# Synthesized Decisions

## Hybrid Architecture: Vercel Frontend/API + Persistent Worker Container
- source: docs/designs/concepts_brief.md
- status: proposed
- decision: Keep React SPA and standard API routes on Vercel, while offloading McqJobService, pdfExtractionService, googleDriveSyncService, and async post-publish Tamil pre-translation to a persistent worker container on Railway/Render (2 GB RAM) backed by Redis/Postgres.
- scope: TNPSC Study Hub, Vercel Serverless, Admin ingestion pipeline, PDF/OCR extraction, MCQ translation

## Database Platform: Keep Neon PostgreSQL with Pooled Connections (-pooler)
- source: docs/designs/concepts_brief.md
- status: proposed
- decision: Keep Neon PostgreSQL; switch DATABASE_URL to Neon's PgBouncer pooled endpoint (-pooler), cap per-Lambda pg.Pool max to 3, remove per-request metricsResult full-table scans from public GET /api/questions, add partial index on published questions, and remove ensureDatabaseSchema() from request middleware (drive.ts, textbooks.ts).
- scope: Neon PostgreSQL, Vercel Serverless, backend/src/db.ts, backend/src/routes/questions.ts

## MCQ Translation Delivery: Pre-translate on Publish + Small Synchronous Fallback
- source: docs/designs/concepts_brief.md
- status: proposed
- decision: Enqueue batch-of-5 English-to-Tamil translations asynchronously when an Admin publishes staging MCQs, and cap synchronous student fallback translation requests at 5-10 uncached IDs per call.
- scope: MCQ translation, backend/src/services/mcqTranslationService.ts

## Syllabus Single Source of Truth: PostgreSQL Write-Master + Edge-Cached Snapshots
- source: docs/designs/concepts_brief.md
- status: proposed
- decision: Reconcile static src/data/ syllabus items into PostgreSQL with additive INSERT ... ON CONFLICT DO NOTHING (preserving all existing IDs), move MockTests.tsx static data into DB-backed records, and serve /api/syllabus/* with Upstash Redis + CDN caching (Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400).
- scope: syllabus single source of truth, src/data/unifiedSyllabusRegistry.ts, backend/src/routes/syllabusRoutes.ts

## Admin Modularization & Root Cleanup
- source: docs/designs/concepts_brief.md
- status: proposed
- decision: Split Admin.tsx (10,503 lines) into lazy-loaded sub-routes under /admin/* (<200 KB per chunk), move shared DTOs out of backend/src/ into src/types/ or shared/, and archive unused root diagnostic .cjs/.md scripts after build verification.
- scope: Admin.tsx, TNPSC Study Hub
