</Testing Patterns>
<Codebase Concerns>
**Analysis Date:** 2026-11-18

## Tech Debt

**Monolithic Admin Page & Oversized Components:**
- Issue: `src/pages/Admin.tsx` is 10,533 lines and mixes authentication, Google Drive OAuth, AI provider config, prompt management, analytics, syllabus, and question management in a single file. Several other UI and service files exceed 2,000 lines.
- Files: `src/pages/Admin.tsx` (10,533 lines), `src/components/admin/StudyMaterialsManagement.tsx` (3,304 lines), `backend/src/services/aiSyllabusEngineService.ts` (2,808 lines), `backend/src/services/studyManagementService.ts` (2,425 lines), `src/components/McqCascadeGenerator.tsx` (1,983 lines), `backend/src/routes/questions.ts` (1,962 lines), `backend/src/routes/drive.ts` (1,826 lines), `backend/src/routes/student.ts` (1,742 lines)
- Impact: Slow editor/bundler feedback, high merge-conflict risk, and difficulty isolating state bugs (e.g. `oxlint` flags `react-hooks/exhaustive-deps` and `set-state-in-effect` warnings inside `src/pages/Admin.tsx`).
- Fix approach: Split `src/pages/Admin.tsx` into route-level lazy sub-pages under `src/pages/admin/` and extract API/state hooks; decompose large backend route files (`questions.ts`, `drive.ts`, `student.ts`) into controller/service modules.

**Missing Frontend Strict TypeScript Mode & Linter Debt:**
- Issue: `tsconfig.app.json` omits `"strict": true` (unlike `backend/tsconfig.json`), allowing implicit `any` and unchecked nullability in React components. `src/components/BulkPdfUploadModal.tsx` (line 956) also uses `// @ts-ignore`. Running `npx oxlint` reports 522 warnings and 3 errors across 723 files.
- Files: `tsconfig.app.json`, `src/components/BulkPdfUploadModal.tsx`, `src/pages/Admin.tsx`
- Impact: Runtime null-reference bugs and stale React hook closures go undetected at compile time.
- Fix approach: Enable `"strict": true` incrementally in `tsconfig.app.json`, replace `@ts-ignore` with typed interfaces, and clear the 3 `oxlint` errors and hook-dependency warnings.

**Static Syllabus Data Hardcoded in Client & Server Bundles:**
- Issue: Large syllabus and question datasets are committed as TypeScript source files rather than served purely from PostgreSQL/JSON assets.
- Files: `src/data/group2TamilData.ts` (5,778 lines), `backend/src/data/canonicalSyllabusLessons.ts` (5,242 lines), `src/data/group2EnglishData.ts` (4,226 lines), `src/data/generalTamilComprehensiveData.ts` (3,894 lines), `src/data/group2ClassSyllabusData.ts` (3,378 lines), `src/data/generalEnglishComprehensiveData.ts` (2,385 lines), `backend/src/data/tnpscSyllabusMasterCatalog.ts` (1,784 lines)
- Impact: Inflates frontend JS chunks, duplicates syllabus truth between `src/data/` and `backend/src/data/`, and requires a full frontend redeploy for content edits.
- Fix approach: Consolidate canonical syllabus data in PostgreSQL (seeded via `backend/src/services/seedSyllabusCatalog.ts`) and fetch lazily from API endpoints.

**Root-Level Clutter & Duplicated OCR Models:**
- Issue: Large working/artifact files sit at the repository root and `eng.traineddata` is duplicated in both the root and `backend/`.
- Files: `eng.traineddata`, `backend/eng.traineddata`, `backend/tam.traineddata`, `495_Group II and IIA prelims.pdf`, `staged_questions_batch1.json`, `public/assets/thirukkural-hero.mp4`
- Impact: Bloats workspace size and risks accidental deployment of oversized static assets.
- Fix approach: Remove duplicate root `eng.traineddata` and move one-off PDF/JSON staging files out of the repo root.

## Known Bugs

**Swallowed Database Errors in Student Auth Middleware:**
- Issue: In `requireStudentAuth`, database lookup failures (e.g. Neon connection timeout) are caught and only logged (`console.error('[requireStudentAuth DB check notice]:', dbErr)`), allowing execution to fall through to `next()` with an unverified `is_active` / `token_version` state.
- Files: `backend/src/middleware/auth.ts` (lines 245-248)
- Trigger: Transient PostgreSQL/Neon outage during an authenticated student request.
- Workaround: None; revoked or deactivated accounts could temporarily bypass DB checks during DB errors.

**Uncaught Exceptions Prevented From Exiting:**
- Issue: `backend/src/server.ts` registers a global `process.on('uncaughtException')` handler (lines 544-546) that logs the error without terminating the process.
- Files: `backend/src/server.ts` (lines 544-546)
- Trigger: Any synchronous unhandled exception in Express middleware or background jobs.
- Workaround: None; leaves long-running local Node processes in an undefined state.

## Security Considerations

