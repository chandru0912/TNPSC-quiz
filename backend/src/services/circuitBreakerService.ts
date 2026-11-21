import CircuitBreaker from 'opossum';

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';

export interface BreakerProfileConfig {
  name: string;
  timeoutMs: number;
  errorThresholdPercentage: number;
  resetTimeoutMs: number;
  volumeThreshold: number;
  maxRetries: number;
  baseBackoffMs: number;
}

export interface BreakerHealthSnapshot {
  name: string;
  state: BreakerState;
  enabled: boolean;
  config: {
    timeoutMs: number;
    errorThresholdPercentage: number;
    resetTimeoutMs: number;
    volumeThreshold: number;
    maxRetries: number;
  };
  metrics: {
    fires: number;
    successes: number;
    failures: number;
    timeouts: number;
    rejects: number;
    fallbacks: number;
    latencyMeanMs: number;
  };
  lastStateChangeAt: string | null;
}

function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const CIRCUIT_BREAKER_ENABLED =
  String(process.env.CIRCUIT_BREAKER_ENABLED ?? 'true').trim().toLowerCase() !== 'false';

export const SERVICE_BREAKER_PROFILES: Record<string, BreakerProfileConfig> = {
  openai_api: {
    name: 'openai_api',
    timeoutMs: parseEnvInt('CB_AI_TIMEOUT_MS', 30_000),
    errorThresholdPercentage: parseEnvInt('CB_ERROR_THRESHOLD_PCT', 50),
    resetTimeoutMs: parseEnvInt('CB_RESET_TIMEOUT_MS', 30_000),
    volumeThreshold: parseEnvInt('CB_VOLUME_THRESHOLD', 3),
    maxRetries: 1,
    baseBackoffMs: 400,
  },
  claude_api: {
    name: 'claude_api',
    timeoutMs: parseEnvInt('CB_AI_TIMEOUT_MS', 45_000),
    errorThresholdPercentage: parseEnvInt('CB_ERROR_THRESHOLD_PCT', 50),
    resetTimeoutMs: parseEnvInt('CB_RESET_TIMEOUT_MS', 30_000),
    volumeThreshold: parseEnvInt('CB_VOLUME_THRESHOLD', 3),
    maxRetries: 1,
    baseBackoffMs: 500,
  },
  gemini_api: {
    name: 'gemini_api',
    timeoutMs: parseEnvInt('CB_AI_TIMEOUT_MS', 45_000),
    errorThresholdPercentage: parseEnvInt('CB_ERROR_THRESHOLD_PCT', 50),
    resetTimeoutMs: parseEnvInt('CB_RESET_TIMEOUT_MS', 30_000),
    volumeThreshold: parseEnvInt('CB_VOLUME_THRESHOLD', 3),
    maxRetries: 0, // GeminiRetryService already handles model fallback
    baseBackoffMs: 400,
  },
  razorpay_orders: {
    name: 'razorpay_orders',
    timeoutMs: parseEnvInt('CB_PAYMENT_TIMEOUT_MS', 12_000),
    errorThresholdPercentage: parseEnvInt('CB_ERROR_THRESHOLD_PCT', 50),
    resetTimeoutMs: parseEnvInt('CB_PAYMENT_RESET_TIMEOUT_MS', 20_000),
    volumeThreshold: parseEnvInt('CB_VOLUME_THRESHOLD', 3),
    maxRetries: 0, // Strictly 0 retries on payment order creation to prevent duplicate orders
    baseBackoffMs: 0,
  },
  razorpay_payments_read: {
    name: 'razorpay_payments_read',
    timeoutMs: parseEnvInt('CB_PAYMENT_TIMEOUT_MS', 8_000),
    errorThresholdPercentage: parseEnvInt('CB_ERROR_THRESHOLD_PCT', 50),
    resetTimeoutMs: parseEnvInt('CB_PAYMENT_RESET_TIMEOUT_MS', 20_000),
    volumeThreshold: parseEnvInt('CB_VOLUME_THRESHOLD', 3),
    maxRetries: 1, // Idempotent GET
    baseBackoffMs: 250,
  },
  google_oauth: {
    name: 'google_oauth',
    timeoutMs: parseEnvInt('CB_GOOGLE_TIMEOUT_MS', 10_000),
    errorThresholdPercentage: parseEnvInt('CB_ERROR_THRESHOLD_PCT', 50),
    resetTimeoutMs: parseEnvInt('CB_RESET_TIMEOUT_MS', 20_000),
    volumeThreshold: parseEnvInt('CB_VOLUME_THRESHOLD', 3),
    maxRetries: 0, // OAuth authorization codes are single-use — never retry
    baseBackoffMs: 0,
  },
  google_drive: {
    name: 'google_drive',
    timeoutMs: parseEnvInt('CB_GOOGLE_DRIVE_TIMEOUT_MS', 20_000),
    errorThresholdPercentage: parseEnvInt('CB_ERROR_THRESHOLD_PCT', 50),
    resetTimeoutMs: parseEnvInt('CB_RESET_TIMEOUT_MS', 30_000),
    volumeThreshold: parseEnvInt('CB_VOLUME_THRESHOLD', 3),
    maxRetries: 1,
    baseBackoffMs: 300,
  },
};

