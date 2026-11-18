<Technology Stack>
**Analysis Date:** 2026-11-18

## Languages

**Primary:**
- TypeScript `~6.0.3` - Frontend React application (`src/`), Express backend (`backend/src/`), and Vite config (`vite.config.ts`)

**Secondary:**
- JavaScript (ESM/CommonJS) - Root diagnostic/maintenance scripts (`*.cjs`, `scripts/*.cjs`) and backend seed/test scripts (`backend/src/scripts/*.cjs`, `backend/*.cjs`, `backend/test_*.js`)
- CSS - Component and global stylesheets (`src/index.css`, `src/App.css`, `src/components/**/*.css`)
- HTML5 - SPA entry shell (`index.html`)

## Runtime

**Environment:**
- Node.js `v24.22.1` (local development environment; `@types/node` `^24.19.2`)
- Browser ES2020/ES2023 target for frontend bundle (`vite.config.ts`, `tsconfig.app.json`)
- Vercel Serverless Functions (Node.js runtime) for production frontend and backend (`vercel.json`, `backend/vercel.json`)

**Package Manager:**
- npm `11.19.1` (separate packages for root frontend and `backend/`)
- Lockfile: Present at `package-lock.json` and `backend/package-lock.json`

## Frameworks

**Core:**
- React `^19.3.1` + React DOM `^19.3.1` - Frontend UI (`package.json`, `src/main.tsx`)
- React Router DOM `^7.18.4` - Client-side routing (`package.json`)
- Express `^4.22.3` - Backend REST API server (`backend/package.json`, `backend/src/server.ts`)

**Testing:**
- Not detected (no Jest/Vitest/Playwright config; ad-hoc Node scripts exist in `backend/test_*.js` and `backend/src/test-*.ts`)

**Build/Dev:**
- Vite `^8.3.4` + `@vitejs/plugin-react` `^6.1.2` - Frontend dev server and bundler (`vite.config.ts`)
- TypeScript `~6.0.3` - Type checking and backend compilation (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `backend/tsconfig.json`)
- `oxlint` `^1.88.0` - Frontend linter configured via `.oxlintrc.json`
- `tsx` `^4.23.15` + `nodemon` `^3.1.14` - Backend TypeScript execution and watch mode (`backend/package.json`)

## Key Dependencies

**Frontend (`package.json`):**
- `framer-motion` `^14.6.0` - UI animations and transitions (split into `vendor-motion` chunk in `vite.config.ts`)
- `lucide-react` `^1.61.0` - Icon library (split into `vendor-icons` chunk in `vite.config.ts`)
- `react-icons` `^5.7.0` - Additional icon sets
- `recharts` `^3.10.1` - Analytics and performance charts

**Backend (`backend/package.json`):**
- `pg` `^8.23.1` - PostgreSQL client and connection pool (`backend/src/db.ts`)
- `@anthropic-ai/sdk` `^1.3.0` - Anthropic Claude API client (`backend/src/services/ai/providers/claude/claude.service.ts`, `backend/src/services/ocrService.ts`)
- `@google/generative-ai` `^0.24.1` - Google Gemini API client (`backend/src/services/ai/providers/gemini/gemini.service.ts`)
- `googleapis` `^189.0.0` - Google OAuth2 and Google Drive API client (`backend/src/services/googleAuthService.ts`, `backend/src/services/googleDriveService.ts`)
- `@google-cloud/vision` `^6.2.0` - Google Cloud Vision OCR (`backend/src/services/ocrService.ts`)
- `@google-cloud/storage` `^8.4.0` - Google Cloud Storage client (`backend/src/services/ocrService.ts`)
- `tesseract.js` `^7.0.0` - Local Tamil/English OCR fallback using `eng.traineddata` and `tam.traineddata` (`backend/src/services/ocrService.ts`)
- `pdf-parse` `^2.4.5` - PDF text extraction (`backend/src/services/pdfProcessor.ts`)
- `multer` `^2.5.0` - Multipart file upload handling (`backend/package.json`)
- `cors` `^2.8.6` - Express CORS middleware (`backend/src/server.ts`)
- `dotenv` `^16.6.1` - Environment variable loading (`backend/src/server.ts`, `backend/src/db.ts`)

## Configuration

**Environment:**
- Root env files present: `.env.example`, `.env.local`, `.env.production.local`
- Backend env files present: `backend/.env`, `backend/.env.example`, `backend/.env.production.local`
- Frontend env variables consumed via `import.meta.env`: `VITE_API_URL`, `VITE_API_BASE_URL`, `VITE_BACKEND_URL` (`src/utils/api.ts`), `VITE_GOOGLE_CLIENT_ID` (`src/utils/googleOAuth.ts`)
- Production DB env validator in `backend/src/utils/productionDbEnv.ts` checks `backend/.env.production.local` for `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`

**Build & Scripts:**
- Root (`package.json`):
  - `npm run dev` - Starts Vite dev server on port `5173` with `/api` proxy to `http://localhost:5000` (`vite.config.ts`)
  - `npm run build` - Runs `tsc -b && vite build`
  - `npm run lint` - Runs `oxlint` using `.oxlintrc.json` (plugins: `react`, `typescript`, `oxc`)
  - `npm run preview` - Previews production build via Vite
- Backend (`backend/package.json`):
  - `npm run dev` - Runs `nodemon --watch src --watch .env --ext ts,env --exec tsx src/server.ts`
  - `npm run build` - Compiles `backend/src/` to `backend/dist/` via `tsc` (`backend/tsconfig.json`, `NodeNext` CommonJS)
  - `npm start` - Runs `node dist/server.js`
  - `npm run db:prod:check` - Runs `tsx src/scripts/checkProdDb.ts`

## Platform Requirements

**Development:**
- Node.js 24.x and npm 11.x
- Local or Neon PostgreSQL database (`backend/src/db.ts`)
- Separate `npm install` in root and `backend/`

**Production:**
- Frontend hosted on Vercel (`vercel.json`): serves static Vite build, caches `/assets/(.*)` and `/fonts/(.*)` with `max-age=31536000, immutable`, rewrites `/api/(.*)` to `https://tnpsc-quiz-lval.vercel.app/api/$1`, and falls back to `/index.html` for SPA routing
- Backend hosted on Vercel (`backend/vercel.json`): serverless Node function at `dist/server.js` with `maxDuration: 60` seconds and `memory: 1024` MB, rewriting all routes `/(.*)` to `/dist/server.js?__vpath=/$1`

---

*Stack analysis: 2026-11-18*
