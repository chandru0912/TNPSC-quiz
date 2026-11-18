# Codebase Structure

**Analysis Date:** 2026-11-18

## Directory Layout

```
tnpsc-quiz/
├── src/                        # Frontend React 19 + TypeScript + Vite SPA
│   ├── assets/                 # Static images and SVG icons
│   ├── components/             # Reusable UI, modals, admin & analytics widgets
│   │   ├── admin/              # Admin Control Center, Mock Test & AI Syllabus wizard
│   │   │   ├── ai-syllabus/    # 4-phase AI Syllabus Import Wizard (Phase A–D)
│   │   │   └── pages/          # Admin sub-pages (New/Restore Student, Subscriptions)
│   │   └── analytics/          # Recharts dashboards, TN map, KPI cards & indicators
│   ├── context/                # React Context providers (`StudentAuthContext.tsx`)
│   ├── data/                   # Static TNPSC Group 1/2/2A/4 syllabus & catalog data
│   ├── hooks/                  # Custom hooks (study timer, scroll lock, translations)
│   ├── layouts/                # Persistent dashboard shell (`StudentDashboardLayout.tsx`)
│   ├── pages/                  # Route-level page components + co-located CSS
│   ├── services/               # Frontend API/cache services (`dynamicSyllabusService.ts`)
│   ├── styles/                 # Global theme, fonts, Tamil typography, spatial logo CSS
│   ├── utils/                  # API client, OAuth, SSE/BroadcastChannel sync, Unicode
│   ├── App.tsx                 # Root router, lazy loading, ErrorBoundary, SVG defs
│   └── main.tsx                # React DOM mount & production Service Worker registration
├── backend/                    # Backend Express 4 + TypeScript + PostgreSQL API
│   ├── src/
│   │   ├── data/               # Canonical syllabus catalogs, textbook catalog, staged batches
│   │   ├── middleware/         # HMAC-SHA256 Admin & Student auth (`auth.ts`)
│   │   ├── routes/             # Express routers (18 domain route files)
│   │   ├── scripts/            # DB seeders, production DB checks, audit scripts
│   │   ├── services/           # Business logic, OCR/PDF, Drive sync, analytics, AI
│   │   │   ├── ai/             # Multi-provider AI factory (`claude`, `gemini`, `openai`)
│   │   │   └── cloudAi/        # Legacy/direct Claude cloud content helpers
│   │   ├── types/              # Shared TypeScript interfaces (`aiSyllabusTypes.ts`)
│   │   ├── utils/              # TTL cache, natural sort, Tamil Unicode, prod DB env
│   │   ├── db.ts               # PostgreSQL `pg.Pool` configuration
│   │   ├── migrate.ts          # Idempotent DDL schema & index migrations (35+ tables)
│   │   └── server.ts           # Express app setup, CORS, route mounting, health checks
│   ├── scripts/                # Verification scripts (`verify-lesson-mapping.ts`)
│   ├── tests/                  # Backend unit tests (`*.test.ts`)
│   ├── uploads/textbooks/      # Local uploaded textbook PDFs
│   ├── package.json            # Backend dependencies & scripts
│   └── vercel.json             # Vercel serverless function config (60s, 1024MB)
├── public/                     # Static public assets, PWA manifest/service worker
├── docs/                       # Project documentation
├── scripts/                    # Root-level utility scripts
├── package.json                # Frontend dependencies & Vite/oxlint scripts
├── vite.config.ts              # Vite bundler, manualChunks, `/api` dev proxy
└── vercel.json                 # Frontend Vercel asset caching & `/api` rewrites
```

## Directory Purposes

**`src/pages/`:**
- Purpose: Top-level route components for public, student portal, and admin views.
- Contains: `.tsx` pages and co-located `.css` files (e.g., `Dashboard.tsx`, `MCQPractice.tsx`, `MockTests.tsx`, `PreviousPapers.tsx`, `Admin.tsx`).
- Key files: `src/pages/Home.tsx`, `src/pages/Dashboard.tsx`, `src/pages/MCQPractice.tsx`, `src/pages/Admin.tsx`.

**`src/components/admin/` & `src/components/analytics/`:**
- Purpose: Modular admin management consoles and data visualization widgets.
- Contains: Sidebar/header shells, `MockTestManagement.tsx`, `StudyMaterialsManagement.tsx`, `ai-syllabus/PhaseASetup.tsx`–`PhaseDPublish.tsx`, and `analytics/indicators/*`.
- Key files: `src/components/admin/AdminControlCenter.tsx`, `src/components/admin/ai-syllabus/AiSyllabusImportWizard.tsx`, `src/components/analytics/AdvancedAnalyticsDashboard.tsx`.

**`src/data/` & `backend/src/data/`:**
- Purpose: Canonical TNPSC syllabus definitions, Samacheer Kalvi textbook catalogs, and staged question batches.
- Contains: Group-specific syllabus trees and master catalogs.
- Key files: `src/data/unifiedSyllabusRegistry.ts`, `src/data/samacheerTextbookCatalog.ts`, `backend/src/data/tnpscSyllabusMasterCatalog.ts`, `backend/src/data/canonicalSyllabusLessons.ts`.

**`backend/src/routes/`:**
- Purpose: HTTP & SSE endpoint definitions grouped by domain.
- Contains: 18 Express router modules mounted in `backend/src/server.ts`.
- Key files: `backend/src/routes/student.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/questions.ts`, `backend/src/routes/syllabusRoutes.ts`, `backend/src/routes/aiGeneration.ts`, `backend/src/routes/analyticsRoutes.ts`, `backend/src/routes/mockTestsRoutes.ts`, `backend/src/routes/studyMaterialsManagementRoutes.ts`.

