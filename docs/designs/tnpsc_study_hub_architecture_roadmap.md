# TNPSC Study Hub — Architecture Improvement Roadmap & Phase 1 Diagnostics

* **Author:** Chandru
* **Date:** 2026-11-16
* **Status:** Proposed (Awaiting Explicit Approval — No Code, Schema, or Deployment Changes Applied)
* **Target Scale:** ~50,000 registered students (~5,000 DAU, 300–1,000 peak concurrent users)

---

## 1. Target Architecture Diagram

```mermaid
flowchart TD
    Student["Student / Admin Browser"] -->|Static SPA + Edge CDN| VercelWeb["Vercel Frontend (React + Vite)"]
    Student -->|100MB PDF Direct Upload| ObjectStore["Cloudflare R2 / S3 (Presigned URL)"]
    VercelWeb -->|Same-Origin /api/*| VercelAPI["Vercel Serverless API (Express)"]
    VercelAPI -->|Stateless Queries (max: 1-2, -pooler)| NeonPool["Neon PgBouncer (-pooler, Tx Mode)"]
    VercelAPI -->|Short Cache / Rate Limit| UpstashRedis["Upstash Redis"]
    VercelAPI -->|Enqueue Short Wakeup / Step| Queue["Durable Queue (QStash / Inngest)"]
    Queue -->|Trigger Batch / Step| Worker["Railway / Render Worker (2 GB RAM)"]
    Worker -->|Read PDF / Write Checkpoints| ObjectStore
    Worker -->|Direct TCP (max: 3-5, DIRECT_URL)| NeonDirect["Neon PostgreSQL (Primary)"]
    Worker -->|Poppler + Tesseract CLI / Cloud OCR| OCR["OCR & AI Providers (Gemini / Claude / Vision)"]
    Worker -->|Pre-Translate on Publish| NeonDirect
```

---

## 2. Phase 1: Read-Only Neon PostgreSQL Diagnostics & Baseline

### 2.1 Current Database Health Report (Observed Baseline)
* **Connection String & Host (`backend/src/db.ts`)**: `isProductionOrCloud: false` on local dev DB; `DATABASE_URL` does not enforce Neon's `-pooler` hostname. `backend/src/db.ts` hardcodes `max: 10` per `Pool`, `ssl: { rejectUnauthorized: false }` (disables TLS cert verification), and runs 5 synchronous `dotenv.config()` calls on cold start.
* **Database Size & Connections**: `60 MB` total size, `max_connections: 100`, `9` active/idle connections during inspection.
* **Observed Row Counts (Local Dev DB)**: `questions`: 33 (`published`: 33, `staging`: 0); `students`: 9; `question_attempts`: 40; `study_notes`: 33; `textbooks`: 72; `mcq_question_translations`: table exists.
* **Live API Baseline Latency**: `GET https://tnpsc-quiz-lval.vercel.app/api/study-materials/questions?group=group1&subjectId=general-studies&standard=6&unitId=1&lessonTitle=Measurements%20and%20SI%20Units&limit=300` measured **4,594 ms** (HTTP 200, cold-start + DB connect overhead).

### 2.2 Connection Exhaustion Risks
* Each Vercel serverless instance creates its own `pg.Pool({ max: 10 })`. Under 50,000-student peak concurrency (100–300 concurrent Lambdas), client connections can spike to 1,000–3,000, exhausting Neon's `max_connections=100` on direct endpoints (`remaining connection slots are reserved`).
* **Transaction-Mode Pooling Pitfall**: Switching `DATABASE_URL` to Neon `-pooler` (PgBouncer transaction mode) breaks session-scoped features (`LISTEN/NOTIFY`, session-level `pg_advisory_lock`, named prepared statements) and cannot run `CREATE INDEX CONCURRENTLY`. Therefore, the system requires **two** connection strings: `DATABASE_URL` (`-pooler`, `max: 1–2`, `allowExitOnIdle: true`) for Vercel runtime, and `DIRECT_URL` (unpooled) for migrations, `CONCURRENTLY` DDL, and persistent worker locks.

