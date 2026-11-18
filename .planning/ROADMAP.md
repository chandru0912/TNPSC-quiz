# Roadmap: TNPSC Study Hub

## Overview

TNPSC Study Hub evolves from a brownfield Vercel-hosted React + Express + Neon PostgreSQL monolith into a 50k-scale, security-hardened, bilingual exam preparation platform. We begin by stabilizing database pooling, query latency, and authentication security; then deliver route-scoped Tamil/English switching and pre-translated MCQs; next establish the Single Parent Unit AI Syllabus Import Engine; then offload bulk PDF ingestion and OCR/MCQ jobs to a persistent worker container; and finally consolidate syllabus truth into PostgreSQL with edge caching, modularize `Admin.tsx`, and lock down TypeScript/lint/test quality gates.

## Phases

- [ ] **Phase 1: Database, Serverless & Security Hardening** - Stabilize Neon pooling, eliminate runtime schema checks, optimize hot quiz/admin queries, and close auth/CORS/rate-limit vulnerabilities.
- [ ] **Phase 2: Bilingual UX & Pre-Translated MCQ Delivery** - Enforce route-scoped Tamil/English switching with deep translation and async post-publish MCQ pre-translation.
- [ ] **Phase 3: AI Syllabus Import Engine (Single Parent Unit)** - Deliver the 12-step Single Parent Unit AI import pipeline with non-destructive Option A merge and 72-textbook reuse.
- [ ] **Phase 4: Bulk PDF Ingestion & Durable Worker Offload** - Enable Direct-to-Drive SHA-256 deduplicated bulk uploads and offload heavy PDF/OCR/MCQ jobs to a persistent worker container.
- [ ] **Phase 5: Syllabus Single Source of Truth, Admin Modularization & Quality Gates** - Reconcile static syllabus data into PostgreSQL with edge caching, split `Admin.tsx` into <200 KB lazy chunks, clean up root clutter, and enforce strict build/test gates.

## Phase Details

### Phase 1: Database, Serverless & Security Hardening
**Goal**: Students and admins experience fast, reliable API responses on Vercel serverless without connection exhaustion, data mutation, or authentication/CORS vulnerabilities.
**Depends on**: Nothing (first phase)
**Requirements**: DB-01, DB-02, DB-03, DB-04, SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. Serverless API routes connect through Neon `-pooler` (`max: 3` per Lambda) while migrations/DDL use `DIRECT_URL`, with `ensureDatabaseSchema()` skipped during normal requests (`SKIP_RUNTIME_SCHEMA_CHECK=true`) and zero existing records mutated.
  2. Public `GET /api/questions`, `/api/study-materials/questions`, and `/api/notes` return exact backward-compatible JSON payloads within Phase 1 SLOs (<120 ms warm quiz read p95, <30 ms admin metrics, <25 ms lesson lookup).
  3. Production startup fails fast if `ADMIN_JWT_SECRET` or `STUDENT_JWT_SECRET` is unset, `admin_users` passwords are verified with `scrypt`, `requireStudentAuth` fails closed on DB errors, `?token=` query auth is rejected, CORS restricts to explicit origins, and auth/AI endpoints enforce rate limits.
**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md — Serverless DB pooling (`max: 3`), `DIRECT_URL` migrations, `VERCEL` `dotenv` gating, and `SKIP_RUNTIME_SCHEMA_CHECK` gating (`DB-01`, `DB-02`)
- [ ] 01-02-PLAN.md — `/admin` `COUNT(*)` skip, partial published indexes, `FILLFACTOR = 70`, `CONCURRENTLY` cleanup, and SLO verification (`DB-03`, `DB-04`)
- [ ] 01-03-PLAN.md — Fail-fast JWT secrets, `ALLOW_DEV_AUTH_BYPASS`, `scrypt` admin auth, fail-closed `requireStudentAuth`, Bearer-only auth, and explicit CORS (`SEC-01`, `SEC-02`, `SEC-03`)
- [ ] 01-04-PLAN.md — Package legitimacy checkpoint + `express-rate-limit` & `trust proxy` protection on auth/AI routes (`SEC-04`)

### Phase 2: Bilingual UX & Pre-Translated MCQ Delivery
**Goal**: Students can seamlessly switch between English and Tamil on Study Materials, MCQ Practice, and Mock Tests with instant pre-translated MCQs and preserved quiz state.
**Depends on**: Phase 1
**Requirements**: LANG-01, LANG-02, LANG-03
**Success Criteria** (what must be TRUE):
  1. `LanguageSwitch` renders and `LanguageContext` (`'en' | 'ta'`) applies ONLY on `/materials*`, `/practice*`, and `/mock-tests*` (absent on Home, Dashboard, Admin, and Auth), persisting `tnpsc_language_pref` across refreshes and route transitions.
  2. Toggling language mid-quiz translates stems, all 4 options, explanations, syllabus units, lesson titles, and study notes while preserving option index order, `correctAnswer` integrity, `selectedAnswer`, question index, and score.
  3. Publishing staging MCQs enqueues async batch-of-5 English-to-Tamil pre-translation, and student synchronous fallback requests are capped at 5–10 uncached IDs per call.
