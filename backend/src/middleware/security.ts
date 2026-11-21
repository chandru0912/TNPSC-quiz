import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';

/**
 * Production HTTP security headers configured safely for JSON APIs, PDF streaming,
 * and cross-origin Vercel frontend deployments.
 */
export const securityHeadersMiddleware = helmet({
  contentSecurityPolicy: false, // API server serves JSON/PDF streams; CSP is managed by frontend
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts:
    process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xPoweredBy: true,
});

function containsNullByte(value: unknown, depth = 0): boolean {
  if (depth > 8 || value == null) return false;
  if (typeof value === 'string') return value.includes('\0');
  if (Array.isArray(value)) return value.some((item) => containsNullByte(item, depth + 1));
  if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (containsNullByte(v, depth + 1)) return true;
    }
  }
  return false;
}

/**
 * Lightweight request validator rejecting null-byte injection and excessively long query parameters
 * without adding database overhead.
 */
export function requestInputValidationMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.originalUrl && req.originalUrl.length > 4096) {
    return res.status(414).json({
      status: 'error',
      code: 'URI_TOO_LONG',
      message: 'Request URL exceeds maximum permitted length.',
    });
  }

  if (containsNullByte(req.query) || containsNullByte(req.body)) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_INPUT',
      message: 'Request contains invalid characters.',
    });
  }

  // Cap search query length to prevent expensive wildcard table scans
  if (typeof req.query?.search === 'string' && req.query.search.length > 200) {
    return res.status(400).json({
      status: 'error',
      code: 'SEARCH_QUERY_TOO_LONG',
      message: 'Search query must not exceed 200 characters.',
    });
  }

  return next();
}
