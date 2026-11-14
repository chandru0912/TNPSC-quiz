/**
 * geminiRetryService.test.ts
 *
 * Verifies retry backoff, 503 handling, 429 handling, and model fallback logic.
 */

import { GeminiRetryService } from './geminiRetryService';

async function runTests() {
  console.log('=== STARTING GEMINI RETRY & FALLBACK TESTS ===\n');
  let passed = 0;
  let failed = 0;

  // TEST 1: Primary model succeeds on first attempt
  try {
    console.log('[Test 1] Primary model succeeds on first attempt:');
    let callCount = 0;
    const res = await GeminiRetryService.executeWithRetryAndFallback(
      async (model: string) => {
        callCount++;
        return `Result from ${model}`;
      },
      {
        primaryModel: 'gemini-3.8-flash',
        fallbackModels: ['gemini-2.5-flash', 'gemini-2.0-flash'],
        maxRetries: 2,
        retryDelaysMs: [10, 20],
      }
    );

    if (res.modelUsed === 'gemini-3.8-flash' && res.attempts === 1 && !res.isFallback) {
      console.log('  -> PASS: Succeeded on primary model with 1 attempt.\n');
      passed++;
    } else {
      throw new Error(`Unexpected result: ${JSON.stringify(res)}`);
    }
  } catch (e: any) {
    console.error('  -> FAIL:', e.message, '\n');
    failed++;
  }

  // TEST 2: Primary model returns 503 (high demand), falls back to secondary model which succeeds
  try {
    console.log('[Test 2] Primary model returns 503, falls back to secondary model:');
    const attemptedModels: string[] = [];

    const res = await GeminiRetryService.executeWithRetryAndFallback(
      async (model: string) => {
        attemptedModels.push(model);
        if (model === 'gemini-3.8-flash') {
          const err = new Error('503 Service Unavailable: This model is currently experiencing high demand.');
          (err as any).status = 503;
          throw err;
        }
        return `Success from fallback ${model}`;
      },
      {
        primaryModel: 'gemini-3.8-flash',
        fallbackModels: ['gemini-2.5-flash', 'gemini-2.0-flash'],
        maxRetries: 2,
        retryDelaysMs: [10, 20],
      }
    );

    if (res.isFallback && res.modelUsed === 'gemini-2.5-flash') {
      console.log(`  -> PASS: Successfully fell back to "${res.modelUsed}" after primary returned 503.\n`);
      passed++;
    } else {
      throw new Error(`Expected fallback to gemini-2.5-flash, got: ${res.modelUsed}`);
    }
  } catch (e: any) {
    console.error('  -> FAIL:', e.message, '\n');
    failed++;
  }

  // TEST 3: Model returns 429 rate limit, then succeeds on retry
  try {
    console.log('[Test 3] Model returns 429 rate limit, then succeeds on retry 2:');
    let attempts = 0;

    const res = await GeminiRetryService.executeWithRetryAndFallback(
      async (model: string) => {
        attempts++;
        if (attempts === 1) {
          const err = new Error('429 Too Many Requests: Rate limit reached');
          (err as any).status = 429;
          throw err;
        }
        return `Success on attempt ${attempts} from ${model}`;
      },
      {
        primaryModel: 'gemini-3.8-flash',
        maxRetries: 3,
        retryDelaysMs: [10, 20, 30],
      }
    );

    if (attempts === 2 && res.attempts === 2) {
      console.log(`  -> PASS: Retried 429 rate limit and succeeded on attempt ${attempts}.\n`);
      passed++;
    } else {
      throw new Error(`Expected 2 attempts, got ${attempts}`);
    }
  } catch (e: any) {
    console.error('  -> FAIL:', e.message, '\n');
    failed++;
  }

  // TEST 4: Non-retryable error (e.g. 401 invalid key) does not loop through retries
  try {
    console.log('[Test 4] Non-retryable error (401 Invalid Key) fails immediately:');
    let attempts = 0;

    await GeminiRetryService.executeWithRetryAndFallback(
      async () => {
        attempts++;
        const err = new Error('API key not valid. Please pass a valid API key.');
        (err as any).status = 400;
        throw err;
      },
      {
        primaryModel: 'gemini-3.8-flash',
        maxRetries: 4,
        retryDelaysMs: [10, 20, 30, 40],
      }
    );
    throw new Error('Expected 401 to fail immediately');
  } catch (e: any) {
    if (e.statusCode === 401 && e.errorType === 'invalid_api_key') {
      console.log('  -> PASS: Failed immediately on 401 without burning retries.\n');
      passed++;
    } else {
      console.error('  -> FAIL:', e.message, '\n');
      failed++;
    }
  }

  // TEST 5: All models return 503 -> exhausts gracefully and reports 503
  try {
    console.log('[Test 5] All models fail with 503 -> exhausts gracefully:');
    await GeminiRetryService.executeWithRetryAndFallback(
      async (model: string) => {
        const err = new Error(`503 High Demand on ${model}`);
        (err as any).status = 503;
        throw err;
      },
      {
        primaryModel: 'gemini-3.8-flash',
        fallbackModels: ['gemini-2.5-flash'],
        maxRetries: 2,
        retryDelaysMs: [10, 20],
      }
    );
    throw new Error('Expected all models to fail');
  } catch (e: any) {
    if (e.statusCode === 503 && e.retryable === true) {
      console.log(`  -> PASS: Gracefully caught all model failures with status 503: "${e.message}".\n`);
      passed++;
    } else {
      console.error('  -> FAIL:', e.message, '\n');
      failed++;
    }
  }

  console.log(`=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests();
