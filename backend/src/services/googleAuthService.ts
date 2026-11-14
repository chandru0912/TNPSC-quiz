import { google } from 'googleapis';

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
  const clientId = cleanEnvValue(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID);
  const clientSecret = cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET);
  return {
    clientId,
    configured: Boolean(clientId && clientSecret),
  };
}

/**
 * Verifies a Google OAuth 2.0 authorization code or ID token on the backend
 * using GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from server environment variables.
 */
export async function verifyGoogleCredentialOrCode(params: {
  code?: string;
  idToken?: string;
  redirectUri?: string;
}): Promise<VerifiedGoogleProfile> {
  const clientId = cleanEnvValue(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID);
  const clientSecret = cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET);

  if (!clientId) {
    throw new GoogleAuthError(
      'Google Sign-In is not configured on the server (missing GOOGLE_CLIENT_ID).',
      503,
      'GOOGLE_NOT_CONFIGURED'
    );
  }

  const effectiveRedirect = cleanEnvValue(params.redirectUri) || 'postmessage';

  let rawIdToken = cleanEnvValue(params.idToken);
  const authCode = cleanEnvValue(params.code);

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
      const tokenResponse = await oauth2Client.getToken({
        code: authCode,
        redirect_uri: effectiveRedirect,
      });
      tokens = tokenResponse.tokens;
    } catch (err: any) {
      const googleErrMsg = err?.response?.data?.error_description || err?.response?.data?.error || err?.message || '';
      console.error('[Google OAuth getToken Error]:', googleErrMsg);
      if (String(googleErrMsg).toLowerCase().includes('redirect_uri_mismatch')) {
        throw new GoogleAuthError(
          'Google OAuth configuration error: Authorized JavaScript Origin mismatch in Google Cloud Console.',
          400,
          'REDIRECT_URI_MISMATCH'
        );
      }
      if (String(googleErrMsg).toLowerCase().includes('invalid_grant')) {
        throw new GoogleAuthError(
          'Google authorization code expired or already used. Please try signing in again.',
          401,
          'INVALID_GRANT'
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
        fullName: (info.name || info.email.split('@')[0]).trim(),
        avatarUrl: info.picture || null,
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
    fullName: String(payload.name || payload.email.split('@')[0]).trim(),
    avatarUrl: payload.picture ? String(payload.picture) : null,
  };
}
