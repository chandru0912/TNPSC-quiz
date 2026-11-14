/**
 * geminiRetryService.ts
 *
 * Reusable Retry and Model Fallback Engine for Google Gemini.
 *
 * Capabilities:
 * 1. Automatic exponential backoff with jitter (2s, 4s, 8s, 16s) for temporary 503, 500, 502, 504, 429.
 * 2. Model fallback to secondary models (gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash, etc.) when 503 high demand occurs.
 * 3. Respects Retry-After headers if provided by Google.
 * 4. Preserves configured primary model without silently mutating database/env state.
 * 5. Structured logging (Request ID, Primary Model, Fallback Model, Status, Attempt, Duration, Result).
 */

import { classifyGeminiError, ClassifiedGeminiError } from './gemini.validator';
import { getGeminiModel, getGeminiFallbackModels } from './gemini.config';

export interface GeminiExecuteOptions {
  requestId?: string;
  primaryModel?: string;
  fallbackModels?: string[];
  maxRetries?: number; // Default: 4
  retryDelaysMs?: number[]; // Default: [2000, 4000, 8000, 16000]
  onRetry?: (attempt: number, delayMs: number, error: ClassifiedGeminiError, model: string) => void;
}

export interface GeminiExecutionResult<T> {
  data: T;
  modelUsed: string;
  requestId: string;
  attempts: number;
  durationMs: number;
  isFallback: boolean;
}

export class GeminiRetryService {
  private static readonly DEFAULT_DELAYS = [2000, 4000, 8000, 16000];
  private static readonly MAX_RETRIES = 4;

