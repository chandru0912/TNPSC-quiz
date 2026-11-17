# TNPSC Study Hub — Reliability & 50k-Scale Architecture Plan

* **Author:** Chandru
* **Date:** 2026-11-16

## Overview

TNPSC Study Hub is a React 19 + Vite single-page application (`src/`) backed by an Express/Node.js API (`backend/src/server.ts`) deployed on Vercel Serverless (`maxDuration: 60s`, `memory: 1024MB`) with Neon PostgreSQL.

This concept brief defines an architecture improvement plan to stabilize production reliability first, harden the Admin content-ingestion-to-Student-learning workflow, and scale to approximately 50,000 registered students (est. 2,500–7,500 DAU and 300–1,000 peak concurrent users) over the next 6–12 months—while preserving all published question IDs, student accounts and attempt history, existing API/frontend routes, Google Drive folder structures, and uncommitted local changes.

---

## Analysis

### 1. Multi-Lens Goldfish Synthesis

A parallel 7-lens review (`egm-design`, `egm-codebase-details`, `egm-zoom-out`, `egm-comprehension`, `egm-implementation-readiness`, `egm-structural`, `egm-inventive-catalyst`) inspected the codebase read-only and identified the following core findings:

1. **System & Scale (`egm-zoom-out`)**: Each Vercel serverless invocation instantiates `pg.Pool({ max: 10 })` without enforcing Neon's PgBouncer pooled endpoint (`-pooler`), risking connection exhaustion (`500–1,500+` connections) during concurrent exam spikes. Public student endpoints (`GET /api/questions`) also execute full-table `COUNT` aggregations (`metricsResult`) on every quiz load.
2. **Code Hotspots (`egm-codebase-details`)**: `src/pages/Admin.tsx` (10,503 lines, ~1.1 MB JS chunk), `studyManagementService.ts` (2,318 lines), `student.ts` (1,872 lines), `drive.ts` (1,826 lines), `questions.ts` (1,697 lines), and `pdfExtractionService.ts` (1,601 lines) concentrate unrelated concerns in single files. `BulkPdfUploadModal.tsx` directly imports backend types (`../../backend/src/services/bulkClassificationService`).
3. **Data & State Integrity (`egm-structural`)**: Syllabus truth is split across three layers—static TypeScript registries (`src/data/unifiedSyllabusRegistry.ts`, `samacheerTextbookCatalog.ts`), hardcoded constants in `backend/src/routes/syllabusRoutes.ts` (`getCanonicalUnits`), and PostgreSQL (`syllabus_lessons`, `syllabus_topics`). `backend/src/utils/cache.ts` is an in-memory `Map` isolated per serverless instance, so invalidations do not propagate across instances.
4. **Workflow & UX (`egm-design`)**: Admin ingestion (Drive sync → PDF/OCR extraction → AI MCQ/notes generation → Staging → Publish) and student Tamil translation rely on client-driven polling, `350ms` `Promise.race` fire-and-forget chaining (`dispatchVercelWorkerStep`), and synchronous multi-batch AI loops.
5. **Observability & Runtime Hygiene (`egm-comprehension`)**: `drive.ts` and `textbooks.ts` execute `ensureDatabaseSchema()` inside request middleware. Silent `catch {}` blocks in `McqBackgroundMonitor.tsx` and fire-and-forget worker dispatch hide stalled jobs.
6. **Ops & Deployment (`egm-implementation-readiness`)**: Dual-hop proxying (`vercel.json` rewrite + `api/index.ts` -> `tnpsc-quiz-lval.vercel.app`) adds cold-start latency and double invocation cost. Running `tesseract.js` (`7.0.0`) inside a 1024 MB / 60s serverless function is prone to memory and timeout failures on multi-page Tamil PDFs.
7. **Inventive Contradiction Resolution (`egm-inventive-catalyst`)**:
   - *Serverless 60s Cap vs. Long AI/OCR Pipelines*: Replace browser-polled `/step` chaining with a durable queue (Upstash QStash / Inngest) or a small persistent worker container (Railway / Render) so jobs survive browser closure and execute without 60s request ceilings.
   - *Dynamic DB Syllabus vs. Zero-Latency Student Reads*: Keep PostgreSQL as the single Admin write-master and publish versioned edge-cached JSON snapshots (`Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`), eliminating both 3-way syllabus drift and per-request database joins.

### 2. Prioritized Architectural Risks

