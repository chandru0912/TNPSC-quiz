# Synthesized Constraints

## Bilingual Language Switch Route Scoping & Persistence
- source: docs/superpowers/plans/2026-10-29-bilingual-switch-study-mcq-mock.md
- type: nfr
- content:
  - Scope restriction: LanguageSwitch and LanguageContext ('en' | 'ta') must ONLY render on or affect Study Materials (/materials*), MCQ Questions (/practice*), and Mock Tests (/mock-tests*); do NOT render on Home, Dashboard, Admin, or Auth pages.
  - Persistence: Store preference in localStorage under key 'tnpsc_language_pref' and preserve across route transitions and refreshes.
  - Deep translation: Translate question stems, all 4 answer options, explanations, syllabus units, lesson titles, and study notes while preserving option index order, correctAnswer integrity, and active quiz state (selectedAnswer, question index, score).
  - Build gate: Must pass `npm run build` (`tsc -b && vite build`) with zero TypeScript or styling errors.

## Bulk PDF Upload Schema & Deduplication
- source: docs/superpowers/plans/2026-11-02-bulk-pdf-upload-syllabus-classification.md
- type: schema
- content:
  - Extend `google_drive_materials` in `backend/src/migrate.ts` with: `file_checksum VARCHAR(64)`, `applicable_groups JSONB DEFAULT '["group1", "group2", "group4"]'::jsonb`, `extracted_toc JSONB`, `classification_meta JSONB`, `confidence_score INT DEFAULT 100`, `medium VARCHAR(20) DEFAULT 'Tamil' CHECK (medium IN ('Tamil', 'English'))`, plus indexes `idx_gdrive_materials_checksum` and `idx_gdrive_materials_medium`.
  - Add `bulk_upload_batches` table (`id`, `batch_id` UNIQUE, `total_files`, `completed_files`, `failed_files`, `status`, `created_by`, `summary` JSONB, `created_at`, `updated_at`).
  - Physical deduplication: A PDF with the same SHA-256 checksum must be stored only once in Google Drive; multi-group/multi-lesson mappings reference the single `google_drive_file_id`.

## Bulk PDF Upload API & Resumable Streaming Protocol
- source: docs/superpowers/plans/2026-11-02-bulk-pdf-upload-syllabus-classification.md
- type: protocol
- content:
  - Preserve existing Single PDF Upload modal and verified Google Drive OAuth 2.0 configuration alongside Bulk PDF Upload.
  - Direct-to-Drive resumable streaming: PDF payloads must NEVER upload through Node/Express or Vercel serverless functions; stream 5 MB chunks directly from browser to Google Drive resumable session URLs with default concurrency 3.
  - Backend endpoints in `backend/src/routes/drive.ts`: `POST /api/drive/bulk/classify`, `POST /api/drive/bulk/check-duplicates`, `POST /api/drive/bulk/register` (transactional `BEGIN ... COMMIT`), and `GET /api/drive/materials` supporting `applicable_groups @>` multi-group filtering.
  - Full-content extraction via `fullTextbookExtractor.ts` across all PDF pages (no truncation), preserving Tamil/English Unicode with Tesseract OCR fallback for scanned pages.
  - Build gate: Frontend (`npm run build`) and Backend (`npm run build --prefix backend`) must compile with zero errors.

## Class-wise AI Syllabus Import API & Schema Extensions
- source: docs/superpowers/plans/2026-11-05-class-wise-ai-syllabus-import.md
- type: api-contract
- content:
  - Extend `ExtractedUnitDraft` in `backend/src/services/aiSyllabusImportService.ts` with `standard_number: number` (6 to 12) and `term?: string`; update `analyzeSyllabus` to accept `standard?: number | 'all'` with 10s AI provider timeout and structural parser fallback.
  - Routes `/ai-syllabus/upload` and `/ai-syllabus/analyze-text` in `backend/src/routes/studyMaterialsManagementRoutes.ts` forward `standard` from `req.body`.
  - `publishApprovedSyllabus` writes `standard_number` to `syllabus_units` and `standard_number`/`term` to `syllabus_lessons` (creates separate units per class 6-12; see INGEST-CONFLICTS.md WARNING against 2026-11-07 Single Parent Unit spec).

## AI Syllabus Import Engine (12-Step) Architecture & Preservation
- source: docs/superpowers/specs/2026-11-07-ai-syllabus-import-design.md
- type: nfr
- content:
  - Single Parent Unit container: Each TNPSC syllabus unit exists as ONE parent container; Standards 6th-12th nest inside it. Never create multiple parent unit boxes per standard.
  - Reuse existing 72 textbooks in `google_drive_materials` (`extracted_toc`); never duplicate PDF files.
  - Preservation: All existing 51 units, 1,725 lessons, 6,002 topics, 592 study notes, and 72 textbooks remain untouched; non-destructive Option A merge appends new standards/lessons and matches existing lessons by `(unit_id, standard_number, lesson_number)` in a single `BEGIN ... COMMIT` PostgreSQL transaction.
  - Drafts stay in component memory / `sessionStorage` until admin explicitly clicks "Approve & Publish to Database"; LLM note/MCQ generation is chunked per lesson.

