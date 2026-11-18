# Phase 1: Database, Serverless & Security Hardening - Research

**Researched:** 2026-11-19
**Domain:** Node.js / Express 4 / PostgreSQL (Neon Serverless) / Security Hardening
**Confidence:** HIGH

## Summary

Phase 1 hardens the Express + Neon PostgreSQL backend for Vercel serverless deployment and 50k-scale workloads across two tracks: database/serverless performance (`DB-01`..`DB-04`) and authentication/network security (`SEC-01`..`SEC-04`). Direct inspection of the backend codebase shows that several partial optimizations are already in place—`backend/src/db.ts` already gates `dotenv.config()` behind `if (!process.env.VERCEL)` and sets `idleTimeoutMillis: 5000` and `allowExitOnIdle: isServerless`, public `GET` routes in `questions.ts`, `studyMaterialQuestions.ts`, and `notes.ts` already skip `COUNT(*)` when `safeOffset === 0 && rows.length < safeLimit`, and `metricsResult` already uses a 30s TTL cache via `backend/src/utils/cache.ts`.

However, critical gaps remain in every requirement: `backend/src/server.ts` still calls `dotenv.config()` unconditionally at top-level, `db.ts` sets `max: 2` instead of `max: 3` on Vercel, `migrate.ts` runs DDL over the pooled `pool` instead of `DIRECT_URL`, `ensureDatabaseSchema()` is invoked unconditionally in `server.ts`, `drive.ts`, and `textbooks.ts`, `/admin` question/note endpoints still run unconditional `COUNT(*)` queries, `questions` lacks partial `WHERE status = 'published'` indexes, `study_notes` carries 13 overlapping indexes, and `mcq_generation_jobs` uses default `FILLFACTOR = 100`. On the security side, `middleware/auth.ts` has hardcoded fallback JWT secrets, an unconditional `NODE_ENV !== 'production'` admin auth bypass, `?token=` query-string acceptance across all three auth middlewares, and a fail-open `catch` block in `requireStudentAuth`; `routes/auth.ts` stores and compares `admin_users` passwords in plaintext; `server.ts` uses wildcard Vercel CORS regexes; and no `express-rate-limit` middleware is installed.

**Primary recommendation:** Implement all `DB-01`..`DB-04` pool, gating, partial-index/`FILLFACTOR`, and `/admin` `COUNT(*)` fixes alongside `SEC-01`..`SEC-04` secret fail-fast, `scrypt` admin hashing, fail-closed student auth, strict `Bearer`-only auth, explicit `CORS_ORIGIN`/`FRONTEND_URL` allowlisting, and `express-rate-limit` with `trust proxy` enabled.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Query Token Removal & SSE Auth (`SEC-03`):**
  - Reject `?token=` query-string authentication everywhere immediately with HTTP `401` in `backend/src/middleware/auth.ts` (`requireAdminAuth`, `requireStudentAuth`, `optionalStudentAuth`).
  - Standardize strictly on `Authorization: Bearer <token>` headers.
  - `Dashboard.tsx` SSE (`/api/student/dashboard/stream`) already uses `fetch` with `Authorization: Bearer`, so no frontend `EventSource` workaround is needed.
- **DB-01:** `pg.Pool` `max: 3` on Vercel serverless (`idleTimeoutMillis: 5000`, `allowExitOnIdle: true`), `DATABASE_URL` (`-pooler`) for runtime queries, `DIRECT_URL` for migrations/DDL, TLS `rejectUnauthorized` toggle, and `dotenv.config()` gated behind `if (!process.env.VERCEL)`.
- **DB-02:** Gate `ensureDatabaseSchema()` behind `process.env.SKIP_RUNTIME_SCHEMA_CHECK !== 'true'` with zero mutations or deletions of existing records.
- **DB-03 / DB-04:** Preserve exact JSON response fields on `/api/questions`, `/api/study-materials/questions`, `/api/notes`, and `/admin` variants while optimizing queries, partial indexes, 30s TTL cache on admin `metricsResult`, and `FILLFACTOR = 70` on `mcq_generation_jobs`.
- **SEC-01 / SEC-02 / SEC-04:** Fail fast in production if `ADMIN_JWT_SECRET` or `STUDENT_JWT_SECRET` is unset, gate dev auth bypass behind `ALLOW_DEV_AUTH_BYPASS=true`, verify `admin_users` with `scrypt`, fail closed on DB errors in `requireStudentAuth`, restrict CORS to explicit `CORS_ORIGIN`/`FRONTEND_URL` origins, and apply `express-rate-limit` to auth and AI generation routes.
- Reject `?token=` across all auth middlewares unconditionally (no dev-mode query-token exception).

