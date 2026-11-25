import { google } from 'googleapis';
import { executeWithCircuitBreaker } from './circuitBreakerService';

export interface VerifiedGoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
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
 * Verifies a Google OAuth 2.0 authorization code or ID token on the backend
 * using GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from server environment variables.
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

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret || undefined, effectiveRedirect);

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
          'Google authorization code expired, invalid, or already used. Please try signing in again.',
          401,
          'INVALID_GRANT'
        );
      }
      if (googleErrorCode === 'invalid_request') {
        throw new GoogleAuthError(
          'Invalid Google OAuth token request parameters. Please refresh and try signing in again.',
          400,
          'INVALID_OAUTH_REQUEST'
        );
      }
      throw new GoogleAuthError(
        'Failed to exchange Google authorization code. Please try again.',
        401,
        'TOKEN_EXCHANGE_FAILED'
      );
    }

    if (tokens?.id_token) {
      rawIdToken = tokens.id_token;
    } else if (tokens?.access_token) {
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfoRes = await oauth2.userinfo.get();
      const info = userInfoRes.data;
      if (!info.id || !info.email) {
        throw new GoogleAuthError('Google account did not return required email and profile details.', 401, 'INCOMPLETE_PROFILE');
      }
      if (info.verified_email !== true) {
        throw new GoogleAuthError(
          'Your Google email address must be verified before signing in or linking an account.',
          403,
          'EMAIL_NOT_VERIFIED'
        );
      }
      return {
        googleId: info.id,
        email: info.email.trim().toLowerCase(),
        emailVerified: true,
        fullName: resolveGoogleFullName({
          name: info.name,
          given_name: info.given_name,
          family_name: info.family_name,
          email: info.email,
        }),
        avatarUrl: normalizeGoogleAvatarUrl(info.picture),
      };
    }
  }

  if (!rawIdToken) {
    throw new GoogleAuthError('Missing Google authorization code or ID token.', 400, 'MISSING_GOOGLE_CREDENTIAL');
  }

  let payload: any;
  try {
    const ticket = await oauth2Client.verifyIdToken({
      idToken: rawIdToken,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch (err: any) {
    console.error('[Google verifyIdToken Error]:', err?.message || err);
    throw new GoogleAuthError(
      'Invalid or expired Google authentication token. Please sign in again.',
      401,
      'INVALID_ID_TOKEN'
    );
  }

  if (!payload || !payload.sub || !payload.email) {
    throw new GoogleAuthError('Google authentication token did not contain required identity claims.', 401, 'INVALID_CLAIMS');
  }

  if (payload.email_verified !== true) {
    throw new GoogleAuthError(
      'Your Google account email address is not verified. Account creation and linking require a verified email.',
      403,
      'EMAIL_NOT_VERIFIED'
    );
  }

  return {
    googleId: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    emailVerified: true,
    fullName: resolveGoogleFullName({
      name: payload.name,
      given_name: payload.given_name,
      family_name: payload.family_name,
      email: String(payload.email),
    }),
    avatarUrl: normalizeGoogleAvatarUrl(payload.picture ? String(payload.picture) : null),
  };
}
