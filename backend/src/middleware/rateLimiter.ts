import rateLimit, { type RateLimitRequestHandler, type Store, type IncrementResponse, type Options } from 'express-rate-limit';
import Redis from 'ioredis';
import type { Request, Response, NextFunction } from 'express';
import { verifyStudentToken, verifyAdminToken } from './auth';

// ====================================================
// 1. Configurable Environment-Driven Limits
// ====================================================
function parseEnvPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const RATE_LIMIT_CONFIG = {
  windowMs: parseEnvPositiveInt('RATE_LIMIT_WINDOW_MS', 60_000), // 1 minute
  generalStudentMax: parseEnvPositiveInt('RATE_LIMIT_MAX_REQUESTS', 60), // 60 req/min
  studentLoginMax: parseEnvPositiveInt('LOGIN_RATE_LIMIT_MAX', 5), // 5 req/min per account+IP
  studentLoginSharedIpMax: parseEnvPositiveInt('LOGIN_SHARED_IP_MAX', 25), // shared-IP safety cap
  adminLoginMax: parseEnvPositiveInt('ADMIN_RATE_LIMIT_MAX', 5), // 5 req/min strict
  otpVerificationMax: parseEnvPositiveInt('OTP_RATE_LIMIT_MAX', parseEnvPositiveInt('LOGIN_RATE_LIMIT_MAX', 5)), // 5 req/min
  mcqPracticeMax: parseEnvPositiveInt('MCQ_RATE_LIMIT_MAX', 120), // 120 req/min
  searchMax: parseEnvPositiveInt('SEARCH_RATE_LIMIT_MAX', 30), // 30 req/min
  aiWindowMs: parseEnvPositiveInt('AI_RATE_LIMIT_WINDOW_MS', 10 * 60_000), // 10 minutes
  aiMax: parseEnvPositiveInt('AI_RATE_LIMIT_MAX', 5), // 5 req/10 min
  uploadWindowMs: parseEnvPositiveInt('UPLOAD_RATE_LIMIT_WINDOW_MS', 10 * 60_000), // 10 minutes
  uploadMax: parseEnvPositiveInt('UPLOAD_RATE_LIMIT_MAX', 20), // 20 uploads/10 min
} as const;

// ====================================================
// 2. Optional Shared Redis Store with Automatic Fail-Open Recovery
// ====================================================
let sharedRedisClient: Redis | null = null;
let redisHealthy = false;
let redisInitAttempted = false;

function getSharedRedisClient(): Redis | null {
  const redisUrl = (process.env.REDIS_URL || '').trim();
  if (!redisUrl) return null;

  if (!redisInitAttempted) {
    redisInitAttempted = true;
    try {
      sharedRedisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: 3000,
        lazyConnect: false,
        retryStrategy(times) {
          // Exponential backoff capped at 30s so Redis recovers cleanly without flooding logs
          return Math.min(times * 500, 30_000);
        },
      });

      sharedRedisClient.on('ready', () => {
        redisHealthy = true;
        console.info('[RateLimiter] Connected to shared Redis store.');
      });

      sharedRedisClient.on('error', (err) => {
        if (redisHealthy) {
          console.warn('[RateLimiter] Redis unavailable, failing open to local fallback store:', err.message);
        }
        redisHealthy = false;
      });

      sharedRedisClient.on('close', () => {
        redisHealthy = false;
      });
    } catch (err: any) {
      console.warn('[RateLimiter] Failed to initialize Redis client, using local fallback store:', err?.message);
      sharedRedisClient = null;
      redisHealthy = false;
    }
  }

  return sharedRedisClient;
}

// Warn once in Vercel production if REDIS_URL is not configured
if (process.env.VERCEL && !process.env.REDIS_URL) {
  console.warn(
    '[RateLimiter] Running on Vercel without REDIS_URL: rate limits are instance-local. Configure REDIS_URL (e.g. Upstash Redis) for global cross-instance enforcement.'
  );
}