### 2.3 Missing / Inefficient Indexes & Table Bloat
* **`study_notes` Bloat & Index Redundancy**: Observed **113,652 sequential scans** vs. **6 index scans** (`33 live / 32 dead rows` = ~50% dead-tuple bloat) and **12 overlapping indexes**. Sequential scans on 33 rows are normal planner behavior (1 heap page < index + heap), meaning the real bug is a **runaway N+1/polling caller** hitting `study_notes` repeatedly plus write amplification from 12 indexes.
* **`mcq_generation_jobs` Update Bloat**: Observed **3,371 sequential scans** vs. **1,061 index scans** (`8 live / 38 dead rows` = ~82% bloat) from frequent job status updates. Needs `FILLFACTOR = 70` for Heap-Only Tuple (HOT) updates.
* **Leading-Wildcard `LIKE` on `questions`**: `backend/src/routes/studyMaterialQuestions.ts` (`#L82-L118`) uses `OR` + `LOWER(lesson_title) LIKE '%...'` and `LOWER(subject) LIKE '%...'`. B-tree indexes (`idx_questions_sm_lookup`) cannot accelerate leading-wildcard `%term%` queries. At 50,000+ questions, heap filtering will degrade linearly.

### 2.4 Slow Query Analysis
* **`GET /api/questions` (Public Student Quiz)**: Runs a separate `SELECT COUNT(*) AS total FROM questions ...` on every quiz fetch (`questions.ts#L288-L290`) alongside `ORDER BY id ASC LIMIT ...`.
* **`GET /api/questions/admin` (`metricsResult`)**: Runs an unfiltered `COUNT(*)` + `COUNT(CASE WHEN ...)` + `COUNT(DISTINCT ...)` across the entire `questions` table on every admin filter change (`questions.ts#L514-L525`).
* **Per-Request DDL Middleware**: `drive.ts` and `textbooks.ts` call `ensureDatabaseSchema()` inside router middleware, adding metadata queries to request paths.

### 2.5 Phase 1 Recommended Optimizations & Performance Targets

| Target Metric | Current Baseline | Phase 1 Target | Optimization |
| --- | --- | --- | --- |
| **Warm Student Quiz Read (`p95`)** | ~400–1,200 ms (4,594 ms cold) | **< 120 ms** | Remove public `COUNT(*)` (use `LIMIT N + 1` for `hasMore`); add Edge/Redis caching |
| **Admin Metrics Query** | Full-table `COUNT(*)` per filter | **< 30 ms** | Cache `metricsResult` in Upstash Redis (60s TTL) or use `pg_class.reltuples` for unfiltered totals |
| **Lesson Question Lookup** | `OR` + `LIKE '%...'` heap filter | **< 25 ms** | Normalize `lesson_id` exact match + optional `pg_trgm` GIN index for search |
| **Vercel Lambda Connections** | Up to 10/Lambda (direct) | **1–2/Lambda (`-pooler`)** | Enforce Neon `-pooler` + `allowExitOnIdle: true` + remove `rejectUnauthorized: false` |
| **Job Table Dead-Tuple Bloat** | 50%–82% dead rows | **< 15% dead rows** | Drop redundant `study_notes` indexes (`CONCURRENTLY`); set `FILLFACTOR = 70` on `mcq_generation_jobs` |

---

## 3. Durable Queue & Worker Evaluation

| Criterion | Upstash QStash (HTTP-Push) | Inngest (Step-Function SDK) | Postgres Queue (`FOR UPDATE SKIP LOCKED`) |
| --- | --- | --- | --- |
| **Cost (5k DAU)** | ₹85 – ₹850/mo (\$1–\$10 PAYG) | ₹0 – ₹6,375/mo (Free tier 50k–100k runs; Pro \$75) | ₹0 software cost (but polling blocks Neon scale-to-zero) |
| **Reliability & Timeouts** | **Mismatch for long OCR/AI**: HTTP timeout triggers duplicate retries if worker takes >60s | **High for multi-step AI**: Breaks OCR/MCQ/Translate into short checkpointed steps | **High for long jobs**: No HTTP timeout; worker holds `locked_until` lease |
| **Retries & DLQ** | Built-in exponential backoff + DLQ | Built-in per-step retries + replay UI | Requires `attempt_count`, `locked_until` reaper, and `failed_permanent` state |
| **Monitoring** | QStash Console (delivery logs, DLQ) | Rich step-level trace dashboard | Custom admin query / `/admin` job monitor |
| **Ops Complexity** | Low (HTTP endpoint + signature check) | Medium (SDK + signing key) | Low (runs inside Railway worker via `DIRECT_URL`) |

**Selected Architecture**:
* **Use a Persistent Railway/Render Worker (2 GB RAM) + Postgres `FOR UPDATE SKIP LOCKED` Job Table (via `DIRECT_URL`)**, optionally woken up by **Upstash QStash** (or 30–60s idle poll) so Neon can still auto-suspend during zero-activity hours.
* **Why**: QStash alone cannot host 100 MB PDF OCR without timing out and causing duplicate LLM spend, while Inngest Pro jumps to \$75/mo (₹6,375/mo). Processing 1–5 pages at a time using native `poppler-utils` (`pdftotext`/`pdftoppm`) + native `tesseract` CLI (not in-process `tesseract.js` WASM) with per-page DB checkpoints prevents 2 GB OOM crashes.
* **100 MB PDF Upload Fix**: Vercel Serverless has a **4.5 MB hard body limit**. Move PDF uploads to **direct-to-object-storage presigned URLs** (Cloudflare R2 / S3) so the browser uploads directly to storage and sends only the storage key to `/api/*`.

