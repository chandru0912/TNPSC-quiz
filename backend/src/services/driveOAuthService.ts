import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import pool from '../db';

// Load backend/.env first so local Drive OAuth config is never shadowed by root .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });
dotenv.config();

export const LOCAL_BACKEND_URL = 'http://localhost:5000';
export const PRODUCTION_BACKEND_URL = 'https://tnpsc-quiz-lval.vercel.app';
export const DEFAULT_LOCAL_FRONTEND_URL = 'http://localhost:5173';
export const DEFAULT_TEXTBOOKS_FOLDER_NAME = 'TNPSC Study Hub Textbooks';

// Least-privilege scopes: openid/email/profile to identify & allowlist the admin account,
// plus drive.readonly to discover & read textbook PDF metadata without write/delete access.
export const DRIVE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.readonly',
] as const;

export type DriveUiStatus =
  | 'NOT_CONNECTED'
  | 'AUTHORIZATION_REQUIRED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'SYNCING'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED'
  | 'TOKEN_EXPIRED'
  | 'REAUTHORIZATION_REQUIRED';

export interface DriveOAuthConfigValidation {
  valid: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  errors: string[];
  environment: 'production' | 'development';
}

export interface DriveConnectionSummary {
  status: DriveUiStatus;
  connected: boolean;
  configured: boolean;
  accountEmail: string | null;
  accountName: string | null;
  adminId: number | null;
  adminUsername: string | null;
  folderId: string | null;
  folderName: string;
  redirectUri: string;
  scopes: readonly string[];
  lastSyncAt: string | null;
  lastError: string | null;
  counts: {
    synchronizedTextbooks: number;
    pendingReview: number;
    published: number;
    missingInDrive: number;
    failedSyncRuns: number;
  };
}

export interface DriveSyncResult {
  logId: number;
  status: 'SYNC_COMPLETED' | 'SYNC_FAILED';
  folderId: string;
  folderName: string;
  discoveredCount: number;
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  missingCount: number;
  failedCount: number;
  errors: string[];
}