## AI Syllabus Import Engine API & Type Contracts
- source: docs/superpowers/plans/2026-11-07-ai-syllabus-import.md
- type: api-contract
- content:
  - Backend service `backend/src/services/aiSyllabusEngineService.ts` and types `backend/src/types/aiSyllabusTypes.ts` (`CanonicalUnitDraft`, `MatchedLessonDraft`, `ExtractedTopicDraft`, `GeneratedNotesDraft`, `GeneratedMCQDraft`, `PublishSyllabusPayload`).
  - REST endpoints mounted at `/api/study-management/ai-import` (`backend/src/routes/aiSyllabusImportRoutes.ts`) with `requireAuth`: `POST /analyze`, `POST /match`, `POST /generate-notes`, `POST /generate-mcqs`, `POST /publish`.
  - Build gate: Both frontend (`tsc -b && vite build`) and backend (`tsc`) must pass with 0 errors after every task.

## Phase 1 Neon Pooling, TLS & Cold-Start Hardening
- source: docs/designs/phase1_implementation_plan.md
- type: nfr
- content:
  - Strict preservation: Zero deletions/mutations of existing PostgreSQL records, published `questions.id`, `correct_answer` indices, student attempts, 72 textbook records, Google Drive folder structures, or `vercel.json`.
  - `backend/src/db.ts`: Gate `dotenv.config()` behind `if (!process.env.VERCEL)`; on serverless (`Boolean(process.env.VERCEL)`), set `max: 2`, `idleTimeoutMillis: 5000`, `allowExitOnIdle: true`; export `getDirectDatabaseUrl()`; enforce TLS `rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false'`.
  - Gate `ensureDatabaseSchema()` in `backend/src/routes/drive.ts` and `backend/src/routes/textbooks.ts` behind `process.env.SKIP_RUNTIME_SCHEMA_CHECK !== 'true'`.

## Phase 1 Backward-Compatible Query & Caching Contracts
- source: docs/designs/phase1_implementation_plan.md
- type: api-contract
- content:
  - Preserve exact JSON response fields (`status`, `total`, `count`, `limit`, `offset`, `metrics`, `filteredTotal`, `data`) on `GET /api/questions`, `GET /api/study-materials/questions`, `GET /api/notes`, and their `/admin` variants.
  - Public endpoints fetch `SELECT *` first and skip `SELECT COUNT(*)` when `safeOffset === 0 && rows.length < safeLimit`.
  - Admin endpoints cache `metricsResult` per `targetSystem` in `backend/src/utils/cache.ts` (30s TTL, invalidated on `POST`/`PATCH`/`DELETE`/`publish`) and run `countQuery` + `dataQuery` in `Promise.all`.
  - Replace per-row correlated `OR` subqueries on `study_notes` in `backend/src/services/studyManagementService.ts` with pre-aggregated CTEs/`LEFT JOIN`s while preserving exact `has_notes`, `notes_count`, and `notes_id` parity.

## 50k-Scale Performance SLOs & Infrastructure Constraints
- source: docs/designs/tnpsc_study_hub_architecture_roadmap.md
- type: nfr
- content:
  - Phase 1 SLO targets: Warm Student Quiz Read p95 < 120 ms; Admin Metrics Query < 30 ms; Lesson Question Lookup < 25 ms; Vercel Lambda connections 1-2 per Lambda via `-pooler`; Job Table dead-tuple bloat < 15% (`FILLFACTOR = 70` on `mcq_generation_jobs`, drop redundant `study_notes` indexes with `CONCURRENTLY`).
  - Dual DB URLs: `DATABASE_URL` (`-pooler`, transaction mode) for Vercel runtime and `DIRECT_URL` (unpooled) for migrations, `CONCURRENTLY` DDL, and worker locks.
  - Upload limit: Bypass Vercel's 4.5 MB body limit via direct-to-object-storage presigned URLs (Cloudflare R2 / S3).
  - Worker execution: Persistent Railway/Render worker (2 GB RAM) using `FOR UPDATE SKIP LOCKED`, `locked_until` lease reaper, `attempt_count` DLQ (`failed_permanent`), and native `poppler-utils` + `tesseract` CLI (1-5 pages at a time on `/tmp`); gate cutover behind `USE_DURABLE_WORKER`.
  - Proxy & CORS: Keep `vercel.json` `/api/*` rewrite in Phase 1; before removing it, either consolidate into a single Vercel project or verify `Access-Control-Allow-Origin` and `Access-Control-Allow-Headers: Authorization, Content-Type`.