---

## 4. Dual-Hop Proxy Investigation (`vercel.json`)

* **Observed Findings**:
  - `api/index.ts` does **not** exist in the repo; `vercel.json` (`#L22-L26`) rewrites `/api/(.*)` to `https://tnpsc-quiz-lval.vercel.app/api/$1`.
  - Authentication in `backend/src/middleware/auth.ts` uses **stateless Bearer JWTs** (`Authorization: Bearer <token>`), with **zero** session cookies or `Set-Cookie` headers.
  - `backend/src/server.ts` already allows `*.vercel.app` origins in CORS.
* **Necessity & Hidden CORS Trap**: The rewrite is **not** needed for cookies. However, because `vercel.json` keeps `/api/*` same-origin, browsers currently skip `OPTIONS` CORS preflight requests on authenticated calls. Switching `VITE_API_URL` directly to `tnpsc-quiz-lval.vercel.app` turns every `Authorization: Bearer` call into a cross-origin preflight.
* **Safe Migration Option**:
  1. **Phase 1**: Leave `vercel.json` untouched.
  2. **Phase 2/4 (Preferred)**: Consolidate frontend and API into a **single Vercel project** (eliminates both the dual-hop proxy latency and cross-origin CORS preflights). Alternatively, if keeping separate deployments, verify `Access-Control-Allow-Origin` and `Access-Control-Allow-Headers: Authorization, Content-Type` on `tnpsc-quiz-lval.vercel.app` *before* setting `VITE_API_URL`, retaining the `vercel.json` rewrite during rollout as an instant rollback.

---

## 5. Four-Phase Implementation Roadmap

1. **Phase 1 — Database Pooling, Query Optimization & Baseline Protection (Weeks 1–2)**
   - Configure `DATABASE_URL` (`-pooler`, `max: 1–2`, `allowExitOnIdle: true`) for Vercel and `DIRECT_URL` for migrations/DDL; remove `rejectUnauthorized: false` and gate `dotenv.config()` behind `!process.env.VERCEL`.
   - Remove `COUNT(*)` from public `GET /api/questions` (use `LIMIT N + 1`); move `metricsResult` to cached admin endpoint (Upstash Redis 60s TTL).
   - Remove `ensureDatabaseSchema()` from `drive.ts` / `textbooks.ts` middleware; run numbered migrations via CI/CD pre-deploy against `DIRECT_URL`.
   - Drop redundant `study_notes` indexes (`CONCURRENTLY`), set `FILLFACTOR = 70` on `mcq_generation_jobs`, and investigate the caller behind 113k `study_notes` seq_scans.
2. **Phase 2 — Durable Worker, Presigned Uploads & Async Tamil Translation (Weeks 3–5)**
   - Deploy Railway/Render worker (2 GB RAM) with `poppler-utils` + `tesseract` CLI, `SIGTERM` graceful shutdown, `locked_until` lease reaper, `/tmp` cleanup, and `attempt_count` DLQ (`failed_permanent`).
   - Add presigned Cloudflare R2 uploads for >4.5 MB PDFs and persist Google Drive `changes.list` `pageToken` in Postgres.
   - Trigger async post-publish English-to-Tamil pre-translation in batches of 5 with idempotency keys; cap synchronous student translation fallback at 5–10 IDs.
3. **Phase 3 — Syllabus Single Source of Truth & Edge Caching (Weeks 6–7)**
   - Expand-and-contract `lesson_id` normalization and additive sync (`INSERT ... ON CONFLICT DO NOTHING`) from `src/data/` into PostgreSQL `syllabus_*` tables; add `pg_trgm` GIN index only if search benchmarks require substring matching.
   - Serve `/api/syllabus/*` with Redis + CDN caching (`s-maxage=3600, stale-while-revalidate=86400`); migrate static `MOCK_TESTS` into DB-backed records.
4. **Phase 4 — `Admin.tsx` Modularization, Proxy Consolidation & Cleanup (Weeks 8–10)**
   - Split 10,503-line `Admin.tsx` into lazy-loaded `/admin/*` route modules (<200 KB/chunk); move shared DTOs out of `backend/src/` into `shared/` or `src/types/`.
   - Consolidate dual-hop proxy safely and archive unused root diagnostic `.cjs`/`.md` files after build verification.

