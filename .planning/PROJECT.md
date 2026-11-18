# TNPSC Study Hub (tnpsc-quiz)

## What This Is

TNPSC Study Hub is a bilingual (Tamil and English) exam preparation platform for Tamil Nadu Public Service Commission (TNPSC) aspirants covering Group 1, Group 2, Group 2A, Group 4, and VAO exams. It provides a React 19 + Vite 8 + TypeScript SPA for students and administrators, backed by an Express 4 + TypeScript + PostgreSQL (Neon) REST/SSE API deployed on Vercel with AI-powered syllabus import, MCQ generation, study notes, mock tests, and Samacheer Kalvi textbook ingestion.

## Core Value

Reliable, fast, bilingual (Tamil/English) TNPSC exam study, MCQ practice, and mock-test delivery backed by a single PostgreSQL syllabus source of truth and a non-destructive AI ingestion pipeline.

## Requirements

### Validated

(None yet — existing brownfield platform undergoing structured hardening and roadmap execution)

### Active

- [ ] Harden Neon PostgreSQL pooling (`-pooler` + `DIRECT_URL`), query latency (<120 ms warm quiz read), and auth/CORS security for 50k-scale serverless operation
- [ ] Deliver route-scoped bilingual (`en` | `ta`) switching and batch pre-translated MCQ delivery on Study Materials, MCQ Practice, and Mock Tests
- [ ] Implement the 12-step Single Parent Unit AI Syllabus Import Engine (`aiSyllabusEngineService.ts`) with non-destructive Option A merge preserving all existing units, lessons, topics, notes, and 72 textbooks
- [ ] Enable Direct-to-Drive bulk PDF upload with SHA-256 deduplication and offload long-running PDF/OCR/MCQ jobs to a persistent worker container
- [ ] Consolidate static syllabus data into PostgreSQL as the single source of truth with edge caching, modularize `Admin.tsx` into <200 KB lazy chunks, and enforce strict TypeScript/lint/test gates

### Out of Scope

- **Per-standard parent syllabus units (`2026-11-05-class-wise-ai-syllabus-import.md`)** — Superseded by the approved 2026-11-07 Single Parent Unit container model; creating separate parent unit boxes per class (6th–12th) is prohibited.
- **Automatic cross-provider AI fallback** — `AIProviderFactory` enforces strict multi-provider isolation (`claude`, `gemini`, `openai`) with explicit admin selection.
- **Destructive syllabus/question migrations** — Zero deletions or ID mutations of existing published `questions.id`, `correct_answer` indices, student attempts, or 72 textbook records.
- **Bilingual switch on Home, Dashboard, Admin, or Auth** — Language switching is scoped strictly to `/materials*`, `/practice*`, and `/mock-tests*`.

## Context

- **Codebase State (2026-11-18):** Brownfield monorepo (`src/` React 19 + Vite 8 frontend; `backend/` Express 4 + TypeScript API). 51 units, 1,725 lessons, 6,002 topics, 592 study notes, and 72 textbooks currently live in PostgreSQL.
- **Key Technical Debt:** Monolithic `src/pages/Admin.tsx` (10,533 lines, 1,136.70 kB bundle chunk), static syllabus TS files duplicated between `src/data/` and `backend/src/data/`, missing `"strict": true` in `tsconfig.app.json`, global `Cache-Control: no-store` on `/api/*`, runtime `ensureDatabaseSchema()` in request handlers, and minimal automated test coverage (4 backend test files, 0 frontend tests).
- **Security Debt:** Hardcoded fallback JWT secrets, `NODE_ENV !== 'production'` admin auth bypass, plaintext `admin_users` passwords, `?token=` query-string fallback, and missing `express-rate-limit` on auth/AI routes.

## Constraints