### the agent's Discretion
- Exact rate-limit window/max thresholds for login, registration, and AI generation endpoints (`SEC-04`).
- Exact partial index names and `CONCURRENTLY` migration script structure (`DB-03`, `DB-04`).
- Production CORS origin parsing when `CORS_ORIGIN` and `FRONTEND_URL` are both set (`SEC-03`).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within Phase 1 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DB-01 | Configure dual PostgreSQL URLs (`DATABASE_URL` Neon `-pooler` `max: 3` on Vercel, `idleTimeoutMillis: 5000`, `allowExitOnIdle: true`; `DIRECT_URL` unpooled for migrations/DDL), TLS toggle, and `dotenv.config()` gated behind `if (!process.env.VERCEL)` | `backend/src/db.ts:6-36` already has `dotenv` gating, `idleTimeoutMillis`, `allowExitOnIdle`, and `PG_SSL_REJECT_UNAUTHORIZED`; needs `max: 3`, `server.ts:5-9` `dotenv` gating, and `migrate.ts` using `getDirectDatabaseUrl()` |
| DB-02 | Gate `ensureDatabaseSchema()` in `drive.ts` and `textbooks.ts` behind `SKIP_RUNTIME_SCHEMA_CHECK !== 'true'` with zero record mutations | `drive.ts:57`, `textbooks.ts:48`, `server.ts:317`, and `migrate.ts:1333` identified; gating inside `ensureDatabaseSchema()` + call sites eliminates runtime schema checks when `SKIP_RUNTIME_SCHEMA_CHECK=true` |
| DB-03 | Optimize `/api/questions`, `/api/study-materials/questions`, `/api/notes`, and `/admin` variants with partial published indexes, skipped `COUNT(*)` when `safeOffset === 0 && rows.length < safeLimit`, 30s TTL cache on `metricsResult`, and CTE/`LEFT JOIN` replacements | Public `GET` routes already skip `COUNT(*)` and `/admin` routes already cache `metricsResult` 30s; `/admin` routes still run unconditional `COUNT(*)`, and `questions` lacks partial `WHERE status = 'published'` indexes |
| DB-04 | Apply 50k-scale DB hygiene (`FILLFACTOR = 70` on `mcq_generation_jobs`, drop redundant `study_notes` indexes `CONCURRENTLY`) and verify SLOs (<120 ms quiz p95, <30 ms admin metrics, <25 ms lesson lookup) | `mcq_generation_jobs` (`migrate.ts:698`) has default fillfactor; `study_notes` has 13 indexes (`migrate.ts:86-94, 364-376, 927`) with redundant `idx_study_notes_lesson_status` / `idx_study_notes_status` |
| SEC-01 | Fail fast on production startup if `ADMIN_JWT_SECRET` or `STUDENT_JWT_SECRET` is missing, and gate dev auth bypass behind `ALLOW_DEV_AUTH_BYPASS=true` | `middleware/auth.ts:5-7, 112-114` have hardcoded fallback secrets; `73-76, 86-89` bypass auth whenever `NODE_ENV !== 'production'` |
| SEC-02 | Hash all `admin_users` passwords with `scrypt` and fail closed on DB lookup errors in `requireStudentAuth` | `routes/auth.ts:25-54, 80-89, 133, 177, 322` store/compare plaintext; `middleware/auth.ts:245-247` swallows `dbErr` and calls `next()` |
| SEC-03 | Remove `?token=` query-string fallback across auth middleware and restrict production CORS in `server.ts` to explicit `CORS_ORIGIN` / `FRONTEND_URL` values | `middleware/auth.ts:68-70, 190-192, 260-262` read `req.query.token`; `server.ts:44-98` uses hardcoded preview URLs and wildcard Vercel regexes |
| SEC-04 | Add `express-rate-limit` middleware protecting login, registration, and AI generation endpoints (`auth.ts`, `student.ts`, `aiGeneration.ts`) | Not installed yet (`express-rate-limit` v8.7.4 available); requires `app.set('trust proxy', 1)` in `server.ts` for Vercel |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Serverless Connection Pooling & Direct DDL | Database / Storage (`db.ts`, `migrate.ts`) | — | `pg.Pool` sizing (`max: 3`), Neon `-pooler` vs `DIRECT_URL`, and TLS belong strictly in the DB connection/migration layer |
| Runtime Schema Check Gating | API / Backend (`server.ts`, `drive.ts`, `textbooks.ts`, `migrate.ts`) | — | Middleware and `ensureDatabaseSchema()` guard prevent per-cold-start DDL probes on serverless requests |
| Query Optimization, Partial Indexes & Fillfactor | Database / Storage + API (`questions.ts`, `studyMaterialQuestions.ts`, `notes.ts`) | — | Index selectivity and `FILLFACTOR = 70` live in PostgreSQL DDL; conditional `COUNT(*)` skip and 30s TTL cache live in Express route handlers |
| Secret Validation, `scrypt` Hashing, Bearer Auth & Rate Limiting | API / Backend (`middleware/auth.ts`, `routes/auth.ts`, `routes/student.ts`, `routes/aiGeneration.ts`) | — | All token verification, password hashing, CORS enforcement, and rate limiting must execute server-side before business logic |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | `^8.23.1` [VERIFIED: `backend/package.json:29`] | PostgreSQL client & `Pool` | Already installed and used across all backend routes/services |
| `express` | `^4.22.3` [VERIFIED: `backend/package.json:25`] | HTTP server & middleware | Existing backend framework |
| `cors` | `^2.8.6` [VERIFIED: `backend/package.json:23`] | CORS header middleware | Already mounted in `backend/src/server.ts:12, 116-117` |
| `node:crypto` | Built-in (Node `v24.22.1` [VERIFIED: `node --version`]) | `scryptSync`, `timingSafeEqual`, HMAC-SHA256 | Already used in `backend/src/middleware/auth.ts:2, 277-295` for student passwords and JWTs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `express-rate-limit` | `8.7.4` [VERIFIED: `npm view express-rate-limit version`] `[WARNING: flagged as suspicious — verify before using.]` | IP-based rate limiting on auth & AI routes | Required by `SEC-04` on `auth.ts`, `student.ts`, `aiGeneration.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `express-rate-limit` (in-memory store) | Upstash Redis rate limiter | `express-rate-limit` is explicitly locked by `SEC-04`; in-memory store is per-Lambda instance on Vercel (acceptable for Phase 1; Redis store can be plugged in later if needed) |

**Installation:**
```bash
npm install express-rate-limit --prefix backend
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `express-rate-limit` (`8.7.4`) | npm | `2026-11-09T21:18:58.188Z` (latest release flagged `too-new`) | 99,847,922/wk | `git+https://github.com/express-rate-limit/express-rate-limit.git` | `[SUS]` | Flagged — planner must add `checkpoint:human-verify` before install |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `express-rate-limit` (`8.7.4`, `postinstall: null`, flagged `too-new` by `gsd-tools query package-legitimacy check`) — planner must insert `checkpoint:human-verify` before running `npm install express-rate-limit --prefix backend`.

