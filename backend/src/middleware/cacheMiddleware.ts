import type { Request, Response, NextFunction } from 'express';
import { cacheService, CACHE_CONFIG } from '../services/cacheService';
import { verifyAdminToken } from './auth';

export interface ResponseCacheOptions {
  /** Logical cache prefix, e.g. 'syllabus', 'study_materials', 'mcq' */
  namespace: string;
  /** Time-to-live in milliseconds */
  ttlMs: number;
  /** Optional predicate to skip caching for specific requests */
  shouldCache?: (req: Request) => boolean;
}

/**
 * Deterministic cache key from namespace + normalized path + sorted query params.
 */
export function buildHttpCacheKey(namespace: string, req: Request): string {
  const cleanBase = `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+/g, '/').toLowerCase();
  const entries = Object.entries(req.query || {})
    .filter(([k]) => k !== 'token' && k !== '_' && k !== 'nocache')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : String(v ?? '')}`);
  const qs = entries.length > 0 ? `?${entries.join('&')}` : '';
  return `${namespace}:${cleanBase}${qs}`;
}

function isAdminRequest(req: Request): boolean {
  const auth = req.headers.authorization;
  const token =
    auth && auth.startsWith('Bearer ')
      ? auth.slice(7).trim()
      : typeof req.query.token === 'string'
        ? req.query.token.trim()
        : '';
  if (!token) return false;
  return Boolean(verifyAdminToken(token));
}

function defaultShouldBypass(req: Request): boolean {
  if (req.method !== 'GET') return true;
  if (!cacheService.isEnabled()) return true;
  if (req.query?.nocache === '1' || req.query?.nocache === 'true') return true;
  const cc = String(req.headers['cache-control'] || '').toLowerCase();
  if (cc.includes('no-cache') || cc.includes('no-store')) return true;

  // Never cache admin paths or unpublished/staging/draft queries
  const fullPath = `${req.baseUrl || ''}${req.path || ''}`.toLowerCase();
  if (fullPath.includes('/admin')) return true;

  const statusParam = String(req.query?.status || '').toLowerCase().trim();
  if (statusParam && statusParam !== 'published') return true;

  // Admins always see live uncached state so edits/drafts reflect instantaneously
  if (isAdminRequest(req)) return true;

  return false;
}

// Single-flight in-flight response map for HTTP-level stampede coalescing
interface CachedHttpPayload {
  statusCode: number;
  body: unknown;
}
const httpInFlight = new Map<string, Promise<CachedHttpPayload | null>>();

/**
 * Reusable Express response-caching middleware with:
 * - Configurable TTL per data category
 * - Single-flight stampede protection for concurrent identical GET requests
 * - Strict bypass for admin/draft/mutating requests
 * - X-Cache: HIT | MISS | BYPASS observability header
 */
export function responseCacheMiddleware(options: ResponseCacheOptions) {
  const { namespace, ttlMs, shouldCache } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (defaultShouldBypass(req) || (shouldCache && !shouldCache(req))) {
      if (req.method === 'GET') res.setHeader('X-Cache', 'BYPASS');
      return next();
    }

    const cacheKey = buildHttpCacheKey(namespace, req);

    // 1. Check cache hit
    const cached = await cacheService.get<CachedHttpPayload>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(cached.statusCode).json(cached.body);
    }

    // 2. Coalesce concurrent identical cache misses (stampede protection)
    const pending = httpInFlight.get(cacheKey);
    if (pending) {
      try {
        const coalesced = await pending;
        if (coalesced) {
          res.setHeader('X-Cache', 'HIT');
          return res.status(coalesced.statusCode).json(coalesced.body);
        }
      } catch {
        // fall through to normal handler
      }
    }

    // 3. First miss: execute route handler and capture JSON response
    let resolveFlight!: (val: CachedHttpPayload | null) => void;
    const flightPromise = new Promise<CachedHttpPayload | null>((resolve) => {
      resolveFlight = resolve;
    });
    httpInFlight.set(cacheKey, flightPromise);

    let settled = false;
    const finishFlight = (val: CachedHttpPayload | null) => {
      if (!settled) {
        settled = true;
        httpInFlight.delete(cacheKey);
        resolveFlight(val);
      }
    };

    const origJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode === 200 && body !== undefined) {
        const payload: CachedHttpPayload = { statusCode: 200, body };
        void cacheService.set(cacheKey, payload, ttlMs).catch(() => {});
        res.setHeader('X-Cache', 'MISS');
        finishFlight(payload);
      } else {
        finishFlight(null);
      }
      return origJson(body);
    }) as Response['json'];

    res.on('close', () => finishFlight(null));
    res.on('finish', () => finishFlight(null));

    return next();
  };
}

/**
 * Automatic cache invalidation middleware for Admin/mutating routes.
 * Whenever POST/PUT/PATCH/DELETE succeeds (status < 400), invalidates all listed prefixes.
 */
export function cacheInvalidationMiddleware(prefixes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          for (const prefix of prefixes) {
            void cacheService.invalidatePrefix(prefix).catch(() => {});
          }
        }
      });
    }
    return next();
  };
}

export const CACHE_MIDDLEWARE_PRESETS = {
  syllabus: responseCacheMiddleware({
    namespace: 'syllabus',
    ttlMs: CACHE_CONFIG.ttl.syllabusMs,
  }),
  studyMaterials: responseCacheMiddleware({
    namespace: 'study_materials',
    ttlMs: CACHE_CONFIG.ttl.studyMaterialsMs,
  }),
  mcq: responseCacheMiddleware({
    namespace: 'mcq',
    ttlMs: CACHE_CONFIG.ttl.mcqMs,
  }),
};