| Severity | Area | Risk & Root Cause | Codebase Location |
| --- | --- | --- | --- |
| Blocker | DB Connection Exhaustion | Per-Lambda `Pool({ max: 10 })` without Neon `-pooler` | `backend/src/db.ts#L29-L53` |
| Blocker | Full-Table Scan on Public Reads | `GET /api/questions` runs unfiltered `metricsResult` counts + leading-wildcard `LIKE` on every student fetch | `backend/src/routes/questions.ts#L514-L538` |
| Blocker | Fragile Serverless Job Chaining | `dispatchVercelWorkerStep` uses `350ms` `Promise.race` fire-and-forget; jobs stall if parent Lambda freezes or admin closes tab | `backend/src/services/mcqJobService.ts#L413-L434` |
| Blocker | Synchronous Translation Timeouts | `translateStudyMaterialQuestions` allows up to 100 IDs sequentially in batches of 5 inside one HTTP request, exceeding 60s on cache misses | `backend/src/services/mcqTranslationService.ts#L15-L16, L430-L470` |
| Major | PDF/OCR Memory & Timeout Ceiling | Full Drive PDF buffers (`100MB` limit) + `tesseract.js` WASM inside 1024 MB / 60s Lambda | `backend/src/services/pdfExtractionService.ts`, `textbooks.ts#L111` |
| Major | Dual-Hop Proxy Overhead | Frontend `vercel.json` + `api/index.ts` double-proxy to `tnpsc-quiz-lval.vercel.app` | `vercel.json#L22-L26`, `api/index.ts#L13-L63` |
| Major | 3-Way Syllabus Drift | `unifiedSyllabusRegistry.ts`, `syllabusRoutes.ts`, and Postgres diverge; `MockTests.tsx` uses hardcoded `MOCK_TESTS` | `src/data/unifiedSyllabusRegistry.ts`, `syllabusRoutes.ts`, `MockTests.tsx` |
| Major | Process-Local Cache & No Edge Caching | `app.set('etag', false)` + `no-store` + local `Map` cache in `cache.ts` | `backend/src/server.ts#L39`, `backend/src/utils/cache.ts` |
| Minor | Monolith & Root Clutter | 10,503-line `Admin.tsx` (~1.1 MB bundle) and 60+ root diagnostic `.cjs`/`.md` files | `src/pages/Admin.tsx`, repo root |

---

## Goals vs. Non-Goals

### In-Scope Goals
- Eliminate Vercel serverless timeouts and DB connection exhaustion at 50,000-student scale.
- Make AI MCQ generation, PDF/OCR extraction, Google Drive sync, and English-to-Tamil MCQ translation durable and resumable independent of admin browser tabs.
- Unify syllabus data so PostgreSQL is the single write-master with edge-cached read delivery for Group 1, Group 2, Group 2A, and Group 4.
- Split `Admin.tsx` into lazy-loaded domain modules and relocate root diagnostic clutter after build verification.
- Provide a phased migration plan, testing strategy, rollback plan, and monthly cost estimate.

### Out-of-Scope Non-Goals
- Deleting or renumbering existing published MCQ question IDs or altering `correct_answer` indices.
- Migrating away from PostgreSQL/Neon unless justified by hard technical limits.
- Modifying student accounts, exam attempts, marks, progress history, or Google Drive folder structures.
- Changing existing API paths or frontend URLs without explicit approval.
- Modifying production database records or discarding uncommitted local changes during planning.

---

## Alternatives Weighed

### 1. Background Execution & PDF/OCR Architecture
- **Option A — 100% Serverless + Durable Queue (Vercel + Upstash QStash / Inngest)**: Keeps zero server ops and adds automatic retries/backoff for AI MCQ and translation steps. Rejected as sole solution for heavy PDF/OCR because individual `tesseract.js` + 100 MB PDF steps still hit Vercel's 1024 MB memory and 60s ceiling.
- **Option B — Hybrid (Vercel Frontend/API + Persistent Worker Container on Railway/Render, 2 GB RAM) [Recommended]**: Keeps React SPA and standard API routes on Vercel, while offloading `McqJobService`, `pdfExtractionService`, `googleDriveSyncService`, and async post-publish Tamil pre-translation to a persistent worker backed by Redis/Postgres. Eliminates 60s timeouts and Lambda OOMs for ~$10–$20/month.
- **Option C — Hardened Self-Chaining + Vercel Cron**: Rejected because 1-minute Cron granularity and serverless memory limits do not fix PDF/OCR OOMs or student-facing latency.