## Architecture Patterns

### System Architecture Diagram

```text
Client (SPA / API Caller)
  │  Authorization: Bearer <token>   (reject ?token= -> 401)
  ▼
Express Server (server.ts)
  ├── trust proxy = 1
  ├── CORS allowlist (CORS_ORIGIN + FRONTEND_URL in production)
  ├── Rate Limiters (SEC-04: /api/admin/login, /api/student/{login,register,forgot-password,reset-password,auth/google}, /api/ai/generate)
  └── Auth Middleware (middleware/auth.ts)
        ├── requireAdminAuth  ──► verifyAdminToken (ADMIN_JWT_SECRET, fail-fast in prod; dev bypass ONLY if ALLOW_DEV_AUTH_BYPASS=true)
        ├── requireStudentAuth ─► verifyStudentToken (STUDENT_JWT_SECRET) ──► pool.query(students) [FAIL CLOSED on DB error -> 503]
        └── optionalStudentAuth ► verifyStudentToken (reject ?token= -> 401)
  │
  ▼
Route Handlers (questions.ts, studyMaterialQuestions.ts, notes.ts, drive.ts, textbooks.ts)
  ├── ensureDatabaseSchema() ─► short-circuit if SKIP_RUNTIME_SCHEMA_CHECK === 'true'
  ├── 30s TTL Cache (utils/cache.ts) for admin metricsResult
  └── Skip COUNT(*) when safeOffset === 0 && rows.length < safeLimit
  │
  ▼
PostgreSQL (db.ts)
  ├── Runtime: pg.Pool (DATABASE_URL -pooler, max: 3 on VERCEL, idleTimeoutMillis: 5000, allowExitOnIdle: true)
  └── Migrations / CONCURRENTLY DDL: DIRECT_URL (unpooled, outside BEGIN/COMMIT)
```