- **Tech Stack**: React 19 + Vite 8 + TypeScript (frontend), Node.js 24 + Express 4 + TypeScript (backend), Neon PostgreSQL, Google Drive API / Cloud Vision / Tesseract.js, Anthropic Claude / Google Gemini / OpenAI.
- **Preservation**: Zero deletions or mutations of existing PostgreSQL records, published `questions.id`, `correct_answer` indices, student attempts, 72 textbook records, or Google Drive folder structures.
- **Vercel Limits**: Bypass 4.5 MB request body limit via direct-to-Drive/object-storage resumable uploads; keep serverless functions within 60s `maxDuration` and 1024 MB memory by offloading heavy jobs to a persistent worker.
- **Build Gate**: Both `npm run build` (`tsc -b && vite build`) and `npm run build --prefix backend` (`tsc`) must pass with 0 errors.

## Key Decisions

<decisions>
- **[LOCKED] Single Parent Unit Container for AI Syllabus Import (2026-11-07):** `docs/superpowers/specs/2026-11-07-ai-syllabus-import-design.md` (`aiSyllabusEngineService.ts`) supersedes `docs/superpowers/plans/2026-11-05-class-wise-ai-syllabus-import.md`. Each TNPSC syllabus unit exists as ONE parent container with Standards 6th–12th nested inside; non-destructive Option A merge preserves all 51 units, 1,725 lessons, 6,002 topics, 592 notes, and 72 textbooks.
- **[LOCKED] ADR > SPEC Serverless `pg.Pool` Max Size:** Per `docs/designs/concepts_brief.md` (ADR), cap per-Lambda `pg.Pool` `max` to `3` using Neon's PgBouncer `-pooler` endpoint for `DATABASE_URL` and unpooled `DIRECT_URL` for migrations/DDL (auto-resolved over SPEC `max: 2`).
- **[LOCKED] Hybrid Architecture (Vercel + Persistent Worker Container):** Keep React SPA and standard API routes on Vercel; offload `McqJobService`, `pdfExtractionService`, `googleDriveSyncService`, and post-publish Tamil pre-translation to a persistent 2 GB RAM worker container (Railway/Render) gated behind `USE_DURABLE_WORKER`.
- **[LOCKED] MCQ Translation Delivery:** Pre-translate batch-of-5 English-to-Tamil MCQs asynchronously on Admin publish, with a small synchronous fallback capped at 5–10 uncached IDs per student request.
- **[LOCKED] Syllabus Single Source of Truth:** PostgreSQL write-master (`INSERT ... ON CONFLICT DO NOTHING` preserving IDs) + edge-cached snapshots (`Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` / Upstash Redis).
- **[LOCKED] Admin Modularization & Root Cleanup:** Split `src/pages/Admin.tsx` into lazy-loaded `/admin/*` sub-routes (<200 KB per chunk), move shared DTOs to `src/types/` or `shared/`, and archive unused root diagnostic scripts.
</decisions>

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single Parent Unit container (`aiSyllabusEngineService.ts`) | Prevents duplicate per-standard unit boxes and preserves existing 51 units / 72 textbooks | ✓ Locked (supersedes 2026-11-05) |
| Neon `-pooler` (`max: 3` per Lambda) + `DIRECT_URL` | Prevents connection exhaustion at 50k scale while supporting `CONCURRENTLY` DDL | ✓ Locked (ADR > SPEC) |
| Hybrid Vercel + Persistent Worker (`USE_DURABLE_WORKER`) | Avoids Vercel 60s timeout and 1024 MB memory limits on OCR/PDF/AI jobs | — Pending |
| Pre-translate on publish + small sync fallback | Eliminates student-facing translation latency spikes | — Pending |
| PostgreSQL Syllabus SSOT + Edge/Redis Cache | Eliminates duplicated `src/data/` vs `backend/src/data/` truth and reduces bundle size | — Pending |
| Lazy `/admin/*` modularization (<200 KB chunks) | Eliminates 1.14 MB `Admin` chunk and isolates state bugs | — Pending |

---
*Last updated: 2026-11-18 after brownfield codebase map and design/spec ingest*
