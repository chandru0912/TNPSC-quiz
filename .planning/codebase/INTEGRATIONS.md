<External Integrations>
**Analysis Date:** 2026-11-18

## APIs & External Services

**AI & LLM Providers (Multi-Provider Isolation Architecture):**
- Factory in `backend/src/services/ai/ai-provider.factory.ts` selects active provider from PostgreSQL (`ai_provider_configs` table) with zero automatic cross-provider fallback.
- **Anthropic Claude** - Default active AI provider for MCQ generation, syllabus alignment, and Vision OCR fallback
  - SDK/Client: `@anthropic-ai/sdk` (`backend/src/services/ai/providers/claude/claude.service.ts`, `backend/src/services/ocrService.ts`)
  - Default Model: `claude-3-5-sonnet-20241022` (aliases for `claude-3-7-sonnet-20250219`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229`, `claude-3-haiku-20240307` in `backend/src/services/ai/providers/claude/claude.config.ts`)
  - Auth: `ANTHROPIC_API_KEY` (optional model override `CLAUDE_MODEL` or `ANTHROPIC_MODEL`)
- **Google Gemini** - Alternate AI provider for MCQ generation and syllabus processing
  - SDK/Client: `@google/generative-ai` (`backend/src/services/ai/providers/gemini/gemini.service.ts`, `backend/src/services/ai/providers/gemini/geminiRetryService.ts`)
  - Default Model: `gemini-3.5-flash` with fallback list (`GEMINI_FALLBACK_MODELS` in `backend/src/services/ai/providers/gemini/gemini.config.ts`)
  - Auth: `GEMINI_API_KEY` (optional `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`)
- **OpenAI** - Alternate AI provider via Chat Completions REST API
  - SDK/Client: Native `fetch` to `https://api.openai.com/v1/chat/completions` (`backend/src/services/ai/providers/openai/openai.service.ts`)
  - Default Model: `gpt-4o-mini` (supports `gpt-4o`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4-turbo`, `gpt-4`, `gpt-4.5-preview` in `backend/src/services/ai/providers/openai/openai.config.ts`)
  - Auth: `OPENAI_API_KEY` (optional `OPENAI_MODEL`)

**OCR & Document Processing:**
- **Google Cloud Vision** - Primary OCR (`DOCUMENT_TEXT_DETECTION` for Tamil `ta` and English `en`)
  - SDK/Client: `@google-cloud/vision` (`ImageAnnotatorClient` in `backend/src/services/ocrService.ts`)
  - Auth: `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_VISION_SERVICE_ACCOUNT_KEY` (JSON), `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`, or GCP default credentials (`GCP_PROJECT` / `GOOGLE_CLOUD_PROJECT`)
- **Tesseract.js** - Local OCR fallback (`tam+eng` using `eng.traineddata` and `tam.traineddata` in `backend/` and root)

**Google Drive & Fonts:**
- **Google Drive API** - Admin study material/textbook PDF storage, resumable uploads, streaming, sync, and reconciliation
  - SDK/Client: `googleapis` (`drive.file` scope, target folder `TNPSC Study Hub Materials` in `backend/src/services/googleDriveService.ts`, `backend/src/routes/drive.ts`, `backend/src/services/googleDriveSyncService.ts`)
  - Auth: OAuth 2.0 (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`), HMAC-signed CSRF state via `ADMIN_JWT_SECRET`
- **Google Fonts** - Fallback font stylesheet (`Inter`, `Noto Sans Tamil`, `Noto Serif Tamil`) loaded in `index.html` alongside self-hosted `/fonts/*.woff2`

## Data Storage

**Databases:**
- **PostgreSQL (Local or Neon Serverless)**
  - Connection: `DATABASE_URL` / `POSTGRES_URL` / `DIRECT_URL`, or explicit `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` (`backend/src/db.ts`)
  - SSL: Enabled automatically in production/cloud (`PG_SSL_REJECT_UNAUTHORIZED` toggle)
  - Pool: `pg.Pool` (`max: 2` on Vercel serverless, `max: 10` locally)
  - Schema initialization: Runtime idempotent DDL via `ensureDatabaseSchema()` in `backend/src/migrate.ts`

**File Storage:**
- **Google Drive** (`TNPSC Study Hub Materials` folder) for PDFs and study materials (`backend/src/services/googleDriveService.ts`)
- **Google Cloud Storage** (`@google-cloud/storage` imported in `backend/src/services/ocrService.ts`)
- **Local filesystem** (`backend/uploads/`) for temporary multipart uploads via `multer`

**Caching:**
- In-memory TTL cache (`Map`-based, max 500 entries, default 60s TTL) in `backend/src/utils/cache.ts` for read-heavy syllabus endpoints
- HTTP `Cache-Control: no-store` enforced on `/api/*` responses in `backend/src/server.ts`; `etag` disabled globally
- Static asset immutable caching (`max-age=31536000, immutable`) for `/assets/*` and `/fonts/*` in `vercel.json`; PWA service worker registration in `src/main.tsx`

## Authentication & Identity

**Admin Authentication:**
- Custom HMAC-SHA256 signed tokens (`base64url(payload).signature`, 24h expiry) verified with `crypto.timingSafeEqual` in `backend/src/middleware/auth.ts`
- Secret: `ADMIN_JWT_SECRET`
- Accounts stored in PostgreSQL `admin_users` table and/or configured via `ADMIN_USERNAME` / `ADMIN_PASSWORD` (`backend/src/routes/auth.ts`)

**Student Authentication:**
- Email/password + **Google Sign-In (Google Identity Services / OAuth 2.0)**
  - Frontend: Dynamically loads GIS (`initCodeClient`) in `src/utils/googleOAuth.ts` using `VITE_GOOGLE_CLIENT_ID` (or fetched from backend)
  - Backend: Exchanges auth code or verifies ID token via `googleapis` OAuth2 client (`backend/src/services/googleAuthService.ts`, `backend/src/routes/student.ts`)
  - Session tokens: Custom HMAC-SHA256 tokens signed with `STUDENT_JWT_SECRET` (`backend/src/middleware/auth.ts`)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry/Datadog SDK detected)

