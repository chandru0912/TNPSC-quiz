import { google } from 'googleapis';
import crypto from 'crypto';
import pool from '../db';

export const TARGET_FOLDER_NAME = 'TNPSC Study Hub Materials';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export const PRODUCTION_BACKEND_URL = 'https://tnpsc-quiz-lval.vercel.app';
export const LOCAL_BACKEND_URL = 'http://localhost:5000';

function getJwtSecret(): string {
  return process.env.ADMIN_JWT_SECRET || 'tnpsc_quiz_admin_jwt_secret_key_2026';
}

/**
 * Sanitizes credentials by trimming whitespace, stripping enclosing quotes,
 * removing carriage returns (\r) and newlines, and stripping zero-width unicode characters.
 */
export function cleanCredential(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  return val
    .trim()
    .replace(/^["']+|["']+$/g, '') // remove surrounding single or double quotes
    .replace(/[\r\n\t]/g, '') // remove carriage returns, newlines, tabs
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove invisible zero-width spaces
    .trim();
}

/**
 * Derives the exact Google OAuth redirect URI based on environment, request hint, and configuration.
 */
export function resolveRedirectUri(customRedirectUri?: string, reqHostHint?: string): string {
  if (customRedirectUri && customRedirectUri.trim()) {
    return cleanCredential(customRedirectUri);
  }
  if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.trim()) {
    return cleanCredential(process.env.GOOGLE_REDIRECT_URI);
  }
  if (process.env.BACKEND_URL && process.env.BACKEND_URL.trim()) {
    return `${cleanCredential(process.env.BACKEND_URL).replace(/\/+$/, '')}/api/drive/oauth/callback`;
  }

  if (reqHostHint && reqHostHint.trim()) {
    const cleanHost = cleanCredential(reqHostHint);
    const isLocal = cleanHost.includes('localhost') || cleanHost.includes('127.0.0.1');
    if (isLocal) {
      return `http://${cleanHost}/api/drive/oauth/callback`;
    }
    return `https://${cleanHost}/api/drive/oauth/callback`;
  }

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.VERCEL);

  if (isProduction) {
    return `${PRODUCTION_BACKEND_URL}/api/drive/oauth/callback`;
  }
  return `${LOCAL_BACKEND_URL}/api/drive/oauth/callback`;
}

/**
 * Creates an OAuth2 client instance with sanitized credentials.
 */
export function createOAuth2Client(redirectUri?: string) {
  const clientId = cleanCredential(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanCredential(process.env.GOOGLE_CLIENT_SECRET);
  const effectiveRedirectUri = resolveRedirectUri(redirectUri);

  return new google.auth.OAuth2(clientId, clientSecret, effectiveRedirectUri);
}

/**
 * Generates an HMAC-signed CSRF state token for the OAuth authorization flow.
 * Securely encodes admin username, frontend origin, and redirect URI for exact post-consent redirection.
 */
export function generateOAuthState(adminUsername: string, frontendOrigin?: string, redirectUri?: string): string {
  const secret = getJwtSecret();
  const timestamp = Date.now();
  const rawPayload = JSON.stringify({
    adminUsername,
    frontendOrigin: frontendOrigin ? cleanCredential(frontendOrigin) : undefined,
    redirectUri: redirectUri ? cleanCredential(redirectUri) : undefined,
    timestamp,
    nonce: crypto.randomBytes(16).toString('hex'),
  });
  const b64 = Buffer.from(rawPayload).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(b64).digest('hex');
  return `${b64}.${signature}`;
}

/**
 * Validates the HMAC-signed OAuth state token and extracts admin username, frontend origin, and redirect URI.
 */
export function verifyOAuthState(state: string): {
  isValid: boolean;
  adminUsername?: string;
  frontendOrigin?: string;
  redirectUri?: string;
} {
  try {
    const secret = getJwtSecret();
    const parts = state.split('.');
    if (parts.length !== 2) return { isValid: false };
    const [b64, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(b64).digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { isValid: false };
    }

    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8'));
    // Expire states older than 15 minutes
    if (!payload.timestamp || Date.now() - payload.timestamp > 15 * 60 * 1000) {
      return { isValid: false };
    }

    return {
      isValid: true,
      adminUsername: payload.adminUsername,
      frontendOrigin: typeof payload.frontendOrigin === 'string' && payload.frontendOrigin.trim()
        ? cleanCredential(payload.frontendOrigin)
        : undefined,
      redirectUri: typeof payload.redirectUri === 'string' && payload.redirectUri.trim()
        ? cleanCredential(payload.redirectUri)
        : undefined,
    };
  } catch {
    return { isValid: false };
  }
}

/**
 * Generates the Google OAuth 2.0 authorization URL.
 */
export function getAuthorizationUrl(
  adminUsername: string,
  redirectUri?: string,
  frontendOrigin?: string
): string {
  const effectiveRedirect = resolveRedirectUri(redirectUri);
  const oauth2Client = createOAuth2Client(effectiveRedirect);
  const state = generateOAuthState(adminUsername, frontendOrigin, effectiveRedirect);

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      DRIVE_SCOPE,
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state,
    include_granted_scopes: true,
  });
}

