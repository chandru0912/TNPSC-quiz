# TNPSC Study Hub — Phase 1 Implementation Plan

* **Author:** Chandru
* **Date:** 2026-11-16
* **Mode:** Read-Only Planning (No files, database records, indexes, or Vercel configs modified)
* **Parent Roadmap:** [tnpsc_study_hub_architecture_roadmap.md](file:///d:/moonzoro/TNPSC%20quiz/docs/designs/tnpsc_study_hub_architecture_roadmap.md)

---

## 1. Executive Summary & Preservation Guarantees

Phase 1 hardens **database connection pooling**, **TLS verification**, **cold-start overhead**, and **high-frequency `COUNT(*)` / `study_notes` query paths** without altering any database schema, deleting or modifying indexes, changing Vercel deployment configuration (`vercel.json`), touching Phase 2 worker infrastructure, or breaking any existing API response contracts.

**Strict Preservation Checklist:**
- Zero deletions, truncations, or mutations of existing PostgreSQL records.
- All published `questions.id` values, `correct_answer` indices, student accounts, attempts, marks, and progress history remain untouched.
- All 72 textbook records and Google Drive folder structures remain untouched.
- All existing API routes, JSON response fields (`status`, `total`, `count`, `metrics`, `filteredTotal`, `data`), and frontend behaviors remain intact.
- Existing uncommitted local changes in the workspace remain untouched.

---

## 2. Neon PostgreSQL Diagnostic Summary (Baseline)

Observed via read-only diagnostics (`neon_diag.cjs`):
- **Local Dev DB State**: `60 MB`, `max_connections: 100`, `9` active/idle connections; `questions`: 33 (`published`: 33, `staging`: 0), `students`: 9, `question_attempts`: 40, `study_notes`: 33, `textbooks`: 72.
- **Connection Pooling Gap (`backend/src/db.ts`)**: Hardcodes `max: 10` per `Pool` regardless of serverless vs. long-running environment, does not enforce Neon's `-pooler` endpoint in serverless runtime, sets `ssl: { rejectUnauthorized: false }`, and executes 5 synchronous `dotenv.config()` calls on every cold start.
- **Live Cold-Start Latency**: `GET https://tnpsc-quiz-lval.vercel.app/api/study-materials/questions?group=group1&subjectId=general-studies&standard=6&unitId=1&lessonTitle=Measurements%20and%20SI%20Units&limit=300` measured **4,594 ms** (HTTP 200).
- **Excessive `COUNT(*)` Queries**:
  - `GET /api/questions` (`questions.ts#L288-L299`) and `GET /api/study-materials/questions` (`studyMaterialQuestions.ts#L127-L138`) run a separate `SELECT COUNT(*) AS total` sequentially before `SELECT *` on every student quiz load, even when `offset = 0` and fewer than `limit` rows exist.
  - `GET /api/questions/admin` (`questions.ts#L514-L540`) and `GET /api/study-materials/questions/admin` (`studyMaterialQuestions.ts#L286-L315`) run 3 sequential queries (`metricsResult` full-table scan, `filteredTotal` count, and `data` fetch) on every admin filter change.
  - `GET /api/notes` (`notes.ts#L254`) and `GET /api/notes/admin` (`notes.ts#L418-L480`) run sequential `COUNT(*)` + metrics queries.
- **`study_notes` Scan & Index Observations (Read-Only)**:
  - `study_notes` showed **113,652 sequential scans** vs. **6 index scans** (`33 live / 32 dead` rows, ~50% bloat) and **12 indexes**.
  - Because `study_notes` is small (33 rows), PostgreSQL's planner chooses 1-page sequential scans over index scans. The real driver of 113k scans is correlated per-lesson/per-topic subqueries in `studyManagementService.ts` (`#L1465, #L1520-L1521, #L1794-L1795, #L2193, #L2219-L2220`) using `OR` (`sn.lesson_id = l.id OR LOWER(sn.lesson_title) = LOWER(l.title)`). **No indexes will be deleted or modified in Phase 1.**
- **Per-Request Schema Check Middleware**: `drive.ts` (`#L57`) and `textbooks.ts` (`#L48`) call `await ensureDatabaseSchema()` in router middleware on every request.

---

## 3. Exact Files & Changes Planned

### Change 1: Neon Pooled `DATABASE_URL` (`max: 1–2`), `DIRECT_URL`, TLS, and Cold-Start Env Loading
* **File**: [backend/src/db.ts](file:///d:/moonzoro/TNPSC%20quiz/backend/src/db.ts#L1-L60)
* **Current Behavior**:
  - Runs 5 synchronous `dotenv.config()` calls unconditionally on module load (`#L6-L10`).
  - Uses `max: 10`, `idleTimeoutMillis: 15000`, `connectionTimeoutMillis: 8000` for all environments (`#L29-L50`).
  - Sets `ssl: isProductionOrCloud ? { rejectUnauthorized: false } : undefined` (`#L28, #L36, #L47`), disabling TLS certificate verification.
  - Has no separation between pooled runtime URL (`DATABASE_URL` with `-pooler`) and unpooled `DIRECT_URL`.
* **Proposed Behavior**:
  - Gate `dotenv.config()` calls behind `if (!process.env.VERCEL)` so serverless cold starts skip unnecessary filesystem lookups.
  - Detect serverless runtime via `const isServerless = Boolean(process.env.VERCEL);` and set `max: isServerless ? 2 : 10`, `idleTimeoutMillis: isServerless ? 5000 : 15000`, `allowExitOnIdle: isServerless`.
  - Export `getDirectDatabaseUrl()` (reading `process.env.DIRECT_URL || connectionString`) for future CLI migrations/DDL while runtime `pool` uses `DATABASE_URL` (Neon `-pooler` in Vercel env).
  - Replace `{ rejectUnauthorized: false }` with `ssl: isProductionOrCloud ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined` (enforcing TLS cert verification by default on Neon while preserving an emergency env override if a self-signed proxy is ever used).
* **Risk Level**: **Medium** — If Neon's `-pooler` is enabled in Vercel without testing, any named prepared statement would fail; `node-postgres` (`pg`) uses unnamed simple/extended queries by default unless `name` is explicitly passed.

### Change 2: Optimize Public `COUNT(*)` Queries (Backward-Compatible Contract)
* **Files**:
  - [backend/src/routes/questions.ts](file:///d:/moonzoro/TNPSC%20quiz/backend/src/routes/questions.ts#L288-L310) (`GET /api/questions`)
  - [backend/src/routes/studyMaterialQuestions.ts](file:///d:/moonzoro/TNPSC%20quiz/backend/src/routes/studyMaterialQuestions.ts#L127-L150) (`GET /api/study-materials/questions`)
  - [backend/src/routes/notes.ts](file:///d:/moonzoro/TNPSC%20quiz/backend/src/routes/notes.ts#L254-L270) (`GET /api/notes`)
* **Current Behavior**:
  - Executes `SELECT COUNT(*) AS total` sequentially *before* `SELECT * FROM ... LIMIT $n OFFSET $m` on every public request.
* **Proposed Behavior**:
  - Fetch `SELECT *` first. When `safeOffset === 0 && rows.length < safeLimit`, compute `totalCount = rows.length` directly in JS without executing `SELECT COUNT(*)` at all (covers 95%+ of lesson-wise student fetches, where lessons have 5–100 questions and `limit=300`).
  - Only when `rows.length === safeLimit || safeOffset > 0` (truncated page), run `SELECT COUNT(*) AS total`.
  - Keep `total`, `count`, `limit`, `offset`, `data` JSON fields 100% identical.
* **Risk Level**: **Low** — JSON response shape is unchanged; `total` remains exact.

### Change 3: Parallelize & Cache Admin `metricsResult` Queries
* **Files**:
  - [backend/src/routes/questions.ts](file:///d:/moonzoro/TNPSC%20quiz/backend/src/routes/questions.ts#L508-L556) (`GET /api/questions/admin`)
  - [backend/src/routes/studyMaterialQuestions.ts](file:///d:/moonzoro/TNPSC%20quiz/backend/src/routes/studyMaterialQuestions.ts#L284-L327) (`GET /api/study-materials/questions/admin`)
  - [backend/src/routes/notes.ts](file:///d:/moonzoro/TNPSC%20quiz/backend/src/routes/notes.ts#L418-L485) (`GET /api/notes/admin`)
* **Current Behavior**:
  - Runs `metricsResult`, `countQuery`, and `dataQuery` sequentially (3 DB round-trips per admin filter change).
* **Proposed Behavior**:
  - Cache `metricsResult` per `targetSystem` in `backend/src/utils/cache.ts` (30s TTL, invalidated on `POST`/`PATCH`/`DELETE`/`publish` in those routers) and run `countQuery` + `dataQuery` in parallel via `Promise.all` (also skipping `countQuery` when `safeOffset === 0 && rows.length < safeLimit`).
  - Preserve exact `metrics` (`totalQuestions`, `stagingCount`, `publishedCount`, `pendingReviewCount`, `unitsCount`, `classesCount`) and `filteredTotal` fields required by [Admin.tsx](file:///d:/moonzoro/TNPSC%20quiz/src/pages/Admin.tsx#L1291-L1294).
* **Risk Level**: **Low** — Metrics may be up to 30s stale across serverless instances if updated elsewhere, with instant invalidation on the mutating instance.

### Change 4: Optimize `study_notes` Correlated Subqueries in `studyManagementService.ts`
* **File**: [backend/src/services/studyManagementService.ts](file:///d:/moonzoro/TNPSC%20quiz/backend/src/services/studyManagementService.ts#L1465-L1525) (and `#L1794-L1795`, `#L2193`, `#L2219-L2220`)
* **Current Behavior**:
  - Executes per-row correlated subqueries `EXISTS (SELECT 1 FROM study_notes sn WHERE sn.lesson_id = l.id OR LOWER(sn.lesson_title) = LOWER(l.title))` and `(SELECT COUNT(*) ...)` for every lesson/topic in the syllabus tree, driving 113,652 sequential scans on `study_notes`.
* **Proposed Behavior**:
  - Pre-aggregate `study_notes` counts/IDs once per query using a CTE (`WITH notes_by_lesson AS (...), notes_by_topic AS (...)`) or `LEFT JOIN` instead of per-row correlated `OR` subqueries, without modifying any table schema or indexes.
* **Risk Level**: **Medium** — Must verify exact parity on `has_notes`, `notes_count`, and `notes_id` for lessons/topics matched by `lesson_id` vs. `LOWER(lesson_title)`.

### Change 5: Gate `ensureDatabaseSchema()` Middleware Behind Cold-Start Flag
* **Files**:
  - [backend/src/routes/drive.ts](file:///d:/moonzoro/TNPSC%20quiz/backend/src/routes/drive.ts#L55-L60)
  - [backend/src/routes/textbooks.ts](file:///d:/moonzoro/TNPSC%20quiz/backend/src/routes/textbooks.ts#L46-L51)
* **Current Behavior**:
  - Calls `await ensureDatabaseSchema()` in `router.use` on every `/api/drive/*` and `/api/textbooks/*` request (already memoized in `migrate.ts` after first success, but still executes a promise check on every request and runs `to_regclass` on cold starts).
* **Proposed Behavior**:
  - Keep `ensureDatabaseSchema()` only when `process.env.SKIP_RUNTIME_SCHEMA_CHECK !== 'true'` so production Vercel can opt out of runtime DDL checks once pre-deploy migrations are verified, while local dev continues to auto-initialize safely.
* **Risk Level**: **Low** — Default behavior remains unchanged unless `SKIP_RUNTIME_SCHEMA_CHECK=true` is explicitly set.

---

## 4. Frontend & Backend Dependency Impact Analysis

| Endpoint / Module | Consumers Verified | Expected Impact |
| --- | --- | --- |
| `GET /api/questions` | [MCQPractice.tsx](file:///d:/moonzoro/TNPSC%20quiz/src/pages/MCQPractice.tsx#L149-L185) | Reads `data.status` and `data.data` only. `total` remains exact. **Zero breakage.** |
| `GET /api/study-materials/questions` | [StudyMaterialsPractice.tsx](file:///d:/moonzoro/TNPSC%20quiz/src/pages/StudyMaterialsPractice.tsx#L178-L189) | Reads `data.status` and `data.data` only. `total` remains exact. **Zero breakage.** |
| `GET /api/questions/admin` & `/api/study-materials/questions/admin` | [Admin.tsx](file:///d:/moonzoro/TNPSC%20quiz/src/pages/Admin.tsx#L1269-L1295) | Reads `data.data`, `data.metrics`, `data.filteredTotal`. All preserved identically. **Zero breakage.** |
| `GET /api/notes` & `/api/notes/admin` | `StudyNotesPage.tsx`, `Admin.tsx` | `total`, `metrics`, `data` preserved identically. **Zero breakage.** |
| `backend/src/db.ts` (`pool`) | All 16 backend routes & 35 services | `pool.query` interface unchanged; `max: 2` on Vercel reduces concurrent idle sockets without changing query semantics. |

---

## 5. Before-and-After Performance Benchmarks & Regression Tests

### Benchmarks (To Measure Before & After on Local + Cloned Neon Branch)
1. **DB Round-Trips per `GET /api/study-materials/questions` (lesson < 300 MCQs)**:
   - *Before*: 2 sequential queries (`COUNT(*)` + `SELECT *`).
   - *After*: 1 query (`SELECT *`), saving 1 full Neon network round-trip (~15–40 ms warm, more under load).
2. **DB Round-Trips per `GET /api/questions/admin`**:
   - *Before*: 3 sequential queries (`metricsResult` + `filteredTotal` + `data`).
   - *After*: 1–2 parallel queries (`metrics` cached for 30s; `filteredTotal` skipped when `rows < limit`), cutting admin filter latency by ~50–65%.
3. **Concurrent Lambda Pool Pressure (k6 / Artillery 200 concurrent users)**:
   - *Before*: `max: 10` per Lambda against direct Neon (`max_connections: 100`) → fails above ~10–15 concurrent Lambdas.
   - *After*: `max: 2` per Lambda against Neon `-pooler` → supports 150+ concurrent Lambdas with zero `connection slots reserved` errors.
4. **`study_notes` Scans per Syllabus Tree Load**:
   - *Before*: N correlated subqueries per tree load (113,652 seq_scans observed).
   - *After*: 2 pre-aggregated CTEs/queries per tree load.

### Regression Test Cases
1. **PgBouncer Transaction-Mode Smoke Test**: Execute `GET /api/questions`, `GET /api/study-materials/questions`, `POST /api/study-materials/questions/translate`, `GET /api/notes`, and `GET /api/textbooks` against a Neon `-pooler` connection string; assert HTTP 200 and zero `prepared statement does not exist` errors.
2. **`total` / `filteredTotal` / `metrics` Parity Test**: Compare `total`, `filteredTotal`, `metrics`, and `data` arrays before and after optimization across `offset=0` (`rows < limit`), `offset=0` (`rows == limit`), and `offset > 0`; assert 100% identical JSON payloads.
3. **Syllabus Notes Parity Test**: Compare `studyManagementService` tree output (`has_notes`, `notes_count`, `notes_id`) before and after CTE rewrite; assert deep equality across all groups/units/lessons/topics.
4. **TLS & Auth Verification**: Verify `db.ts` connects cleanly to Neon with `rejectUnauthorized: true` and `Admin.tsx` login/publish/delete still invalidates `metrics` cache.

---

## 6. Estimated Implementation Sequence & Rollback Strategy

### Sequence (Once Approved)
1. Update `backend/src/db.ts` (serverless `max: 2`, `allowExitOnIdle: true`, gated `dotenv`, `DIRECT_URL` helper, TLS default `true`).
2. Optimize `GET /api/questions`, `GET /api/study-materials/questions`, and `GET /api/notes` (`COUNT(*)` skip when `offset === 0 && rows.length < limit`).
3. Parallelize + cache `metricsResult` in `questions.ts`, `studyMaterialQuestions.ts`, and `notes.ts`.
4. Rewrite correlated `study_notes` subqueries in `studyManagementService.ts` using CTEs/pre-aggregation.
5. Add `SKIP_RUNTIME_SCHEMA_CHECK` env gate in `drive.ts` and `textbooks.ts`.
6. Run `tsc --noEmit`, `npm run build`, and parity/concurrency tests before any Neon env switch or deploy.

### Rollback Strategy (Per Change)
* **Change 1 (`db.ts` / `-pooler`)**: Revert `DATABASE_URL` in Vercel env vars to the previous value or set `PG_SSL_REJECT_UNAUTHORIZED=false` if TLS fails; `git checkout -- backend/src/db.ts` reverts pool sizing in one commit.
* **Changes 2 & 3 (`COUNT(*)` / `metricsResult`)**: Purely localized to route handlers; reverting those commits restores sequential `COUNT(*)` with zero DB state impact.
* **Change 4 (`studyManagementService.ts` CTE)**: Read-only query refactor; reverting restores original SQL immediately.
* **Change 5 (`SKIP_RUNTIME_SCHEMA_CHECK`)**: Unset env var or set `false` to re-enable runtime schema checks without code deploy.

---

**Awaiting explicit approval before editing any source code or environment configuration.**