**Plans**: TBD
**UI hint**: yes

### Phase 3: AI Syllabus Import Engine (Single Parent Unit)
**Goal**: Admins can import, match against existing textbooks, generate notes/MCQs for, and non-destructively publish TNPSC syllabi using the Single Parent Unit container model.
**Depends on**: Phase 1
**Requirements**: SYL-01, SYL-02, SYL-03
**Success Criteria** (what must be TRUE):
  1. Imported TNPSC units always map to ONE parent unit container with Standards 6th–12th nested inside (`aiSyllabusEngineService.ts`), never creating separate per-standard parent unit boxes.
  2. Existing 51 units, 1,725 lessons, 6,002 topics, 592 study notes, and 72 textbooks in `google_drive_materials` remain intact and un-duplicated after an Option A transactional `BEGIN ... COMMIT` publish.
  3. Authenticated `/api/study-management/ai-import` endpoints (`/analyze`, `/match`, `/generate-notes`, `/generate-mcqs`, `/publish`) keep drafts in component/`sessionStorage` until explicit admin approval and pass both frontend and backend builds with 0 errors.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Bulk PDF Ingestion & Durable Worker Offload
**Goal**: Admins can bulk-upload deduplicated Samacheer Kalvi PDFs directly to Google Drive/object storage while long-running PDF, OCR, and MCQ jobs execute reliably on a persistent worker.
**Depends on**: Phase 1, Phase 3
**Requirements**: INGEST-01, INGEST-02, INGEST-03, INGEST-04
**Success Criteria** (what must be TRUE):
  1. Admins can stream 5 MB PDF chunks directly from browser to Google Drive (concurrency 3) with SHA-256 checksum deduplication, `bulk_upload_batches` progress tracking, and multi-group filtering while Single PDF Upload and Drive OAuth 2.0 continue working.
  2. Full-content PDF extraction (`fullTextbookExtractor.ts`) processes all pages with Tamil/English Unicode fidelity and OCR fallback without Vercel 4.5 MB body-limit failures (using presigned object-storage URLs for non-Drive uploads).
  3. When `USE_DURABLE_WORKER` is enabled, `McqJobService`, `pdfExtractionService`, `googleDriveSyncService`, and post-publish Tamil translation execute on the persistent 2 GB RAM worker with `FOR UPDATE SKIP LOCKED`, `locked_until` lease recovery, and `failed_permanent` DLQ handling.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Syllabus Single Source of Truth, Admin Modularization & Quality Gates
**Goal**: Static syllabus data is consolidated in PostgreSQL with edge caching, `Admin.tsx` is split into fast lazy chunks, root clutter is cleaned up, and strict TypeScript/lint/test gates protect future changes.
**Depends on**: Phase 2, Phase 3, Phase 4
**Requirements**: SSOT-01, SSOT-02, MOD-01, MOD-02, MOD-03, MOD-04
**Success Criteria** (what must be TRUE):
  1. Static `src/data/` syllabus records and `MockTests.tsx` data are reconciled into PostgreSQL via additive `INSERT ... ON CONFLICT DO NOTHING` (preserving all IDs), and `/api/syllabus/*` serves edge/Redis-cached responses (`s-maxage=3600, stale-while-revalidate=86400`).
  2. `Admin.tsx` is decomposed into lazy-loaded `/admin/*` sub-routes with every chunk under 200 KB, shared DTOs live in `src/types/` or `shared/`, and duplicate root `eng.traineddata` / unused diagnostic scripts are archived.
  3. `tsconfig.app.json` enforces `"strict": true` with zero `@ts-ignore` or `oxlint` errors, `cloudAi/` is consolidated into `services/ai/`, and unified `"test"` scripts pass backend unit/integration and frontend smoke tests alongside 0-error frontend and backend builds.
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database, Serverless & Security Hardening | 0/4 | Not started | - |
| 2. Bilingual UX & Pre-Translated MCQ Delivery | 0/TBD | Not started | - |
| 3. AI Syllabus Import Engine (Single Parent Unit) | 0/TBD | Not started | - |
| 4. Bulk PDF Ingestion & Durable Worker Offload | 0/TBD | Not started | - |
| 5. Syllabus Single Source of Truth, Admin Modularization & Quality Gates | 0/TBD | Not started | - |
