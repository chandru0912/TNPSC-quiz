import crypto from 'crypto';
import path from 'path';
import type { Readable } from 'stream';
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

// Least-privilege scopes: openid/email/profile for admin identity & allowlist verification,
// plus drive.readonly to discover folders, read PDF metadata, and stream published PDFs.
export const DRIVE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.readonly',
] as const;

export type DriveUiStatus =
  | 'NOT_CONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'VERIFIED'
  | 'TOKEN_EXPIRED'
  | 'REAUTHORIZATION_REQUIRED'
  | 'CONNECTION_FAILED';

export type ReviewStatus =
  | 'DISCOVERED'
  | 'SYNCED'
  | 'NEEDS_REVIEW'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export type PublicationStatus =
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'UNPUBLISHED'
  | 'REJECTED'
  | 'UNAVAILABLE';

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
  verified: boolean;
  configured: boolean;
  accountEmail: string | null;
  accountName: string | null;
  adminId: number | null;
  adminUsername: string | null;
  oauthVerified: boolean;
  driveApiAccessible: boolean;
  tokenStatus: 'VALID' | 'EXPIRED' | 'REVOKED' | 'MISSING';
  folderAccessible: boolean;
  folderId: string | null;
  folderName: string;
  redirectUri: string;
  scopes: readonly string[];
  connectedAt: string | null;
  lastVerifiedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  counts: {
    drivePdfsDiscovered: number;
    synchronizedBooks: number;
    pendingReview: number;
    approved: number;
    publishedTextbooks: number;
    rejected: number;
    failedSync: number;
    unavailableFiles: number;
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

export interface DriveTextbookRow {
  id: number;
  groupId: string;
  bookName: string;
  standard: number;
  term: string | null;
  volume: string | null;
  subject: string;
  medium: 'Tamil' | 'English';
  unit: number | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  googleDriveFileId: string;
  googleDriveParentFolderId: string | null;
  driveFolderPath: string | null;
  driveModifiedTime: string | null;
  driveAvailable: boolean;
  reviewStatus: ReviewStatus;
  publicationStatus: PublicationStatus;
  publishedAt: string | null;
  publishedBy: string | null;
  lastSyncedAt: string | null;
  downloadCount: number;
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
      const origin = new URL(candidate).origin;
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
  return cleanEnvValue(process.env.ADMIN_JWT_SECRET) || 'tnpsc_quiz_admin_jwt_secret_key_2026';
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
 * Idempotently creates Drive OAuth connection, sync logs, and metadata-only textbook columns.
 * Never drops tables, never deletes existing textbook data, and never stores PDF binaries in PostgreSQL.
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
      drive_api_accessible BOOLEAN DEFAULT false,
      folder_accessible BOOLEAN DEFAULT false,
      last_verified_at TIMESTAMP WITH TIME ZONE,
      last_error TEXT,
      connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE google_drive_connections ADD COLUMN IF NOT EXISTS drive_api_accessible BOOLEAN DEFAULT false;
    ALTER TABLE google_drive_connections ADD COLUMN IF NOT EXISTS folder_accessible BOOLEAN DEFAULT false;
    ALTER TABLE google_drive_connections ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE;

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
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS review_status VARCHAR(40) DEFAULT 'PENDING_REVIEW';
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS publication_status VARCHAR(40) DEFAULT 'PENDING_REVIEW';
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS published_by VARCHAR(150);
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(150);

    CREATE TABLE IF NOT EXISTS google_drive_textbook_audit_logs (
      id SERIAL PRIMARY KEY,
      admin_username VARCHAR(150) NOT NULL,
      admin_role VARCHAR(50),
      action VARCHAR(60) NOT NULL,
      scope VARCHAR(40) NOT NULL,
      affected_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      details JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_textbooks_drive_file_id_unique
      ON textbooks (google_drive_file_id)
      WHERE google_drive_file_id IS NOT NULL;
  `);

  driveSchemaReady = true;
}

export function createDriveOAuth2Client(redirectUri?: string): OAuth2Client {
  const cfg = validateDriveOAuthConfig();
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, redirectUri || cfg.redirectUri);
}

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

export function extractGoogleProjectNumber(clientId?: string | null): string | null {
  const clean = cleanEnvValue(clientId);
  const match = clean.match(/^(\d+)-/);
  return match ? match[1] : null;
}

export function diagnoseDriveOAuthError(
  rawError: string,
  redirectUri: string
): {
  category: 'unapproved_test_user' | 'incorrect_oauth_client' | 'invalid_scope' | 'redirect_uri_mismatch' | 'token_revoked' | 'unknown';
  message: string;
} {
  const lower = String(rawError || '').toLowerCase();
  if (lower.includes('redirect_uri_mismatch')) {
    return {
      category: 'redirect_uri_mismatch',
      message: `redirect_uri_mismatch: Register exact URI "${redirectUri}" under Authorized redirect URIs in Google Cloud Console.`,
    };
  }
  if (lower.includes('access_denied')) {
    return {
      category: 'unapproved_test_user',
      message: '403 access_denied: Account denied or not listed under Google Auth Platform -> Audience -> Test users.',
    };
  }
  if (lower.includes('invalid_client')) {
    return {
      category: 'incorrect_oauth_client',
      message: 'Google OAuth client credentials rejected (invalid_client). Verify GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET.',
    };
  }
  if (lower.includes('invalid_scope')) {
    return {
      category: 'invalid_scope',
      message: 'Google rejected the requested OAuth scope (invalid_scope). Ensure Google Drive API is enabled.',
    };
  }
  if (lower.includes('invalid_grant')) {
    return {
      category: 'token_revoked',
      message: 'OAuth refresh token expired or revoked (invalid_grant). Please reconnect Google Drive.',
    };
  }
  return {
    category: 'unknown',
    message: rawError || 'Google Drive OAuth authorization failed.',
  };
}

export function mapGoogleOAuthErrorToDiagnostic(rawError: string, redirectUri: string): string {
  return diagnoseDriveOAuthError(rawError, redirectUri).message;
}

export async function runDriveOAuthDiagnostics(reqHostHint?: string) {
  const cfg = validateDriveOAuthConfig(reqHostHint);
  const projectNum = extractGoogleProjectNumber(cfg.clientId);
  let clientCredentialsStatus: 'valid_client_credentials' | 'invalid_client' | 'unconfigured' | 'error' = cfg.valid
    ? 'valid_client_credentials'
    : 'unconfigured';
  let redirectUriStatus: 'registered' | 'mismatch' | 'unknown' = 'unknown';
  let diagnosedBlocker = 'none';

  if (cfg.valid) {
    try {
      const tokenProbe = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: 'diagnostic_probe_invalid_code',
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: cfg.redirectUri,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(8000),
      });
      const data: any = await tokenProbe.json().catch(() => ({}));
      const errCode = String(data?.error || '').toLowerCase();
      if (errCode === 'invalid_client') {
        clientCredentialsStatus = 'invalid_client';
        diagnosedBlocker = 'invalid_client';
      } else if (errCode === 'redirect_uri_mismatch') {
        redirectUriStatus = 'mismatch';
        diagnosedBlocker = 'redirect_uri_mismatch';
      } else {
        clientCredentialsStatus = 'valid_client_credentials';
        redirectUriStatus = 'registered';
      }
    } catch {
      clientCredentialsStatus = 'error';
      diagnosedBlocker = 'network_error';
    }
  } else {
    diagnosedBlocker = cfg.errors[0] || 'unconfigured';
  }

  return {
    googleCloudProjectNumber: projectNum,
    clientCredentialsStatus,
    redirectUriStatus,
    scopeValid: DRIVE_OAUTH_SCOPES.includes('https://www.googleapis.com/auth/drive.readonly'),
    diagnosedBlocker,
    adminOnlyDriveAccess: true,
    redirectUri: cfg.redirectUri,
  };
}

export async function handleDriveOAuthCallback(params: {
  code: string;
  state: string;
  reqHostHint?: string;
  oauthClientFactory?: (redirectUri: string) => OAuth2Client;
}): Promise<{ email: string; name: string | null; frontendOrigin: string; verified: boolean }> {
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

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const profileRes = await oauth2.userinfo.get();
  const email = cleanEnvValue(profileRes.data.email).toLowerCase();
  const name = cleanEnvValue(profileRes.data.name) || null;

  if (!email) {
    throw new Error('Could not determine Google account email from OAuth profile.');
  }

  if (!isAllowedAdminGoogleEmail(email)) {
    const err: any = new Error(
      `Unauthorized Google account (${email}). Only approved administrator emails may connect Google Drive.`
    );
    err.statusCode = 403;
    throw err;
  }

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
  const configuredFolderId = cleanEnvValue(process.env.GOOGLE_DRIVE_TEXTBOOKS_FOLDER_ID) || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM google_drive_connections');
    await client.query(
      `INSERT INTO google_drive_connections (
         admin_id, admin_username, account_email, account_name,
         encrypted_refresh_token, refresh_token_iv, refresh_token_auth_tag,
         encrypted_access_token, access_token_iv, access_token_auth_tag,
         token_expiry, scope, folder_id, folder_name, connection_status,
         drive_api_accessible, folder_accessible, last_error,
         connected_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'CONNECTED',false,false,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
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
        configuredFolderId,
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

  // Immediately perform real Drive API verification so status transitions to VERIFIED if Drive API succeeds
  let verified = false;
  try {
    const verifyRes = await verifyLiveDriveConnection();
    verified = verifyRes.verified;
  } catch {
    verified = false;
  }

  return { email, name, frontendOrigin, verified };
}

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
    err.uiStatus = 'NOT_CONNECTED';
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
             connection_status = CASE WHEN drive_api_accessible THEN 'VERIFIED' ELSE 'CONNECTED' END,
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
             drive_api_accessible = false,
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
 * Performs a real authenticated Google Drive API v3 verification request:
 * 1) Confirms Drive API is accessible and checks authenticated email
 * 2) Checks whether the configured textbook folder is accessible
 * 3) Marks connection_status = 'VERIFIED' only when live Drive API call succeeds.
 */