export function cleanEnvValue(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/[\r\n\t]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

/**
 * Resolves the canonical server-side OAuth redirect URI.
 * Never accepts arbitrary frontend-supplied redirect URIs and never emits localhost in production.
 */
export function resolveCanonicalRedirectUri(reqHostHint?: string): string {
  const normalize = (v: string) => cleanEnvValue(v).replace(/\/+$/, '');
  const configured = normalize(process.env.GOOGLE_DRIVE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || '');
  const prod = isProductionRuntime();

  if (!prod) {
    if (
      configured &&
      /^http:\/\/(localhost|127\.0\.0\.1):5000\/api\/drive\/oauth\/callback$/i.test(configured)
    ) {
      return configured;
    }
    return `${LOCAL_BACKEND_URL}/api/drive/oauth/callback`;
  }

  // Production: strictly disallow localhost redirect URIs
  if (configured && /^https:\/\/[^/]+\/api\/drive\/oauth\/callback$/i.test(configured) && !configured.includes('localhost')) {
    return configured;
  }
  const backendUrl = normalize(process.env.BACKEND_URL || '');
  if (backendUrl && /^https:\/\//i.test(backendUrl) && !backendUrl.includes('localhost')) {
    return `${backendUrl}/api/drive/oauth/callback`;
  }
  const cleanHost = cleanEnvValue(reqHostHint);
  if (cleanHost && !cleanHost.includes('localhost') && !cleanHost.includes('127.0.0.1')) {
    return `https://${cleanHost}/api/drive/oauth/callback`;
  }
  return `${PRODUCTION_BACKEND_URL}/api/drive/oauth/callback`;
}

/**
 * Validates Drive OAuth configuration without exposing secrets.
 * Prefers dedicated GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET so Student Google Login stays isolated.
 */
export function validateDriveOAuthConfig(reqHostHint?: string): DriveOAuthConfigValidation {
  const clientId = cleanEnvValue(process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanEnvValue(process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET);
  const redirectUri = resolveCanonicalRedirectUri(reqHostHint);
  const prod = isProductionRuntime();
  const errors: string[] = [];

  if (!clientId || !clientId.endsWith('.apps.googleusercontent.com')) {
    errors.push('GOOGLE_DRIVE_CLIENT_ID (or GOOGLE_CLIENT_ID) is missing or malformed.');
  }
  if (!clientSecret || clientSecret.includes('your_') || clientSecret.includes('YOUR_')) {
    errors.push('GOOGLE_DRIVE_CLIENT_SECRET (or GOOGLE_CLIENT_SECRET) is missing or set to a placeholder.');
  }
  if (!redirectUri || !/\/api\/drive\/oauth\/callback$/i.test(redirectUri)) {
    errors.push('GOOGLE_REDIRECT_URI must end with /api/drive/oauth/callback.');
  }
  if (prod && redirectUri.includes('localhost')) {
    errors.push('Production GOOGLE_REDIRECT_URI must not point to localhost.');
  }

  return {
    valid: errors.length === 0,
    clientId,
    clientSecret,
    redirectUri,
    errors,
    environment: prod ? 'production' : 'development',
  };
}

/**
 * Validates and normalizes frontend origin to prevent open redirects after OAuth callback.
 */
export function resolveSafeFrontendOrigin(candidateOrigin?: string | null): string {
  const configured = cleanEnvValue(process.env.FRONTEND_URL).replace(/\/+$/, '');
  const allowedOrigins = new Set<string>([
    DEFAULT_LOCAL_FRONTEND_URL,
    'http://127.0.0.1:5173',
    PRODUCTION_BACKEND_URL,
  ]);
  if (configured && /^https?:\/\//i.test(configured)) {
    allowedOrigins.add(configured);
  }
  const extraCors = cleanEnvValue(process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGINS);
  for (const part of extraCors.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean)) {
    if (/^https?:\/\//i.test(part)) allowedOrigins.add(part);
  }

  const candidate = cleanEnvValue(candidateOrigin).replace(/\/+$/, '');
  if (candidate) {
    try {
      const parsed = new URL(candidate);
      const origin = parsed.origin;
      if (
        allowedOrigins.has(origin) ||
        /^https:\/\/[a-z0-9-]+(?:-[a-z0-9-]+)*\.vercel\.app$/i.test(origin) ||
        (!isProductionRuntime() && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin))
      ) {
        return origin;
      }
    } catch {
      // ignore invalid URL
    }
  }

  if (configured && /^https?:\/\//i.test(configured)) {
    return configured;
  }
  return isProductionRuntime() ? PRODUCTION_BACKEND_URL : DEFAULT_LOCAL_FRONTEND_URL;
}

/**
 * AES-256-GCM symmetric encryption for OAuth tokens stored in PostgreSQL.
 */
function getEncryptionKey(): Buffer {
  const raw =
    cleanEnvValue(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY) ||
    cleanEnvValue(process.env.ADMIN_JWT_SECRET) ||
    'tnpsc_study_hub_drive_oauth_fallback_key_2026';
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptTokenValue(plaintext: string): { ciphertext: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptTokenValue(ciphertext: string, ivB64: string, authTagB64: string): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function getStateSigningSecret(): string {
  return (
    cleanEnvValue(process.env.ADMIN_JWT_SECRET) ||
    'tnpsc_quiz_admin_jwt_secret_key_2026'
  );
}

export interface OAuthStatePayload {
  adminId: number | null;
  adminUsername: string;
  frontendOrigin: string;
  redirectUri: string;
  timestamp: number;
  nonce: string;
}

export function generateSignedOAuthState(params: {
  adminId: number | null;
  adminUsername: string;
  frontendOrigin: string;
  redirectUri: string;
}): string {
  const payload: OAuthStatePayload = {
    adminId: params.adminId,
    adminUsername: params.adminUsername,
    frontendOrigin: resolveSafeFrontendOrigin(params.frontendOrigin),
    redirectUri: params.redirectUri,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getStateSigningSecret()).update(encoded).digest('hex');
  return `${encoded}.${sig}`;
}

export function verifySignedOAuthState(state: string): { valid: boolean; payload?: OAuthStatePayload; error?: string } {
  if (!state || typeof state !== 'string') {
    return { valid: false, error: 'Missing OAuth state parameter.' };
  }
  const parts = state.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed OAuth state parameter.' };
  }
  const [encoded, sig] = parts;
  const expected = crypto.createHmac('sha256', getStateSigningSecret()).update(encoded).digest('hex');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'Invalid OAuth state signature (CSRF check failed).' };
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OAuthStatePayload;
    if (!payload.timestamp || Date.now() - payload.timestamp > 15 * 60 * 1000) {
      return { valid: false, error: 'OAuth state expired. Please retry connecting Google Drive.' };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Failed to decode OAuth state payload.' };
  }
}

/**
 * Checks whether an authenticated Google email is permitted by GOOGLE_DRIVE_ALLOWED_EMAILS.
 * If GOOGLE_DRIVE_ALLOWED_EMAILS is configured, only listed emails are allowed to connect.
 */
export function isAllowedAdminGoogleEmail(email: string): boolean {
  const normalized = cleanEnvValue(email).toLowerCase();
  if (!normalized || !normalized.includes('@')) return false;
  const allowlistRaw = cleanEnvValue(process.env.GOOGLE_DRIVE_ALLOWED_EMAILS);
  if (!allowlistRaw) return true;
  const allowed = allowlistRaw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(normalized);
}

let driveSchemaReady = false;

/**
 * Idempotently creates Drive OAuth connection & sync log tables and metadata-only textbook columns.
 * Never drops tables, never overwrites existing textbook records, and never creates binary PDF columns.
 */
export async function ensureDriveOAuthSchema(): Promise<void> {
  if (driveSchemaReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS google_drive_connections (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER,
      admin_username VARCHAR(150) NOT NULL,
      account_email VARCHAR(255) NOT NULL,
      account_name VARCHAR(255),
      encrypted_refresh_token TEXT NOT NULL,
      refresh_token_iv VARCHAR(64) NOT NULL,
      refresh_token_auth_tag VARCHAR(64) NOT NULL,
      encrypted_access_token TEXT,
      access_token_iv VARCHAR(64),
      access_token_auth_tag VARCHAR(64),
      token_expiry BIGINT,
      scope TEXT,
      folder_id VARCHAR(255),
      folder_name VARCHAR(255) DEFAULT 'TNPSC Study Hub Textbooks',
      connection_status VARCHAR(40) NOT NULL DEFAULT 'CONNECTED',
      last_error TEXT,
      connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS google_drive_textbook_sync_logs (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER,
      admin_username VARCHAR(150),
      folder_id VARCHAR(255),
      folder_name VARCHAR(255),
      status VARCHAR(40) NOT NULL DEFAULT 'SYNCING',
      discovered_count INTEGER NOT NULL DEFAULT 0,
      inserted_count INTEGER NOT NULL DEFAULT 0,
      updated_count INTEGER NOT NULL DEFAULT 0,
      unchanged_count INTEGER NOT NULL DEFAULT 0,
      missing_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      error_details TEXT,
      started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP WITH TIME ZONE
    );

    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS google_drive_file_id VARCHAR(255);
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS google_drive_parent_folder_id VARCHAR(255);
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS volume VARCHAR(50);
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS file_name TEXT;
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120) DEFAULT 'application/pdf';
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS drive_modified_time TIMESTAMP WITH TIME ZONE;
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS drive_folder_path TEXT;
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS drive_available BOOLEAN DEFAULT true;
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS publication_status VARCHAR(40) DEFAULT 'pending_review';
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_textbooks_drive_file_id_unique
      ON textbooks (google_drive_file_id)
      WHERE google_drive_file_id IS NOT NULL;
  `);

  driveSchemaReady = true;
}

export function createDriveOAuth2Client(redirectUri?: string): OAuth2Client {
  const cfg = validateDriveOAuthConfig();
  const effectiveRedirect = redirectUri || cfg.redirectUri;
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, effectiveRedirect);
}

/**
 * Generates the Google OAuth 2.0 Authorization URL with CSRF state & account picker.
 */
export function createDriveAuthorizationUrl(params: {
  adminId: number | null;
  adminUsername: string;
  frontendOrigin?: string;
  reqHostHint?: string;
}): { authUrl: string; redirectUri: string; state: string } {
  const cfg = validateDriveOAuthConfig(params.reqHostHint);
  if (!cfg.valid) {
    const err: any = new Error(`Google Drive OAuth configuration invalid: ${cfg.errors.join(' ')}`);
    err.statusCode = 500;
    throw err;
  }

  const safeFrontendOrigin = resolveSafeFrontendOrigin(params.frontendOrigin);
  const state = generateSignedOAuthState({
    adminId: params.adminId,
    adminUsername: params.adminUsername,
    frontendOrigin: safeFrontendOrigin,
    redirectUri: cfg.redirectUri,
  });

  const oauth2Client = createDriveOAuth2Client(cfg.redirectUri);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account consent',
    scope: [...DRIVE_OAUTH_SCOPES],
    state,
    include_granted_scopes: true,
  });

  return { authUrl, redirectUri: cfg.redirectUri, state };
}

export type DriveOAuthFailureCategory =
  | 'unapproved_test_user'
  | 'incorrect_oauth_client'
  | 'invalid_scope'
  | 'redirect_uri_mismatch'
  | 'token_or_grant_error'
  | 'unknown';

export function extractGoogleProjectNumber(clientId?: string): string | null {
  const clean = cleanEnvValue(clientId || process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID);
  const m = clean.match(/^(\d+)-/);
  return m ? m[1] : null;
}

export function diagnoseDriveOAuthError(
  rawError: string,
  redirectUri: string
): { category: DriveOAuthFailureCategory; message: string; googleCloudProjectNumber: string | null } {
  const lower = String(rawError || '').toLowerCase();
  const projectNumber = extractGoogleProjectNumber();
  const projectLabel = projectNumber ? `Google Cloud Project ${projectNumber}` : 'your Google Cloud Project';

  if (lower.includes('redirect_uri_mismatch')) {
    return {
      category: 'redirect_uri_mismatch',
      googleCloudProjectNumber: projectNumber,
      message: `redirect_uri_mismatch: Ensure exact URI "${redirectUri}" is registered under Authorized redirect URIs in ${projectLabel}.`,
    };
  }
  if (lower.includes('access_denied') || lower.includes('approved testers') || lower.includes('org_internal') || lower.includes('403')) {
    return {
      category: 'unapproved_test_user',
      googleCloudProjectNumber: projectNumber,
      message: `Error 403 access_denied: Selected Gmail is not approved as an OAuth Test User (or consent was declined). Add your administrator Gmail under ${projectLabel} → Google Auth Platform → Audience → Test users, save, and retry.`,
    };
  }
  if (lower.includes('invalid_client') || lower.includes('deleted_client') || lower.includes('unauthorized_client')) {
    return {
      category: 'incorrect_oauth_client',
      googleCloudProjectNumber: projectNumber,
      message: `invalid_client: Google OAuth client credentials were rejected. Verify GOOGLE_DRIVE_CLIENT_ID / GOOGLE_CLIENT_ID and Client Secret in ${projectLabel}.`,
    };
  }
  if (lower.includes('invalid_scope') || lower.includes('insufficient_scope') || lower.includes('insufficientpermissions')) {
    return {
      category: 'invalid_scope',
      googleCloudProjectNumber: projectNumber,
      message: `invalid_scope: Requested Google Drive OAuth scope was rejected or not granted. Required minimal scopes: ${DRIVE_OAUTH_SCOPES.join(', ')}.`,
    };
  }
  if (lower.includes('invalid_grant') || lower.includes('token has been expired')) {
    return {
      category: 'token_or_grant_error',
      googleCloudProjectNumber: projectNumber,
      message: 'OAuth grant expired or revoked (invalid_grant). Please reconnect Google Drive.',
    };
  }
  return {
    category: 'unknown',
    googleCloudProjectNumber: projectNumber,
    message: rawError || 'Google Drive OAuth authorization failed.',
  };
}

/**
 * Translates Google OAuth errors into actionable administrator diagnostics.
 */
export function mapGoogleOAuthErrorToDiagnostic(rawError: string, redirectUri: string): string {
  return diagnoseDriveOAuthError(rawError, redirectUri).message;
}

/**
 * Read-only live diagnostic (8s timeout per probe, no login, no DB writes, no secrets exposed).
 * Distinguishes whether a failure is caused by an incorrect OAuth client, redirect URI mismatch,
 * invalid scope, or an unapproved test user (403 access_denied in Testing mode).
 */
export async function runDriveOAuthDiagnostics(reqHostHint?: string): Promise<{
  googleCloudProjectNumber: string | null;
  clientIdMasked: string;
  redirectUri: string;
  scopes: readonly string[];
  adminOnlyDriveAccess: boolean;
  clientCredentialsStatus: 'valid_client_credentials' | 'invalid_client_secret' | 'invalid_client_id' | 'unconfigured' | 'error';
  redirectUriStatus: 'registered' | 'not_registered' | 'invalid_client' | 'unknown';
  scopeValid: boolean;
  diagnosedBlocker: 'none' | 'incorrect_oauth_client' | 'redirect_uri_mismatch' | 'invalid_scope';
  testingModeGuidance: string;
}> {
  const cfg = validateDriveOAuthConfig(reqHostHint);
  const projectNumber = extractGoogleProjectNumber(cfg.clientId);
  const clientIdMasked =
    cfg.clientId.length > 24 ? `${cfg.clientId.slice(0, 12)}...${cfg.clientId.slice(-20)}` : cfg.clientId;
  const scopeList: readonly string[] = DRIVE_OAUTH_SCOPES;
  const scopeValid =
    scopeList.includes('https://www.googleapis.com/auth/drive.readonly') &&
    !scopeList.includes('https://www.googleapis.com/auth/drive');

  if (!cfg.valid) {
    return {
      googleCloudProjectNumber: projectNumber,
      clientIdMasked,
      redirectUri: cfg.redirectUri,
      scopes: DRIVE_OAUTH_SCOPES,
      adminOnlyDriveAccess: true,
      clientCredentialsStatus: 'unconfigured',
      redirectUriStatus: 'unknown',
      scopeValid,
      diagnosedBlocker: 'incorrect_oauth_client',
      testingModeGuidance: `Configuration errors: ${cfg.errors.join(' ')}`,
    };
  }

  // Probe 1: Google token endpoint (validates client_id + client_secret without login)
  let clientCredentialsStatus: 'valid_client_credentials' | 'invalid_client_secret' | 'invalid_client_id' | 'error' = 'error';
  try {
    const body = new URLSearchParams({
      code: 'probe_dummy_code',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: 'authorization_code',
    });
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(8_000),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (tokenJson.error === 'invalid_grant' || tokenJson.error === 'bad_request') {
      clientCredentialsStatus = 'valid_client_credentials';
    } else if (tokenJson.error === 'invalid_client') {
      clientCredentialsStatus = /secret/i.test(String(tokenJson.error_description || ''))
        ? 'invalid_client_secret'
        : 'invalid_client_id';
    }
  } catch {
    clientCredentialsStatus = 'error';
  }

  // Probe 2: Google authorization endpoint (checks redirect_uri registration without login)
  let redirectUriStatus: 'registered' | 'not_registered' | 'invalid_client' | 'unknown' = 'unknown';
  try {
    const authParams = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: 'code',
      scope: DRIVE_OAUTH_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'select_account consent',
    });
    const authRes = await fetch(`https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    const loc = authRes.headers.get('location') || '';
    if (!/\/signin\/oauth\/error/i.test(loc)) {
      redirectUriStatus = 'registered';
    } else {
      const ae = new URL(loc).searchParams.get('authError') || '';
      const decoded = Buffer.from(ae.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1');
      if (/redirect_uri_mismatch/i.test(decoded)) redirectUriStatus = 'not_registered';
      else if (/invalid_client|deleted_client/i.test(decoded)) redirectUriStatus = 'invalid_client';
    }
  } catch {
    redirectUriStatus = 'unknown';
  }

  let diagnosedBlocker: 'none' | 'incorrect_oauth_client' | 'redirect_uri_mismatch' | 'invalid_scope' = 'none';
  if (clientCredentialsStatus !== 'valid_client_credentials' || redirectUriStatus === 'invalid_client') {
    diagnosedBlocker = 'incorrect_oauth_client';
  } else if (redirectUriStatus === 'not_registered') {
    diagnosedBlocker = 'redirect_uri_mismatch';
  } else if (!scopeValid) {
    diagnosedBlocker = 'invalid_scope';
  }

  const testingModeGuidance =
    diagnosedBlocker === 'none'
      ? `OAuth client (${clientIdMasked}), redirect URI (${cfg.redirectUri}), and minimal read-only scopes are all valid. ` +
        `If Google shows "Error 403: access_denied", add your administrator Gmail under Google Cloud Project ${projectNumber || ''} → Google Auth Platform → Audience → Test users (Testing mode is recommended for admin-only Drive access).`
      : `Detected OAuth blocker: ${diagnosedBlocker}.`;

  return {
    googleCloudProjectNumber: projectNumber,
    clientIdMasked,
    redirectUri: cfg.redirectUri,
    scopes: DRIVE_OAUTH_SCOPES,
    adminOnlyDriveAccess: true,
    clientCredentialsStatus,
    redirectUriStatus,
    scopeValid,
    diagnosedBlocker,
    testingModeGuidance,
  };
}

/**
 * Handles the OAuth callback: verifies state, exchanges code using canonical redirect URI,
 * checks allowlist, encrypts tokens with AES-256-GCM, and saves the connection in PostgreSQL.
 */
export async function handleDriveOAuthCallback(params: {
  code: string;
  state: string;
  reqHostHint?: string;
  oauthClientFactory?: (redirectUri: string) => OAuth2Client;
}): Promise<{ email: string; name: string | null; frontendOrigin: string }> {
  await ensureDriveOAuthSchema();

  const stateCheck = verifySignedOAuthState(params.state);
  if (!stateCheck.valid || !stateCheck.payload) {
    const err: any = new Error(stateCheck.error || 'Invalid OAuth state.');
    err.statusCode = 400;
    throw err;
  }

  const { adminId, adminUsername, frontendOrigin, redirectUri } = stateCheck.payload;
  const canonicalRedirect = redirectUri || resolveCanonicalRedirectUri(params.reqHostHint);
  const oauth2Client = params.oauthClientFactory
    ? params.oauthClientFactory(canonicalRedirect)
    : createDriveOAuth2Client(canonicalRedirect);

  const tokenRes = await oauth2Client.getToken({
    code: params.code,
    redirect_uri: canonicalRedirect,
  });
  const tokens = tokenRes.tokens;
  if (!tokens.access_token && !tokens.refresh_token) {
    throw new Error('Google OAuth token exchange returned no usable tokens.');
  }

  oauth2Client.setCredentials(tokens);

  // Fetch authenticated Google account identity
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const profileRes = await oauth2.userinfo.get();
  const email = cleanEnvValue(profileRes.data.email).toLowerCase();
  const name = cleanEnvValue(profileRes.data.name) || null;

  if (!email) {
    throw new Error('Could not determine Google account email from OAuth profile.');
  }

  if (!isAllowedAdminGoogleEmail(email)) {
    const err: any = new Error(
      `Unauthorized Google account (${email}). Only approved administrator emails in GOOGLE_DRIVE_ALLOWED_EMAILS may connect Google Drive.`
    );
    err.statusCode = 403;
    throw err;
  }

  // Preserve existing refresh token if Google omitted it on a re-consent for the same email
  let effectiveRefreshToken = tokens.refresh_token || '';
  if (!effectiveRefreshToken) {
    const existing = await pool.query(
      `SELECT encrypted_refresh_token, refresh_token_iv, refresh_token_auth_tag
       FROM google_drive_connections
       WHERE LOWER(account_email) = LOWER($1)
       ORDER BY updated_at DESC LIMIT 1`,
      [email]
    );
    if (existing.rows.length > 0) {
      effectiveRefreshToken = decryptTokenValue(
        existing.rows[0].encrypted_refresh_token,
        existing.rows[0].refresh_token_iv,
        existing.rows[0].refresh_token_auth_tag
      );
    }
  }

  if (!effectiveRefreshToken) {
    throw new Error(
      'Google did not return a refresh token. Please revoke prior app access in Google Account Security and reconnect.'
    );
  }

  const encRefresh = encryptTokenValue(effectiveRefreshToken);
  const encAccess = tokens.access_token ? encryptTokenValue(tokens.access_token) : null;
  const folderName = cleanEnvValue(process.env.GOOGLE_DRIVE_TEXTBOOKS_FOLDER_NAME) || DEFAULT_TEXTBOOKS_FOLDER_NAME;

  // Replace active connection cleanly inside a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM google_drive_connections');
    await client.query(
      `INSERT INTO google_drive_connections (
         admin_id, admin_username, account_email, account_name,
         encrypted_refresh_token, refresh_token_iv, refresh_token_auth_tag,
         encrypted_access_token, access_token_iv, access_token_auth_tag,
         token_expiry, scope, folder_name, connection_status, last_error,
         connected_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'CONNECTED',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      [
        adminId,
        adminUsername,
        email,
        name,
        encRefresh.ciphertext,
        encRefresh.iv,
        encRefresh.authTag,
        encAccess?.ciphertext || null,
        encAccess?.iv || null,
        encAccess?.authTag || null,
        tokens.expiry_date || null,
        tokens.scope || DRIVE_OAUTH_SCOPES.join(' '),
        folderName,
      ]
    );
    await client.query('COMMIT');
  } catch (txErr) {
    await client.query('ROLLBACK');
    throw txErr;
  } finally {
    client.release();
  }

  return { email, name, frontendOrigin };
}

/**
 * Returns an authenticated OAuth2Client, automatically refreshing expired access tokens
 * and persisting rotated encrypted tokens. Marks REAUTHORIZATION_REQUIRED if refresh token is revoked.
 */
export async function getAuthenticatedDriveClient(options?: {
  oauthClientFactory?: (redirectUri: string) => OAuth2Client;
}): Promise<{ client: OAuth2Client; connection: any }> {
  await ensureDriveOAuthSchema();

  const res = await pool.query(
    `SELECT * FROM google_drive_connections ORDER BY updated_at DESC LIMIT 1`
  );
  if (res.rows.length === 0) {
    const err: any = new Error('Google Drive is not connected. Click "Connect Google Drive" to authorize.');
    err.statusCode = 401;
    err.uiStatus = 'AUTHORIZATION_REQUIRED';
    throw err;
  }

  const conn = res.rows[0];
  const refreshToken = decryptTokenValue(
    conn.encrypted_refresh_token,
    conn.refresh_token_iv,
    conn.refresh_token_auth_tag
  );
  const accessToken =
    conn.encrypted_access_token && conn.access_token_iv && conn.access_token_auth_tag
      ? decryptTokenValue(conn.encrypted_access_token, conn.access_token_iv, conn.access_token_auth_tag)
      : undefined;

  const cfg = validateDriveOAuthConfig();
  const oauth2Client = options?.oauthClientFactory
    ? options.oauthClientFactory(cfg.redirectUri)
    : createDriveOAuth2Client(cfg.redirectUri);

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken,
    expiry_date: conn.token_expiry ? Number(conn.token_expiry) : undefined,
  });

  // Refresh if access token is missing or expires within 2 minutes
  const expiryMs = conn.token_expiry ? Number(conn.token_expiry) : 0;
  const needsRefresh = !accessToken || !expiryMs || expiryMs <= Date.now() + 2 * 60 * 1000;

  if (needsRefresh) {
    try {
      const refreshed = await oauth2Client.refreshAccessToken();
      const newCreds = refreshed.credentials;
      const newAccess = newCreds.access_token ? encryptTokenValue(newCreds.access_token) : null;
      const newRefresh = newCreds.refresh_token ? encryptTokenValue(newCreds.refresh_token) : null;

      await pool.query(
        `UPDATE google_drive_connections
         SET encrypted_access_token = COALESCE($1, encrypted_access_token),
             access_token_iv = COALESCE($2, access_token_iv),
             access_token_auth_tag = COALESCE($3, access_token_auth_tag),
             encrypted_refresh_token = COALESCE($4, encrypted_refresh_token),
             refresh_token_iv = COALESCE($5, refresh_token_iv),
             refresh_token_auth_tag = COALESCE($6, refresh_token_auth_tag),
             token_expiry = COALESCE($7, token_expiry),
             connection_status = 'CONNECTED',
             last_error = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8`,
        [
          newAccess?.ciphertext || null,
          newAccess?.iv || null,
          newAccess?.authTag || null,
          newRefresh?.ciphertext || null,
          newRefresh?.iv || null,
          newRefresh?.authTag || null,
          newCreds.expiry_date || null,
          conn.id,
        ]
      );
      oauth2Client.setCredentials(newCreds);
    } catch (refreshErr: any) {
      const msg = String(
        refreshErr?.response?.data?.error_description ||
          refreshErr?.response?.data?.error ||
          refreshErr?.message ||
          'Token refresh failed'
      );
      const isRevoked = /invalid_grant|revoked|expired/i.test(msg);
      const nextStatus: DriveUiStatus = isRevoked ? 'REAUTHORIZATION_REQUIRED' : 'TOKEN_EXPIRED';

      await pool.query(
        `UPDATE google_drive_connections
         SET connection_status = $1,
             last_error = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [nextStatus, mapGoogleOAuthErrorToDiagnostic(msg, cfg.redirectUri), conn.id]
      );

      const err: any = new Error(mapGoogleOAuthErrorToDiagnostic(msg, cfg.redirectUri));
      err.statusCode = 401;
      err.uiStatus = nextStatus;
      throw err;
    }
  }

  return { client: oauth2Client, connection: conn };
}

