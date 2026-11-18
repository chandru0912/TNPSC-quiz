</Codebase Structure>
<Coding Conventions>
**Analysis Date:** 2026-11-18

## Naming Patterns

**Files:**
- **React Components & Pages:** Use `PascalCase.tsx` (e.g., `src/components/Navbar.tsx`, `src/components/ErrorBoundary.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Admin.tsx`).
- **Co-located Component Stylesheets:** Match the component filename with `.css` extension (`src/components/Navbar.css`, `src/components/StudentSidebar.css`, `src/components/admin/AdminControlCenter.css`).
- **Hooks:** Prefix with `use` in camelCase (`src/hooks/useMcqTranslations.ts`, `src/hooks/useScrollLock.ts`, `src/hooks/useStudyTimeTracker.ts`).
- **Context Providers:** Suffix with `Context.tsx` (`src/context/StudentAuthContext.tsx`).
- **Frontend Utilities & Services:** Use `camelCase.ts` (`src/utils/api.ts`, `src/utils/naturalSort.ts`, `src/services/dynamicSyllabusService.ts`).
- **Backend Routes & Services:** Use `camelCase.ts` or `kebab-case.service.ts` inside `backend/src/services/ai/` (`backend/src/routes/questions.ts`, `backend/src/routes/studyMaterialRoutes.ts`, `backend/src/services/ai/ai-provider.factory.ts`, `backend/src/services/ai/providers/gemini/gemini.validator.ts`).
- **Backend Tests:** Suffix with `.test.ts` inside `backend/tests/` (`backend/tests/geminiJsonParser.test.ts`, `backend/tests/studentAuthOAuth.test.ts`).
- **Ad-hoc Root / Utility Scripts:** Use `.cjs` for CommonJS Node scripts (`scripts/checkCounts.cjs`).

**Functions:**
- Use `camelCase` for utility functions, route handlers, hooks, and service methods (`resolveApiBaseUrl`, `apiFetch`, `parseApiResponse`, `classifyApiError`, `generateAdminToken`, `verifyAdminToken`, `mapRowToQuestion`).
- Use `PascalCase` for React components (`Navbar`, `AppShell`, `RouteLoadingFallback`, `ErrorBoundary`) and backend service classes (`AISyllabusJobService`, `GeminiRetryService`).
- Prefix boolean helpers and guards with `is`, `has`, or `require` (`isLocalhostUrl`, `isOriginAllowed`, `requireAdminAuth`, `requireStudentAuth`).

**Variables:**
- Use `camelCase` for local variables and state (`isLoading`, `isPreviewMode`, `activeAuthSlide`).
- Use `UPPER_SNAKE_CASE` for module-level constants and storage/cache keys (`LOCAL_BACKEND_URL`, `PRODUCTION_BACKEND_URL`, `TOKEN_KEY`, `USER_KEY`, `CHUNK_SIZE`, `REQUEST_TIMEOUT_MS`, `SESSION_CACHE_KEY`).

**Types:**
- Use `PascalCase` for TypeScript interfaces and type aliases (`StudentUser`, `StudentAuthContextType`, `ApiFetchOptions`, `QuestionDTO`, `AdminPayload`, `AuthenticatedRequest`).
- Suffix props interfaces with `Props` (`ErrorBoundaryProps`, `ErrorBoundaryState`) and API transfer objects with `DTO` or `Options` (`QuestionDTO`, `ApiFetchOptions`).

## Code Style

**Formatting:**
- No Prettier or Biome config is present; formatting is maintained via editor settings and TypeScript/oxlint checks.
- **Frontend (`src/`):** Uses 2-space indentation, single quotes, and omits semicolons in most React/page files (`src/App.tsx`, `src/components/Navbar.tsx`, `src/hooks/useMcqTranslations.ts`), though utility files like `src/utils/api.ts` and `src/components/ErrorBoundary.tsx` use semicolons. Keep style consistent within each file you edit.
- **Backend (`backend/src/`):** Uses 2-space indentation, single quotes, and semicolons (`backend/src/server.ts`, `backend/src/routes/questions.ts`, `backend/src/middleware/auth.ts`).
- **CSS (`src/**/*.css`):** Uses CSS custom properties defined in `src/styles/theme.css` (`--navy-deep`, `--gold-primary`, `--glass-bg`, `--glass-blur`, `--transition`). Prefer theme tokens and co-located component `.css` files (`src/components/Navbar.css`) over hardcoded colors, with glassmorphism surfaces (`backdrop-filter: blur(20px)`) and Tamil typography defaults (`Noto Sans Tamil`, `Nirmala UI`) in `src/index.css` and `src/styles/tamilTypography.css`.

**Linting:**
- **Tool:** `oxlint` (`^1.88.0`) configured in `.oxlintrc.json`.
- **Plugins:** `react`, `typescript`, `oxc`.
- **Enforced Rules:**
  - `react/rules-of-hooks`: `"error"`
  - `react/only-export-components`: `["warn", { "allowConstantExport": true }]`
- **TypeScript Compiler Checks:**
  - Frontend (`tsconfig.app.json`): `target: "es2023"`, `moduleResolution: "bundler"`, `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`, `noEmit: true`. Note that `strict: true` is NOT enabled in `tsconfig.app.json`, whereas `backend/tsconfig.json` enables `strict: true` with `module: "NodeNext"` and `moduleResolution: "NodeNext"`.
  - Because `verbatimModuleSyntax: true` is enabled on the frontend, use explicit `type` imports for type-only symbols (`import { Component, type ErrorInfo, type ReactNode } from 'react'`, `import MobileAuthSlide, { type AuthSlideType } from './MobileAuthSlide'`).