/**
 * Retrieves the currently saved tokens from PostgreSQL or env fallback.
 */
export async function getStoredTokens(): Promise<{
  id?: number;
  refreshToken: string;
  accessToken?: string | null;
  expiryDate?: number | null;
  accountEmail?: string | null;
  folderId?: string | null;
} | null> {
  try {
    const res = await pool.query(
      `SELECT id, account_email, refresh_token, access_token, expiry_date, folder_id 
       FROM google_drive_tokens 
       ORDER BY updated_at DESC, id DESC 
       LIMIT 1`
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        id: row.id,
        accountEmail: row.account_email,
        refreshToken: row.refresh_token,
        accessToken: row.access_token,
        expiryDate: row.expiry_date ? Number(row.expiry_date) : null,
        folderId: row.folder_id,
      };
    }
  } catch (err: any) {
    console.warn('[GoogleDriveService] Error querying google_drive_tokens:', err.message);
  }

  // Fallback to environment variable if configured in Vercel
  if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN.trim()) {
    return {
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN.trim(),
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
      accountEmail: process.env.GOOGLE_ACCOUNT_EMAIL || null,
    };
  }

  return null;
}

/**
 * Persists OAuth tokens into PostgreSQL.
 */
export async function saveTokens(params: {
  refreshToken: string;
  accessToken?: string | null;
  expiryDate?: number | null;
  accountEmail?: string | null;
  folderId?: string | null;
}): Promise<void> {
  const existing = await pool.query(`SELECT id FROM google_drive_tokens LIMIT 1`);
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE google_drive_tokens
       SET refresh_token = $1,
           access_token = COALESCE($2, access_token),
           expiry_date = COALESCE($3, expiry_date),
           account_email = COALESCE($4, account_email),
           folder_id = COALESCE($5, folder_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [
        params.refreshToken,
        params.accessToken || null,
        params.expiryDate || null,
        params.accountEmail || null,
        params.folderId || null,
        existing.rows[0].id,
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO google_drive_tokens 
        (refresh_token, access_token, expiry_date, account_email, folder_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        params.refreshToken,
        params.accessToken || null,
        params.expiryDate || null,
        params.accountEmail || null,
        params.folderId || null,
      ]
    );
  }
}

/**
 * Obtains an authenticated Google OAuth2 client with automatic access-token refresh.
 */
export async function getAuthenticatedClient(redirectUri?: string) {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    throw new Error('Google Cloud credentials missing: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured.');
  }

  const stored = await getStoredTokens();
  if (!stored || !stored.refreshToken) {
    throw new Error('Google Drive is not connected. Please connect your Google Drive account from the Admin Panel.');
  }

  const oauth2Client = createOAuth2Client(redirectUri);
  oauth2Client.setCredentials({
    refresh_token: stored.refreshToken,
    access_token: stored.accessToken || undefined,
    expiry_date: stored.expiryDate || undefined,
  });

  // Automatically persist newly refreshed access tokens into PostgreSQL
  oauth2Client.on('tokens', async (tokens) => {
    try {
      await saveTokens({
        refreshToken: tokens.refresh_token || stored.refreshToken,
        accessToken: tokens.access_token || null,
        expiryDate: tokens.expiry_date || null,
        accountEmail: stored.accountEmail || null,
        folderId: stored.folderId || null,
      });
    } catch (saveErr: any) {
      console.warn('[GoogleDriveService] Failed to auto-save refreshed tokens:', saveErr.message);
    }
  });

  return oauth2Client;
}

/**
 * Searches for or creates the dedicated "TNPSC Study Hub Materials" folder in Google Drive.
 */