// Atomic INCR + PEXPIRE Lua script so keys never leak without TTL
const REDIS_INCR_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local pttl = redis.call("PTTL", KEYS[1])
return { current, pttl }
`;

export class ResilientRedisStore implements Store {
  public prefix: string;
  private windowMs: number = 60_000;
  private localFallback = new Map<string, { hits: number; resetAt: number }>();
  private redisClientOverride?: Redis | null;

  constructor(prefix: string, redisClientOverride?: Redis | null) {
    this.prefix = prefix;
    this.redisClientOverride = redisClientOverride;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private incrementLocal(key: string): IncrementResponse {
    const now = Date.now();
    // Lightweight opportunistic pruning to prevent unbounded memory growth
    if (this.localFallback.size > 10_000) {
      for (const [k, v] of this.localFallback.entries()) {
        if (v.resetAt <= now) this.localFallback.delete(k);
      }
    }
    const existing = this.localFallback.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.localFallback.set(key, { hits: 1, resetAt });
      return { totalHits: 1, resetTime: new Date(resetAt) };
    }
    existing.hits += 1;
    return { totalHits: existing.hits, resetTime: new Date(existing.resetAt) };
  }

  async increment(key: string): Promise<IncrementResponse> {
    const client = this.redisClientOverride !== undefined ? this.redisClientOverride : getSharedRedisClient();
    const canUseRedis = client && (this.redisClientOverride !== undefined ? client.status === 'ready' : redisHealthy);

    if (canUseRedis) {
      try {
        const redisKey = `rl:${this.prefix}:${key}`;
        const result = (await client.eval(REDIS_INCR_SCRIPT, 1, redisKey, String(this.windowMs))) as [number, number];
        const totalHits = Number(result?.[0] ?? 1);
        const pttl = Number(result?.[1] ?? this.windowMs);
        const resetMs = pttl > 0 ? pttl : this.windowMs;
        return {
          totalHits,
          resetTime: new Date(Date.now() + resetMs),
        };
      } catch {
        // Automatic fail-open fallback to local counter if Redis drops mid-request
        return this.incrementLocal(key);
      }
    }

    return this.incrementLocal(key);
  }

  async decrement(key: string): Promise<void> {
    const client = this.redisClientOverride !== undefined ? this.redisClientOverride : getSharedRedisClient();
    const canUseRedis = client && (this.redisClientOverride !== undefined ? client.status === 'ready' : redisHealthy);
    if (canUseRedis) {
      try {
        await client.decr(`rl:${this.prefix}:${key}`);
        return;
      } catch {
        // fallback below
      }
    }
    const existing = this.localFallback.get(key);
    if (existing && existing.hits > 0) existing.hits -= 1;
  }

  async resetKey(key: string): Promise<void> {
    const client = this.redisClientOverride !== undefined ? this.redisClientOverride : getSharedRedisClient();
    const canUseRedis = client && (this.redisClientOverride !== undefined ? client.status === 'ready' : redisHealthy);
    if (canUseRedis) {
      try {
        await client.del(`rl:${this.prefix}:${key}`);
      } catch {
        // ignore
      }
    }
    this.localFallback.delete(key);
  }
}

export function getRateLimiterHealth() {
  const configured = Boolean((process.env.REDIS_URL || '').trim());
  return {
    storeMode: configured ? (redisHealthy ? 'redis' : 'redis-fallback-memory') : 'memory',
    redisConfigured: configured,
    redisConnected: redisHealthy,
    limits: {
      studentLoginPerMin: RATE_LIMIT_CONFIG.studentLoginMax,
      adminLoginPerMin: RATE_LIMIT_CONFIG.adminLoginMax,
      otpVerificationPerMin: RATE_LIMIT_CONFIG.otpVerificationMax,
      generalStudentPerMin: RATE_LIMIT_CONFIG.generalStudentMax,
      mcqPracticePerMin: RATE_LIMIT_CONFIG.mcqPracticeMax,
      searchPerMin: RATE_LIMIT_CONFIG.searchMax,
      aiGenerationPer10Min: RATE_LIMIT_CONFIG.aiMax,
      fileUploadPer10Min: RATE_LIMIT_CONFIG.uploadMax,
    },
  };
}

// ====================================================
// 3. Trusted Client IP & User-Aware Key Generators
// ====================================================
/**
 * Extracts normalized client IP relying strictly on Express `trust proxy` (1 hop on Vercel)
 * rather than blindly trusting arbitrary X-Forwarded-For chains.
 */
export function getSafeClientIp(req: Request): string {
  const raw = req.ip || req.socket?.remoteAddress || 'unknown';
  return String(raw).replace(/^::ffff:/, '').trim() || 'unknown';
}

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  if (typeof req.query.token === 'string' && req.query.token.trim()) return req.query.token.trim();
  return null;
}

/**
 * Authenticated Student/Admin user-based key with safe IP fallback.
 * Prevents students sharing a hostel/college/office public IP from blocking one another.
 */
export function userOrIpKeyGenerator(req: Request): string {
  const token = extractBearerToken(req);
  if (token) {
    const student = verifyStudentToken(token);
    if (student?.studentId) {
      return `student:${student.studentId}`;
    }
    const admin = verifyAdminToken(token);
    if (admin?.username) {
      return `admin:${admin.username.toLowerCase()}`;
    }
  }
  return `ip:${getSafeClientIp(req)}`;
}

/**
 * Login/OTP composite key: combines IP + normalized account identifier so brute-force against
 * one account is blocked at 5/min while classmates behind the same public IP are not locked out.
 */
export function loginAccountKeyGenerator(req: Request): string {
  const ip = getSafeClientIp(req);
  const rawAcct = req.body?.email || req.body?.username || '';
  const acct = String(rawAcct).trim().toLowerCase().slice(0, 120);
  return acct ? `ip:${ip}:acct:${acct}` : `ip:${ip}`;
}

// ====================================================
// 4. Standardized HTTP 429 Handler with Retry-After
// ====================================================
function buildRateLimitHandler(customMessage: string) {
  return (req: Request, res: Response, _next: NextFunction, optionsUsed: Options) => {
    const resetTime = (req as any).rateLimit?.resetTime as Date | undefined;
    const retryAfterSeconds = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : Math.max(1, Math.ceil(optionsUsed.windowMs / 1000));

    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `${customMessage} Please try again in ${retryAfterSeconds} seconds.`,
      retryAfterSeconds,
    });
  };
}

function createLimiter(opts: {
  prefix: string;
  windowMs: number;
  limit: number;
  message: string;
  keyGenerator: (req: Request) => string;
  skip?: (req: Request) => boolean;
}): RateLimitRequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new ResilientRedisStore(opts.prefix),
    keyGenerator: opts.keyGenerator,
    skip: opts.skip,
    validate: {
      xForwardedForHeader: false,
      keyGeneratorIpFallback: false,
    },
    handler: buildRateLimitHandler(opts.message),
  });
}

// ====================================================
// 5. Exported Production Rate Limiters
// ====================================================

/** 1. Student Login / Registration / Google Auth: 5 req/min per account+IP + 25 req/min shared-IP cap */
const studentLoginAccountLimiter = createLimiter({
  prefix: 'student_login_acct',
  windowMs: RATE_LIMIT_CONFIG.windowMs,
  limit: RATE_LIMIT_CONFIG.studentLoginMax,
  message: 'Too many login attempts for this account.',
  keyGenerator: loginAccountKeyGenerator,
});

const studentLoginIpBurstLimiter = createLimiter({
  prefix: 'student_login_ip',
  windowMs: RATE_LIMIT_CONFIG.windowMs,
  limit: RATE_LIMIT_CONFIG.studentLoginSharedIpMax,
  message: 'Too many authentication attempts from this network.',
  keyGenerator: (req) => `ip:${getSafeClientIp(req)}`,
});

export function studentLoginLimiter(req: Request, res: Response, next: NextFunction) {
  studentLoginAccountLimiter(req, res, (err?: any) => {
    if (err || res.headersSent) return;
    studentLoginIpBurstLimiter(req, res, next);
  });
}

/** 2. Admin Login: strict 5 req/min per IP */
export const adminLoginLimiter = createLimiter({
  prefix: 'admin_login',
  windowMs: RATE_LIMIT_CONFIG.windowMs,
  limit: RATE_LIMIT_CONFIG.adminLoginMax,
  message: 'Too many administrator login attempts.',
  keyGenerator: (req) => `ip:${getSafeClientIp(req)}`,
});

/** 3. OTP / Password Reset Verification: 5 req/min per account+IP */
export const otpVerificationLimiter = createLimiter({
  prefix: 'otp_verify',
  windowMs: RATE_LIMIT_CONFIG.windowMs,
  limit: RATE_LIMIT_CONFIG.otpVerificationMax,
  message: 'Too many verification or password reset attempts.',
  keyGenerator: loginAccountKeyGenerator,
});

/** 4. General Student API: 60 req/min per authenticated student (or IP fallback) */
export const generalStudentApiLimiter = createLimiter({
  prefix: 'student_api',
  windowMs: RATE_LIMIT_CONFIG.windowMs,
  limit: RATE_LIMIT_CONFIG.generalStudentMax,
  message: 'Too many requests to student services.',
  keyGenerator: userOrIpKeyGenerator,
  skip: (req) =>
    req.path === '/session-stream' ||
    req.path === '/login' ||
    req.path === '/register' ||
    req.path === '/auth/google' ||
    req.path === '/forgot-password' ||
    req.path === '/reset-password',
});

/** 5. MCQ Practice API: 120 req/min per authenticated student (fast, high-throughput for exam sessions) */
export const mcqPracticeLimiter = createLimiter({
  prefix: 'mcq_practice',
  windowMs: RATE_LIMIT_CONFIG.windowMs,
  limit: RATE_LIMIT_CONFIG.mcqPracticeMax,
  message: 'MCQ practice request rate limit exceeded.',
  keyGenerator: userOrIpKeyGenerator,
});

/** 6. Search API: 30 req/min when ?search= query is present */
export const searchApiLimiter = createLimiter({
  prefix: 'search_api',
  windowMs: RATE_LIMIT_CONFIG.windowMs,
  limit: RATE_LIMIT_CONFIG.searchMax,
  message: 'Too many search requests.',
  keyGenerator: userOrIpKeyGenerator,
  skip: (req) => {
    const s = req.query?.search;
    return typeof s !== 'string' || s.trim().length === 0;
  },
});

/** 7. AI Question Generation: 5 req / 10 minutes per admin/IP */
export const aiGenerationLimiter = createLimiter({
  prefix: 'ai_generation',
  windowMs: RATE_LIMIT_CONFIG.aiWindowMs,
  limit: RATE_LIMIT_CONFIG.aiMax,
  message: 'AI question generation rate limit reached.',
  keyGenerator: userOrIpKeyGenerator,
});

/** 8. File Upload Frequency: 20 uploads / 10 minutes per user/IP (paired with Multer file size limits) */
export const fileUploadLimiter = createLimiter({
  prefix: 'file_upload',
  windowMs: RATE_LIMIT_CONFIG.uploadWindowMs,
  limit: RATE_LIMIT_CONFIG.uploadMax,
  message: 'Too many file uploads in a short period.',
  keyGenerator: userOrIpKeyGenerator,
});