### 2. Database Platform
- **Keep Neon PostgreSQL with Pooled Connections (`-pooler`) [Recommended]**: Switching `DATABASE_URL` to Neon's PgBouncer pooled endpoint, capping per-Lambda `pg.Pool` `max: 3`, removing per-request `metricsResult` full-table scans, and adding partial indexes resolves connection and query bottlenecks without migrating 28 tables of live student/question data.
- **Migrate to RDS / Supabase**: Rejected because it adds migration risk without solving anything Neon pooling + read caching cannot already solve.

### 3. MCQ Translation Delivery
- **Pre-translate on Publish (Async) + Small Synchronous Fallback**: Enqueue batch-of-5 Tamil translations automatically when an Admin publishes staging MCQs so student sessions hit `mcq_question_translations` at >95% cache hit rate. Cap synchronous student fallback requests at 5–10 uncached IDs per call so requests finish in 4–8s instead of timing out at 60s.

---

## Key Decisions & Staging for Next Steps

### Phased Migration Plan
1. **Phase 1 — Immediate Reliability & DB Protection (Weeks 1–2)**:
   - Switch Vercel `DATABASE_URL` to Neon's `-pooler` endpoint; set Lambda pool `max` to `3`.
   - Remove `metricsResult` full-table count from public `GET /api/questions` (move to `/api/questions/admin/metrics` with 60s cache); add partial index `ON questions (target_system, status, category, unit_id, class_id) WHERE status = 'published'`.
   - Remove `ensureDatabaseSchema()` from request middleware (`drive.ts`, `textbooks.ts`); run migrations only in deploy/CI scripts.
   - Consolidate the dual-hop `/api/*` proxy (`vercel.json` vs `api/index.ts`) once cookie/CORS requirements are verified.
2. **Phase 2 — Async Pipeline & Translation Caching (Weeks 3–5)**:
   - Introduce Upstash Redis (shared cache + rate limiting) and a durable queue / Railway worker for `McqJobService`, `pdfExtractionService`, and Drive sync.
   - Trigger async English-to-Tamil translation on MCQ publish; cap synchronous student translation fallback at 5–10 IDs per request.
   - Add a stalled-job sweeper for expired `PROCESSING` leases.
3. **Phase 3 — Syllabus Single Source of Truth (Weeks 6–7)**:
   - Reconcile static `src/data/` syllabus items into PostgreSQL with additive `INSERT ... ON CONFLICT DO NOTHING` (preserving all existing IDs).
   - Serve `/api/syllabus/*` with Redis + CDN caching (`s-maxage=3600, stale-while-revalidate=86400`); move `MockTests.tsx` static data into DB-backed records.
4. **Phase 4 — `Admin.tsx` Modularization & Cleanup (Weeks 8–10)**:
   - Split `Admin.tsx` into lazy-loaded sub-routes under `/admin/*` (<200 KB per chunk).
   - Move shared DTOs out of `backend/src/` into `src/types/` (or `shared/`) and archive unused root diagnostic `.cjs`/`.md` scripts.

### Testing & Rollback Strategy
- **Data Invariant Tests**: Verify existing `questions.id`, `correct_answer`, and student `question_attempts` / `mock_test_attempts` never mutate.
- **Syllabus Parity Tests**: Snapshot-compare `/api/syllabus/*` against `unifiedSyllabusRegistry.ts` across Group 1, 2, 2A, and 4 before switching runtime reads.
- **Load & Failure-Injection Tests**: Run k6/Artillery at 500–1,000 concurrent users against a Neon branch; verify worker recovery when killed mid-PDF or mid-AI batch.
- **Rollback**: Use Neon PITR + database branching before additive-only (`CREATE INDEX CONCURRENTLY`) DDL; gate queue/worker routing behind `USE_QUEUE_WORKER` env flag; use Vercel instant rollback for frontend chunks.

### Estimated Monthly Infrastructure Cost (50,000 Students)
- **Vercel Pro**: ~$20/mo (frontend CDN + API routes)
- **Neon Scale / Launch** (1–4 CU autoscale, 20 GB, PITR): ~$35–$90/mo
- **Upstash Redis + QStash**: ~$10–$25/mo
- **Dedicated PDF/OCR/AI Worker** (Railway/Render, 2 GB RAM): ~$10–$20/mo
- **AI & OCR APIs** (Google Cloud Vision + Claude/Gemini, decreasing once translation cache warms): ~$30–$120/mo
- **Total**: **~$105–$275/month**
