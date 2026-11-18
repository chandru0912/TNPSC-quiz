# Phase 1: Database, Serverless & Security Hardening - Context

**Gathered:** 2026-11-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Stabilize Neon PostgreSQL pooling on Vercel serverless, gate runtime DDL schema checks, optimize hot quiz/notes/admin SQL queries without altering JSON response contracts or mutating data, and close auth, CORS, and rate-limit vulnerabilities (`DB-01`..`DB-04`, `SEC-01`..`SEC-04`).

</domain>

<decisions>
## Implementation Decisions

### Query Token Removal & SSE Auth (`SEC-03`)
- Reject `?token=` query-string authentication everywhere immediately with HTTP `401` in `backend/src/middleware/auth.ts` (`requireAdminAuth`, `requireStudentAuth`, `optionalStudentAuth`).
- Standardize strictly on `Authorization: Bearer <token>` headers.
- `Dashboard.tsx` SSE (`/api/student/dashboard/stream`) already uses `fetch` with `Authorization: Bearer`, so no frontend `EventSource` workaround is needed.

### Prior Locked Decisions (from `PROJECT.md` / `REQUIREMENTS.md`)
- **DB-01:** `pg.Pool` `max: 3` on Vercel serverless (`idleTimeoutMillis: 5000`, `allowExitOnIdle: true`), `DATABASE_URL` (`-pooler`) for runtime queries, `DIRECT_URL` for migrations/DDL, TLS `rejectUnauthorized` toggle, and `dotenv.config()` gated behind `if (!process.env.VERCEL)`.
- **DB-02:** Gate `ensureDatabaseSchema()` behind `process.env.SKIP_RUNTIME_SCHEMA_CHECK !== 'true'` with zero mutations or deletions of existing records.
- **DB-03 / DB-04:** Preserve exact JSON response fields on `/api/questions`, `/api/study-materials/questions`, `/api/notes`, and `/admin` variants while optimizing queries, partial indexes, 30s TTL cache on admin `metricsResult`, and `FILLFACTOR = 70` on `mcq_generation_jobs`.
- **SEC-01 / SEC-02 / SEC-04:** Fail fast in production if `ADMIN_JWT_SECRET` or `STUDENT_JWT_SECRET` is unset, gate dev auth bypass behind `ALLOW_DEV_AUTH_BYPASS=true`, verify `admin_users` with `scrypt`, fail closed on DB errors in `requireStudentAuth`, restrict CORS to explicit `CORS_ORIGIN`/`FRONTEND_URL` origins, and apply `express-rate-limit` to auth and AI generation routes.

### Agent's Discretion
- Exact rate-limit window/max thresholds for login, registration, and AI generation endpoints (`SEC-04`).
- Exact partial index names and `CONCURRENTLY` migration script structure (`DB-03`, `DB-04`).
- Production CORS origin parsing when `CORS_ORIGIN` and `FRONTEND_URL` are both set (`SEC-03`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing:**
- `.planning/REQUIREMENTS.md` — Phase 1 requirements `DB-01`..`DB-04` and `SEC-01`..`SEC-04`
- `.planning/PROJECT.md` — Locked `<decisions>` blocks (`pg.Pool` `max: 3` on serverless)
- `.planning/codebase/CONCERNS.md` — Security and performance audit findings
- `backend/src/db.ts` — Current PostgreSQL pool and `DIRECT_URL` setup
- `backend/src/middleware/auth.ts` — JWT secret resolution, `scrypt` helpers, and `?token=` handling
- `backend/src/server.ts` — CORS configuration and Express middleware mounts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/utils/cache.ts` — Existing TTL cache utility for `metricsResult` caching (`DB-03`)
- `backend/src/middleware/auth.ts` — Already includes `crypto.scryptSync` password hashing helpers

### Integration Points
- `src/pages/Dashboard.tsx` already connects to `/api/student/dashboard/stream` via `fetch` with `Authorization: Bearer` header.
- `backend/src/routes/drive.ts` and `backend/src/routes/textbooks.ts` call `ensureDatabaseSchema()` on request paths.

</code_context>

<specifics>
## Specific Ideas

- Reject `?token=` across all auth middlewares unconditionally (no dev-mode query-token exception).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope.

</deferred>

---

*Phase: 01-database-serverless-security-hardening*
*Context gathered: 2026-11-19*
