# Requirements: TNPSC Study Hub (tnpsc-quiz)

**Defined:** 2026-11-18
**Core Value:** Reliable, fast, bilingual (Tamil/English) TNPSC exam study, MCQ practice, and mock-test delivery backed by a single PostgreSQL syllabus source of truth and a non-destructive AI ingestion pipeline.

## v1 Requirements

Requirements for the current hardening, bilingual, AI ingestion, and modularization milestone. Each maps to a single roadmap phase.

### Database & Serverless Hardening

- [ ] **DB-01**: Configure dual PostgreSQL URLs (`DATABASE_URL` Neon `-pooler` with `max: 3` on Vercel serverless, `idleTimeoutMillis: 5000`, `allowExitOnIdle: true`; `DIRECT_URL` unpooled for migrations/DDL), enforce TLS (`rejectUnauthorized` toggle), and gate `dotenv.config()` behind `if (!process.env.VERCEL)` in `backend/src/db.ts`.
- [ ] **DB-02**: Gate `ensureDatabaseSchema()` in `backend/src/routes/drive.ts` and `backend/src/routes/textbooks.ts` behind `process.env.SKIP_RUNTIME_SCHEMA_CHECK !== 'true'`, preserving zero deletions or mutations of existing records.
- [ ] **DB-03**: Optimize `GET /api/questions`, `GET /api/study-materials/questions`, `GET /api/notes`, and `/admin` variants with partial published-question indexes, skipped `COUNT(*)` when `safeOffset === 0 && rows.length < safeLimit`, 30s TTL cached admin `metricsResult` in `backend/src/utils/cache.ts`, and pre-aggregated CTE/`LEFT JOIN` replacements for correlated `study_notes` subqueries while preserving exact JSON response fields.
- [ ] **DB-04**: Apply 50k-scale DB hygiene (`FILLFACTOR = 70` on `mcq_generation_jobs`, drop redundant `study_notes` indexes `CONCURRENTLY`) and verify SLOs (Warm Student Quiz Read p95 < 120 ms, Admin Metrics < 30 ms, Lesson Question Lookup < 25 ms).

### Security & Auth Hardening

- [ ] **SEC-01**: Fail fast on production startup if `ADMIN_JWT_SECRET` or `STUDENT_JWT_SECRET` is missing (removing hardcoded fallback secrets), and gate dev auth bypass behind an explicit `ALLOW_DEV_AUTH_BYPASS=true` opt-in flag.
- [ ] **SEC-02**: Hash all `admin_users` passwords with `scrypt` (removing plaintext password comparisons and hardcoded defaults in production) and fail closed on DB lookup errors in `requireStudentAuth`.
- [ ] **SEC-03**: Remove `?token=` query-string token fallback across auth middleware (standardizing on `Authorization: Bearer`) and restrict production CORS in `backend/src/server.ts` to explicit `CORS_ORIGIN` / `FRONTEND_URL` values.
- [ ] **SEC-04**: Add `express-rate-limit` middleware protecting login, registration, and AI generation endpoints (`backend/src/routes/auth.ts`, `backend/src/routes/student.ts`, `backend/src/routes/aiGeneration.ts`).

### Bilingual Experience & Translation

- [ ] **LANG-01**: Render `LanguageSwitch` and apply `LanguageContext` (`'en' | 'ta'`) strictly on Study Materials (`/materials*`), MCQ Questions (`/practice*`), and Mock Tests (`/mock-tests*`)—never on Home, Dashboard, Admin, or Auth—persisted in `localStorage` under `tnpsc_language_pref`.
- [ ] **LANG-02**: Deep-translate question stems, all 4 answer options, explanations, syllabus units, lesson titles, and study notes while preserving option index order, `correctAnswer` integrity, and active quiz state (`selectedAnswer`, question index, score).
- [ ] **LANG-03**: Enqueue batch-of-5 English-to-Tamil translations asynchronously when an Admin publishes staging MCQs, and cap synchronous student fallback translation requests in `mcqTranslationService.ts` at 5–10 uncached IDs per call.

### AI Syllabus Import Engine (Single Parent Unit)

- [ ] **SYL-01**: Implement Single Parent Unit container architecture in `backend/src/services/aiSyllabusEngineService.ts` and `backend/src/types/aiSyllabusTypes.ts` where each TNPSC syllabus unit is ONE parent container with Standards 6th–12th nested inside (never creating per-standard parent unit boxes).
- [ ] **SYL-02**: Reuse existing 72 textbooks in `google_drive_materials` (`extracted_toc`) without duplicating PDF files, and preserve all 51 units, 1,725 lessons, 6,002 topics, 592 study notes, and 72 textbooks via non-destructive Option A transactional merge (`BEGIN ... COMMIT` matching by `(unit_id, standard_number, lesson_number)`).
- [ ] **SYL-03**: Expose `requireAuth`-protected `/api/study-management/ai-import` endpoints (`/analyze`, `/match`, `/generate-notes`, `/generate-mcqs`, `/publish`) with draft state isolated in component memory/`sessionStorage` until explicit publish and chunked per-lesson LLM generation.

