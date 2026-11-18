</Coding Conventions>
<Testing Patterns>
**Analysis Date:** 2026-11-18

## Test Framework

**Runner:**
- No Jest or Vitest test runner is configured.
- Automated tests are standalone TypeScript scripts executed directly with `tsx` (`^4.23.15` in `backend/package.json`).
- Config: `backend/tsconfig.json` (`strict: true`, `module: "NodeNext"`).

**Assertion Library:**
- Node built-in `assert` (`import assert from 'assert'` in `backend/tests/studentAuthOAuth.test.ts`) or explicit conditional checks throwing `Error` with `passed` / `failed` counters and `process.exit(1)` on failure (`backend/tests/geminiJsonParser.test.ts`, `backend/tests/geminiRetryService.test.ts`).

**Run Commands:**
```bash
# Frontend typecheck + production bundle build (from repo root)
npm run build                    # Runs: tsc -b && vite build

# Frontend typecheck only (from repo root)
npx tsc -b --noEmit

# Frontend linter (from repo root)
npm run lint                     # Runs: oxlint across workspace
npx oxlint src                   # Recommended: scope oxlint to frontend src/

# Backend typecheck and build (from backend/)
cd backend && npx tsc --noEmit   # Typecheck only
cd backend && npm run build      # Compiles src/ to backend/dist/

# Backend production DB connectivity check (from backend/)
cd backend && npm run db:prod:check

# Run standalone backend unit test suite (from backend/)
cd backend && npx tsx tests/geminiJsonParser.test.ts
```

## Test File Organization

**Location:**
- Separate `backend/tests/` directory for backend unit and integration test suites.
- No frontend unit or E2E test files exist under `src/`.
- Ad-hoc verification scripts live in `backend/src/scripts/` (`checkProdDb.ts`), `scripts/` (`checkCounts.cjs`, `auditReport.cjs`), and root `check*.cjs` / `find_*.cjs` files.

**Naming:**
- `*.test.ts` inside `backend/tests/`.

**Structure:**
```
backend/
├── tests/
│   ├── aiSyllabusJobService.test.ts   # Integration: DB + async syllabus job service
│   ├── geminiJsonParser.test.ts       # Unit: JSON parsing, validation & Tamil fidelity
│   ├── geminiRetryService.test.ts     # Unit: retry backoff & model fallback
│   └── studentAuthOAuth.test.ts       # Integration: Express routes + auth middleware + DB
└── src/
    └── scripts/
        └── checkProdDb.ts             # Operational DB health verification
```

## Test Structure

**Suite Organization:**
Tests follow a single `async function runTests()` entrypoint with numbered `try / catch` blocks, `passed`/`failed` counters, and `if (failed > 0) process.exit(1)`:
```typescript
// Pattern from backend/tests/geminiJsonParser.test.ts
async function runTests() {
  let passed = 0;
  let failed = 0;

  // 1. Valid JSON response
  try {
    const parsed = parseGeminiJsonResponse<any>(validRaw);
    const validated = validateSyllabusUnitsJson(parsed);
    if (validated.units.length === 1 && validated.units[0].title === 'General Science') {
      passed++;
    } else {
      throw new Error('Validation failed on valid JSON.');
    }
  } catch (e: any) {
    console.error('  -> FAIL [Test 1]:', e.message);
    failed++;
  }

  console.log(`=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests();
```

**Patterns:**
- **Setup:** Integration suites load `backend/.env` via `dotenv.config({ path: path.resolve(__dirname, '../.env') })`, call `ensureDatabaseSchema()`, and spin up an ephemeral `http.createServer(app)` on port `0` (`backend/tests/studentAuthOAuth.test.ts`).
- **Teardown:** Integration suites clean up created DB rows / jobs and close the HTTP server and `pool.end()` (or snapshot baseline row counts before/after in `backend/tests/aiSyllabusJobService.test.ts`).

## Mocking

**Framework:** None (manual prototype patching or callback injection).

**Patterns:**
```typescript
// Callback injection in backend/tests/geminiRetryService.test.ts
const res = await GeminiRetryService.executeWithRetryAndFallback(
  async (model: string) => {
    if (model === 'gemini-3.8-flash') {
      const err = new Error('503 Service Unavailable');
      (err as any).status = 503;
      throw err;
    }
    return `Success from fallback ${model}`;
  },
  { primaryModel: 'gemini-3.8-flash', fallbackModels: ['gemini-2.5-flash'], maxRetries: 2, retryDelaysMs: [10, 20] }
);

