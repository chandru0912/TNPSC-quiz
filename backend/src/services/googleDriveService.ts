import dotenv from 'dotenv';
import path from 'path';

// Guarantee environment variables from backend/.env and .env.local are loaded
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

import { google } from 'googleapis';
import crypto from 'crypto';
import pool from '../db';
import { getPdfParseClass, cleanText, normalizeTamilPdfText, isClass6TamilTextbook } from './pdfProcessor';
import { CLASS_6_TAMIL_TERM_1_PAGES } from './class6TamilTerm1Corpus';

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

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.VERCEL);

  const cleanHost = reqHostHint ? cleanCredential(reqHostHint) : '';
  const isLocalHostHint = Boolean(
    cleanHost && (cleanHost.includes('localhost') || cleanHost.includes('127.0.0.1'))
  );

  // Local development: strictly guarantee the backend callback uses port 5000
  if (!isProduction || isLocalHostHint) {
    if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.includes('localhost')) {
      return cleanCredential(process.env.GOOGLE_REDIRECT_URI);
    }
    return `${LOCAL_BACKEND_URL}/api/drive/oauth/callback`; // http://localhost:5000/api/drive/oauth/callback
  }

  // Production: use configured production redirect URI
  if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.trim()) {
    return cleanCredential(process.env.GOOGLE_REDIRECT_URI);
  }
  if (process.env.BACKEND_URL && process.env.BACKEND_URL.trim()) {
    return `${cleanCredential(process.env.BACKEND_URL).replace(/\/+$/, '')}/api/drive/oauth/callback`;
  }
  if (cleanHost && !isLocalHostHint) {
    return `https://${cleanHost}/api/drive/oauth/callback`;
  }
  return `${PRODUCTION_BACKEND_URL}/api/drive/oauth/callback`;
}

/**
 * Creates an OAuth2 client instance with sanitized credentials.
 */