export async function verifyLiveDriveConnection(reqHostHint?: string): Promise<DriveConnectionSummary> {
  await ensureDriveOAuthSchema();

  const { client, connection } = await getAuthenticatedDriveClient();
  const drive = google.drive({ version: 'v3', auth: client });

  try {
    const aboutRes = await drive.about.get({ fields: 'user(emailAddress,displayName)' });
    const driveEmail = cleanEnvValue(aboutRes.data.user?.emailAddress).toLowerCase() || connection.account_email;
    const driveName = cleanEnvValue(aboutRes.data.user?.displayName) || connection.account_name;

    let folderId: string | null = connection.folder_id || cleanEnvValue(process.env.GOOGLE_DRIVE_TEXTBOOKS_FOLDER_ID) || null;
    const folderName: string = connection.folder_name || cleanEnvValue(process.env.GOOGLE_DRIVE_TEXTBOOKS_FOLDER_NAME) || DEFAULT_TEXTBOOKS_FOLDER_NAME;
    let folderAccessible = false;

    if (folderId) {
      try {
        const fMeta = await drive.files.get({
          fileId: folderId,
          fields: 'id, name, trashed',
          supportsAllDrives: true,
        });
        folderAccessible = Boolean(fMeta.data.id && !fMeta.data.trashed);
      } catch {
        folderAccessible = false;
      }
    } else {
      const escaped = folderName.replace(/'/g, "\\'");
      const folderSearch = await drive.files.list({
        q: `name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 5,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const found = folderSearch.data.files?.[0];
      if (found?.id) {
        folderId = found.id;
        folderAccessible = true;
      }
    }

    await pool.query(
      `UPDATE google_drive_connections
       SET account_email = $1,
           account_name = $2,
           folder_id = COALESCE($3, folder_id),
           connection_status = 'VERIFIED',
           drive_api_accessible = true,
           folder_accessible = $4,
           last_verified_at = CURRENT_TIMESTAMP,
           last_error = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [driveEmail, driveName, folderId, folderAccessible, connection.id]
    );
  } catch (verifyErr: any) {
    const errMsg = verifyErr?.response?.data?.error?.message || verifyErr?.message || 'Drive API verification failed.';
    await pool.query(
      `UPDATE google_drive_connections
       SET connection_status = 'CONNECTION_FAILED',
           drive_api_accessible = false,
           last_error = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [errMsg, connection.id]
    );
  }

  return getDriveConnectionSummary(reqHostHint);
}

/**
 * Lists folders in My Drive / Shared Drives so the Admin can select or browse textbook folders.
 */
export async function listDriveFolders(parentFolderId?: string): Promise<Array<{ id: string; name: string; parentId: string | null }>> {
  const { client } = await getAuthenticatedDriveClient();
  const drive = google.drive({ version: 'v3', auth: client });

  const q = parentFolderId
    ? `'${parentFolderId.replace(/'/g, "\\'")}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    : `mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const folders: Array<{ id: string; name: string; parentId: string | null }> = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q,
      fields: 'nextPageToken, files(id, name, parents)',
      orderBy: 'name',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files || []) {
      if (f.id && f.name) {
        folders.push({ id: f.id, name: f.name, parentId: f.parents?.[0] || null });
      }
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken && folders.length < 500);

  return folders;
}

/**
 * Smart metadata classifier: only assigns Standard/Subject/Unit when confidently detected;
 * otherwise flags needsReview = true so the Admin verifies before publishing.
 */
export function classifyTextbookFromDrivePath(fileName: string, folderSegments: string[]) {
  const combined = [...folderSegments, fileName].join(' ').replace(/[_.-]+/g, ' ');

  let standard: number | null = null;
  const stdMatch = combined.match(/(?:class|std|standard)?\s*(12|11|10|9|8|7|6)(?:th)?\b/i);
  if (stdMatch) standard = parseInt(stdMatch[1], 10);

  const medium: 'Tamil' | 'English' =
    /tamil\s*medium|\btm\b|தமிழ்/i.test(combined) ? 'Tamil' : 'English';

  let term: string | null = null;
  let volume: string | null = null;
  if (standard !== null && standard <= 10) {
    const tm = combined.match(/\bterm\s*([1-3])\b/i);
    if (tm) term = `Term ${tm[1]}`;
  } else if (standard !== null && standard >= 11) {
    const vm = combined.match(/\bvol(?:ume)?\s*([1-3])\b/i);
    if (vm) volume = `Volume ${vm[1]}`;
  }

  let unit: number | null = null;
  const unitMatch = combined.match(/\bunit\s*(\d{1,2})\b/i);
  if (unitMatch) unit = parseInt(unitMatch[1], 10);

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

  let subject: string | null = null;
  for (const [pat, label] of subjectRules) {
    if (pat.test(subjectHint)) {
      subject = label;
      break;
    }
  }

  const confident = standard !== null && subject !== null;
  const resolvedStandard = standard ?? 6;
  const resolvedSubject = subject ?? 'Unclassified';
  const baseName = fileName.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim();
  const bookName = baseName || `${resolvedStandard}th ${resolvedSubject} (${medium})`;

  return {
    standard: resolvedStandard,
    medium,
    term,
    volume,
    unit,
    subject: resolvedSubject,
    bookName,
    reviewStatus: (confident ? 'PENDING_REVIEW' : 'NEEDS_REVIEW') as ReviewStatus,
  };
}

/**
 * Metadata-only recursive Google Drive PDF textbook synchronization into PostgreSQL.
 * Supports pagination (>100 files), My Drive + Shared Drives, skips unchanged files,
 * prevents duplicates via unique google_drive_file_id, and never auto-publishes.
 */
export async function syncDriveTextbooksMetadata(params: {
  adminId: number | null;
  adminUsername: string;
  folderId?: string;
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

  let folderId =
    cleanEnvValue(params.folderId) ||
    params.folderIdOverride ||
    cleanEnvValue(process.env.GOOGLE_DRIVE_TEXTBOOKS_FOLDER_ID) ||
    '';
  const errors: string[] = [];

  try {
    let discovered: DiscoveredDrivePdf[] = [];

    if (params.discoveredPdfsOverride) {
      discovered = params.discoveredPdfsOverride.filter(
        (f) => f.mimeType === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );
      folderId = folderId || 'mock_root_folder';
    } else {
      const { client, connection } = await getAuthenticatedDriveClient();
      const drive = google.drive({ version: 'v3', auth: client });

      // 1. Resolve target root folder
      if (!folderId && connection.folder_id && (!params.folderName || params.folderName === connection.folder_name)) {
        folderId = connection.folder_id;
      }
      if (!folderId) {
        const escaped = targetFolderName.replace(/'/g, "\\'");
        const folderRes = await drive.files.list({
          q: `name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
          pageSize: 10,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        const match = folderRes.data.files?.[0];
        if (!match?.id) {
          throw new Error(
            `Google Drive folder "${targetFolderName}" was not found. Select a folder from the folder picker or create/share "${targetFolderName}" in ${connection.account_email}.`
          );
        }
        folderId = match.id;
      }

      // 2. Recursive BFS metadata scan with full nextPageToken pagination (supports 1000+ PDFs)
      const queue: Array<{ id: string; segments: string[] }> = [{ id: folderId, segments: [targetFolderName] }];
      const visitedFolders = new Set<string>([folderId]);

      while (queue.length > 0) {
        const current = queue.shift()!;
        let pageToken: string | undefined;
        do {
          const listRes = await drive.files.list({
            q: `'${current.id}' in parents and trashed = false`,
            fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)',
            pageSize: 1000,
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
            } else if (f.mimeType === 'application/pdf') {
              discovered.push({
                id: f.id,
                name: f.name,
                mimeType: 'application/pdf',
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
         SET folder_id = $1,
             folder_name = $2,
             folder_accessible = true,
             drive_api_accessible = true,
             connection_status = 'VERIFIED',
             last_verified_at = CURRENT_TIMESTAMP,
             last_error = NULL,
             updated_at = CURRENT_TIMESTAMP`,
        [folderId, targetFolderName]
      );
    }

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
          await pool.query(`UPDATE textbooks SET last_synced_at = CURRENT_TIMESTAMP WHERE id = $1`, [existing.id]);
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
               group_id, standard, subject, medium, term, volume, unit, book_name,
               file_path, file_name, mime_type, file_size,
               google_drive_file_id, google_drive_parent_folder_id,
               drive_modified_time, drive_folder_path, drive_available,
               review_status, publication_status, status, last_synced_at, updated_at
             ) VALUES (
               'group1', $1, $2, $3, $4, $5, $6, $7,
               $8, $9, $10, $11,
               $12, $13,
               $14, $15, true,
               $16, 'PENDING_REVIEW', 'uploaded', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
             )
             ON CONFLICT (google_drive_file_id) WHERE google_drive_file_id IS NOT NULL DO NOTHING`,
            [
              meta.standard,
              meta.subject,
              meta.medium,
              meta.term || (meta.standard >= 11 ? meta.volume || 'Full Book' : 'Full Year'),
              meta.volume,
              meta.unit,
              meta.bookName,
              `gdrive://${pdf.id}`,
              pdf.name,
              pdf.mimeType,
              pdf.size,
              pdf.id,
              pdf.parentFolderId,
              remoteModIso,
              folderPath,
              meta.reviewStatus,
            ]
          );
          insertedCount += 1;
        }
      } catch (itemErr: any) {
        failedCount += 1;
        errors.push(`${pdf.name}: ${itemErr?.message || 'Sync error'}`);
      }
    }

    let missingCount = 0;
    // Never mark unrelated real Drive records as unavailable during mock/override test runs
    if (!params.discoveredPdfsOverride) {
      for (const [driveId, row] of existingByDriveId.entries()) {
        if (!seenDriveIds.has(driveId) && row.drive_available !== false) {
          await pool.query(
            `UPDATE textbooks
             SET drive_available = false,
                 publication_status = CASE WHEN UPPER(publication_status) = 'PUBLISHED' THEN 'UNAVAILABLE' ELSE publication_status END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [row.id]
          );
          missingCount += 1;
        }
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

function mapTextbookRow(r: any): DriveTextbookRow {
  const pubRaw = String(r.publication_status || 'PENDING_REVIEW').toUpperCase();
  const revRaw = String(r.review_status || 'PENDING_REVIEW').toUpperCase();
  return {
    id: Number(r.id),
    groupId: String(r.group_id || 'group1'),
    bookName: String(r.book_name || r.file_name || 'Untitled Textbook'),
    standard: Number(r.standard || 6),
    term: r.term || null,
    volume: r.volume || null,
    subject: String(r.subject || 'Unclassified'),
    medium: String(r.medium || '').toLowerCase().includes('tamil') ? 'Tamil' : 'English',
    unit: r.unit !== null && r.unit !== undefined ? Number(r.unit) : null,
    fileName: String(r.file_name || `${r.book_name || 'textbook'}.pdf`),
    mimeType: String(r.mime_type || 'application/pdf'),
    fileSize: Number(r.file_size || 0),
    googleDriveFileId: String(r.google_drive_file_id),
    googleDriveParentFolderId: r.google_drive_parent_folder_id || null,
    driveFolderPath: r.drive_folder_path || null,
    driveModifiedTime: r.drive_modified_time ? new Date(r.drive_modified_time).toISOString() : null,
    driveAvailable: r.drive_available !== false,
    reviewStatus: revRaw as ReviewStatus,
    publicationStatus: pubRaw as PublicationStatus,
    publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
    publishedBy: r.published_by || null,
    lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at).toISOString() : null,
    downloadCount: Number(r.download_count || 0),
  };
}

export async function listDriveTextbooksForAdmin(filters?: {
  search?: string;
  standard?: string;
  termOrVolume?: string;
  subject?: string;
  medium?: string;
  publicationStatus?: string;
}): Promise<DriveTextbookRow[]> {
  await ensureDriveOAuthSchema();

  const clauses = ['google_drive_file_id IS NOT NULL'];
  const params: any[] = [];
  let idx = 1;

  if (filters?.standard && filters.standard !== 'all') {
    clauses.push(`standard = $${idx++}`);
    params.push(Number(filters.standard));
  }
  if (filters?.medium && filters.medium !== 'all') {
    clauses.push(`LOWER(medium) = LOWER($${idx++})`);
    params.push(filters.medium);
  }
  if (filters?.subject && filters.subject !== 'all') {
    clauses.push(`LOWER(subject) = LOWER($${idx++})`);
    params.push(filters.subject);
  }
  if (filters?.termOrVolume && filters.termOrVolume !== 'all') {
    clauses.push(`(LOWER(COALESCE(term, '')) = LOWER($${idx}) OR LOWER(COALESCE(volume, '')) = LOWER($${idx}))`);
    params.push(filters.termOrVolume);
    idx += 1;
  }
  if (filters?.publicationStatus && filters.publicationStatus !== 'all') {
    clauses.push(`UPPER(COALESCE(publication_status, 'PENDING_REVIEW')) = UPPER($${idx++})`);
    params.push(filters.publicationStatus);
  }
  if (filters?.search && filters.search.trim()) {
    clauses.push(`(book_name ILIKE $${idx} OR file_name ILIKE $${idx} OR subject ILIKE $${idx} OR COALESCE(drive_folder_path, '') ILIKE $${idx})`);
    params.push(`%${filters.search.trim()}%`);
    idx += 1;
  }

  const res = await pool.query(
    `SELECT * FROM textbooks
     WHERE ${clauses.join(' AND ')}
     ORDER BY standard ASC, subject ASC, book_name ASC`,
    params
  );
  return res.rows.map(mapTextbookRow);
}

export async function updateDriveTextbookMetadataById(
  id: number,
  updates: {
    groupId?: string;
    bookName?: string;
    standard?: number;
    term?: string | null;
    volume?: string | null;
    subject?: string;
    medium?: string;
    unit?: number | null;
    reviewStatus?: ReviewStatus;
  }
): Promise<DriveTextbookRow | null> {
  await ensureDriveOAuthSchema();

  const existing = await pool.query(`SELECT * FROM textbooks WHERE id = $1 AND google_drive_file_id IS NOT NULL`, [id]);
  if (existing.rows.length === 0) return null;

  const cur = existing.rows[0];
  const nextStd = updates.standard !== undefined ? Number(updates.standard) : Number(cur.standard);
  const nextTerm = nextStd <= 10 ? (updates.term !== undefined ? updates.term : cur.term) : null;
  const nextVol = nextStd >= 11 ? (updates.volume !== undefined ? updates.volume : cur.volume) : null;
  const nextUnit = updates.unit !== undefined ? (updates.unit === null ? null : Number(updates.unit)) : cur.unit;

  const res = await pool.query(
    `UPDATE textbooks
     SET group_id = $1,
         book_name = $2,
         standard = $3,
         term = $4,
         volume = $5,
         subject = $6,
         medium = $7,
         unit = $8,
         review_status = COALESCE($9, review_status),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $10
     RETURNING *`,
    [
      updates.groupId || cur.group_id || 'group1',
      (updates.bookName || cur.book_name).trim(),
      nextStd,
      nextTerm || (nextStd >= 11 ? nextVol || 'Full Book' : 'Full Year'),
      nextVol,
      (updates.subject || cur.subject).trim(),
      updates.medium || cur.medium || 'English',
      Number.isFinite(nextUnit) ? nextUnit : null,
      updates.reviewStatus || null,
      id,
    ]
  );
  return mapTextbookRow(res.rows[0]);
}

export async function resyncSingleDriveTextbook(id: number): Promise<DriveTextbookRow | null> {
  await ensureDriveOAuthSchema();
  const res = await pool.query(`SELECT * FROM textbooks WHERE id = $1 AND google_drive_file_id IS NOT NULL`, [id]);
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  const { client } = await getAuthenticatedDriveClient();
  const drive = google.drive({ version: 'v3', auth: client });

  try {
    const meta = await drive.files.get({
      fileId: row.google_drive_file_id,
      fields: 'id, name, mimeType, size, modifiedTime, trashed, parents',
      supportsAllDrives: true,
    });
    const available = Boolean(meta.data.id && !meta.data.trashed);
    const upd = await pool.query(
      `UPDATE textbooks
       SET file_name = COALESCE($1, file_name),
           file_size = COALESCE($2, file_size),
           drive_modified_time = COALESCE($3, drive_modified_time),
           drive_available = $4,
           publication_status = CASE WHEN $4 = false AND UPPER(publication_status) = 'PUBLISHED' THEN 'UNAVAILABLE' ELSE publication_status END,
           last_synced_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        meta.data.name || null,
        meta.data.size ? Number(meta.data.size) : null,
        meta.data.modifiedTime ? new Date(meta.data.modifiedTime).toISOString() : null,
        available,
        id,
      ]
    );
    return mapTextbookRow(upd.rows[0]);
  } catch {
    const upd = await pool.query(
      `UPDATE textbooks
       SET drive_available = false,
           publication_status = CASE WHEN UPPER(publication_status) = 'PUBLISHED' THEN 'UNAVAILABLE' ELSE publication_status END,
           last_synced_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return mapTextbookRow(upd.rows[0]);
  }
}

export async function applyDriveTextbookWorkflowAction(params: {
  ids: number[];
  action: 'mark_review' | 'approve' | 'reject' | 'publish' | 'unpublish';
  adminUsername: string;
  skipDriveCheck?: boolean;
}): Promise<{ updatedCount: number; failed: Array<{ id: number; reason: string }> }> {
  await ensureDriveOAuthSchema();
  const cleanIds = Array.from(new Set(params.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)));
  if (cleanIds.length === 0) return { updatedCount: 0, failed: [] };

  const failed: Array<{ id: number; reason: string }> = [];
  let updatedCount = 0;

  let driveClient: ReturnType<typeof google.drive> | null = null;
  if (params.action === 'publish' && !params.skipDriveCheck) {
    const { client } = await getAuthenticatedDriveClient();
    driveClient = google.drive({ version: 'v3', auth: client });
  }

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    for (const id of cleanIds) {
      const rowRes = await dbClient.query(
        `SELECT * FROM textbooks WHERE id = $1 AND google_drive_file_id IS NOT NULL`,
        [id]
      );
      if (rowRes.rows.length === 0) {
        failed.push({ id, reason: 'Textbook record not found.' });
        continue;
      }
      const tb = rowRes.rows[0];

      if (params.action === 'publish') {
        if (!tb.book_name || !tb.subject || String(tb.subject).toLowerCase() === 'unclassified') {
          failed.push({ id, reason: 'Metadata incomplete: assign Subject & Title before publishing.' });
          continue;
        }
        if (driveClient) {
          try {
            const check = await driveClient.files.get({
              fileId: tb.google_drive_file_id,
              fields: 'id, trashed',
              supportsAllDrives: true,
            });
            if (!check.data.id || check.data.trashed) {
              failed.push({ id, reason: 'Original PDF is trashed or missing in Google Drive.' });
              continue;
            }
          } catch (driveErr: any) {
            failed.push({ id, reason: `Drive accessibility check failed: ${driveErr?.message || 'Inaccessible'}` });
            continue;
          }
        }
        await dbClient.query(
          `UPDATE textbooks
           SET review_status = 'APPROVED',
               publication_status = 'PUBLISHED',
               drive_available = true,
               published_by = $1,
               published_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [params.adminUsername, id]
        );
        updatedCount += 1;
      } else if (params.action === 'unpublish') {
        await dbClient.query(
          `UPDATE textbooks
           SET publication_status = 'UNPUBLISHED',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id]
        );
        updatedCount += 1;
      } else if (params.action === 'approve') {
        await dbClient.query(
          `UPDATE textbooks
           SET review_status = 'APPROVED',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id]
        );
        updatedCount += 1;
      } else if (params.action === 'reject') {
        await dbClient.query(
          `UPDATE textbooks
           SET review_status = 'REJECTED',
               publication_status = 'REJECTED',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id]
        );
        updatedCount += 1;
      } else if (params.action === 'mark_review') {
        await dbClient.query(
          `UPDATE textbooks
           SET review_status = 'PENDING_REVIEW',
               publication_status = CASE WHEN UPPER(publication_status) = 'PUBLISHED' THEN 'PENDING_REVIEW' ELSE publication_status END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id]
        );
        updatedCount += 1;
      }
    }
    await dbClient.query('COMMIT');
  } catch (txErr) {
    await dbClient.query('ROLLBACK');
    throw txErr;
  } finally {
    dbClient.release();
  }

  return { updatedCount, failed };
}