**Hardcoded Fallback JWT Secrets & Dev Auth Bypass:**
- Risk: Both admin and student HMAC-SHA256 token signing/verification fall back to hardcoded string literals (`'tnpsc_quiz_admin_jwt_secret_key_2026'` and `'tnpsc_student_session_secret_key_2026'`) if `ADMIN_JWT_SECRET` / `STUDENT_JWT_SECRET` are unset. Additionally, `requireAdminAuth` bypasses token verification whenever `NODE_ENV !== 'production'` (accepting missing tokens or `token.length < 20`).
- Files: `backend/src/middleware/auth.ts` (lines 5-7, 73-89, 112-114)
- Current mitigation: Production deployments on Vercel set `NODE_ENV=production`.
- Recommendations: Fail fast on startup in production if `ADMIN_JWT_SECRET` or `STUDENT_JWT_SECRET` is missing, and gate dev bypass behind an explicit opt-in flag (e.g., `ALLOW_DEV_AUTH_BYPASS=true`).

**Plaintext Admin Passwords & Default Seeded Credentials:**
- Risk: `ensureAdminUsersTable()` seeds default accounts with weak hardcoded passwords (`'tnpscadmin2026'`, `'tnpsccontent2026'`, `'tnpscreview2026'`) and stores/compares `admin_users.password` in plaintext (`user.password === cleanPass`), unlike student passwords which use `crypto.scryptSync`.
- Files: `backend/src/routes/auth.ts` (lines 25-52, 80-89, 177)
- Current mitigation: Environment variables (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_USERS`) override defaults when configured.
- Recommendations: Hash all `admin_users` passwords with `scrypt` (matching `hashStudentPassword` in `backend/src/middleware/auth.ts`) and remove hardcoded default passwords in production.

**Bearer Tokens Accepted via URL Query String & Stored in `localStorage`:**
- Risk: `requireAdminAuth`, `requireStudentAuth`, and `optionalStudentAuth` accept `?token=...` query parameters, which can leak into server/proxy/browser history logs. On the frontend, admin and student tokens are stored in `localStorage` under multiple keys (`tnpsc_admin_token`, `adminToken`, `token`).
- Files: `backend/src/middleware/auth.ts` (lines 68, 190, 260), `src/context/StudentAuthContext.tsx` (line 41), `src/components/admin/StudyMaterialsManagement.tsx` (lines 194-196)
- Current mitigation: `Authorization: Bearer` header is the primary transport.
- Recommendations: Remove `req.query.token` fallback (except for dedicated signed download links if needed) and standardize on a single token storage key or `HttpOnly` cookies.

**Permissive Vercel CORS Regex:**
- Risk: `isOriginAllowed` allows any origin matching `/^https:\/\/tnpsc-quiz.*\.vercel\.app$/` or `/^https:\/\/.*-moonzoro\.vercel\.app$/`, and allows all origins when `NODE_ENV !== 'production'`.
- Files: `backend/src/server.ts` (lines 65-98)
- Current mitigation: Restricts to `moonzoro` / `tnpsc-quiz` Vercel subdomains in production.
- Recommendations: Restrict production CORS to explicit `CORS_ORIGIN` / `FRONTEND_URL` values.

## Performance Bottlenecks

**Oversized Frontend Build Chunks:**
- Problem: `npx vite build` emits `dist/assets/Admin-DXpNPgad.js` at **1,136.70 kB** (263.96 kB gzipped), triggering Vite's >600 kB chunk size warning (`chunkSizeWarningLimit: 600` in `vite.config.ts`). Syllabus data chunks are also large: `group2TamilData` (453.90 kB), `group2ClassSyllabusData` (438.34 kB), and `generalTamilComprehensiveData` (283.11 kB).
- Files: `vite.config.ts`, `src/pages/Admin.tsx`, `src/data/group2TamilData.ts`, `src/data/group2ClassSyllabusData.ts`, `src/data/generalTamilComprehensiveData.ts`
- Cause: `Admin.tsx` is lazy-loaded as one monolithic chunk, and static syllabus TS modules are bundled directly.
- Improvement path: Code-split admin sub-tabs with `React.lazy` inside `Admin.tsx` and move large syllabus datasets to backend API responses.

**Global `no-store` Cache Headers on All `/api` Routes:**
- Problem: `backend/src/server.ts` strips `If-None-Match` / `If-Modified-Since` and sets `Cache-Control: no-store, no-cache, must-revalidate` globally on `/api`, preventing browser or CDN caching even for static syllabus catalog endpoints.
- Files: `backend/src/server.ts` (lines 42, 226-237)
- Cause: Blanket workaround to prevent HTTP 304 on dynamic endpoints.
- Improvement path: Apply `no-store` only to auth/mutation/user-specific routes and allow short `max-age` / `stale-while-revalidate` on read-only syllabus/catalog endpoints.

## Fragile Areas

**Monolithic Inline Migration & Skipped Serverless Schema Checks:**
- Files: `backend/src/migrate.ts` (1,401 lines), `backend/src/server.ts` (lines 548-561)
- Why fragile: All schema DDL, `ALTER TABLE` patches, index creation, and data backfills live in one 1,401-line `runMigration()` function without versioned migration tracking. On Vercel (`process.env.VERCEL`), `ensureDatabaseSchema()` is never called at startup (`server.ts:548`), so schema drift in production will cause runtime SQL errors until manually migrated.
- Safe modification: Append idempotent `IF NOT EXISTS` DDL carefully and run `migrate.ts` against target DBs before deploying backend changes.
- Test coverage: None; no automated migration tests exist.

**Ephemeral File Uploads & Long-Running Jobs on Vercel Serverless:**
- Files: `backend/vercel.json`, `backend/src/routes/textbooks.ts` (lines 56-82), `backend/src/routes/drive.ts` (lines 1577-1767), `backend/src/services/aiSyllabusJobService.ts`
- Why fragile: `backend/vercel.json` sets `maxDuration: 60` and `memory: 1024`. Textbook uploads (`multer.diskStorage`) and OCR/PDF extraction fall back to `os.tmpdir()` on Vercel, which is ephemeral and not shared across invocations. Background AI/OCR jobs exceeding 60s will be terminated mid-flight.
- Safe modification: Offload binary storage to Google Cloud Storage / Google Drive and ensure long-running AI/OCR jobs are resumable or executed off-serverless.
- Test coverage: `backend/tests/aiSyllabusJobService.test.ts` covers job state logic, but not serverless timeout/filesystem boundaries.

## Scaling Limits

**Process-Local In-Memory Cache:**
- Current capacity: 500 entries max in a single Node process `Map` (`backend/src/utils/cache.ts`, lines 11-30).
- Limit: Not shared across Vercel serverless function instances; `invalidateCachePrefix()` only clears the current instance's memory, causing stale reads across concurrent instances until TTL expiry.
- Scaling path: Replace with Redis/Upstash or PostgreSQL-backed caching if horizontal/serverless consistency is required.

**Serverless PostgreSQL Connection Pool:**
- Current capacity: `max: 2` connections per Vercel function (`backend/src/db.ts`, line 32) vs `max: 10` locally.
- Limit: High concurrent serverless traffic can exhaust Neon connection limits if not routed through Neon's connection pooler (`-pooler` endpoint).
- Scaling path: Enforce pooled `DATABASE_URL` in production and reserve `DIRECT_URL` strictly for migrations.

## Dependencies at Risk

**Multiple Overlapping AI & PDF/OCR Stacks:**
- Risk: `backend/package.json` includes `@anthropic-ai/sdk`, `@google/generative-ai`, `@google-cloud/vision`, `@google-cloud/storage`, `googleapis`, `pdf-parse`, and `tesseract.js` (`v7.0.0`). Bundling `tesseract.js` + `pdf-parse` + cloud SDKs increases cold-start time and memory pressure within Vercel's 1024 MB limit.
- Impact: Slower serverless cold starts and higher maintenance surface across multiple AI provider wrappers (`backend/src/services/ai/` and `backend/src/services/cloudAi/`).
- Migration plan: Consolidate legacy `backend/src/services/cloudAi/` into `backend/src/services/ai/` and offload heavy OCR/PDF processing from serverless functions.

## Missing Critical Features

- **Unified Automated Test Runner:** Neither root `package.json` nor `backend/package.json` defines a `"test"` script or CI test pipeline.
- **Rate Limiting on Auth & AI Endpoints:** `backend/src/routes/auth.ts` and `backend/src/routes/student.ts` have no `express-rate-limit` middleware protecting login, registration, or expensive AI generation endpoints.

## Test Coverage Gaps

**Frontend Application (`src/`):**
- What's not tested: All React pages, components, routing, `StudentAuthContext`, quiz/mock-test state, and `Admin.tsx` (0 test files in `src/`).
- Files: `src/pages/*.tsx`, `src/components/**/*.tsx`, `src/context/StudentAuthContext.tsx`
- Risk: Regressions in quiz scoring, timer/attempt submission, and admin workflows go undetected until manual testing.
- Priority: High

**Backend Routes & Services (`backend/src/`):**
- What's not tested: Only 4 test files exist (`backend/tests/aiSyllabusJobService.test.ts`, `backend/tests/geminiJsonParser.test.ts`, `backend/tests/geminiRetryService.test.ts`, `backend/tests/studentAuthOAuth.test.ts`). Core routes (`questions.ts`, `notes.ts`, `student.ts`, `auth.ts`, `drive.ts`, `textbooks.ts`, `mockTestsRoutes.ts`), auth middleware (`backend/src/middleware/auth.ts`), and DB migrations (`backend/src/migrate.ts`) have no automated tests.
- Files: `backend/src/routes/*.ts`, `backend/src/middleware/auth.ts`, `backend/src/migrate.ts`
- Risk: Auth/authorization regressions, SQL query errors, and migration failures are only caught in live environments.
- Priority: High

---

*Concerns audit: 2026-11-18*