export async function getOrCreateTargetFolder(authClient: any): Promise<string> {
  const drive = google.drive({ version: 'v3', auth: authClient });

  // 1. Check if folderId is already saved in DB and still valid
  const stored = await getStoredTokens();
  if (stored?.folderId) {
    try {
      const existing = await drive.files.get({
        fileId: stored.folderId,
        fields: 'id, name, trashed, mimeType',
      });
      if (existing.data.id && !existing.data.trashed) {
        return existing.data.id;
      }
    } catch {
      // Stored folder ID is invalid or deleted; search by name below
    }
  }

  // 2. Search for existing active folder named "TNPSC Study Hub Materials"
  const q = `name = '${TARGET_FOLDER_NAME.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const listRes = await drive.files.list({
    q,
    spaces: 'drive',
    fields: 'files(id, name, createdTime)',
    pageSize: 1,
  });

  if (listRes.data.files && listRes.data.files.length > 0) {
    const folderId = listRes.data.files[0].id!;
    if (stored?.refreshToken) {
      await saveTokens({ ...stored, folderId });
    }
    return folderId;
  }

  // 3. Create the dedicated folder
  const createRes = await drive.files.create({
    requestBody: {
      name: TARGET_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Official TNPSC Study Hub PDF Study Materials & Textbook Archive',
    },
    fields: 'id, name',
  });

  const newFolderId = createRes.data.id!;
  if (stored?.refreshToken) {
    await saveTokens({ ...stored, folderId: newFolderId });
  }
  return newFolderId;
}

/**
 * Probes Google OAuth token endpoint to verify client credentials validity
 * without exposing secrets or completing a full login.
 */
export async function verifyGoogleClientCredentials(redirectUri?: string): Promise<{
  status: 'valid_client_credentials' | 'invalid_client_secret' | 'invalid_client_id' | 'unconfigured' | 'error';
  details: string;
  isAuthentic: boolean;
}> {
  const clientId = cleanCredential(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanCredential(process.env.GOOGLE_CLIENT_SECRET);
  const effectiveRedirectUri = resolveRedirectUri(redirectUri);

  if (!clientId || !clientSecret) {
    return {
      status: 'unconfigured',
      details: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing or empty in environment variables.',
      isAuthentic: false,
    };
  }

  try {
    const probeParams = new URLSearchParams({
      code: 'probe_test_verifier_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: effectiveRedirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: probeParams.toString(),
    });

    const data: any = await res.json().catch(() => ({}));

    if (data.error === 'invalid_client') {
      const desc = data.error_description || '';
      if (/secret/i.test(desc)) {
        return {
          status: 'invalid_client_secret',
          details: 'Google rejected the Client Secret: ' + desc,
          isAuthentic: false,
        };
      }
      return {
        status: 'invalid_client_id',
        details: 'Google rejected the Client ID: ' + desc,
        isAuthentic: false,
      };
    }

    // Google returns invalid_grant when the client credentials ARE valid,
    // but the authorization code was a probe dummy!
    if (data.error === 'invalid_grant' || data.error === 'bad_request') {
      return {
        status: 'valid_client_credentials',
        details: 'Google Cloud successfully validated and accepted GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
        isAuthentic: true,
      };
    }

    return {
      status: 'error',
      details: `Google response: ${data.error || res.status} - ${data.error_description || ''}`,
      isAuthentic: false,
    };
  } catch (err: any) {
    return {
      status: 'error',
      details: `Failed to contact Google OAuth token endpoint: ${err.message}`,
      isAuthentic: false,
    };
  }
}

/**
 * Exchanges the OAuth authorization code for tokens, extracts account email,
 * initializes the dedicated folder, and saves credentials to PostgreSQL.
 */
export async function handleOAuthCallback(code: string, state: string, redirectUri?: string): Promise<{
  success: boolean;
  email?: string;
  folderId?: string;
  message?: string;
}> {
  const stateCheck = verifyOAuthState(state);
  if (!stateCheck.isValid) {
    throw new Error('OAuth Security Error: Invalid or expired state token (possible CSRF attack).');
  }

  const clientId = cleanCredential(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanCredential(process.env.GOOGLE_CLIENT_SECRET);

  if (!clientId || !clientSecret) {
    throw new Error('Google Cloud OAuth configuration missing: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is empty.');
  }

  // Ensure redirect URI matches the exact URI recorded in state or fallback
  const effectiveRedirectUri = resolveRedirectUri(stateCheck.redirectUri || redirectUri);
  const oauth2Client = createOAuth2Client(effectiveRedirectUri);

  const cleanCode = cleanCredential(code);
  let tokens: any;
  try {
    const tokenRes = await oauth2Client.getToken(cleanCode);
    tokens = tokenRes.tokens;
  } catch (tokenErr: any) {
    const errorData = tokenErr.response?.data;
    const googleDesc = errorData?.error_description || errorData?.error || tokenErr.message;
    console.error('[GoogleDriveService] Google OAuth token exchange failed:', {
      error: errorData?.error,
      errorDescription: googleDesc,
      status: tokenErr.response?.status,
    });
    throw new Error(`Google OAuth error: ${googleDesc}`);
  }

  if (!tokens.refresh_token) {
    // If no refresh token was returned (user was already consented), check if we already have one stored
    const existing = await getStoredTokens();
    if (!existing || !existing.refreshToken) {
      throw new Error(
        'Google did not return a refresh token. Please re-authenticate and ensure prompt=consent is used.'
      );
    }
    tokens.refresh_token = existing.refreshToken;
  }

  oauth2Client.setCredentials(tokens);

  // Retrieve user account email
  let accountEmail: string | undefined;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    accountEmail = userInfo.data.email || undefined;
  } catch (userErr: any) {
    console.warn('[GoogleDriveService] Could not retrieve user email:', userErr.message);
  }

  // Find or create dedicated folder
  const folderId = await getOrCreateTargetFolder(oauth2Client);

  // Persist tokens
  await saveTokens({
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token || null,
    expiryDate: tokens.expiry_date || null,
    accountEmail: accountEmail || null,
    folderId,
  });

  return {
    success: true,
    email: accountEmail,
    folderId,
    message: `Google Drive successfully connected (${accountEmail || 'Account verified'}). Storage folder: "${TARGET_FOLDER_NAME}".`,
  };
}

/**
 * Checks overall Google Drive connection status and storage info.
 */
export async function getConnectionStatus(): Promise<{
  connected: boolean;
  configured: boolean;
  email?: string;
  folderName: string;
  folderId?: string;
  error?: string;
  redirectUri: string;
  clientInfo?: {
    clientIdLength: number;
    clientIdConfigured: boolean;
    clientSecretConfigured: boolean;
    clientSecretLength: number;
    clientSecretStartsWithGocspx: boolean;
    hasFormattingIssue: boolean;
  };
}> {
  const rawId = process.env.GOOGLE_CLIENT_ID || '';
  const rawSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const clientId = cleanCredential(rawId);
  const clientSecret = cleanCredential(rawSecret);
  const configured = Boolean(clientId && clientSecret);
  const redirectUri = resolveRedirectUri();

  const hasFormattingIssue =
    /^["']|["']$/.test(rawId) ||
    /^["']|["']$/.test(rawSecret) ||
    /\s/.test(rawId) ||
    /\s/.test(rawSecret);

  const clientInfo = {
    clientIdLength: clientId.length,
    clientIdConfigured: Boolean(clientId),
    clientSecretConfigured: Boolean(clientSecret),
    clientSecretLength: clientSecret.length,
    clientSecretStartsWithGocspx: clientSecret.startsWith('GOCSPX-'),
    hasFormattingIssue,
  };

  if (!configured) {
    return {
      connected: false,
      configured: false,
      folderName: TARGET_FOLDER_NAME,
      redirectUri,
      clientInfo,
      error: 'Google OAuth Client ID & Secret are not yet configured in server environment variables.',
    };
  }

  const stored = await getStoredTokens();
  if (!stored || !stored.refreshToken) {
    return {
      connected: false,
      configured: true,
      folderName: TARGET_FOLDER_NAME,
      redirectUri,
      clientInfo,
      error: 'Google Drive is not connected yet. Click "Connect Google Drive" to authenticate.',
    };
  }

  try {
    const authClient = await getAuthenticatedClient();
    const folderId = await getOrCreateTargetFolder(authClient);
    return {
      connected: true,
      configured: true,
      email: stored.accountEmail || undefined,
      folderName: TARGET_FOLDER_NAME,
      folderId,
      redirectUri,
      clientInfo,
    };
  } catch (err: any) {
    return {
      connected: false,
      configured: true,
      email: stored.accountEmail || undefined,
      folderName: TARGET_FOLDER_NAME,
      folderId: stored.folderId || undefined,
      redirectUri,
      clientInfo,
      error: err.message || 'Failed to authenticate with Google Drive API',
    };
  }
}

/**
 * Initiates a Google Drive Resumable Upload Session.
 * 
 * Returns the resumable upload URL directly to the client browser.
 * The browser then streams the large PDF directly into Google Drive,
 * completely bypassing Vercel serverless request body limits!
 */
export async function initiateResumableUpload(params: {
  fileName: string;
  fileSize: number;
  mimeType?: string;
  origin?: string;
}): Promise<{ uploadUrl: string; folderId: string }> {
  const authClient = await getAuthenticatedClient();
  const folderId = await getOrCreateTargetFolder(authClient);
  const mimeType = params.mimeType || 'application/pdf';

  // Obtain access token
  const tokenResponse = await authClient.getAccessToken();
  const accessToken = tokenResponse.token;
  if (!accessToken) {
    throw new Error('Failed to retrieve Google Drive access token for resumable upload.');
  }

  const metadata = {
    name: params.fileName,
    parents: [folderId],
    mimeType,
  };

  // Google Drive Resumable Upload initiation request
  const initUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': mimeType,
    'X-Upload-Content-Length': String(params.fileSize),
  };

  // CRITICAL FOR CORS: When initiating a resumable upload for a web browser client,
  // Google Drive API requires the Origin header. Google binds CORS permissions to the
  // returned session URL based strictly on this Origin header.
  if (params.origin) {
    const cleanOrigin = params.origin.trim().replace(/\/+$/, '');
    headers['Origin'] = cleanOrigin;
  }

  const response = await fetch(initUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Google Drive API rejected resumable session initiation (HTTP ${response.status}): ${errText}`);
  }

  const uploadUrl = response.headers.get('location');
  if (!uploadUrl) {
    throw new Error('Google Drive API did not return a resumable session upload Location header.');
  }

  return { uploadUrl, folderId };
}

