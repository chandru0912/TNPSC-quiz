import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { executeWithCircuitBreaker } from './circuitBreakerService';

export const GOOGLE_AUTH_REQUIRED_MESSAGE = 'Please sign in using a verified Google Account.';

const VALID_GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export interface VerifiedGoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  hostedDomain: string | null;
  fullName: string;
  avatarUrl: string | null;
}

export class GoogleAuthError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 401, code = 'GOOGLE_AUTH_FAILED') {
    super(message);
    this.name = 'GoogleAuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function normalizeGoogleAvatarUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  // Upgrade low-resolution Google OAuth thumbnails (=s96-c, =s64-c, etc.) to crisp 256px circular-ready quality
  if (/googleusercontent\.com/i.test(trimmed)) {
    if (/=s\d+-c/i.test(trimmed)) {
      return trimmed.replace(/=s\d+-c/i, '=s256-c');
    }
    if (!/=s\d+/i.test(trimmed)) {
      return `${trimmed}=s256-c`;
    }
  }
  return trimmed;
}

function resolveGoogleFullName(info: { name?: string | null; given_name?: string | null; family_name?: string | null; email: string }): string {
  const direct = String(info.name || '').trim();
  if (direct) return direct;
  const combined = [info.given_name, info.family_name]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(' ');
  if (combined) return combined;
  return info.email.split('@')[0].trim();
}