function normalizeMediumParam(raw?: string): string | null {
  if (!raw || raw === 'all') return null;
  const lower = raw.toLowerCase().trim();
  if (lower.includes('tamil')) return 'Tamil';
  if (lower.includes('english')) return 'English';
  return raw.trim();
}

/**
 * Student Textbook Library query: strictly returns ONLY publication_status = 'PUBLISHED'
 * AND drive_available = true AND deleted_at IS NULL. Supports medium, standard, subject,
 * term, volume, termOrVolume, search, page, and limit.
 */
export async function listPublishedStudentTextbooks(filters?: {
  group?: string;
  standard?: string;
  subject?: string;
  medium?: string;
  term?: string;
  volume?: string;
  termOrVolume?: string;
  unit?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<DriveTextbookRow[]> {
  const result = await queryPublishedStudentTextbooksPaginated(filters);
  return result.items;
}

export async function queryPublishedStudentTextbooksPaginated(filters?: {
  group?: string;
  standard?: string;
  subject?: string;
  medium?: string;
  term?: string;
  volume?: string;
  termOrVolume?: string;
  unit?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  items: DriveTextbookRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  await ensureDriveOAuthSchema();

  const clauses = [
    'google_drive_file_id IS NOT NULL',
    'deleted_at IS NULL',
    "UPPER(COALESCE(publication_status, '')) = 'PUBLISHED'",
    'COALESCE(drive_available, true) = true',
  ];
  const params: any[] = [];
  let idx = 1;

  if (filters?.group && filters.group !== 'all') {
    clauses.push(`LOWER(group_id) = LOWER($${idx++})`);
    params.push(filters.group);
  }
  if (filters?.standard && filters.standard !== 'all') {
    clauses.push(`standard = $${idx++}`);
    params.push(Number(filters.standard));
  }
  if (filters?.subject && filters.subject !== 'all') {
    clauses.push(`LOWER(subject) = LOWER($${idx++})`);
    params.push(filters.subject.trim());
  }
  const normMed = normalizeMediumParam(filters?.medium);
  if (normMed) {
    clauses.push(`LOWER(medium) = LOWER($${idx++})`);
    params.push(normMed);
  }
  if (filters?.term && filters.term !== 'all') {
    clauses.push(`LOWER(COALESCE(term, '')) = LOWER($${idx++})`);
    params.push(filters.term.trim());
  }
  if (filters?.volume && filters.volume !== 'all') {
    clauses.push(`(LOWER(COALESCE(volume, '')) = LOWER($${idx}) OR LOWER(COALESCE(term, '')) = LOWER($${idx}))`);
    params.push(filters.volume.trim());
    idx += 1;
  }
  if (filters?.termOrVolume && filters.termOrVolume !== 'all') {
    clauses.push(`(LOWER(COALESCE(term, '')) = LOWER($${idx}) OR LOWER(COALESCE(volume, '')) = LOWER($${idx}))`);
    params.push(filters.termOrVolume.trim());
    idx += 1;
  }
  if (filters?.unit && filters.unit !== 'all') {
    clauses.push(`unit = $${idx++}`);
    params.push(Number(filters.unit));
  }
  if (filters?.search && filters.search.trim()) {
    clauses.push(`(book_name ILIKE $${idx} OR file_name ILIKE $${idx} OR subject ILIKE $${idx})`);
    params.push(`%${filters.search.trim()}%`);
    idx += 1;
  }

  const whereSql = clauses.join(' AND ');
  const page = Math.max(1, Number(filters?.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(filters?.limit) || 100));
  const offset = (page - 1) * limit;

  const [countRes, rowsRes] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM textbooks WHERE ${whereSql}`, params),
    pool.query(
      `SELECT * FROM textbooks
       WHERE ${whereSql}
       ORDER BY standard ASC, subject ASC, term ASC NULLS LAST, volume ASC NULLS LAST, book_name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    ),
  ]);

  const total = Number(countRes.rows[0]?.total || 0);
  return {
    items: rowsRes.rows.map(mapTextbookRow),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/**
 * Dynamic cascading filter options derived strictly from PUBLISHED, Drive-available textbooks.
 */
export async function getPublishedStudentTextbookFilters(filters?: {
  medium?: string;
  standard?: string;
  subject?: string;
  term?: string;
  volume?: string;
}) {
  await ensureDriveOAuthSchema();

  const baseWhere = `
    google_drive_file_id IS NOT NULL
    AND deleted_at IS NULL
    AND UPPER(COALESCE(publication_status, '')) = 'PUBLISHED'
    AND COALESCE(drive_available, true) = true
  `;

  const normMed = normalizeMediumParam(filters?.medium);
  const stdNum = filters?.standard && filters.standard !== 'all' ? Number(filters.standard) : null;
  const subj = filters?.subject && filters.subject !== 'all' ? filters.subject.trim() : null;

  // 1. Mediums across all published textbooks
  const mediumsRes = await pool.query(`
    SELECT
      CASE WHEN LOWER(medium) LIKE '%tamil%' THEN 'Tamil' ELSE 'English' END AS medium,
      COUNT(*)::int AS count
    FROM textbooks
    WHERE ${baseWhere}
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  // 2. Standards available for selected medium
  const stdParams: any[] = [];
  let stdClause = baseWhere;
  if (normMed) {
    stdParams.push(normMed);
    stdClause += ` AND LOWER(medium) = LOWER($${stdParams.length})`;
  }
  const standardsRes = await pool.query(
    `SELECT standard::int AS standard, COUNT(*)::int AS count
     FROM textbooks
     WHERE ${stdClause}
     GROUP BY standard
     ORDER BY standard ASC`,
    stdParams
  );

  // 3. Subjects available for selected medium + standard
  const subjParams: any[] = [...stdParams];
  let subjClause = stdClause;
  if (stdNum && Number.isInteger(stdNum)) {
    subjParams.push(stdNum);
    subjClause += ` AND standard = $${subjParams.length}`;
  }
  const subjectsRes = await pool.query(
    `SELECT subject, COUNT(*)::int AS count
     FROM textbooks
     WHERE ${subjClause} AND subject IS NOT NULL AND TRIM(subject) <> ''
     GROUP BY subject
     ORDER BY subject ASC`,
    subjParams
  );

  // 4. Terms & Volumes available for selected medium + standard + subject
  const tvParams: any[] = [...subjParams];
  let tvClause = subjClause;
  if (subj) {
    tvParams.push(subj);
    tvClause += ` AND LOWER(subject) = LOWER($${tvParams.length})`;
  }
  const tvRes = await pool.query(
    `SELECT term, volume, COUNT(*)::int AS count
     FROM textbooks
     WHERE ${tvClause}
     GROUP BY term, volume`,
    tvParams
  );

  const termCounts = new Map<string, number>();
  const volumeCounts = new Map<string, number>();

  for (const r of tvRes.rows) {
    const t = String(r.term || '').trim();
    const v = String(r.volume || '').trim();
    const cnt = Number(r.count || 0);

    if (/^term\s*\d+/i.test(t)) {
      termCounts.set(t, (termCounts.get(t) || 0) + cnt);
    }
    if (/^vol(?:ume)?\s*\d+/i.test(v)) {
      volumeCounts.set(v, (volumeCounts.get(v) || 0) + cnt);
    } else if (/^vol(?:ume)?\s*\d+/i.test(t)) {
      volumeCounts.set(t, (volumeCounts.get(t) || 0) + cnt);
    }
  }

  const sortNumLabel = (a: string, b: string) => {
    const na = parseInt(a.replace(/\D/g, ''), 10) || 99;
    const nb = parseInt(b.replace(/\D/g, ''), 10) || 99;
    return na - nb || a.localeCompare(b);
  };

  const terms = Array.from(termCounts.entries())
    .sort(([a], [b]) => sortNumLabel(a, b))
    .map(([label, count]) => ({ label, count }));

  const volumes = Array.from(volumeCounts.entries())
    .sort(([a], [b]) => sortNumLabel(a, b))
    .map(([label, count]) => ({ label, count }));

  const structureType: 'term' | 'volume' | 'both' | 'none' =
    terms.length > 0 && volumes.length > 0
      ? 'both'
      : terms.length > 0
        ? 'term'
        : volumes.length > 0
          ? 'volume'
          : 'none';

  const totalPublished = mediumsRes.rows.reduce((sum, r) => sum + Number(r.count || 0), 0);

  return {
    totalPublished,
    mediums: mediumsRes.rows.map((r) => ({ medium: r.medium as 'Tamil' | 'English', count: Number(r.count) })),
    standards: standardsRes.rows.map((r) => ({ standard: Number(r.standard), count: Number(r.count) })),
    subjects: subjectsRes.rows.map((r) => ({ subject: String(r.subject), count: Number(r.count) })),
    terms,
    volumes,
    structureType,
  };
}

export async function getPublishedStudentTextbookById(id: number): Promise<DriveTextbookRow | null> {
  await ensureDriveOAuthSchema();
  const res = await pool.query(
    `SELECT * FROM textbooks
     WHERE id = $1
       AND google_drive_file_id IS NOT NULL
       AND deleted_at IS NULL
       AND UPPER(COALESCE(publication_status, '')) = 'PUBLISHED'
       AND COALESCE(drive_available, true) = true
     LIMIT 1`,
    [id]
  );
  return res.rows.length > 0 ? mapTextbookRow(res.rows[0]) : null;
}

/**
 * Streams a Google Drive PDF directly as a Node Readable stream (zero full-file buffering in RAM).
 * Enforces publication_status = 'PUBLISHED' for student requests!
 */
export async function openDriveTextbookPdfStream(params: {
  textbookId: number;
  isAdmin: boolean;
  incrementDownloadCount?: boolean;
}): Promise<{ stream: Readable; fileName: string; fileSize: number; mimeType: string }> {
  await ensureDriveOAuthSchema();

  const res = await pool.query(
    `SELECT id, book_name, file_name, file_size, google_drive_file_id, publication_status, drive_available
     FROM textbooks
     WHERE id = $1 AND google_drive_file_id IS NOT NULL AND deleted_at IS NULL
     LIMIT 1`,
    [params.textbookId]
  );
  if (res.rows.length === 0) {
    const err: any = new Error('Textbook not found.');
    err.statusCode = 404;
    throw err;
  }

  const row = res.rows[0];
  if (!params.isAdmin && String(row.publication_status || '').toUpperCase() !== 'PUBLISHED') {
    const err: any = new Error('This textbook is not published in the Student Textbook Library.');
    err.statusCode = 403;
    throw err;
  }
  if (row.drive_available === false) {
    const err: any = new Error('Original Google Drive PDF is currently unavailable.');
    err.statusCode = 404;
    throw err;
  }

  const { client } = await getAuthenticatedDriveClient();
  const drive = google.drive({ version: 'v3', auth: client });

  const mediaRes = await drive.files.get(
    { fileId: row.google_drive_file_id, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );

  if (params.incrementDownloadCount) {
    pool
      .query(`UPDATE textbooks SET download_count = COALESCE(download_count, 0) + 1 WHERE id = $1`, [row.id])
      .catch(() => {});
  }

  const rawName = String(row.file_name || `${row.book_name || 'textbook'}.pdf`).trim();
  const safeName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;

  return {
    stream: mediaRes.data as unknown as Readable,
    fileName: safeName,
    fileSize: Number(row.file_size || 0),
    mimeType: 'application/pdf',
  };
}

export async function getDriveConnectionSummary(reqHostHint?: string): Promise<DriveConnectionSummary> {
  await ensureDriveOAuthSchema();
  const cfg = validateDriveOAuthConfig(reqHostHint);

  const [connRes, countsRes, lastLogRes, failedLogsRes] = await Promise.all([
    pool.query(`SELECT * FROM google_drive_connections ORDER BY updated_at DESC LIMIT 1`),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL)::int AS synced_total,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND UPPER(COALESCE(publication_status, 'PENDING_REVIEW')) = 'PENDING_REVIEW')::int AS pending_review,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND UPPER(COALESCE(review_status, '')) = 'APPROVED')::int AS approved,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND UPPER(COALESCE(publication_status, '')) = 'PUBLISHED')::int AS published,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND UPPER(COALESCE(publication_status, '')) = 'REJECTED')::int AS rejected,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND drive_available = false)::int AS unavailable_files
      FROM textbooks
    `),
    pool.query(`
      SELECT status, discovered_count, completed_at, started_at, error_details
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
  let tokenStatus: 'VALID' | 'EXPIRED' | 'REVOKED' | 'MISSING' = 'MISSING';

  if (!conn) {
    uiStatus = 'NOT_CONNECTED';
    tokenStatus = 'MISSING';
  } else if (conn.connection_status === 'REAUTHORIZATION_REQUIRED') {
    uiStatus = 'REAUTHORIZATION_REQUIRED';
    tokenStatus = 'REVOKED';
  } else if (conn.connection_status === 'TOKEN_EXPIRED') {
    uiStatus = 'TOKEN_EXPIRED';
    tokenStatus = 'EXPIRED';
  } else if (conn.connection_status === 'CONNECTION_FAILED') {
    uiStatus = 'CONNECTION_FAILED';
    tokenStatus = 'VALID';
  } else if (conn.connection_status === 'VERIFIED' && conn.drive_api_accessible) {
    uiStatus = 'VERIFIED';
    tokenStatus = 'VALID';
  } else {
    uiStatus = 'CONNECTED';
    tokenStatus = 'VALID';
  }

  const syncedTotal = Number(countsRow.synced_total || 0);
  const lastDiscovered = Math.max(syncedTotal, Number(lastLog?.discovered_count || 0));

  return {
    status: uiStatus,
    connected: Boolean(conn && ['CONNECTED', 'VERIFIED'].includes(uiStatus)),
    verified: uiStatus === 'VERIFIED',
    configured: cfg.valid,
    accountEmail: conn?.account_email || null,
    accountName: conn?.account_name || null,
    adminId: conn?.admin_id ?? null,
    adminUsername: conn?.admin_username || null,
    oauthVerified: Boolean(conn && ['CONNECTED', 'VERIFIED'].includes(uiStatus)),
    driveApiAccessible: Boolean(conn?.drive_api_accessible),
    tokenStatus,
    folderAccessible: Boolean(conn?.folder_accessible),
    folderId: conn?.folder_id || cleanEnvValue(process.env.GOOGLE_DRIVE_TEXTBOOKS_FOLDER_ID) || null,
    folderName: conn?.folder_name || cleanEnvValue(process.env.GOOGLE_DRIVE_TEXTBOOKS_FOLDER_NAME) || DEFAULT_TEXTBOOKS_FOLDER_NAME,
    redirectUri: cfg.redirectUri,
    scopes: DRIVE_OAUTH_SCOPES,
    connectedAt: conn?.connected_at ? new Date(conn.connected_at).toISOString() : null,
    lastVerifiedAt: conn?.last_verified_at ? new Date(conn.last_verified_at).toISOString() : null,
    lastSyncAt: lastLog?.completed_at || lastLog?.started_at || null,
    lastError: conn?.last_error || (lastLog?.status === 'SYNC_FAILED' ? lastLog.error_details : null) || (!cfg.valid ? cfg.errors.join(' ') : null),
    counts: {
      drivePdfsDiscovered: lastDiscovered,
      synchronizedBooks: syncedTotal,
      pendingReview: Number(countsRow.pending_review || 0),
      approved: Number(countsRow.approved || 0),
      publishedTextbooks: Number(countsRow.published || 0),
      rejected: Number(countsRow.rejected || 0),
      failedSync: Number(failedLogsRes.rows[0]?.failed_runs || 0),
      unavailableFiles: Number(countsRow.unavailable_files || 0),
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