export class CircuitOpenError extends Error {
  public readonly statusCode = 503;
  public readonly code = 'SERVICE_CIRCUIT_OPEN';
  public readonly serviceName: string;

  constructor(serviceName: string, message?: string) {
    super(message || `External service "${serviceName}" is temporarily unavailable. Please try again shortly.`);
    this.name = 'CircuitOpenError';
    this.serviceName = serviceName;
  }
}

function logStructured(level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown>) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    component: 'circuit_breaker',
    event,
    ...data,
  });
  if (level === 'error') console.error(payload);
  else if (level === 'warn') console.warn(payload);
  else console.info(payload);
}

function isRetryableTransientError(err: any): boolean {
  if (!err) return false;
  if (err instanceof CircuitOpenError || err.code === 'EOPENBREAKER') return false;
  const status = Number(err.statusCode || err.status || err.response?.status || 0);
  // Never retry 4xx client/auth/validation errors (except 429 rate-limit / 408 timeout)
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  return true;
}

async function sleepWithJitter(attempt: number, baseMs: number): Promise<void> {
  const exp = baseMs * Math.pow(2, attempt);
  const jittered = Math.floor(Math.random() * exp); // Full jitter prevents thundering-herd retry storms
  await new Promise((r) => setTimeout(r, Math.max(50, jittered)));
}

interface ManagedBreaker {
  config: BreakerProfileConfig;
  breaker: CircuitBreaker<[() => Promise<unknown>], unknown>;
  lastStateChangeAt: string | null;
}

const registry = new Map<string, ManagedBreaker>();

export function getOrCreateBreaker(
  name: string,
  overrideConfig?: Partial<BreakerProfileConfig>
): ManagedBreaker {
  const existing = registry.get(name);
  if (existing) return existing;

  const base = SERVICE_BREAKER_PROFILES[name] || {
    name,
    timeoutMs: 15_000,
    errorThresholdPercentage: 50,
    resetTimeoutMs: 20_000,
    volumeThreshold: 3,
    maxRetries: 0,
    baseBackoffMs: 300,
  };
  const config: BreakerProfileConfig = { ...base, ...overrideConfig, name };

  const breaker = new CircuitBreaker(
    async (action: () => Promise<unknown>) => await action(),
    {
      name: config.name,
      timeout: config.timeoutMs,
      errorThresholdPercentage: config.errorThresholdPercentage,
      resetTimeout: config.resetTimeoutMs,
      volumeThreshold: config.volumeThreshold,
      rollingCountTimeout: 10_000,
      rollingCountBuckets: 10,
      // Do not trip the circuit on 4xx client validation/auth errors
      errorFilter: (err: any) => {
        const status = Number(err?.statusCode || err?.status || err?.response?.status || 0);
        return status >= 400 && status < 500 && status !== 408 && status !== 429;
      },
    }
  );

  const managed: ManagedBreaker = { config, breaker, lastStateChangeAt: null };

  breaker.on('open', () => {
    managed.lastStateChangeAt = new Date().toISOString();
    logStructured('warn', 'state_open', { service: name, resetTimeoutMs: config.resetTimeoutMs });
  });
  breaker.on('halfOpen', () => {
    managed.lastStateChangeAt = new Date().toISOString();
    logStructured('info', 'state_half_open', { service: name });
  });
  breaker.on('close', () => {
    managed.lastStateChangeAt = new Date().toISOString();
    logStructured('info', 'state_closed', { service: name });
  });
  breaker.on('timeout', () => {
    logStructured('warn', 'timeout', { service: name, timeoutMs: config.timeoutMs });
  });
  breaker.on('reject', () => {
    logStructured('warn', 'rejected_open', { service: name });
  });

  registry.set(name, managed);
  return managed;
}