## Import Organization

**Order:**
1. Environment bootstrap (`dotenv.config(...)` at the very top of `backend/src/server.ts` and `backend/src/db.ts` before other imports).
2. External packages (`react`, `react-router-dom`, `express`, `cors`, `lucide-react`).
3. Internal modules (`../utils/api`, `../middleware/auth`, `../services/...`, `../context/...`).
4. Co-located stylesheets last (`import './Navbar.css'`, `import './App.css'`).

**Path Aliases:**
- None configured. Always use relative imports (`./`, `../`).
- Frontend `tsconfig.app.json` has `allowImportingTsExtensions: true` (e.g., `import App from './App.tsx'` in `src/main.tsx`).
- Backend `backend/tsconfig.json` uses `moduleResolution: "NodeNext"` without `.js` extensions in source (`import pool from '../db'`), compiled via `tsc` to CommonJS (`"type": "commonjs"` in `backend/package.json`).

## Error Handling

**Frontend API & Fetch Pattern:**
- Route all frontend HTTP calls through `apiFetch(path, options)` in `src/utils/api.ts`. It handles same-origin `/api` proxying in dev, Vercel relative rewrites in production, multi-tier 404 failover, `AbortController` timeouts (default `30000` ms), and classifies `TimeoutError` / `NetworkError`.
- Parse responses with `parseApiResponse<T>(res)` and translate HTTP failures into user-facing messages with `classifyApiError(res, data, rawText, endpointLabel)` or `classifyFetchFailure(err, options)`:
```typescript
const res = await apiFetch('/api/questions', { method: 'GET' })
const { data, rawText } = await parseApiResponse(res)
if (!res.ok) {
  throw new Error(classifyApiError(res, data, rawText, 'questions'))
}
```
- Wrap route trees and fragile views with `ErrorBoundary` (`src/components/ErrorBoundary.tsx`), which catches render errors via `getDerivedStateFromError` and `componentDidCatch` and offers Retry / Go Home actions.
- Use `lazyWithRetry` (`src/App.tsx`) for `React.lazy` page imports to retry once after 400 ms on transient chunk load failures.

**Backend Express Pattern:**
- Wrap async route handlers in `try / catch` and return structured JSON with a consistent `status` field:
```typescript
res.status(401).json({
  status: 'error',
  message: 'Unauthorized: Missing or invalid Authorization header or token parameter. Admin access required.',
});
```
- Global fallback middleware in `backend/src/server.ts` (lines 522–538) ensures unmatched routes return JSON `404` and uncaught middleware errors return JSON `{ status: 'error', message }` instead of HTML, preserving CORS headers.
- Process-level `unhandledRejection` and `uncaughtException` listeners in `backend/src/server.ts` (lines 540–546) log errors without crashing the server.
- Note: Many `catch (err: any)` blocks are used in routes (`backend/src/routes/auth.ts`, `backend/src/server.ts`); in `backend/src/scripts/checkProdDb.ts`, prefer `catch (err: unknown)` with `err instanceof Error ? err.message : String(err)`.

## Logging

**Framework:** Native `console` (`console.log`, `console.warn`, `console.error`). No external logging library is used.

**Patterns:**
- Prefix contextual logs with bracketed tags indicating the module or subsystem:
  - `[apiFetch]` in `src/utils/api.ts`
  - `[React ErrorBoundary]` in `src/components/ErrorBoundary.tsx`
  - `[Server Error]`, `[Server]`, `[Server Startup]` in `backend/src/server.ts`
  - `[GeminiValidator]` in `backend/src/services/ai/providers/gemini/gemini.validator.ts`

## Comments

**When to Comment:**
- Explain non-obvious architectural constraints, browser/Vercel platform quirks, and fallback order (e.g., Vercel 4.5 MB payload limit comment in `src/utils/api.ts`, ETag disabling in `backend/src/server.ts`, CORS origin handling).
- Use section divider banners in large CSS files (`/* ========================================================= ... */` in `src/components/Navbar.css`).

**JSDoc/TSDoc:**
- Used selectively on shared helpers and test suites (e.g., `src/hooks/useMcqTranslations.ts`, `backend/tests/geminiJsonParser.test.ts`).

## Function Design

**Size:**
- Utilities and hooks are modular (`src/utils/api.ts`, `src/hooks/useMcqTranslations.ts`), while legacy page/route files (`src/pages/Admin.tsx`, `backend/src/routes/questions.ts` at 1,962 lines) are large monolithic files. Place new domain logic in dedicated `backend/src/services/` modules or `src/hooks/` / `src/utils/` helpers rather than expanding monolithic route/page files.

**Parameters:**
- Use an `options` object interface with defaults for functions taking multiple optional parameters (`ApiFetchOptions = {}` in `src/utils/api.ts`, `{ endpointLabel, uploadFileSizeBytes } = {}` in `classifyFetchFailure`).

**Return Values:**
- Backend DB row mappers (`mapRowToQuestion` in `backend/src/routes/questions.ts`) convert `snake_case` PostgreSQL columns to `camelCase` DTOs before returning JSON to the frontend.

## Module Design

**Exports:**
- React components, pages, and routers typically use default exports (`export default Navbar`, `export default app`, `export default router`), while utilities, hooks, contexts, and DTOs use named exports (`export async function apiFetch`, `export const StudentAuthProvider`, `export interface QuestionDTO`). `ErrorBoundary` exports both named and default (`src/components/ErrorBoundary.tsx`).

**Barrel Files:**
- Not used. Import directly from the target module path.

---

*Convention analysis: 2026-11-18*