### Pattern 1: Exact `DB-01` Dual-URL Pool & `dotenv` Gating
**What:** Ensure `dotenv.config()` never runs on Vercel in both `server.ts` and `db.ts`, set `max: 3` on serverless, and use `DIRECT_URL` in `migrate.ts` when run directly or for DDL scripts.
**Current state in repo:**
- `backend/src/db.ts:6-12` already gates `dotenv.config()` with `if (!process.env.VERCEL)`.
- `backend/src/server.ts:5-9` calls `dotenv.config()` **unconditionally** at lines 5-9. Wrap lines 5-9 in `if (!process.env.VERCEL) { ... }`.
- `backend/src/db.ts:32` sets `max: isServerless ? 2 : 10`. Change `2` to `3` per `DB-01` (`max: isServerless ? 3 : 10`).
- `backend/src/migrate.ts:4` calls `pool.connect()` (which uses `DATABASE_URL`). Add a helper in `db.ts` or `migrate.ts` using `getDirectDatabaseUrl()` (`backend/src/db.ts:27-29`) when `DIRECT_URL` is set so `runMigration()` and standalone `CONCURRENTLY` index scripts connect directly without Neon `-pooler` transaction-pooling restrictions.

### Pattern 2: `DB-02` Runtime Schema Check Gating
**What:** Gate `ensureDatabaseSchema()` behind `process.env.SKIP_RUNTIME_SCHEMA_CHECK !== 'true'`.
**Where it is called:**
1. `backend/src/migrate.ts:1333` (`export function ensureDatabaseSchema()`) — add early return `if (process.env.SKIP_RUNTIME_SCHEMA_CHECK === 'true') return Promise.resolve();` as the canonical guard.
2. `backend/src/server.ts:315-322` (`requireSchemaMiddleware`) — optionally skip calling `ensureDatabaseSchema()` when `process.env.SKIP_RUNTIME_SCHEMA_CHECK === 'true'`.
3. `backend/src/routes/drive.ts:57` and `backend/src/routes/textbooks.ts:48` — guard `if (process.env.SKIP_RUNTIME_SCHEMA_CHECK !== 'true') { await ensureDatabaseSchema(); }` explicitly as required by `DB-02`.