// Method monkey-patching in backend/tests/studentAuthOAuth.test.ts
const originalVerifyIdToken = google.auth.OAuth2.prototype.verifyIdToken;
(google.auth.OAuth2.prototype as any).verifyIdToken = async ({ idToken }: { idToken: string }) => {
  // Return mock token payload by idToken key
};
```

**What to Mock:**
- External OAuth token verification (`google.auth.OAuth2.prototype.verifyIdToken` in `backend/tests/studentAuthOAuth.test.ts`).
- AI provider API calls and retry delays (`retryDelaysMs: [10, 20]` in `backend/tests/geminiRetryService.test.ts`).

**What NOT to Mock:**
- Express routing, auth middleware (`requireAdminAuth`), and PostgreSQL schema/queries in integration tests (`backend/tests/studentAuthOAuth.test.ts`, `backend/tests/aiSyllabusJobService.test.ts`).

## Fixtures and Factories

**Test Data:**
Inline helper builders inside test files (`buildCanonicalUnits()` in `backend/tests/aiSyllabusJobService.test.ts`) and timestamp-suffixed unique emails (`test_oauth_new_${suffix}@example.com` in `backend/tests/studentAuthOAuth.test.ts`).

**Location:**
- Co-located inside each `backend/tests/*.test.ts` file.

## Coverage

**Requirements:** None enforced. No coverage tool (c8/istanbul) is configured.

**View Coverage:**
- Not applicable.

## Test Types

**Unit Tests:**
- `backend/tests/geminiJsonParser.test.ts`: Tests 10 cases of JSON parsing, line/col error diagnostics, Tamil Unicode preservation, duplicate topic pruning, and unit sorting. Verified passing (10 passed, 0 failed via `npx tsx tests/geminiJsonParser.test.ts`).
- `backend/tests/geminiRetryService.test.ts`: Tests retry backoff and fallback across models. Note: Line 7 imports `'./geminiRetryService'` instead of `'../src/services/ai/providers/gemini/geminiRetryService'`, so it requires fixing that import path before running from `backend/tests/`.

**Integration Tests:**
- `backend/tests/studentAuthOAuth.test.ts`: Tests Express `/api/student` and `/api/admin` auth routes, `requireAdminAuth` middleware, and PostgreSQL persistence using an ephemeral `http` server and `fetch`. Requires a running PostgreSQL instance configured in `backend/.env`.
- `backend/tests/aiSyllabusJobService.test.ts`: Tests `AISyllabusJobService` and `AISyllabusEngineService` against PostgreSQL textbook records (`google_drive_materials`, `syllabus_units`, `syllabus_lessons`).

**E2E Tests:**
- Not used.

## Common Patterns

**Async Testing:**
```typescript
// Ephemeral Express server + native fetch in backend/tests/studentAuthOAuth.test.ts
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const addr = server.address() as { port: number };
const baseUrl = `http://127.0.0.1:${addr.port}`;
const res = await fetch(`${baseUrl}/api/student/google`, { method: 'POST', ... });
```

**Error Testing:**
```typescript
// Nested try/catch expecting a typed error in backend/tests/geminiJsonParser.test.ts
try {
  parseGeminiJsonResponse(missingComma);
  throw new Error('Should have thrown on missing comma');
} catch (e: any) {
  if (e instanceof GeminiJsonParseError && e.line > 0 && e.position > 0) {
    passed++;
  } else {
    throw e;
  }
}
```

## Verification & Quality Gates

- **TypeScript:** Both `npx tsc -b --noEmit` (frontend) and `cd backend && npx tsc --noEmit` (backend) exit with code `0` and zero errors.
- **Linter (`oxlint`):** Running unscoped `npm run lint` scans 723 files across the entire repo (including `.agents/`, `backend/`, and root `.cjs` scripts) and reports 522 warnings and 3 errors; running `npx oxlint src` on the frontend reports 131 warnings and 0 errors.

---

*Testing analysis: 2026-11-18*