/**
 * Verifies that a file was successfully uploaded to Google Drive
 * and retrieves its confirmed metadata.
 */
export async function verifyUploadedFile(fileId: string): Promise<{
  id: string;
  name: string;
  size: number;
  mimeType: string;
  md5Checksum?: string;
  createdTime?: string;
}> {
  const authClient = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  const res = await drive.files.get({
    fileId,
    fields: 'id, name, size, mimeType, trashed, md5Checksum, createdTime, parents',
  });

  const file = res.data;
  if (!file || !file.id || file.trashed) {
    throw new Error(`Google Drive file ${fileId} does not exist or has been trashed.`);
  }

  return {
    id: file.id,
    name: file.name || 'Untitled Document',
    size: file.size ? parseInt(String(file.size), 10) : 0,
    mimeType: file.mimeType || 'application/pdf',
    md5Checksum: file.md5Checksum || undefined,
    createdTime: file.createdTime || new Date().toISOString(),
  };
}

/**
 * Deletes a file from Google Drive.
 */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
  const authClient = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  try {
    await drive.files.delete({ fileId });
    return true;
  } catch (err: any) {
    if (err.code === 404) {
      return true; // Already deleted
    }
    throw err;
  }
}

/**
 * Streams a PDF file from Google Drive with HTTP Range header support.
 * Allows responsive in-browser PDF viewing, fast seeking, and page-by-page loading.
 */