### Pattern 3: `DB-03` & `DB-04` Partial Indexes, `/admin` `COUNT(*)` Skip, and `CONCURRENTLY` Hygiene
**What:**
1. **Admin `COUNT(*)` skip:** In `questions.ts:762-780` (`GET /api/questions/admin`), `studyMaterialQuestions.ts:305-330` (`GET /api/study-materials/questions/admin`), and `notes.ts:429-461` (`GET /api/notes/admin`), run `dataQuery` (and cached/live `metricsResult`) first or conditionally skip `countQuery` when `safeOffset === 0 && dataResult.rows.length < safeLimit`, setting `filteredTotal = dataResult.rows.length` (or `total = dataResult.rows.length` in `notes.ts`). Preserve exact JSON response keys (`filteredTotal` in `questions.ts`/`studyMaterialQuestions.ts`, `total` in `notes.ts`).
2. **Partial published-question indexes (`DB-03`):** Add partial indexes with `WHERE status = 'published'`:
   - `idx_questions_published_main` on `questions (category, unit_id, id)` `WHERE status = 'published'`
   - `idx_questions_published_sm` on `questions (target_system, exam_group_id, subject_id, standard_id, unit_id, lesson_id, id)` `WHERE status = 'published'`
   - `idx_questions_published_lesson_id` on `questions (lesson_id, id)` `WHERE status = 'published'`
3. **`FILLFACTOR = 70` & redundant `study_notes` index cleanup (`DB-04`):**
   - `ALTER TABLE mcq_generation_jobs SET (fillfactor = 70);`
   - Drop redundant `study_notes` indexes `CONCURRENTLY`: `idx_study_notes_lesson_status` (covered by `idx_study_notes_lookup` at `migrate.ts:375`) and `idx_study_notes_status` (low-cardinality 3-value column at `migrate.ts:927`). Remove their `CREATE INDEX IF NOT EXISTS` statements from `migrate.ts` so future migrations do not recreate them.

### Pattern 4: `SEC-01`..`SEC-04` Auth, CORS & Rate-Limiting
**What:**
1. **Fail-fast secrets (`SEC-01`):**
   - Remove `'tnpsc_quiz_admin_jwt_secret_key_2026'` (`auth.ts:6`) and `'tnpsc_student_session_secret_key_2026'` (`auth.ts:113`).
   - Add `assertProductionSecrets()` called at module load / startup in `server.ts` (before `app.listen` and on serverless cold start): if `process.env.NODE_ENV === 'production'` and (`!process.env.ADMIN_JWT_SECRET` or `!process.env.STUDENT_JWT_SECRET`), throw an `Error` immediately. In non-production, require env vars or an explicit dev fallback only when `NODE_ENV !== 'production'`.
2. **Explicit dev auth bypass (`SEC-01`):**
   - In `requireAdminAuth` (`middleware/auth.ts:73-76, 86-89`), replace `process.env.NODE_ENV !== 'production'` with `process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_AUTH_BYPASS === 'true'`.
3. **`scrypt` for `admin_users` (`SEC-02`):**
   - Reuse `hashStudentPassword` / `verifyStudentPassword` (or rename/alias to `hashPassword` / `verifyPassword`) in `middleware/auth.ts:277-295`.
   - In `routes/auth.ts`:
     - `POST /users` (`line 322`): hash `cleanPass` with `hashPassword(cleanPass)` before `INSERT`.
     - `POST /login` (`line 177`): verify `user.password` using `verifyPassword(cleanPass, user.password)`. For seamless transition of any legacy plaintext rows in `admin_users`, if `user.password` does not contain `:` (not `salt:hex` format), compare in non-production or upgrade-on-login in a migration, OR hash all existing plaintext `admin_users.password` rows during migration (`DB` backfill where `password NOT LIKE '%:%'`).
     - In `ensureAdminUsersTable()` (`lines 25-54`) and `getEnvAdmins()` (`lines 80-89`): in `NODE_ENV === 'production'`, do NOT seed hardcoded default passwords (`'tnpscadmin2026'`, `'tnpsccontent2026'`, `'tnpscreview2026'`); only use `ADMIN_USERNAME`/`ADMIN_PASSWORD` / `ADMIN_USERS` if explicitly set.
4. **Fail-closed `requireStudentAuth` (`SEC-02`):**
   - In `middleware/auth.ts:245-247`, replace the silent `catch (dbErr) { console.error(...); }` with `return res.status(503).json({ status: 'error', message: 'Authentication verification temporarily unavailable. Please try again.' });`.