---

## 6. Estimated Monthly Infrastructure Cost in INR (50,000 Students / ~5,000 DAU)

*Exchange rate assumed: ₹85 / USD.*

| Component | Tier & Role | USD / mo | INR / mo (₹85) | Notes & Cost Controls |
| --- | --- | ---: | ---: | --- |
| **Vercel Pro** | Frontend SPA + Serverless API (1 seat) | \$20 | ₹1,700 | PDFs bypass Vercel via R2 presigned URLs (avoids \$0.15/GB transfer overages) |
| **Neon PostgreSQL** | Launch (\$19) to Scale (\$69) | \$19 – \$69 | ₹1,615 – ₹5,865 | `-pooler` + Redis caching keeps CU low; avoid 24/7 polling to allow scale-to-zero |
| **Background Worker** | Railway / Render (2 GB RAM, 1 vCPU) | \$15 – \$25 | ₹1,275 – ₹2,125 | Hosts Poppler/Tesseract OCR, Drive sync, AI MCQ & translation jobs |
| **Upstash Redis + QStash** | Shared cache, rate limits & wake-up triggers | \$5 – \$15 | ₹425 – ₹1,275 | Replaces process-local `cache.ts` across serverless instances |
| **Cloudflare R2 Storage** | Textbook PDFs & OCR page artifacts | \$2 – \$6 | ₹170 – ₹510 | Zero egress fees for textbook downloads |
| **Observability** | Sentry / Log Drain | \$0 – \$29 | ₹0 – ₹2,465 | Vercel Pro retains logs for only 1 day |
| **AI & Cloud OCR APIs** | Gemini / Claude / Cloud Vision | \$25 – \$100 | ₹2,125 – ₹8,500 | Front-loaded during ingestion; drops once `mcq_question_translations` cache is warm |
| **Total Monthly Cost** | | **\$86 – \$264** | **₹7,310 – ₹22,440** | **~₹0.15 – ₹0.45 per registered student/month** |

---

## 7. Testing Plan, Rollback Strategy & Risk Assessment

### Testing Plan
1. **PgBouncer Transaction-Mode Integration Test**: Run full API test suite against Neon `-pooler` under concurrent requests to catch prepared-statement or session-state errors.
2. **5,000 DAU Burst Load Test (k6 / Artillery)**: Simulate 300–500 concurrent students on `/api/questions`, `/api/study-materials/questions`, `/api/study-materials/questions/translate`, and `/api/student/*` against a cloned Neon branch; verify p95 < 150 ms and zero connection errors.
3. **Migration Dry-Run on Cloned Neon Branch**: Validate `lesson_id` backfill, `CREATE INDEX CONCURRENTLY` outside transactions, and removal of `ensureDatabaseSchema()` before production cutover.
4. **Worker Chaos Recovery Test**: Send `SIGKILL` and `SIGTERM` mid-OCR on a 100 MB PDF; verify lease expiry (`locked_until`), zero duplicate DB rows, `/tmp` cleanup, and DLQ routing for poison-pill PDFs.
5. **Data Invariant & Syllabus Parity Tests**: Assert zero changes to existing `questions.id`, `correct_answer`, and student `question_attempts`, and 100% parity across Group 1/2/2A/4 before switching runtime syllabus reads.

### Rollback Plan & Operational Runbooks
* **Database**: Snapshot via Neon PITR + branch before any migration; execute all index changes with `CONCURRENTLY` outside transactions. If an index fails mid-build (`pg_index.indisvalid = false`), run `DROP INDEX CONCURRENTLY` and retry.
* **Schema & Deploy Order**: Run `DIRECT_URL` migrations and verify before promoting Vercel or Railway deploys.
* **Worker / Queue Cutover**: Gate async worker dispatch behind `USE_DURABLE_WORKER=true/false` so traffic can revert to synchronous/legacy handlers immediately without redeploying.
* **Frontend & Proxy**: Retain `vercel.json` rewrite during transition and use Vercel instant deployment rollback (<30s) for UI bundle regressions.

### Key Risks & Mitigations
* **OOM Kill (`SIGKILL` 137) on 2 GB Worker**: Mitigated by sequential 1-page `pdftoppm` + `tesseract` CLI execution on `/tmp` instead of in-memory `tesseract.js` WASM.
* **CORS Failure on Proxy Removal**: Mitigated by merging into one Vercel project or verifying `OPTIONS` preflight headers before changing `VITE_API_URL`.
* **Neon 24/7 Compute Cost Spike**: Mitigated by using QStash/webhook wake-ups or 60s idle poll intervals instead of tight 1-second `pg-boss` polling.