  /**
   * Generates a unique request identifier for structured tracing.
   */
  static generateRequestId(): string {
    return `req_gemini_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Helper sleep with jitter: baseMs ± jitter (up to 300ms)
   */
  private static async sleep(ms: number): Promise<void> {
    const jitter = Math.floor(Math.random() * 400) - 200; // -200ms to +200ms
    const finalDelay = Math.max(500, ms + jitter);
    return new Promise((resolve) => setTimeout(resolve, finalDelay));
  }

  /**
   * Executes a Gemini API generator function with automated retry and model fallback.
   *
   * @param executeFn A function taking the current model identifier and returning a Promise of result T.
   * @param options Execution settings including custom models, max retries, delays, and callbacks.
   */
  static async executeWithRetryAndFallback<T>(
    executeFn: (model: string) => Promise<T>,
    options?: GeminiExecuteOptions
  ): Promise<GeminiExecutionResult<T>> {
    const requestId = options?.requestId || this.generateRequestId();
    const primaryModel = options?.primaryModel || getGeminiModel();
    const configuredFallbacks = options?.fallbackModels || getGeminiFallbackModels();

    // Model sequence: primary model followed by unique fallback models
    const modelSequence = [
      primaryModel,
      ...configuredFallbacks.filter((m) => m !== primaryModel),
    ];

    const maxRetries = options?.maxRetries ?? this.MAX_RETRIES;
    const retryDelays = options?.retryDelaysMs || this.DEFAULT_DELAYS;
    const overallStart = Date.now();

    let lastError: ClassifiedGeminiError = {
      message: 'Initial state',
      statusCode: 500,
      errorType: 'unknown_error',
      retryable: true,
    };

    let totalAttemptsCount = 0;

    for (let modelIdx = 0; modelIdx < modelSequence.length; modelIdx++) {
      const currentModel = modelSequence[modelIdx];
      const isFallback = currentModel !== primaryModel;

      if (isFallback) {
        console.warn(
          `[GeminiRetryService] [${requestId}] Switched to fallback model: "${currentModel}" (Primary was: "${primaryModel}")`
        );
      }

      // Retry loop for the current model
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        totalAttemptsCount++;
        const attemptStart = Date.now();

        console.info(
          `[GeminiRetryService] [${requestId}] Attempt ${attempt}/${maxRetries} using model "${currentModel}"`
        );

        try {
          const result = await executeFn(currentModel);
          const duration = Date.now() - overallStart;

          console.info(
            `[GeminiRetryService] [${requestId}] SUCCESS: Model="${currentModel}" (Fallback=${isFallback}) Attempts=${totalAttemptsCount} Duration=${duration}ms`
          );

          return {
            data: result,
            modelUsed: currentModel,
            requestId,
            attempts: totalAttemptsCount,
            durationMs: duration,
            isFallback,
          };
        } catch (rawError: any) {
          const durationAttempt = Date.now() - attemptStart;
          const classified = classifyGeminiError(rawError);
          lastError = classified;

          console.warn(
            `[GeminiRetryService] [${requestId}] FAILED Attempt ${attempt}/${maxRetries} on "${currentModel}": [${classified.statusCode}] ${classified.message} (${durationAttempt}ms)`
          );

          const isModelNotFound = classified.statusCode === 404 || classified.errorType === 'model_not_found';
          const isModelQuotaExceeded =
            classified.statusCode === 429 &&
            (classified.errorType === 'quota_exceeded' ||
              String(rawError?.message || '').toLowerCase().includes('free tier') ||
              String(rawError?.message || '').toLowerCase().includes('per day limit') ||
              String(rawError?.message || '').toLowerCase().includes('quota exceeded'));

          // If the model itself is not found, deprecated (404), or this specific model's quota is exhausted:
          // Immediately advance to the next fallback model in the sequence if one exists
          if (isModelNotFound || isModelQuotaExceeded) {
            if (modelIdx < modelSequence.length - 1) {
              console.warn(
                `[GeminiRetryService] [${requestId}] Model "${currentModel}" ${
                  isModelQuotaExceeded ? 'quota exhausted' : 'not found / deprecated'
                }. Advancing immediately to fallback model "${modelSequence[modelIdx + 1]}".`
              );
              break;
            }
          }

          // If error is strictly non-retryable across all models (e.g. invalid API key, safety block)
          // immediately fail rather than burning through useless retries
          if (
            !classified.retryable &&
            !isModelNotFound &&
            !isModelQuotaExceeded
          ) {
            console.error(
              `[GeminiRetryService] [${requestId}] Non-retryable error encountered: [${classified.statusCode}] ${classified.message}`
            );
            const err = new Error(classified.message) as any;
            err.statusCode = classified.statusCode;
            err.errorType = classified.errorType;
            err.requestId = requestId;
            throw err;
          }

          // If this is a 503 high demand error and we have fallback models available,
          // don't burn all retries waiting on the overloaded model; try 1 retry then switch to fallback
          if (classified.statusCode === 503 && modelIdx < modelSequence.length - 1 && attempt >= 2) {
            console.warn(
              `[GeminiRetryService] [${requestId}] Model "${currentModel}" consistently returning 503 (high demand). Advancing to next fallback model "${modelSequence[modelIdx + 1]}".`
            );
            break;
          }

          // If retries remain for this model, wait exponential backoff with jitter
          if (attempt < maxRetries) {
            const delayBase = retryDelays[attempt - 1] || 16000;
            const delayMs = classified.retryAfterSeconds
              ? Math.max(delayBase, classified.retryAfterSeconds * 1000)
              : delayBase;

            console.info(
              `[GeminiRetryService] [${requestId}] Waiting ${delayMs}ms before attempt ${attempt + 1}...`
            );

            if (options?.onRetry) {
              options.onRetry(attempt, delayMs, classified, currentModel);
            }

            await this.sleep(delayMs);
          }
        }
      }
    }

    // All models and retry attempts exhausted
    const totalDuration = Date.now() - overallStart;
    console.error(
      `[GeminiRetryService] [${requestId}] ALL MODELS EXHAUSTED after ${totalAttemptsCount} attempts (${totalDuration}ms). Final Status: ${lastError.statusCode}. Error: ${lastError.message}`
    );

    const finalErr = new Error(
      `Gemini AI Service Error: ${lastError.message} (Tried ${modelSequence.join(', ')} over ${totalAttemptsCount} attempts)`
    ) as any;
    finalErr.statusCode = lastError.statusCode;
    finalErr.errorType = lastError.errorType;
    finalErr.requestId = requestId;
    finalErr.retryable = lastError.retryable;
    throw finalErr;
  }
}

export default GeminiRetryService;