5. **Reject `?token=` everywhere (`SEC-03`, locked):**
   - In `requireAdminAuth`, `requireStudentAuth`, and `optionalStudentAuth` (`middleware/auth.ts:68-70, 190-192, 260-262`), if `req.query.token !== undefined`, immediately return `res.status(401).json({ status: 'error', message: 'Query string token authentication is not permitted. Use Authorization: Bearer header.' })`.
6. **Explicit production CORS (`SEC-03`):**
   - In `server.ts:44-98`: build `allowedOrigins` from `process.env.CORS_ORIGIN` (comma-separated) + `process.env.FRONTEND_URL` (single or comma-separated), trimming quotes and trailing slashes. In `NODE_ENV === 'production'`, remove the wildcard regexes (`tnpsc-quiz.*\.vercel\.app`, `.*-moonzoro\.vercel\.app`) and reject `*`. Keep `localhost`/`127.0.0.1` only when `NODE_ENV !== 'production'`.
7. **Rate limiting (`SEC-04`):**
   - Set `app.set('trust proxy', 1)` in `server.ts` so `req.ip` reflects the real client IP behind Vercel's proxy.
   - Apply `express-rate-limit` (`standardHeaders: true, legacyHeaders: false`) to:
     - `routes/auth.ts`: `POST /login` (e.g., `windowMs: 15 * 60 * 1000, max: 10`)
     - `routes/student.ts`: `POST /login`, `POST /register`, `POST /forgot-password`, `POST /reset-password`, `POST /auth/google` (e.g., `windowMs: 15 * 60 * 1000, max: 15` for login/oauth, `max: 10` for register/password-reset)
     - `routes/aiGeneration.ts`: `POST /generate` (e.g., `windowMs: 60 * 1000, max: 20`)

### Anti-Patterns to Avoid
- **Running `CONCURRENTLY` inside `BEGIN ... COMMIT`:** PostgreSQL raises `ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`. Never place `CREATE INDEX CONCURRENTLY` or `DROP INDEX CONCURRENTLY` inside `runMigration()`'s `BEGIN ... COMMIT` block (`migrate.ts:8-1301`).
- **Breaking `JSON` response contracts:** Do not rename or omit `filteredTotal`, `total`, `count`, `metrics`, or `data` fields on `/api/questions`, `/api/study-materials/questions`, `/api/notes`, or their `/admin` variants.
- **Changing `optionalStudentAuth` to skip `?token=` check:** Per `01-CONTEXT.md`, `optionalStudentAuth` must also reject `?token=` with HTTP `401` rather than silently ignoring it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom SHA-256 / plaintext comparison | `crypto.scryptSync` + `crypto.timingSafeEqual` (already in `middleware/auth.ts:277-295`) | Prevents rainbow-table and timing attacks; already battle-tested in student auth |
| HTTP Rate Limiting | Custom `Map<ip, count[]>` in Express | `express-rate-limit` (`8.7.4`) | Handles `RateLimit-*` standard headers, sliding/fixed windows, IPv6 normalization, and `trust proxy` |
| TTL Metrics Caching | New cache layer | `getCached` / `setCached` / `invalidateCachePrefix` (`backend/src/utils/cache.ts`) | Already wired into `questions.ts`, `studyMaterialQuestions.ts`, and `notes.ts` |

## Common Pitfalls

### Pitfall 1: `CREATE/DROP INDEX CONCURRENTLY` Inside `runMigration()` Transaction
**What goes wrong:** `runMigration()` in `backend/src/migrate.ts:8` starts with `await client.query('BEGIN')`. Putting `CONCURRENTLY` DDL inside that block causes migration failure.
**How to avoid:** Execute `CONCURRENTLY` index creations/drops in a separate standalone script (or post-`COMMIT` helper) using `getDirectDatabaseUrl()` (`DIRECT_URL`).
**Warning signs:** `ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`.

### Pitfall 2: `express-rate-limit` Keying All Vercel Users to One IP
**What goes wrong:** Without `app.set('trust proxy', 1)` in `backend/src/server.ts`, `req.ip` on Vercel resolves to the reverse proxy IP, causing all students to share a single rate-limit bucket.
**How to avoid:** Add `app.set('trust proxy', 1);` in `backend/src/server.ts` before mounting routes/limiters.