/**
 * Classifies textbook metadata from folder path + PDF filename (metadata-only).
 */
export function classifyTextbookFromDrivePath(fileName: string, folderSegments: string[]) {
  const combined = [...folderSegments, fileName].join(' ').replace(/[_.-]+/g, ' ');

  let standard = 6;
  const stdMatch = combined.match(/(?:class|std|standard)?\s*(12|11|10|9|8|7|6)(?:th)?\b/i);
  if (stdMatch) standard = parseInt(stdMatch[1], 10);

  const medium: 'Tamil' | 'English' =
    /tamil\s*medium|\btm\b|தமிழ்/i.test(combined) ? 'Tamil' : 'English';

  let term: string | null = null;
  let volume: string | null = null;
  if (standard <= 10) {
    const tm = combined.match(/\bterm\s*([1-3])\b/i);
    if (tm) term = `Term ${tm[1]}`;
  } else {
    const vm = combined.match(/\bvol(?:ume)?\s*([1-3])\b/i);
    if (vm) volume = `Volume ${vm[1]}`;
  }

  const subjectHint = [
    ...folderSegments.filter((s) => !/medium|term|vol|standard|std|class|textbook/i.test(s)),
    fileName.replace(/\.pdf$/i, '').replace(/[_.-]+/g, ' ').replace(/english\s*medium|tamil\s*medium/gi, ''),
  ].join(' ');

  const subjectRules: Array<[RegExp, string]> = [
    [/social\s*science/i, 'Social Science'],
    [/computer\s*science/i, 'Computer Science'],
    [/political\s*science/i, 'Political Science'],
    [/math(?:ematics|s)?/i, 'Mathematics'],
    [/physics/i, 'Physics'],
    [/chemistry/i, 'Chemistry'],
    [/botany/i, 'Botany'],
    [/zoology/i, 'Zoology'],
    [/biology/i, 'Biology'],
    [/science/i, 'Science'],
    [/history/i, 'History'],
    [/geography/i, 'Geography'],
    [/economics/i, 'Economics'],
    [/commerce/i, 'Commerce'],
    [/accountancy/i, 'Accountancy'],
    [/\btamil\b/i, 'Tamil'],
    [/\benglish\b/i, 'English'],
  ];

  let subject = 'General Studies';
  for (const [pat, label] of subjectRules) {
    if (pat.test(subjectHint)) {
      subject = label;
      break;
    }
  }

  const baseName = fileName.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim();
  const bookName = baseName || `${standard}th ${subject} ${term || volume || ''} (${medium})`.replace(/\s+/g, ' ').trim();

  return { standard, medium, term, volume, subject, bookName };
}

