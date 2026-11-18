<!-- refreshed: 2026-11-18 -->
# Architecture

**Analysis Date:** 2026-11-18

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Frontend SPA (React 19 + Vite 8)                         │
├────────────────────┬─────────────────────────┬───────────────────────────────┤
│  Public & Auth     │  Student Portal         │  Admin Control Center         │
│  `src/pages/Home`  │  `src/layouts/          │  `src/pages/Admin.tsx`        │
│  `src/pages/Login` │  StudentDashboardLayout`│  `src/components/admin/`      │
└─────────┬──────────┴───────────┬─────────────┴──────────────┬────────────────┘
          │                      │                            │
          ▼                      ▼                            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│           Frontend Services, Context & Multi-Tier API Client                 │
│  `src/context/StudentAuthContext.tsx` · `src/services/dynamicSyllabusService`│
│  `src/utils/api.ts` (apiFetch) · `src/utils/studentSync.ts` (BroadcastChannel│
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │ HTTPS / Vite Proxy (`/api` -> `:5000`)
                                     │ or Vercel Rewrite (`vercel.json`)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                   Backend API (Express 4 + TypeScript)                       │
│  `backend/src/server.ts` (CORS, NFC Unicode, `__vpath` rewrite, ETag off)    │
│  `backend/src/middleware/auth.ts` (HMAC-SHA256 Admin & Student Tokens)       │
├────────────────────┬─────────────────────────┬───────────────────────────────┤
│  REST & SSE Routes │  Domain Services        │  AI Provider Factory          │
│  `backend/src/     │  `backend/src/services/`│  `backend/src/services/ai/    │
│  routes/*.ts`      │  Dashboard, Study, Mock │  ai-provider.factory.ts`      │
└─────────┬──────────┴───────────┬─────────────┴──────────────┬────────────────┘
          │                      │                            │
          ▼                      ▼                            ▼
┌──────────────────────────────┐ ┌─────────────────────────────────────────────┐
│   PostgreSQL (Neon / Local)  │ │  External Integrations                      │
│   `backend/src/db.ts`        │ │  Anthropic Claude · Google Gemini · OpenAI  │
│   `backend/src/migrate.ts`   │ │  Google Drive API · Google OAuth · GCS      │
└──────────────────────────────┘ └─────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| SPA Router & Shell | Lazy route loading with chunk-retry, error boundaries, SVG 3D filters | `src/App.tsx` |
| Student Auth Context | Token persistence, profile refresh, Admin Student Preview mode | `src/context/StudentAuthContext.tsx` |
| Student Dashboard Layout | Persistent sidebar + independent scroll viewport, onboarding modal | `src/layouts/StudentDashboardLayout.tsx` |
| Study Time Tracker | 30s active heartbeat with 2m idle cutoff and multi-tab leader lock | `src/hooks/useStudyTimeTracker.ts` |
| Dynamic Syllabus Service | PostgreSQL-backed syllabus tree, TTL cache, BroadcastChannel sync | `src/services/dynamicSyllabusService.ts` |
| Unified Syllabus Registry | Static ontological fallback for Group 1, 2, 2A, 4, VAO units/lessons | `src/data/unifiedSyllabusRegistry.ts` |
| API Fetch Client | Base URL resolution, 404 multi-tier failover, timeout handling | `src/utils/api.ts` |
| Express Server Bootstrap | Env loading, CORS, NFC normalization, dual-prefix route mounting | `backend/src/server.ts` |
| Auth Middleware | Custom HMAC-SHA256 token signing/verification for Admin & Student | `backend/src/middleware/auth.ts` |
| Database Pool & Schema | `pg.Pool` (serverless vs local sizing) and idempotent DDL migrations | `backend/src/db.ts`, `backend/src/migrate.ts` |
| Student Dashboard & SSE | Aggregated telemetry queries, `EventEmitter` pub/sub, SSE stream | `backend/src/services/studentDashboardService.ts` |
| AI Provider Factory | Strict multi-provider isolation (`claude`, `gemini`, `openai`) | `backend/src/services/ai/ai-provider.factory.ts` |

## Pattern Overview

**Overall:** Decoupled Monorepo Client-Server Architecture (React + Vite SPA communicating with an Express + PostgreSQL REST/SSE API), deployed as separate or rewritten Vercel serverless functions.

**Key Characteristics:**
- **Resilient Dual-Mode API Routing:** `src/utils/api.ts` routes through relative `/api/*` via Vite's dev proxy (`vite.config.ts`) locally or `vercel.json` rewrites in production, with automatic failover to `PRODUCTION_BACKEND_URL` or `http://localhost:5000` on 404/network errors.
- **Database-First Syllabus with Static Registry Fallback:** `src/services/dynamicSyllabusService.ts` fetches live syllabus hierarchies from `/api/syllabus/*` (backed by PostgreSQL and a 60s backend TTL cache in `backend/src/utils/cache.ts`), while `src/data/unifiedSyllabusRegistry.ts` and `src/utils/syllabusFallback.ts` provide canonical TNPSC Group 1/2/2A/4 structures.
- **Event-Driven Real-Time Telemetry:** Student dashboard updates flow over Server-Sent Events (`/api/student/dashboard/stream`) backed by an in-process `EventEmitter` (`studentDashboardEmitter`), paired with client-side `BroadcastChannel` (`tnpsc_student_sync` and `tnpsc_syllabus_sync`) and a 10-second polling fallback.
- **Strict AI Provider Isolation:** `AIProviderFactory` in `backend/src/services/ai/ai-provider.factory.ts` enforces zero cross-provider automatic fallback; each provider (`claude`, `gemini`, `openai`) maintains its own config, prompts, and validators.

## Layers

**Frontend Presentation & Routing:**
- Purpose: Renders public landing pages, Student Portal views, and the Admin Control Center.
- Location: `src/pages/`, `src/components/`, `src/layouts/`
- Contains: Route-level lazy components (`lazyWithRetry` in `src/App.tsx`), CSS modules/stylesheets, Recharts/analytics visualizations (`src/components/analytics/`), and admin management consoles (`src/components/admin/`).
- Depends on: `src/context/StudentAuthContext.tsx`, `src/services/dynamicSyllabusService.ts`, `src/utils/api.ts`.
- Used by: Browser DOM via `src/main.tsx`.

**Frontend State, Hooks & Synchronization:**
- Purpose: Manages authentication state, active study-time telemetry, and cross-tab cache invalidation.
- Location: `src/context/`, `src/hooks/`, `src/utils/studentSync.ts`
- Contains: `StudentAuthProvider`, `useStudyTimeTracker`, `useMcqTranslations`, `useScrollLock`, and `BroadcastChannel` helpers.
- Depends on: `localStorage`, `BroadcastChannel` API, `apiFetch`.
- Used by: `StudentDashboardLayout.tsx`, `Dashboard.tsx`, `MarkList.tsx`, `PerformanceAnalytics.tsx`, `ProgressTracker.tsx`.

**Backend HTTP & Middleware Layer:**
- Purpose: Normalizes requests/responses, enforces CORS, verifies tokens, and ensures database schema readiness.
- Location: `backend/src/server.ts`, `backend/src/middleware/auth.ts`
- Contains: `normalizePayloadUnicode` (NFC normalization for Tamil/English text), `__vpath` Vercel rewrite normalizer, `requireSchemaMiddleware` (runs `ensureDatabaseSchema()`), `requireAdminAuth`, `requireStudentAuth`, `optionalStudentAuth`.
- Depends on: `backend/src/migrate.ts`, `backend/src/utils/tamilUnicode.ts`.
- Used by: All mounted Express routers in `backend/src/routes/`.

**Backend Route & Service Layer:**
- Purpose: Implements domain logic for MCQs, study notes, mock tests, previous papers, textbooks, analytics, and AI generation.
- Location: `backend/src/routes/`, `backend/src/services/`
- Contains: 18 Express route modules and 30+ domain services including `studyManagementService.ts`, `studentDashboardService.ts`, `mockTestService.ts`, `analyticsService.ts`, `aiSyllabusEngineService.ts`, and `googleDriveSyncService.ts`.
- Depends on: `backend/src/db.ts` (`pool`), `backend/src/services/ai/`.
- Used by: `backend/src/server.ts`.

**Data & Persistence Layer:**
- Purpose: Connection pooling, schema migrations, and in-memory TTL caching.
- Location: `backend/src/db.ts`, `backend/src/migrate.ts`, `backend/src/utils/cache.ts`
- Contains: `pg.Pool` configuration (`max: 2` on Vercel serverless, `max: 10` locally), 35+ PostgreSQL tables (`questions`, `study_notes`, `students`, `mock_tests`, `textbooks`, `google_drive_materials`, etc.), and `getCached`/`setCached`/`invalidateCachePrefix`.
- Depends on: PostgreSQL (Neon cloud or local).

## Data Flow

### Primary Request Path

1. User action in a React page (e.g., `src/pages/MCQPractice.tsx`) calls `apiFetch('/api/questions/...')` from `src/utils/api.ts` (`src/utils/api.ts:76`).
2. Locally, Vite dev server proxies `/api` to `http://localhost:5000` (`vite.config.ts:30-35`); in production, Vercel rewrites `/api/(.*)` to the backend deployment (`vercel.json:22-26`).
3. `backend/src/server.ts` normalizes any `__vpath` query prefix (`backend/src/server.ts:141-170`), applies NFC Unicode normalization (`backend/src/server.ts:123-138`), and invokes `requireSchemaMiddleware` (`backend/src/server.ts:315-322`) before routing.
4. Route handler validates auth via `requireAdminAuth` or `requireStudentAuth` (`backend/src/middleware/auth.ts`), delegates to a service in `backend/src/services/`, queries `pool` (`backend/src/db.ts`), and returns UTF-8 JSON with `etag` disabled.

### Real-Time SSE & Cross-Tab Sync

1. On mount, `src/pages/Dashboard.tsx` (`src/pages/Dashboard.tsx:272-326`) opens a `fetch()` stream with `Accept: text/event-stream` to `GET /api/student/dashboard/stream` (`backend/src/routes/student.ts:831-879`).
2. The backend sends an immediate `event: dashboard` JSON snapshot via `getStudentDashboardData(studentId)` and subscribes to `studentDashboardEmitter` (`backend/src/services/studentDashboardService.ts:5-29`) for both `student:{id}` and `platform:content-updated` events, sending `: keepalive` every 20s.
3. Mutations (e.g., `useStudyTimeTracker` posting `/api/student/study-session/heartbeat` or completing a quiz) emit `notifyStudentDashboardUpdate(studentId)` on the server and `notifyStudentSync()` (`src/utils/studentSync.ts:4-20`) in the browser, triggering `BroadcastChannel('tnpsc_student_sync')` across open tabs.
4. If SSE disconnects or is unavailable on serverless, `Dashboard.tsx` falls back to 10-second polling.

### Syllabus Registry & Dynamic Cascade

1. Cascade selectors (`src/components/SyllabusCascadeSelector.tsx`, `src/components/McqCascadeGenerator.tsx`) call `dynamicSyllabusService` (`src/services/dynamicSyllabusService.ts`).
2. `dynamicSyllabusService` queries `/api/syllabus/exams`, `/subjects`, `/units`, `/lessons`, and `/topics`, caching results in-memory (`Map`) and synchronizing invalidations across tabs via `BroadcastChannel('tnpsc_syllabus_sync')` (`src/services/dynamicSyllabusService.ts:105-120`).
3. On the backend, `backend/src/routes/syllabusRoutes.ts` serves canonical TNPSC Group 1/2/2A/4 metadata merged with PostgreSQL lesson/note counts, caching `GET` responses via `backend/src/utils/cache.ts` and invalidating `syllabus:` keys on any non-GET `2xx`/`3xx` response (`backend/src/routes/syllabusRoutes.ts:10-19`).
4. Static hierarchical definitions in `src/data/unifiedSyllabusRegistry.ts` (`group1`, `group2`, `group2a`, `group4`, `vao`) and `backend/src/data/tnpscSyllabusMasterCatalog.ts` act as canonical baselines and offline fallbacks.

### Authentication & Student Preview Mode

1. **Admin Auth:** `POST /api/admin/login` (`backend/src/routes/auth.ts`) validates credentials against `admin_users` or environment variables (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_USERS`) and issues a 24-hour HMAC-SHA256 signed token (`generateAdminToken` in `backend/src/middleware/auth.ts:17-29`).
2. **Student Auth:** `backend/src/routes/student.ts` supports email/password registration/login and Google OAuth (`backend/src/services/googleAuthService.ts`). `generateStudentToken` issues a 30-day HMAC-SHA256 token containing `studentId`, `tokenType: 'student'`, and `tokenVersion`.
3. **Admin Student Preview:** `StudentAuthContext.tsx` (`startStudentPreview` / `exitStudentPreview`) sets `tnpsc_admin_preview_active=true` in `localStorage` with a 2-hour `isPreview: true` token. Backend routes like `/api/student/study-session/heartbeat` (`backend/src/routes/student.ts:889`) inspect `req.studentUser?.isPreview` and short-circuit writes to keep student DB records read-only during preview.

### AI Content Generation & Streaming

1. Admin triggers generation from `src/components/CloudAiGeneratorModal.tsx` (`Accept: text/event-stream`) or `src/components/admin/ai-syllabus/AiSyllabusImportWizard.tsx`.
2. `POST /api/ai/generate?stream=true` (`backend/src/routes/aiGeneration.ts:289-303`) streams progress events over SSE (`data: {...}\n\n`).
3. `AIProviderFactory.getProvider(provider)` (`backend/src/services/ai/ai-provider.factory.ts:22-34`) resolves `ClaudeService`, `GeminiService`, or `OpenAIService` with no automatic cross-provider fallback, writing results to `study_notes` or `questions` in `staging` status and logging usage in `ai_generation_logs`.

**State Management:**
- **Student Auth & Session:** `StudentAuthContext` (`src/context/StudentAuthContext.tsx`) backed by `localStorage` keys `tnpsc_student_token`, `tnpsc_student_user`, `tnpsc_admin_preview_active`.
- **Syllabus Cache:** In-memory `Map` in `src/services/dynamicSyllabusService.ts` + `BroadcastChannel('tnpsc_syllabus_sync')`.
- **Cross-Tab Heartbeat Lock:** `localStorage` key `tnpsc_study_tab_leader` in `src/hooks/useStudyTimeTracker.ts` ensures only one active tab sends 30s study-time heartbeats.

## Key Abstractions

**`IAIProvider` & `AIProviderFactory`:**
- Purpose: Uniform interface for MCQ and study-notes generation across Claude, Gemini, and OpenAI without cross-provider fallback.
- Examples: `backend/src/services/ai/ai-provider.interface.ts`, `backend/src/services/ai/ai-provider.factory.ts`, `backend/src/services/ai/providers/claude/claude.service.ts`
- Pattern: Factory + Strategy with strict provider isolation.

**`apiFetch`:**
- Purpose: Environment-aware HTTP client handling Vite dev proxy, Vercel rewrites, timeouts (`AbortController`), and multi-tier 404/network failover.
- Examples: `src/utils/api.ts`
- Pattern: Wrapper around `window.fetch` with cascading fallback URLs.

**Dual-Prefix Express Router Mounting:**
- Purpose: Ensures routes resolve identically regardless of whether Vercel rewrites strip `/api` or forward `/api/api/*`.
- Examples: `backend/src/server.ts:324-403` (mounting `/api/questions`, `/questions`, and `/api/api/questions`).
- Pattern: Multi-path `app.use()` registration.

## Entry Points

**Frontend SPA Entry:**
- Location: `src/main.tsx` -> `src/App.tsx`
- Triggers: Browser load of `index.html`, registers `/sw.js` in production (`src/main.tsx:13-21`).
- Responsibilities: Initializes `StudentAuthProvider`, `Router`, `ErrorBoundary`, `StudentDashboardLayout`, and lazy-loaded route chunks.

**Backend API Entry:**
- Location: `backend/src/server.ts`
- Triggers: `tsx src/server.ts` (dev), `node dist/server.js` (prod), or Vercel serverless export (`export default app` when `process.env.VERCEL` is set).
- Responsibilities: Loads multi-path `.env` files, configures CORS and middleware, mounts all `/api/*` routers, runs startup schema/job recovery when not on Vercel (`backend/src/server.ts:548-561`).

## Architectural Constraints

- **Serverless vs. Long-Lived Process:** `backend/src/db.ts` limits `pg.Pool` to `max: 2` connections on Vercel (`isServerless`) vs. `max: 10` locally. In-memory `EventEmitter` (`studentDashboardEmitter`) and `backend/src/utils/cache.ts` are per-instance; SSE streams and background jobs (`AISyllabusJobService`) are subject to Vercel's 60s `maxDuration` (`backend/vercel.json:5`).
- **Global State / Singletons:** `studentDashboardEmitter` (`backend/src/services/studentDashboardService.ts:5`), `store` cache (`backend/src/utils/cache.ts:11`), and `isTableInitialized` (`backend/src/routes/auth.ts:8`) live in module scope.
- **Development Auth Bypass:** `requireAdminAuth` in `backend/src/middleware/auth.ts:72-89` permits missing or short/demo tokens when `NODE_ENV !== 'production'`.
- **Tamil Unicode Integrity:** All incoming JSON bodies and query params pass through `normalizePayloadUnicode` (`backend/src/server.ts:123-129`) to enforce NFC Unicode normalization.

## Anti-Patterns

### Cross-Provider Silent Fallback in AI Generation

**What happens:** Automatically switching from a failing AI provider (e.g., Claude) to another (e.g., Gemini) without explicit admin selection.
**Why it's wrong:** Violates provider cost/quality expectations and corrupts provider-specific prompt/audit logs (`ai_generation_logs`).
**Do this instead:** Use `AIProviderFactory.getProvider(name)` (`backend/src/services/ai/ai-provider.factory.ts:22-34`) and surface provider errors directly to the caller.

### Direct `fetch('/api/...')` Bypassing `apiFetch`

**What happens:** Calling raw `fetch` with hardcoded `http://localhost:5000` or unnormalized paths.
**Why it's wrong:** Breaks on Vercel preview/production deployments where `/api` is rewritten or hosted on a separate origin, and loses 404 failover and timeout protection.
**Do this instead:** Use `apiFetch()` or `getApiUrl()` from `src/utils/api.ts` (note: SSE streaming in `src/pages/Dashboard.tsx:274` uses `getApiUrl()` with raw `fetch` for `ReadableStream` access).

### Mutating Student Records During Admin Preview

**What happens:** Recording study heartbeats or quiz attempts when an admin is previewing the student portal.
**Why it's wrong:** Pollutes real student telemetry and streaks with admin test activity.
**Do this instead:** Check `req.studentUser?.isPreview` on backend write endpoints (as implemented in `backend/src/routes/student.ts:889`) and `token === 'preview_admin_token'` on the client (`src/pages/Dashboard.tsx:261`).

## Error Handling

**Strategy:** Centralized JSON error responses on the backend with React `ErrorBoundary` and per-route fallback UI on the frontend.

**Patterns:**
- **Backend Global Error & 404 Handlers:** `backend/src/server.ts:522-538` catches unmatched routes and middleware errors, returning JSON `{ status: 'error', message }` instead of Express HTML, preserving CORS headers.
- **Process-Level Guards:** `unhandledRejection` and `uncaughtException` listeners in `backend/src/server.ts:540-546` log and prevent hard crashes.
- **Frontend Error Boundaries & Chunk Retry:** `src/App.tsx:14-23` wraps `React.lazy` in `lazyWithRetry` (400ms retry on stale Vercel chunks) and wraps `<Routes>` in `<ErrorBoundary key={location.pathname}>` (`src/components/ErrorBoundary.tsx`).

## Cross-Cutting Concerns

**Logging:** Backend uses `console.log` / `console.warn` / `console.error` with bracketed prefixes (e.g., `[Server Error]:`, `[Dashboard SSE Push Error]:`), plus PostgreSQL audit tables `ai_generation_logs` and `google_drive_sync_logs`.
**Validation:** Input validation is performed inline in route handlers and domain services (`backend/src/services/questionValidator.ts`, `backend/src/services/ai/shared/mcq-validator.ts`), plus PostgreSQL `CHECK` constraints in `backend/src/migrate.ts`.
**Authentication:** Custom HMAC-SHA256 base64url tokens (`ADMIN_JWT_SECRET` / `STUDENT_JWT_SECRET`) in `backend/src/middleware/auth.ts`, separating `admin` and `student` token types and checking `token_version` for student session revocation.

---

*Architecture analysis: 2026-11-18*
