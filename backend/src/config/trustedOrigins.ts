import type { Request } from 'express';

/**
 * Single source of truth for explicitly trusted frontend origins across:
 * 1. Express CORS middleware (`backend/src/server.ts`)
 * 2. Student Google OAuth CSRF origin check (`backend/src/routes/student.ts`)
 *
 * Security policy:
 * - Wildcard (`*`) origins are NEVER accepted because credentialed auth is used.
 * - Only explicitly configured production domains, project Vercel subdomains,
 *   and localhost development origins are trusted.
 */

const STATIC_TRUSTED_ORIGINS = new Set<string>([
  'https://tnpsc-quiz-lrkivhxrn-moonzoro.vercel.app',
  'https://tnpsc-quiz-1rra490pf-moonzoro.vercel.app',
  'https://tnpsc-quiz-lval.vercel.app',
  'https://tnpsc-quiz-jwkl.vercel.app',
  'https://tnpsc-quiz-jwk1.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
]);

function normalizeOrigin(raw: string): string {
  const cleaned = raw.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  if (!cleaned || cleaned === '*') return '';
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.origin.toLowerCase();
  } catch {
    return '';
  }
}

function getEnvTrustedOrigins(): Set<string> {
  const origins = new Set<string>();
  const rawSources = [
    process.env.CORS_ORIGIN || '',
    process.env.FRONTEND_URL || '',
    process.env.PUBLIC_APP_URL || '',
    process.env.APP_URL || '',
  ];

  for (const source of rawSources) {
    if (!source.trim()) continue;
    for (const part of source.split(',')) {
      const normalized = normalizeOrigin(part);
      // Explicitly ignore '*' wildcards for credentialed authentication
      if (normalized) {
        origins.add(normalized);
      }
    }
  }

  return origins;
}

export function isTrustedOrigin(rawOrigin?: string | null): boolean {
  if (!rawOrigin || typeof rawOrigin !== 'string') return false;
  const origin = normalizeOrigin(rawOrigin);
  if (!origin) return false;

  if (STATIC_TRUSTED_ORIGINS.has(origin)) {
    return true;
  }

  if (getEnvTrustedOrigins().has(origin)) {
    return true;
  }

  // Explicitly allow local development origins on localhost / 127.0.0.1
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return true;
  }

  // Explicitly allow this project's Vercel production & preview subdomains
  if (
    /^https:\/\/tnpsc-quiz[a-z0-9-]*\.vercel\.app$/i.test(origin) ||
    /^https:\/\/tnpsc-aspirant-orbit[a-z0-9-]*\.vercel\.app$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+-moonzoro\.vercel\.app$/i.test(origin)
  ) {
    return true;
  }

  return false;
}

/**
 * Validates that a browser-originated authentication request comes from a trusted origin.
 * Allows same-origin / non-browser requests with no Origin header, and strictly checks
 * Origin (or Referer fallback) against `isTrustedOrigin`.
 */
export function isTrustedAuthOriginRequest(req: Request): boolean {
  const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  if (originHeader) {
    return isTrustedOrigin(originHeader);
  }

  // Same-origin browser requests or non-browser clients without Origin header:
  // If Referer is present, ensure it also resolves to a trusted origin.
  const refererHeader = typeof req.headers.referer === 'string' ? req.headers.referer.trim() : '';
  if (refererHeader) {
    return isTrustedOrigin(refererHeader);
  }

  return true;
}