export interface DiscoveredDrivePdf {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string | null;
  parentFolderId: string | null;
  folderSegments: string[];
}

/**
 * Metadata-only recursive Google Drive PDF textbook synchronization into PostgreSQL.
 * Never downloads PDF binaries into PostgreSQL, avoids duplicates, skips unchanged records,
 * and marks missing/inaccessible Drive files cleanly.
 */
export async function syncDriveTextbooksMetadata(params: {
  adminId: number | null;
  adminUsername: string;
  folderName?: string;
  discoveredPdfsOverride?: DiscoveredDrivePdf[];
  folderIdOverride?: string;
}): Promise<DriveSyncResult> {
  await ensureDriveOAuthSchema();

  const targetFolderName =
    cleanEnvValue(params.folderName) ||
    cleanEnvValue(process.env.GOOGLE_DRIVE_TEXTBOOKS_FOLDER_NAME) ||
    DEFAULT_TEXTBOOKS_FOLDER_NAME;

  const logIns = await pool.query(
    `INSERT INTO google_drive_textbook_sync_logs (admin_id, admin_username, folder_name, status)
     VALUES ($1, $2, $3, 'SYNCING')
     RETURNING id`,
    [params.adminId, params.adminUsername, targetFolderName]
  );
  const logId = Number(logIns.rows[0].id);

  let folderId = params.folderIdOverride || cleanEnvValue(process.env.GOOGLE_DRIVE_TEXTBOOKS_FOLDER_ID) || '';
  const errors: string[] = [];

  try {
    let discovered: DiscoveredDrivePdf[] = [];

    if (params.discoveredPdfsOverride) {
      discovered = params.discoveredPdfsOverride;
      folderId = folderId || 'mock_root_folder';
    } else {
      const { client } = await getAuthenticatedDriveClient();
      const drive = google.drive({ version: 'v3', auth: client });

      // 1. Locate root folder
      if (!folderId) {
        const escaped = targetFolderName.replace(/'/g, "\\'");
        const folderRes = await drive.files.list({
          q: `name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
          pageSize: 5,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        const match = folderRes.data.files?.[0];
        if (!match?.id) {
          throw new Error(
            `Google Drive folder "${targetFolderName}" was not found. Create or share this folder in the connected Google account, or set GOOGLE_DRIVE_TEXTBOOKS_FOLDER_ID.`
          );
        }
        folderId = match.id;
      }

      // 2. Recursive BFS metadata scan (zero PDF downloads!)
      const queue: Array<{ id: string; segments: string[] }> = [{ id: folderId, segments: [targetFolderName] }];
      const visitedFolders = new Set<string>([folderId]);

      while (queue.length > 0) {
        const current = queue.shift()!;
        let pageToken: string | undefined;
        do {
          const listRes = await drive.files.list({
            q: `'${current.id}' in parents and trashed = false`,
            fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)',
            pageSize: 500,
            pageToken,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });
          for (const f of listRes.data.files || []) {
            if (!f.id || !f.name) continue;
            if (f.mimeType === 'application/vnd.google-apps.folder') {
              if (!visitedFolders.has(f.id)) {
                visitedFolders.add(f.id);
                queue.push({ id: f.id, segments: [...current.segments, f.name] });
              }
            } else if (f.mimeType === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
              discovered.push({
                id: f.id,
                name: f.name,
                mimeType: f.mimeType || 'application/pdf',
                size: Number(f.size || 0),
                modifiedTime: f.modifiedTime || null,
                parentFolderId: f.parents?.[0] || current.id,
                folderSegments: current.segments,
              });
            }
          }
          pageToken = listRes.data.nextPageToken || undefined;
        } while (pageToken);
      }

      await pool.query(
        `UPDATE google_drive_connections
         SET folder_id = $1, folder_name = $2, updated_at = CURRENT_TIMESTAMP`,
        [folderId, targetFolderName]
      );
    }

    // Load existing Drive-linked textbooks to skip unchanged & detect missing files
    const existingRes = await pool.query(
      `SELECT id, google_drive_file_id, file_size, drive_modified_time, drive_available
       FROM textbooks
       WHERE google_drive_file_id IS NOT NULL`
    );
    const existingByDriveId = new Map<string, any>();
    for (const row of existingRes.rows) {
      existingByDriveId.set(row.google_drive_file_id, row);
    }

    const seenDriveIds = new Set<string>();
    let insertedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let failedCount = 0;

    for (const pdf of discovered) {
      if (seenDriveIds.has(pdf.id)) continue;
      seenDriveIds.add(pdf.id);

      try {
        const existing = existingByDriveId.get(pdf.id);
        const remoteModIso = pdf.modifiedTime ? new Date(pdf.modifiedTime).toISOString() : null;
        const localModIso = existing?.drive_modified_time
          ? new Date(existing.drive_modified_time).toISOString()
          : null;

        if (
          existing &&
          Number(existing.file_size || 0) === Number(pdf.size || 0) &&
          localModIso === remoteModIso &&
          existing.drive_available === true
        ) {
          unchangedCount += 1;
          await pool.query(
            `UPDATE textbooks SET last_synced_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [existing.id]
          );
          continue;
        }

        const meta = classifyTextbookFromDrivePath(pdf.name, pdf.folderSegments);
        const folderPath = [...pdf.folderSegments, pdf.name].join('/');

        if (existing) {
          await pool.query(
            `UPDATE textbooks
             SET file_name = $1,
                 mime_type = $2,
                 file_size = $3,
                 google_drive_parent_folder_id = $4,
                 drive_modified_time = $5,
                 drive_folder_path = $6,
                 drive_available = true,
                 last_synced_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7`,
            [pdf.name, pdf.mimeType, pdf.size, pdf.parentFolderId, remoteModIso, folderPath, existing.id]
          );
          updatedCount += 1;
        } else {
          await pool.query(
            `INSERT INTO textbooks (
               group_id, standard, subject, medium, term, volume, book_name,
               file_path, file_name, mime_type, file_size,
               google_drive_file_id, google_drive_parent_folder_id,
               drive_modified_time, drive_folder_path, drive_available,
               publication_status, status, last_synced_at, updated_at
             ) VALUES (
               'group1', $1, $2, $3, $4, $5, $6,
               $7, $8, $9, $10,
               $11, $12,
               $13, $14, true,
               'pending_review', 'uploaded', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
             )
             ON CONFLICT (google_drive_file_id) WHERE google_drive_file_id IS NOT NULL DO NOTHING`,
            [
              meta.standard,
              meta.subject,
              meta.medium,
              meta.term || (meta.standard >= 11 ? meta.volume || 'Full Book' : 'Full Year'),
              meta.volume,
              meta.bookName,
              `gdrive://${pdf.id}`,
              pdf.name,
              pdf.mimeType,
              pdf.size,
              pdf.id,
              pdf.parentFolderId,
              remoteModIso,
              folderPath,
            ]
          );
          insertedCount += 1;
        }
      } catch (itemErr: any) {
        failedCount += 1;
        errors.push(`${pdf.name}: ${itemErr?.message || 'Sync error'}`);
      }
    }

    // Mark previously synced Drive textbooks that are no longer accessible in Drive
    let missingCount = 0;
    for (const [driveId, row] of existingByDriveId.entries()) {
      if (!seenDriveIds.has(driveId) && row.drive_available !== false) {
        await pool.query(
          `UPDATE textbooks
           SET drive_available = false,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [row.id]
        );
        missingCount += 1;
      }
    }

    await pool.query(
      `UPDATE google_drive_textbook_sync_logs
       SET folder_id = $1,
           status = 'SYNC_COMPLETED',
           discovered_count = $2,
           inserted_count = $3,
           updated_count = $4,
           unchanged_count = $5,
           missing_count = $6,
           failed_count = $7,
           error_details = $8,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $9`,
      [
        folderId,
        discovered.length,
        insertedCount,
        updatedCount,
        unchangedCount,
        missingCount,
        failedCount,
        errors.length > 0 ? errors.join('\n') : null,
        logId,
      ]
    );

    return {
      logId,
      status: 'SYNC_COMPLETED',
      folderId,
      folderName: targetFolderName,
      discoveredCount: discovered.length,
      insertedCount,
      updatedCount,
      unchangedCount,
      missingCount,
      failedCount,
      errors,
    };
  } catch (err: any) {
    const errMsg = err?.message || 'Google Drive synchronization failed.';
    await pool.query(
      `UPDATE google_drive_textbook_sync_logs
       SET folder_id = COALESCE($1, folder_id),
           status = 'SYNC_FAILED',
           error_details = $2,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [folderId || null, errMsg, logId]
    );
    throw err;
  }
}

export async function getDriveConnectionSummary(reqHostHint?: string): Promise<DriveConnectionSummary> {
  await ensureDriveOAuthSchema();
  const cfg = validateDriveOAuthConfig(reqHostHint);

  const [connRes, countsRes, lastLogRes, failedLogsRes] = await Promise.all([
    pool.query(`SELECT * FROM google_drive_connections ORDER BY updated_at DESC LIMIT 1`),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL)::int AS synced_total,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND publication_status = 'pending_review')::int AS pending_review,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND publication_status = 'published')::int AS published,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND drive_available = false)::int AS missing_in_drive
      FROM textbooks
    `),
    pool.query(`
      SELECT status, completed_at, started_at, error_details
      FROM google_drive_textbook_sync_logs
      ORDER BY started_at DESC LIMIT 1
    `),
    pool.query(`
      SELECT COUNT(*)::int AS failed_runs
      FROM google_drive_textbook_sync_logs
      WHERE status = 'SYNC_FAILED'
    `),
  ]);

  const countsRow = countsRes.rows[0] || {};
  const lastLog = lastLogRes.rows[0] || null;
  const conn = connRes.rows[0] || null;

  let uiStatus: DriveUiStatus = 'NOT_CONNECTED';
  if (!cfg.valid) {
    uiStatus = 'AUTHORIZATION_REQUIRED';
  } else if (!conn) {
    uiStatus = 'NOT_CONNECTED';
  } else if (conn.connection_status === 'REAUTHORIZATION_REQUIRED') {
    uiStatus = 'REAUTHORIZATION_REQUIRED';
  } else if (conn.connection_status === 'TOKEN_EXPIRED') {
    uiStatus = 'TOKEN_EXPIRED';
  } else if (lastLog?.status === 'SYNCING') {
    uiStatus = 'SYNCING';
  } else if (lastLog?.status === 'SYNC_FAILED') {
    uiStatus = 'SYNC_FAILED';
  } else if (lastLog?.status === 'SYNC_COMPLETED') {
    uiStatus = 'SYNC_COMPLETED';
  } else {
    uiStatus = 'CONNECTED';
  }

  return {
    status: uiStatus,
    connected: Boolean(conn && !['REAUTHORIZATION_REQUIRED', 'TOKEN_EXPIRED'].includes(conn.connection_status)),
    configured: cfg.valid,
    accountEmail: conn?.account_email || null,
    accountName: conn?.account_name || null,
    adminId: conn?.admin_id ?? null,
    adminUsername: conn?.admin_username || null,
    folderId: conn?.folder_id || null,
    folderName: conn?.folder_name || cleanEnvValue(process.env.GOOGLE_DRIVE_TEXTBOOKS_FOLDER_NAME) || DEFAULT_TEXTBOOKS_FOLDER_NAME,
    redirectUri: cfg.redirectUri,
    scopes: DRIVE_OAUTH_SCOPES,
    lastSyncAt: lastLog?.completed_at || lastLog?.started_at || null,
    lastError: conn?.last_error || (lastLog?.status === 'SYNC_FAILED' ? lastLog.error_details : null) || (!cfg.valid ? cfg.errors.join(' ') : null),
    counts: {
      synchronizedTextbooks: Number(countsRow.synced_total || 0),
      pendingReview: Number(countsRow.pending_review || 0),
      published: Number(countsRow.published || 0),
      missingInDrive: Number(countsRow.missing_in_drive || 0),
      failedSyncRuns: Number(failedLogsRes.rows[0]?.failed_runs || 0),
    },
  };
}

export async function getDriveSyncLogs(limit = 20) {
  await ensureDriveOAuthSchema();
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const res = await pool.query(
    `SELECT id, admin_id, admin_username, folder_id, folder_name, status,
            discovered_count, inserted_count, updated_count, unchanged_count,
            missing_count, failed_count, error_details, started_at, completed_at
     FROM google_drive_textbook_sync_logs
     ORDER BY started_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return res.rows;
}

export async function disconnectDriveConnection(): Promise<{ disconnected: boolean }> {
  await ensureDriveOAuthSchema();
  const res = await pool.query(`DELETE FROM google_drive_connections RETURNING id`);
  return { disconnected: res.rows.length > 0 };
}