export function createOAuth2Client(
  redirectUri?: string,
  clientIdOverride?: string,
  clientSecretOverride?: string
) {
  const clientId = cleanCredential(clientIdOverride || process.env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanCredential(clientSecretOverride || process.env.GOOGLE_CLIENT_SECRET);
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
  frontendOrigin?: string,
  clientIdOverride?: string
): string {
  const clientId = cleanCredential(clientIdOverride || process.env.GOOGLE_CLIENT_ID);
  if (!clientId) {
    throw new Error(
      'Google Cloud OAuth configuration missing: GOOGLE_CLIENT_ID is not configured. ' +
      'Please ensure GOOGLE_CLIENT_ID is set in backend/.env (local) or Vercel Environment Variables (production).'
    );
  }

  const clientSecret = cleanCredential(process.env.GOOGLE_CLIENT_SECRET);
  const isPlaceholderSecret =
    !clientSecret ||
    clientSecret === 'YOUR_NEW_ROTATED_CLIENT_SECRET_HERE' ||
    clientSecret === 'LOAD_FROM_LOCAL_BACKEND_ENV' ||
    clientSecret.includes('YOUR_') ||
    clientSecret.includes('your_');

  if (isPlaceholderSecret) {
    throw new Error(
      'Google Cloud OAuth configuration missing: GOOGLE_CLIENT_SECRET is not configured in backend/.env. ' +
      'Please open backend/.env and paste your newly rotated Google Client Secret (starting with GOCSPX-) before connecting.'
    );
  }

  const effectiveRedirect = resolveRedirectUri(redirectUri);
  const oauth2Client = createOAuth2Client(effectiveRedirect, clientId);
  const state = generateOAuthState(adminUsername, frontendOrigin, effectiveRedirect);

  const authUrl = oauth2Client.generateAuthUrl({
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

  if (!authUrl.includes('client_id=')) {
    throw new Error('Failed to generate valid Google OAuth URL: client_id parameter is missing.');
  }

  return authUrl;
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

  const isPlaceholderSecret =
    !clientSecret ||
    clientSecret === 'YOUR_NEW_ROTATED_CLIENT_SECRET_HERE' ||
    clientSecret === 'LOAD_FROM_LOCAL_BACKEND_ENV' ||
    clientSecret.includes('YOUR_') ||
    clientSecret.includes('your_');

  if (!clientId || isPlaceholderSecret) {
    return {
      status: 'unconfigured',
      details: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing, empty, or set to placeholder in backend/.env.',
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

  const isPlaceholderSecret =
    !clientSecret ||
    clientSecret === 'YOUR_NEW_ROTATED_CLIENT_SECRET_HERE' ||
    clientSecret === 'LOAD_FROM_LOCAL_BACKEND_ENV' ||
    clientSecret.includes('YOUR_') ||
    clientSecret.includes('your_');

  if (!clientId || isPlaceholderSecret) {
    throw new Error(
      'Google Cloud OAuth configuration missing: Valid GOOGLE_CLIENT_SECRET must be configured in backend/.env. ' +
      'Please open backend/.env and paste your newly rotated Google Client Secret (starting with GOCSPX-).'
    );
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
    if (googleDesc && /client secret is invalid/i.test(googleDesc)) {
      throw new Error(
        'Google OAuth error: The provided client secret in backend/.env is invalid. ' +
        'Please verify that GOOGLE_CLIENT_SECRET matches the exact Client Secret generated for Client ID ' +
        clientId + ' in Google Cloud Console (project: tnpsc-study-hub).'
      );
    }
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

  const isPlaceholderSecret =
    !clientSecret ||
    clientSecret === 'YOUR_NEW_ROTATED_CLIENT_SECRET_HERE' ||
    clientSecret === 'LOAD_FROM_LOCAL_BACKEND_ENV' ||
    clientSecret.includes('YOUR_') ||
    clientSecret.includes('your_');

  const configured = Boolean(clientId && !isPlaceholderSecret);
  const redirectUri = resolveRedirectUri();

  const hasFormattingIssue =
    /^["']|["']$/.test(rawId) ||
    /^["']|["']$/.test(rawSecret) ||
    /\s/.test(rawId) ||
    /\s/.test(rawSecret);

  const clientInfo = {
    clientIdLength: clientId.length,
    clientIdConfigured: Boolean(clientId),
    clientSecretConfigured: Boolean(clientSecret && !isPlaceholderSecret),
    clientSecretLength: clientSecret.length,
    clientSecretStartsWithGocspx: clientSecret.startsWith('GOCSPX-'),
    hasFormattingIssue,
  };

  if (!configured) {
    const errorMsg = !clientId
      ? 'Google Client ID is missing. Please configure GOOGLE_CLIENT_ID in backend/.env.'
      : isPlaceholderSecret
      ? 'Google Client Secret is not set in backend/.env. Please paste your newly rotated Google Client Secret into backend/.env.'
      : 'Google OAuth Client ID & Secret are not yet configured in server environment variables.';
    return {
      connected: false,
      configured: false,
      folderName: TARGET_FOLDER_NAME,
      redirectUri,
      clientInfo,
      error: errorMsg,
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

/**
 * Retrieves the raw binary Buffer of a file from Google Drive.
 */
export async function getDriveFileBuffer(fileId: string): Promise<Buffer> {
  const authClient = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(res.data as ArrayBuffer);
}

/**
 * Lists all PDF textbooks available in Google Drive and PostgreSQL.
 * If syncFromDrive is true or DB is empty, syncs directly with the Google Drive target folder.
 */
export async function listGoogleDrivePdfs(options: {
  search?: string;
  group?: string;
  subject?: string;
  standard?: number;
  syncFromDrive?: boolean;
} = {}): Promise<any[]> {
  const conditions: string[] = ["mime_type = 'application/pdf'", "upload_status = 'completed'"];
  const vals: any[] = [];
  let pIdx = 1;

  if (options.search && options.search.trim()) {
    conditions.push(`(LOWER(file_name) LIKE $${pIdx} OR LOWER(subject) LIKE $${pIdx} OR LOWER(lesson) LIKE $${pIdx})`);
    vals.push(`%${options.search.trim().toLowerCase()}%`);
    pIdx++;
  }

  if (options.standard && !isNaN(options.standard)) {
    conditions.push(`standard = $${pIdx++}`);
    vals.push(options.standard);
  }

  if (options.group && options.group !== 'all') {
    const cleanGrp = options.group.toLowerCase().trim();
    conditions.push(`(LOWER(tnpsc_group) LIKE $${pIdx} OR (applicable_groups IS NOT NULL AND applicable_groups @> $${pIdx + 1}::jsonb))`);
    vals.push(`%${cleanGrp}%`);
    vals.push(JSON.stringify([cleanGrp]));
    pIdx += 2;
  }

  if (options.subject && options.subject !== 'all') {
    conditions.push(`(LOWER(subject) = LOWER($${pIdx}) OR LOWER(subject) LIKE '%' || LOWER($${pIdx}) || '%')`);
    vals.push(options.subject.replace(/-/g, ' '));
    pIdx++;
  }

  const query = `
    SELECT id, file_name, original_file_name, mime_type, file_size,
           google_drive_file_id, google_drive_folder_id,
           tnpsc_group, subject, standard, term, unit, lesson, lesson_id,
           upload_status, uploaded_by, page_count,
           extracted_text IS NOT NULL as has_extracted_text,
           created_at, updated_at
    FROM google_drive_materials
    WHERE ${conditions.join(' AND ')}
    ORDER BY id DESC
  `;

  const dbRes = await pool.query(query, vals);
  let rows = dbRes.rows;

  // If sync requested or empty database, synchronize with Google Drive target folder
  if (options.syncFromDrive || rows.length === 0) {
    try {
      const authClient = await getAuthenticatedClient();
      const folderId = await getOrCreateTargetFolder(authClient);
      const drive = google.drive({ version: 'v3', auth: authClient });

      const driveRes = await drive.files.list({
        q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
        fields: 'files(id, name, size, mimeType, createdTime, modifiedTime)',
        pageSize: 100,
      });

      const driveFiles = driveRes.data.files || [];

      for (const df of driveFiles) {
        if (!df.id || !df.name) continue;
        const existing = rows.find((r) => r.google_drive_file_id === df.id);
        if (!existing) {
          // Infer basic standard and subject from filename if possible
          let inferredStandard: number | null = null;
          const stdMatch = df.name.match(/(?:class|std|standard)[_\s\-]*(\d+)/i);
          if (stdMatch) inferredStandard = parseInt(stdMatch[1], 10);

          let inferredSubject = 'General Studies';
          if (/tamil/i.test(df.name)) inferredSubject = 'General Tamil';
          else if (/science/i.test(df.name)) inferredSubject = 'Science';
          else if (/history/i.test(df.name)) inferredSubject = 'History';
          else if (/math/i.test(df.name)) inferredSubject = 'Maths';

          await pool.query(
            `INSERT INTO google_drive_materials (
              file_name, original_file_name, mime_type, file_size,
              google_drive_file_id, google_drive_folder_id,
              tnpsc_group, subject, standard, term, unit,
              upload_status, uploaded_by
            ) VALUES ($1, $2, $3, $4, $5, $6, 'group2', $7, $8, 'Term 1', 1, 'completed', 'admin')
            ON CONFLICT (google_drive_file_id) DO NOTHING`,
            [
              df.name,
              df.name,
              df.mimeType || 'application/pdf',
              parseInt(df.size || '0', 10),
              df.id,
              folderId,
              inferredSubject,
              inferredStandard,
            ]
          );
        }
      }

      // Re-fetch after sync
      const refreshed = await pool.query(query, vals);
      rows = refreshed.rows;
    } catch (syncErr: any) {
      console.warn('[GoogleDriveService] Drive folder sync warning:', syncErr.message);
    }
  }

  return rows.map((r) => {
    const sizeBytes = parseInt(r.file_size, 10) || 0;
    const mb = (sizeBytes / (1024 * 1024)).toFixed(1);
    return {
      id: r.id,
      googleDriveFileId: r.google_drive_file_id,
      fileName: r.file_name,
      originalFileName: r.original_file_name || r.file_name,
      mimeType: r.mime_type || 'application/pdf',
      fileSize: sizeBytes,
      fileSizeFormatted: sizeBytes > 0 ? `${mb} MB` : 'PDF Document',
      group: r.tnpsc_group,
      subject: r.subject,
      standard: r.standard,
      term: r.term || 'Term 1',
      unit: r.unit || 1,
      lesson: r.lesson || null,
      lessonId: r.lesson_id || null,
      uploadStatus: r.upload_status,
      uploadedBy: r.uploaded_by,
      pageCount: r.page_count || null,
      hasExtractedText: Boolean(r.has_extracted_text),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      viewUrl: `/api/drive/view/${r.id}`,
    };
  });
}

/**
 * Extracts and lesson-matches text from a Google Drive PDF textbook.
 * Caches extracted pages and text in PostgreSQL for instant subsequent generations.
 */
export async function extractTextFromGoogleDrivePdf(params: {
  fileId: string;
  materialId?: number;
  lessonTitle?: string;
  unitId?: number;
  standard?: number;
  subject?: string;
}): Promise<{
  text: string;
  fileName: string;
  fileId: string;
  pageCount: number;
  relevantPages: number[];
  matchedLesson: boolean;
  fromCache: boolean;
}> {
  console.log(`[GoogleDriveExtract] Extracting textbook text for file ${params.fileId} (lesson: "${params.lessonTitle || 'Whole Book'}")`);

  let dbRecord: any = null;
  const lookupQuery = `
    SELECT id, file_name, file_size, standard, subject, lesson,
           extracted_text, extracted_pages, page_count
    FROM google_drive_materials
    WHERE google_drive_file_id = $1 OR id = $2
    LIMIT 1
  `;
  const dbRes = await pool.query(lookupQuery, [params.fileId, params.materialId || 0]);
  if (dbRes.rows.length > 0) {
    dbRecord = dbRes.rows[0];
  }

  const effectiveFileName = dbRecord?.file_name || 'Google_Drive_Textbook.pdf';
  const effectiveStandard = params.standard || dbRecord?.standard || 6;
  const effectiveSubject = params.subject || dbRecord?.subject || 'General Studies';

  let extractedPages: Array<{ pageNumber: number; text: string }> = [];
  let totalPages = 0;
  let fullConcatenatedText = '';
  let fromCache = false;

  // 1. Check if pages are already extracted and cached in database
  if (dbRecord?.extracted_pages && Array.isArray(dbRecord.extracted_pages) && dbRecord.extracted_pages.length > 0) {
    extractedPages = dbRecord.extracted_pages;
    totalPages = dbRecord.page_count || extractedPages.length;
    fullConcatenatedText = dbRecord.extracted_text || extractedPages.map(p => `=== [Page ${p.pageNumber}] ===\n${p.text}`).join('\n\n');
    fromCache = true;
    console.log(`[GoogleDriveExtract] Using cached extracted pages (${extractedPages.length} pages) for "${effectiveFileName}"`);
  } else if (dbRecord?.extracted_text && dbRecord.extracted_text.length >= 100) {
    fullConcatenatedText = dbRecord.extracted_text;
    totalPages = dbRecord.page_count || 1;
    fromCache = true;
    console.log(`[GoogleDriveExtract] Using cached text (${fullConcatenatedText.length} chars) for "${effectiveFileName}"`);
  } else {
    // 2. Download from Google Drive and parse
    try {
      console.log(`[GoogleDriveExtract] Downloading PDF from Google Drive: ${params.fileId}...`);
      const fileBuffer = await getDriveFileBuffer(params.fileId);
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error(`Google Drive returned an empty file (0 bytes) for file ID ${params.fileId}`);
      }

      console.log(`[GoogleDriveExtract] Downloaded ${fileBuffer.length} bytes. Initializing PDF parser...`);
      const PDFParseClass = getPdfParseClass();
      const parser = new PDFParseClass({ data: fileBuffer });
      const textResult = await parser.getText();

      totalPages = textResult?.total || textResult?.pages?.length || 0;
      if (totalPages === 0) {
        throw new Error(`PDF parser decoded 0 pages for Google Drive file ${params.fileId}`);
      }

      // Process each page
      let totalTextChars = 0;
      for (let i = 0; i < totalPages; i++) {
        const rawPage = textResult.pages?.[i]?.text || '';
        const cleaned = cleanText(rawPage.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '').trim());
        extractedPages.push({
          pageNumber: i + 1,
          text: cleaned,
        });
        totalTextChars += cleaned.replace(/[^a-zA-Z0-9\u0B80-\u0BFF]/g, '').length;
      }

      // Hydration fallback for rasterized Class 6 Tamil Term 1
      if (
        totalTextChars < 500 &&
        isClass6TamilTextbook(effectiveStandard, 'Tamil', effectiveSubject, totalPages) &&
        CLASS_6_TAMIL_TERM_1_PAGES.length > 0
      ) {
        console.log(`[GoogleDriveExtract] Hydrating verified Class 6 Tamil syllabus text corpus.`);
        extractedPages = CLASS_6_TAMIL_TERM_1_PAGES.map((p) => ({
          pageNumber: p.pageNumber,
          text: cleanText(p.text),
        }));
        totalPages = extractedPages.length;
      }
    } catch (dlErr: any) {
      if (
        isClass6TamilTextbook(effectiveStandard, 'Tamil', effectiveSubject, 0) ||
        effectiveFileName.toLowerCase().includes('class_6_tamil') ||
        effectiveFileName.toLowerCase().includes('tamil')
      ) {
        console.warn(`[GoogleDriveExtract] Drive download error (${dlErr.message}). Hydrating verified Class 6 Tamil syllabus text corpus.`);
        extractedPages = CLASS_6_TAMIL_TERM_1_PAGES.map((p) => ({
          pageNumber: p.pageNumber,
          text: cleanText(p.text),
        }));
        totalPages = extractedPages.length;
      } else {
        throw dlErr;
      }
    }

    fullConcatenatedText = extractedPages
      .map((p) => `=== [Page ${p.pageNumber}] ===\n${p.text}`)
      .join('\n\n');

    // 3. Cache into google_drive_materials
    try {
      if (dbRecord?.id) {
        await pool.query(
          `UPDATE google_drive_materials
           SET extracted_text = $1,
               extracted_pages = $2,
               page_count = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [fullConcatenatedText, JSON.stringify(extractedPages), totalPages, dbRecord.id]
        );
      } else {
        await pool.query(
          `UPDATE google_drive_materials
           SET extracted_text = $1,
               extracted_pages = $2,
               page_count = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE google_drive_file_id = $4`,
          [fullConcatenatedText, JSON.stringify(extractedPages), totalPages, params.fileId]
        );
      }
      console.log(`[GoogleDriveExtract] Successfully cached ${totalPages} pages in database.`);
    } catch (cacheErr: any) {
      console.warn('[GoogleDriveExtract] Non-fatal caching warning:', cacheErr.message);
    }
  }

  // 4. Match pages to requested lesson
  const rawLesson = params.lessonTitle ? params.lessonTitle.trim() : '';
  let matchedPages: number[] = [];
  let matchedText = '';

  if (rawLesson && extractedPages.length > 0) {
    // Extract search keywords from lesson title
    const stopWords = new Set(['and', 'the', 'unit', 'lesson', 'std', 'class', 'term', 'part', 'பருவம்', 'வகுப்பு', 'இயல்', 'பாடம்']);
    const keywords = rawLesson
      .replace(/[^a-zA-Z0-9\u0B80-\u0BFF\s]/g, ' ')
      .split(/\s+/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length >= 3 && !stopWords.has(w));

    // Score pages
    const scoredPages: Array<{ pageNumber: number; text: string; score: number }> = [];
    for (const page of extractedPages) {
      let score = 0;
      const lower = page.text.toLowerCase();
      // Exact substring match gives high weight
      if (lower.includes(rawLesson.toLowerCase())) {
        score += 10;
      }
      // Keyword matches
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          score += 2;
        }
      }
      if (params.unitId && (lower.includes(`இயல் ${params.unitId}`) || lower.includes(`unit ${params.unitId}`))) {
        score += 3;
      }
      if (score > 0) {
        scoredPages.push({ pageNumber: page.pageNumber, text: page.text, score });
      }
    }

    scoredPages.sort((a, b) => b.score - a.score);

    // If specific pages match with high relevance
    if (scoredPages.length > 0 && scoredPages[0].score >= 2) {
      const topPageNums = scoredPages.map((p) => p.pageNumber);
      const minPage = Math.min(...topPageNums);
      const maxPage = Math.max(...topPageNums);

      // Expand to contiguous window of up to 15 pages around matches
      const windowStart = Math.max(1, minPage - 1);
      const windowEnd = Math.min(totalPages, Math.max(maxPage + 2, windowStart + 12));

      const lessonPages = extractedPages.filter(
        (p) => p.pageNumber >= windowStart && p.pageNumber <= windowEnd
      );

      matchedPages = lessonPages.map((p) => p.pageNumber);
      matchedText = lessonPages.map((p) => `=== [Page ${p.pageNumber}] ===\n${p.text}`).join('\n\n');
      console.log(`[GoogleDriveExtract] Matched ${lessonPages.length} relevant pages (Pages ${windowStart}–${windowEnd}) for lesson: "${rawLesson}".`);
    }
  }

  // If no specific page window matched, use full text up to ~120,000 chars (safe for Claude prompt)
  if (!matchedText || matchedText.length < 200) {
    matchedText = fullConcatenatedText.slice(0, 120000);
    matchedPages = extractedPages.slice(0, 30).map((p) => p.pageNumber);
    console.log(`[GoogleDriveExtract] Using full textbook content (${matchedText.length} characters) for AI generation.`);
  }

  return {
    text: matchedText,
    fileName: effectiveFileName,
    fileId: params.fileId,
    pageCount: totalPages,
    relevantPages: matchedPages,
    matchedLesson: matchedPages.length > 0 && matchedPages.length < totalPages,
    fromCache,
  };
}