**`backend/src/services/`:**
- Purpose: Core business logic, database queries, PDF/OCR extraction, Google Drive sync, and AI orchestration.
- Contains: Domain services and `ai/` sub-architecture (`providers/claude/`, `providers/gemini/`, `providers/openai/`, `shared/`).
- Key files: `backend/src/services/studentDashboardService.ts`, `backend/src/services/studyManagementService.ts`, `backend/src/services/ai/ai-provider.factory.ts`, `backend/src/services/ai/shared/generation-orchestrator.ts`.

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Frontend React root render and Service Worker registration.
- `src/App.tsx`: Frontend `<Router>` with all public, `/dashboard/*`, `/materials/*`, `/practice/*`, and `/admin/*` routes.
- `backend/src/server.ts`: Backend Express application bootstrap and Vercel serverless export.

**Configuration:**
- `package.json` & `vite.config.ts`: Frontend build (`tsc -b && vite build`), `oxlint`, manual chunk splitting, and `/api` -> `http://localhost:5000` proxy.
- `vercel.json` & `backend/vercel.json`: Production Vercel routing, asset cache headers, and serverless function limits.
- `backend/package.json` & `backend/tsconfig.json`: Backend TypeScript compilation (`dist/server.js`) and `tsx` dev runner.
- `backend/src/db.ts`: PostgreSQL `pg.Pool` connection settings (Neon SSL & serverless pool sizing).

**Core Logic:**
- `src/utils/api.ts`: `apiFetch()` and `getApiUrl()` with 404/network multi-tier failover.
- `src/context/StudentAuthContext.tsx`: Student authentication state and Admin Student Preview mode.
- `src/services/dynamicSyllabusService.ts`: Reactive syllabus tree fetching, caching, and cross-tab sync.
- `backend/src/middleware/auth.ts`: HMAC-SHA256 token generation/verification (`requireAdminAuth`, `requireStudentAuth`).
- `backend/src/migrate.ts`: Idempotent PostgreSQL schema creation (`ensureDatabaseSchema` / `runMigration`).

**Testing:**
- `backend/tests/aiSyllabusJobService.test.ts`: AI syllabus job service tests.
- `backend/tests/geminiJsonParser.test.ts`: Gemini JSON parser tests.
- `backend/tests/geminiRetryService.test.ts`: Gemini retry logic tests.
- `backend/tests/studentAuthOAuth.test.ts`: Student Google OAuth flow tests.

## Naming Conventions

**Files:**
- React components & pages: PascalCase `.tsx` with co-located `.css` (`src/pages/MCQPractice.tsx`, `src/pages/MCQPractice.css`).
- Frontend hooks, utils & services: camelCase `.ts` (`src/hooks/useStudyTimeTracker.ts`, `src/utils/studentSync.ts`).
- Backend routes & services: camelCase `.ts` (`backend/src/routes/syllabusRoutes.ts`, `backend/src/services/mockTestService.ts`), with kebab-case used inside `backend/src/services/ai/` (`ai-provider.factory.ts`, `mcq-validator.ts`).
- Backend tests: `*.test.ts` inside `backend/tests/`.

**Directories:**
- Lowercase/camelCase feature folders (`src/components/analytics/`, `src/components/admin/ai-syllabus/`, `backend/src/services/cloudAi/`).

## Where to Add New Code

**New Student or Public Page:**
- Page component & styles: `src/pages/NewPage.tsx` + `src/pages/NewPage.css`
- Route registration: `src/App.tsx` (wrap in `lazyWithRetry`; place inside `<Route element={<StudentDashboardLayout />}>` if it uses the student sidebar, and add its path prefix to `isDashboardRoute` in `src/App.tsx:88-102`).

**New Admin Console Section:**
- Component: `src/components/admin/NewSection.tsx` or `src/components/admin/pages/NewSectionPage.tsx`
- Integration: Wire into `src/pages/Admin.tsx` and `src/components/admin/AdminSidebar.tsx`.

**New Backend API Endpoint & Service:**
- Service: `backend/src/services/newDomainService.ts`
- Router: `backend/src/routes/newDomainRoutes.ts`
- Mount in `backend/src/server.ts`: Register with `requireSchemaMiddleware` and dual-prefix paths (`/api/...`, `/...`, `/api/api/...`).
- Schema changes: Add `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `backend/src/migrate.ts`.

**New AI Provider:**
- Implementation: `backend/src/services/ai/providers/<provider>/` implementing `IAIProvider` (`backend/src/services/ai/ai-provider.interface.ts`).
- Registration: Add explicit lookup in `AIProviderFactory.getProvider()` (`backend/src/services/ai/ai-provider.factory.ts`).

**Shared Utilities:**
- Frontend: `src/utils/`
- Backend: `backend/src/utils/`

## Special Directories

**`backend/uploads/textbooks/`:**
- Purpose: Local storage for uploaded Samacheer Kalvi textbook PDFs during processing.
- Generated: Yes (runtime uploads).
- Committed: Sample/test PDFs present; runtime user uploads are transient on serverless.

**`dist/` & `backend/dist/`:**
- Purpose: Compiled Vite SPA bundle and TypeScript-compiled Express server (`dist/server.js`).
- Generated: Yes (`npm run build`).
- Committed: No (build output).

**Root Diagnostic Scripts (`check*.cjs`, `find_*.cjs`, `fix*.cjs`):**
- Purpose: Ad-hoc CommonJS inspection/verification scripts in the repository root.
- Generated: Manual utility scripts.
- Committed: Yes, present at root level outside `src/`.

---

*Structure analysis: 2026-11-18*