### Bulk PDF Ingestion & Durable Worker Offload

- [ ] **INGEST-01**: Implement Direct-to-Drive 5 MB chunked resumable streaming (concurrency 3) with SHA-256 `file_checksum` deduplication in `google_drive_materials`, `bulk_upload_batches` tracking, and `POST /api/drive/bulk/{classify,check-duplicates,register}` while preserving Single PDF Upload and Drive OAuth 2.0.
- [ ] **INGEST-02**: Support full-content PDF extraction across all pages via `fullTextbookExtractor.ts` (no truncation) with Tamil/English Unicode preservation and Tesseract OCR fallback for scanned pages.
- [ ] **INGEST-03**: Offload `McqJobService`, `pdfExtractionService`, `googleDriveSyncService`, and post-publish Tamil pre-translation to a persistent worker container (2 GB RAM) using `FOR UPDATE SKIP LOCKED`, `locked_until` lease reaper, `attempt_count` DLQ (`failed_permanent`), and native `poppler-utils` + `tesseract` CLI (1–5 pages at a time on `/tmp`), gated by `USE_DURABLE_WORKER`.
- [ ] **INGEST-04**: Bypass Vercel's 4.5 MB request body limit for non-Drive binary uploads using direct-to-object-storage presigned URLs (Cloudflare R2 / S3).

### Syllabus Single Source of Truth & Edge Caching

- [ ] **SSOT-01**: Reconcile static `src/data/` syllabus items and `MockTests.tsx` static data into PostgreSQL using additive `INSERT ... ON CONFLICT DO NOTHING` (preserving all existing IDs).
- [ ] **SSOT-02**: Serve `/api/syllabus/*` with shared Upstash Redis + CDN caching (`Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`), replacing global `no-store` on read-only syllabus/catalog endpoints while preserving auth/user-specific `no-store`.

### Frontend Modularization, Type Safety & Quality

- [ ] **MOD-01**: Split `src/pages/Admin.tsx` (10,533 lines) into lazy-loaded sub-routes under `/admin/*` (<200 KB per chunk) and move shared DTOs out of `backend/src/` into `src/types/` or `shared/`.
- [ ] **MOD-02**: Enable `"strict": true` incrementally in `tsconfig.app.json`, remove `@ts-ignore` (`BulkPdfUploadModal.tsx`), clear `oxlint` errors, and pass `npm run build` (`tsc -b && vite build`) and `npm run build --prefix backend` (`tsc`) with 0 errors.
- [ ] **MOD-03**: Clean up root clutter (remove duplicate root `eng.traineddata`, archive unused root `.cjs`/`.md` diagnostic scripts and staging files) and consolidate legacy `backend/src/services/cloudAi/` into `backend/src/services/ai/`.
- [ ] **MOD-04**: Add unified `"test"` scripts for backend unit/integration tests (fixing `geminiRetryService.test.ts` import and adding auth, syllabus, and query-parity tests) and critical frontend quiz/auth smoke coverage.

## v2 Requirements

Deferred to future milestones.

- **OBS-01**: Integrate structured error tracking (Sentry/Datadog) and automated CI/CD GitHub Actions test + build pipelines.
- **PWA-01**: Offline-first IndexedDB caching for downloaded study notes and practice sets.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Class-wise separate parent syllabus units (`2026-11-05` plan) | Explicitly superseded by 2026-11-07 Single Parent Unit design |
| Automatic cross-provider AI fallback | Violates `AIProviderFactory` strict multi-provider isolation |
| Destructive DB table resets or ID renumbering | Breaks live student attempts, bookmarks, and published quiz links |
| Language switch on Home/Dashboard/Admin/Auth | Explicitly restricted by bilingual scoping NFR |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 1 | Pending |
| DB-02 | Phase 1 | Pending |
| DB-03 | Phase 1 | Pending |
| DB-04 | Phase 1 | Pending |
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 1 | Pending |
| SEC-04 | Phase 1 | Pending |
| LANG-01 | Phase 2 | Pending |
| LANG-02 | Phase 2 | Pending |
| LANG-03 | Phase 2 | Pending |
| SYL-01 | Phase 3 | Pending |
| SYL-02 | Phase 3 | Pending |
| SYL-03 | Phase 3 | Pending |
| INGEST-01 | Phase 4 | Pending |
| INGEST-02 | Phase 4 | Pending |
| INGEST-03 | Phase 4 | Pending |
| INGEST-04 | Phase 4 | Pending |
| SSOT-01 | Phase 5 | Pending |
| SSOT-02 | Phase 5 | Pending |
| MOD-01 | Phase 5 | Pending |
| MOD-02 | Phase 5 | Pending |
| MOD-03 | Phase 5 | Pending |
| MOD-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-18*
*Last updated: 2026-11-18 after roadmap creation*