export async function getFileStream(
  fileId: string,
  rangeHeader?: string
): Promise<{
  stream: NodeJS.ReadableStream;
  contentLength?: number;
  contentRange?: string;
  contentType: string;
  statusCode: number;
}> {
  const authClient = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  // 1. Get metadata for content length
  const meta = await drive.files.get({
    fileId,
    fields: 'id, name, size, mimeType',
  });

  const totalSize = meta.data.size ? parseInt(String(meta.data.size), 10) : 0;
  const contentType = meta.data.mimeType || 'application/pdf';

  // 2. Fetch the stream from Google Drive API
  const requestHeaders: Record<string, string> = {};
  if (rangeHeader) {
    requestHeaders['Range'] = rangeHeader;
  }

  const driveRes = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream', headers: requestHeaders }
  );

  const statusCode = driveRes.status || (rangeHeader ? 206 : 200);
  const contentRange = (driveRes.headers as any)['content-range'] || undefined;
  const contentLength = (driveRes.headers as any)['content-length']
    ? parseInt((driveRes.headers as any)['content-length'], 10)
    : totalSize;

  return {
    stream: driveRes.data,
    contentLength,
    contentRange,
    contentType,
    statusCode,
  };
}

/**
 * Disconnects Google Drive by clearing stored tokens.
 */
export async function disconnectGoogleDrive(): Promise<void> {
  await pool.query(`DELETE FROM google_drive_tokens`);
}