### Pitfall 3: `admin_users` Plaintext Migration Lockout
**What goes wrong:** Switching `POST /api/admin/login` to `verifyStudentPassword` (`scrypt`) without hashing existing plaintext rows in `admin_users` will lock out existing DB-stored admin accounts.
**How to avoid:** Include a one-time idempotent backfill in `migrate.ts` (or in `ensureAdminUsersTable` / login path) that detects rows where `password NOT LIKE '%:%'` (or `!isScryptHash(user.password)`) and hashes them with `hashStudentPassword`.

### Pitfall 4: `server.ts` Mounts `POST /api/admin/login` Directly Before `authRouter`
**What goes wrong:** `backend/src/server.ts:287-289` mounts `app.post(['/api/admin/login', '/admin/login', '/api/api/admin/login'], ... authRouter)`. Putting the rate limiter only on `server.ts:326` (`app.use('/api/admin', authRouter)`) would miss `line 287`!
**How to avoid:** Attach the rate limiter directly inside `backend/src/routes/auth.ts` on `router.post(['/login', '/', '/api/admin/login', '/admin/login'], adminLoginLimiter, ...)` so every mount path is protected.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime & tests | ✓ | `v24.22.1` [VERIFIED: `node --version`] | — |
| npm | Installing `express-rate-limit` | ✓ | `11.19.1` [VERIFIED: `npm --version`] | — |
| PostgreSQL (`DIRECT_URL` / `DATABASE_URL`) | Migration & SLO benchmarks | Not probed (runtime env) | — | Unit/HTTP tests using mocked `pool.query` or local Postgres |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `tsx` + Node `assert` (`http.createServer(app)`) — no Jest/Vitest configured (`backend/package.json:7-12`) |
| Config file | none — see Wave 0 |
| Quick run command | `npx tsx backend/tests/studentAuthOAuth.test.ts` |
| Full suite command | Run each `npx tsx backend/tests/*.test.ts` (no `"test"` script in `backend/package.json`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DB-01 | `pool` uses `max: 3` on `VERCEL=1`, `dotenv` skipped on Vercel | unit | `npx tsx backend/tests/phase1Hardening.test.ts` | ❌ Wave 0 |
| DB-02 | `ensureDatabaseSchema()` skipped when `SKIP_RUNTIME_SCHEMA_CHECK=true` | unit | `npx tsx backend/tests/phase1Hardening.test.ts` | ❌ Wave 0 |
| DB-03 | `/admin` routes skip `COUNT(*)` on `< safeLimit` first page, preserve JSON keys | unit/integration | `npx tsx backend/tests/phase1Hardening.test.ts` | ❌ Wave 0 |
| DB-04 | Partial indexes, `FILLFACTOR = 70`, SLO timing (`EXPLAIN ANALYZE` / benchmark) | integration/manual | `npx tsx backend/scripts/verifyPhase1Db.ts` (against target DB) | ❌ Wave 0 |
| SEC-01 | Missing JWT secrets fail fast in prod; dev bypass requires `ALLOW_DEV_AUTH_BYPASS=true` | unit | `npx tsx backend/tests/phase1Hardening.test.ts` | ❌ Wave 0 |
| SEC-02 | `admin_users` `scrypt` verify; `requireStudentAuth` fails closed (503) on DB error | unit | `npx tsx backend/tests/phase1Hardening.test.ts` | ❌ Wave 0 |
| SEC-03 | `?token=` returns 401 across all 3 auth middlewares; prod CORS rejects unlisted origins | unit | `npx tsx backend/tests/phase1Hardening.test.ts` | ❌ Wave 0 |
| SEC-04 | Auth & AI routes return 429 after threshold | integration | `npx tsx backend/tests/phase1Hardening.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run build --prefix backend && npx tsx backend/tests/phase1Hardening.test.ts`
- **Per wave merge:** `npm run build --prefix backend && npx tsx backend/tests/studentAuthOAuth.test.ts && npx tsx backend/tests/phase1Hardening.test.ts`
- **Phase gate:** TypeScript build (`tsc`) clean + all Phase 1 unit/integration tests green + DB SLO verification before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/phase1Hardening.test.ts` — covers `DB-01`..`DB-03` and `SEC-01`..`SEC-04`
- [ ] `backend/src/scripts/applyPhase1Indexes.ts` (or equivalent standalone `CONCURRENTLY` + `FILLFACTOR` script using `getDirectDatabaseUrl()`) — covers `DB-03` / `DB-04`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `scrypt` password hashing (`crypto.scryptSync` + `timingSafeEqual`), fail-fast `ADMIN_JWT_SECRET`/`STUDENT_JWT_SECRET`, `express-rate-limit` on login/register/reset |
| V3 Session Management | yes | `Authorization: Bearer` header only (reject `?token=` with 401), `token_version` DB check failing closed (`503`) on DB errors |
| V4 Access Control | yes | `ALLOW_DEV_AUTH_BYPASS=true` explicit gate, strict `admin` vs `student` `tokenType`/`role` separation |
| V5 Input Validation | yes | Existing route parameter sanitization + strict CORS origin parsing (`CORS_ORIGIN` / `FRONTEND_URL`) |
| V6 Cryptography | yes | `crypto.scryptSync`, `crypto.timingSafeEqual`, HMAC-SHA256 (`ADMIN_JWT_SECRET` / `STUDENT_JWT_SECRET`) |

### Known Threat Patterns for Express + Neon PostgreSQL

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token leakage in URLs/logs | Information Disclosure | Reject `?token=` with `401` in all auth middlewares (`SEC-03`) |
| Hardcoded/default JWT secrets & dev bypass | Elevation of Privilege | Fail fast on startup in production; gate dev bypass behind `ALLOW_DEV_AUTH_BYPASS=true` (`SEC-01`) |
| Plaintext admin credentials in DB | Information Disclosure | Hash all `admin_users` passwords with `scrypt` (`SEC-02`) |
| Fail-open auth on transient DB outage | Elevation of Privilege | Return `503` in `requireStudentAuth` `catch` block (`SEC-02`) |
| Brute-force login & AI credit exhaustion | Denial of Service / Tampering | `express-rate-limit` + `trust proxy` (`SEC-04`) |
| Overly permissive wildcard CORS | Information Disclosure / CSRF | Explicit `CORS_ORIGIN` + `FRONTEND_URL` allowlist in production (`SEC-03`) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `express-rate-limit` `8.7.4` is safe to install despite `too-new` flag from `gsd-tools query package-legitimacy check` | Standard Stack / Package Legitimacy Audit | Minor version API differences or supply-chain risk if unverified; mitigated by `checkpoint:human-verify` before `npm install` |
| A2 | Live Neon PostgreSQL `EXPLAIN ANALYZE` / SLO timings (<120 ms quiz p95, <30 ms admin metrics, <25 ms lesson lookup) will meet targets once partial indexes and `FILLFACTOR = 70` are applied | Validation Architecture | Requires post-migration verification against target Neon DB |

## Sources

### Primary (HIGH confidence)
- Direct codebase reads: `backend/src/db.ts`, `backend/src/migrate.ts`, `backend/src/server.ts`, `backend/src/middleware/auth.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/student.ts`, `backend/src/routes/questions.ts`, `backend/src/routes/studyMaterialQuestions.ts`, `backend/src/routes/notes.ts`, `backend/src/routes/drive.ts`, `backend/src/routes/textbooks.ts`, `backend/src/routes/aiGeneration.ts`, `backend/src/utils/cache.ts`, `backend/package.json`
- npm registry (`npm view express-rate-limit version`) and `gsd-tools query package-legitimacy check`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages and versions verified directly from `backend/package.json` and npm registry
- Architecture: HIGH - all call sites, line numbers, and existing partial optimizations verified by direct file reads
- Pitfalls: HIGH - transaction-block `CONCURRENTLY` constraint, `server.ts` duplicate `dotenv` / `POST /api/admin/login` mount, and `trust proxy` verified directly in code

**Research date:** 2026-11-19
**Valid until:** 2026-12-19