**Logs & Health Checks:**
- `console.log` / `console.warn` / `console.error` to stdout/stderr (Vercel Function logs)
- Health endpoints in `backend/src/server.ts`: `GET /api/health` (server uptime, DB `SELECT 1` latency, JWT probe) and `GET /api/db-health` (`SELECT NOW()`, DB version, Neon detection, env var presence)
- AI generation logs persisted to PostgreSQL via `backend/src/services/ai/ai-logs.service.ts`

## CI/CD & Deployment

**Hosting:**
- **Vercel** (separate frontend project configured by `vercel.json` and backend project configured by `backend/vercel.json`)
- Frontend proxies `/api/*` to `https://tnpsc-quiz-lval.vercel.app/api/$1` in production (`vercel.json`) and `http://localhost:5000` in local Vite dev (`vite.config.ts`, `src/utils/api.ts`)

**CI Pipeline:**
- None detected (no `.github/workflows/` directory)

## Environment Configuration

**Required / Supported Env Vars:**
- Database: `DATABASE_URL` / `POSTGRES_URL` / `DIRECT_URL` or `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PG_SSL_REJECT_UNAUTHORIZED`
- Auth & Server: `PORT`, `NODE_ENV`, `VERCEL`, `CORS_ORIGIN`, `FRONTEND_URL`, `BACKEND_URL`, `ADMIN_JWT_SECRET`, `STUDENT_JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`
- Google OAuth & Drive: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `VITE_GOOGLE_CLIENT_ID`
- AI Providers: `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `ANTHROPIC_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, `OPENAI_API_KEY`, `OPENAI_MODEL`
- Google Cloud Vision OCR: `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_VISION_SERVICE_ACCOUNT_KEY`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GCP_PROJECT`, `GOOGLE_CLOUD_PROJECT`
- Frontend: `VITE_API_URL`, `VITE_API_BASE_URL`, `VITE_BACKEND_URL`, `VITE_GOOGLE_CLIENT_ID`

**Secrets location:**
- Local: `.env.local`, `.env.production.local`, `backend/.env`, `backend/.env.production.local` (gitignored; templates in `.env.example` and `backend/.env.example`)
- Production: Vercel project environment variables

## Webhooks & Callbacks

**Incoming:**
- `GET /api/drive/oauth/callback` - Google Drive OAuth 2.0 authorization callback (`backend/src/routes/drive.ts`, `backend/src/services/googleDriveService.ts`)

**Outgoing:**
- Outbound HTTPS calls to Anthropic Messages API, Google Gemini API, OpenAI Chat Completions API (`https://api.openai.com/v1/chat/completions`), Google OAuth2/Drive APIs, and Google Cloud Vision API.

---

*Integration audit: 2026-11-18*