export function cleanEnvValue(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  return val
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/[\r\n\t]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

export function getGoogleOAuthPublicConfig(): { clientId: string; configured: boolean } {
  const clientId = cleanEnvValue(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET);
  return {
    clientId,
    configured: Boolean(clientId && clientSecret),
  };
}

/**
 * Safe startup validation for Google OAuth environment variables.
 * Never logs secrets, tokens, keys, or passwords.
 */
export function validateGoogleOAuthStartupConfig(): { valid: boolean; warnings: string[] } {
  const clientId = cleanEnvValue(process.env.GOOGLE_CLIENT_ID);
  const viteClientId = cleanEnvValue(process.env.VITE_GOOGLE_CLIENT_ID);
  const clientSecret = cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET);
  const warnings: string[] = [];

  if (!clientId) {
    warnings.push('GOOGLE_CLIENT_ID is missing in backend environment.');
  } else if (!clientId.endsWith('.apps.googleusercontent.com')) {
    warnings.push('GOOGLE_CLIENT_ID format appears invalid (expected *.apps.googleusercontent.com).');
  }
  if (!clientSecret) {
    warnings.push('GOOGLE_CLIENT_SECRET is missing in backend environment (required for code exchange).');
  }
  if (clientId && viteClientId && clientId !== viteClientId) {
    warnings.push('VITE_GOOGLE_CLIENT_ID differs from GOOGLE_CLIENT_ID — ensure frontend and backend use the same OAuth client.');
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * Strictly validates a decoded Google ID Token payload (after cryptographic verification via OAuth2Client.verifyIdToken).
 * Enforces:
 * - Valid Google subject ID (sub)
 * - Exact audience match (aud === GOOGLE_CLIENT_ID)
 * - Valid Google issuer (accounts.google.com or https://accounts.google.com)
 * - Non-expired token (exp > now)
 * - Valid email address
 * - email_verified === true (authoritative claim from Google's signed ID token)
 */
export function validateVerifiedGoogleTokenPayload(
  payload: TokenPayload | undefined | null,
  expectedClientId: string
): VerifiedGoogleProfile {
  if (!payload || typeof payload !== 'object') {
    throw new GoogleAuthError('Invalid or expired Google credential. Please sign in again.', 401, 'INVALID_ID_TOKEN');
  }

  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const iss = typeof payload.iss === 'string' ? payload.iss.trim() : '';
  const aud = payload.aud;
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;

  if (!sub) {
    throw new GoogleAuthError('Google account verification failed: missing Google user identifier.', 401, 'INVALID_SUBJECT');
  }

  if (!VALID_GOOGLE_ISSUERS.has(iss)) {
    throw new GoogleAuthError('Google account verification failed: unrecognized token issuer.', 401, 'INVALID_ISSUER');
  }

  const audMatches = Array.isArray(aud)
    ? aud.includes(expectedClientId)
    : typeof aud === 'string' && aud === expectedClientId;
  if (!expectedClientId || !audMatches) {
    console.error('[Google OAuth Audience Mismatch]:', {
      hasExpectedClientId: Boolean(expectedClientId),
      audMatches: false,
    });
    throw new GoogleAuthError(
      'OAuth Client ID mismatch. Please contact the administrator to verify Google OAuth configuration.',
      401,
      'INVALID_AUDIENCE'
    );
  }

  if (!exp || exp * 1000 <= Date.now()) {
    throw new GoogleAuthError(
      'Invalid or expired Google credential. Please click Continue with Google again.',
      401,
      'TOKEN_EXPIRED'
    );
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new GoogleAuthError('Google account verification failed: invalid email address.', 401, 'INVALID_EMAIL');
  }

  if (payload.email_verified !== true) {
    throw new GoogleAuthError(
      'Your Google Account email is not verified. Please verify your email with Google and try again.',
      403,
      'EMAIL_NOT_VERIFIED'
    );
  }

  const hostedDomain = typeof payload.hd === 'string' && payload.hd.trim() ? payload.hd.trim().toLowerCase() : null;

  return {
    googleId: sub,
    email,
    emailVerified: true,
    hostedDomain,
    fullName: resolveGoogleFullName({
      name: payload.name,
      given_name: payload.given_name,
      family_name: payload.family_name,
      email,
    }),
    avatarUrl: normalizeGoogleAvatarUrl(payload.picture ? String(payload.picture) : null),
  };
}

/**
 * Verifies a Google OAuth 2.0 authorization code or ID token on the backend
 * using google-auth-library's OAuth2Client.verifyIdToken().
 */
export async function verifyGoogleCredentialOrCode(params: {
  code?: string;
  idToken?: string;
  redirectUri?: string;
  codeVerifier?: string;
}): Promise<VerifiedGoogleProfile> {
  const clientId = cleanEnvValue(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET);

  if (!clientId) {
    throw new GoogleAuthError(
      'Google Sign-In is not configured on the server (missing GOOGLE_CLIENT_ID).',
      503,
      'GOOGLE_NOT_CONFIGURED'
    );
  }

  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const rawRedirect = cleanEnvValue(params.redirectUri);
  // Never allow localhost redirect_uri in Vercel/production OAuth token exchange
  const effectiveRedirect =
    !rawRedirect || (isProduction && /localhost|127\.0\.0\.1/i.test(rawRedirect))
      ? 'postmessage'
      : rawRedirect;

  let rawIdToken = cleanEnvValue(params.idToken);
  const authCode = cleanEnvValue(params.code);
  const codeVerifier = cleanEnvValue(params.codeVerifier);

  const oauth2Client = new OAuth2Client(clientId, clientSecret || undefined, effectiveRedirect);

  if (authCode) {
    if (!clientSecret) {
      throw new GoogleAuthError(
        'Google Sign-In code exchange requires GOOGLE_CLIENT_SECRET on the server.',
        503,
        'GOOGLE_SECRET_MISSING'
      );
    }

    let tokens: any;
    try {
      tokens = await executeWithCircuitBreaker(
        { service: 'google_oauth', maxRetries: 0 }, // Authorization codes are single-use — never retry
        async () => {
          const form = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: authCode,
            redirect_uri: effectiveRedirect,
            grant_type: 'authorization_code',
          });
          if (codeVerifier) {
            form.set('code_verifier', codeVerifier);
          }

          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Accept: 'application/json',
            },
            body: form.toString(),
          });

          const tokenBody: any = await tokenRes.json().catch(() => ({}));
          if (!tokenRes.ok) {
            const err: any = new Error(tokenBody?.error_description || tokenBody?.error || `Google token endpoint HTTP ${tokenRes.status}`);
            err.statusCode = tokenRes.status;
            err.googleError = String(tokenBody?.error || '').trim().toLowerCase();
            err.googleErrorDescription = String(tokenBody?.error_description || '').trim();
            throw err;
          }
          return tokenBody;
        }
      );
    } catch (err: any) {
      const googleErrorCode = String(
        err?.googleError || err?.response?.data?.error || ''
      )
        .trim()
        .toLowerCase();
      const googleErrorDesc = String(
        err?.googleErrorDescription || err?.response?.data?.error_description || err?.message || ''
      ).trim();
      const combined = `${googleErrorCode} ${googleErrorDesc}`.toLowerCase();

      // Safe structured diagnostic log (NEVER logs client_secret, auth code, or tokens)
      console.error('[Google OAuth Token Exchange Error]:', {
        googleError: googleErrorCode || 'unknown',
        httpStatus: err?.statusCode || err?.status || null,
        redirectUriMode: effectiveRedirect === 'postmessage' ? 'postmessage' : 'explicit_uri',
        isProduction,
        hasClientId: Boolean(clientId),
        hasClientSecret: Boolean(clientSecret),
      });

      if (googleErrorCode === 'redirect_uri_mismatch' || combined.includes('redirect_uri_mismatch')) {
        throw new GoogleAuthError(
          'Google OAuth configuration error: Authorized JavaScript Origin or Redirect URI mismatch in Google Cloud Console.',
          400,
          'REDIRECT_URI_MISMATCH'
        );
      }
      if (googleErrorCode === 'invalid_client' || combined.includes('invalid_client')) {
        throw new GoogleAuthError(
          'Google OAuth server credentials are invalid or outdated. Please verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel Environment Variables.',
          503,
          'INVALID_CLIENT'
        );
      }
      if (googleErrorCode === 'unauthorized_client' || combined.includes('unauthorized_client')) {
        throw new GoogleAuthError(
          'Google OAuth client is not authorized for this sign-in flow. Please verify the OAuth Web Client settings in Google Cloud Console.',
          403,
          'UNAUTHORIZED_CLIENT'
        );
      }
      if (googleErrorCode === 'invalid_grant' || combined.includes('invalid_grant') || combined.includes('malformed auth code')) {
        throw new GoogleAuthError(
          'Invalid or expired Google credential. Please click Continue with Google again.',
          401,
          'INVALID_GRANT'
        );
      }
      if (googleErrorCode === 'invalid_request') {
        throw new GoogleAuthError(
          'Google authentication request was invalid. Please refresh the page and try again.',
          400,
          'INVALID_OAUTH_REQUEST'
        );
      }
      throw new GoogleAuthError(
        'Backend authentication service could not verify your Google sign-in right now. Please try again.',
        502,
        'TOKEN_EXCHANGE_FAILED'
      );
    }

    if (tokens?.id_token) {
      rawIdToken = String(tokens.id_token);
    }
  }

  if (!rawIdToken) {
    throw new GoogleAuthError(
      'Google did not return a verifiable ID token. Please try signing in again.',
      400,
      'MISSING_GOOGLE_CREDENTIAL'
    );
  }

  let payload: TokenPayload | undefined;
  try {
    const ticket = await oauth2Client.verifyIdToken({
      idToken: rawIdToken,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    console.error('[Google verifyIdToken Error]:', {
      stage: 'verify_id_token',
      reason: msg.includes('used too late') || msg.includes('expired')
        ? 'token_expired'
        : msg.includes('wrong recipient') || msg.includes('audience')
          ? 'audience_mismatch'
          : 'verification_failed',
    });
    if (msg.includes('used too late') || msg.includes('expired')) {
      throw new GoogleAuthError(
        'Invalid or expired Google credential. Please click Continue with Google again.',
        401,
        'TOKEN_EXPIRED'
      );
    }
    if (msg.includes('wrong recipient') || msg.includes('audience')) {
      throw new GoogleAuthError(
        'OAuth Client ID mismatch. Please contact the administrator to verify Google OAuth configuration.',
        401,
        'INVALID_AUDIENCE'
      );
    }
    throw new GoogleAuthError(
      'Google account verification failed. Please sign in again.',
      401,
      'INVALID_ID_TOKEN'
    );
  }

  return validateVerifiedGoogleTokenPayload(payload, clientId);
}