export interface ExecuteProtectedOptions<T> {
  service: string;
  /** Optional safe fallback invoked when the circuit is OPEN or execution fails */
  fallback?: (err: Error) => T | Promise<T>;
  /** Override max retries (0 for non-idempotent writes like payment creation or OAuth code exchange) */
  maxRetries?: number;
  /** Optional custom breaker config overrides (useful for tests or per-service tuning) */
  configOverride?: Partial<BreakerProfileConfig>;
}

/**
 * Executes an external service call protected by an Opossum Circuit Breaker
 * with controlled exponential backoff + jitter (only when safe & idempotent).
 */
export async function executeWithCircuitBreaker<T>(
  options: ExecuteProtectedOptions<T>,
  action: () => Promise<T>
): Promise<T> {
  if (!CIRCUIT_BREAKER_ENABLED) {
    return action();
  }

  const managed = getOrCreateBreaker(options.service, options.configOverride);
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : managed.config.maxRetries;

  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return (await managed.breaker.fire(action)) as T;
    } catch (err: any) {
      lastErr = err;

      // Fast-fail immediately if the circuit is OPEN (never retry an open breaker!)
      if (err?.code === 'EOPENBREAKER' || managed.breaker.opened) {
        const openErr = new CircuitOpenError(options.service);
        if (options.fallback) {
          return await options.fallback(openErr);
        }
        throw openErr;
      }

      const canRetry = attempt < maxRetries && isRetryableTransientError(err);
      if (!canRetry) break;

      await sleepWithJitter(attempt, managed.config.baseBackoffMs);
    }
  }

  if (options.fallback) {
    return await options.fallback(lastErr instanceof Error ? lastErr : new Error(String(lastErr)));
  }
  throw lastErr;
}

export function getBreakerState(breaker: CircuitBreaker<any, any>): BreakerState {
  if (breaker.opened) return 'OPEN';
  if (breaker.halfOpen) return 'HALF-OPEN';
  return 'CLOSED';
}

export function getAllCircuitBreakerSnapshots(): {
  enabled: boolean;
  runtimeScope: string;
  breakers: BreakerHealthSnapshot[];
  timestamp: string;
} {
  // Ensure all primary external service profiles are visible in monitoring even before first call
  for (const name of Object.keys(SERVICE_BREAKER_PROFILES)) {
    getOrCreateBreaker(name);
  }

  const breakers: BreakerHealthSnapshot[] = Array.from(registry.values()).map(({ config, breaker, lastStateChangeAt }) => {
    const s = breaker.stats;
    return {
      name: config.name,
      state: getBreakerState(breaker),
      enabled: CIRCUIT_BREAKER_ENABLED,
      config: {
        timeoutMs: config.timeoutMs,
        errorThresholdPercentage: config.errorThresholdPercentage,
        resetTimeoutMs: config.resetTimeoutMs,
        volumeThreshold: config.volumeThreshold,
        maxRetries: config.maxRetries,
      },
      metrics: {
        fires: s.fires,
        successes: s.successes,
        failures: s.failures,
        timeouts: s.timeouts,
        rejects: s.rejects,
        fallbacks: s.fallbacks,
        latencyMeanMs: Math.round((s.latencyMean || 0) * 100) / 100,
      },
      lastStateChangeAt,
    };
  });

  return {
    enabled: CIRCUIT_BREAKER_ENABLED,
    runtimeScope: process.env.VERCEL ? 'vercel-serverless-instance-local' : 'node-process-local',
    breakers,
    timestamp: new Date().toISOString(),
  };
}

export function resetBreakerForTests(name: string): void {
  const existing = registry.get(name);
  if (existing) {
    existing.breaker.shutdown();
    registry.delete(name);
  }
}
