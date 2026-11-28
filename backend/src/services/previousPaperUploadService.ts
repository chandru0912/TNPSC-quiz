import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Storage } from '@google-cloud/storage';
import pool from '../db';
import {
  getConnectionStatus,
  getFileStream,
  initiateResumableUpload as initiateDriveResumableUpload,
  verifyUploadedFile as verifyDriveUploadedFile,
} from './googleDriveService';

export const MAX_PDF_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB
export const CLOUD_RESUMABLE_CHUNK_BYTES = 8 * 1024 * 1024; // 8 MB (multiple of 256 KB for GCS/Drive)
export const LOCAL_CHUNK_BYTES = 3 * 1024 * 1024; // 3 MB (safe under proxy/serverless limits)

export type UploadStorageProvider = 'gcs' | 'google_drive' | 'local_chunked';
export type UploadPurpose = 'question_pdf' | 'answer_key_pdf';

export interface UploadSessionRecord {
  id: string;
  purpose: UploadPurpose;
  storageProvider: UploadStorageProvider;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  expectedSha256: string | null;
  actualSha256: string | null;
  storageBucket: string | null;
  storageObjectKey: string | null;
  driveFileId: string | null;
  localTempPath: string | null;
  uploadUrl: string | null;
  status: 'initiated' | 'uploading' | 'completed' | 'verified' | 'failed';
  bytesUploaded: number;
  createdAt: string;
  expiresAt: string;
}

let uploadSchemaPromise: Promise<void> | null = null;
let gcsClient: Storage | null = null;
let gcsClientChecked = false;

export async function ensurePreviousPaperUploadSchema(): Promise<void> {
  if (!uploadSchemaPromise) {
    uploadSchemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS previous_paper_upload_sessions (
          id VARCHAR(64) PRIMARY KEY,
          purpose VARCHAR(32) NOT NULL DEFAULT 'question_pdf',
          storage_provider VARCHAR(32) NOT NULL,
          original_filename TEXT NOT NULL,
          content_type VARCHAR(120) NOT NULL DEFAULT 'application/pdf',
          file_size_bytes BIGINT NOT NULL,
          expected_sha256 VARCHAR(64),
          actual_sha256 VARCHAR(64),
          storage_bucket TEXT,
          storage_object_key TEXT,
          drive_file_id TEXT,
          local_temp_path TEXT,
          upload_url TEXT,
          status VARCHAR(24) NOT NULL DEFAULT 'initiated',
          bytes_uploaded BIGINT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '6 hours'),
          completed_at TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS idx_pyp_upload_sessions_status
          ON previous_paper_upload_sessions (status, created_at DESC);
      `);
    })().catch((err) => {
      uploadSchemaPromise = null;
      throw err;
    });
  }
  await uploadSchemaPromise;
}

function getGcsBucketName(): string | null {
  const b = (process.env.GCS_PREVIOUS_PAPERS_BUCKET || process.env.GCS_BUCKET || '').trim();
  return b.length > 0 ? b : null;
}

function getGcsStorageClient(): Storage | null {
  if (gcsClientChecked) return gcsClient;
  gcsClientChecked = true;
  if (!getGcsBucketName()) return null;
  try {
    if (process.env.GOOGLE_VISION_SERVICE_ACCOUNT_KEY) {
      const credentials = JSON.parse(process.env.GOOGLE_VISION_SERVICE_ACCOUNT_KEY);
      gcsClient = new Storage({ credentials });
      return gcsClient;
    }
    if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      gcsClient = new Storage({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
      });
      return gcsClient;
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT) {
      gcsClient = new Storage();
      return gcsClient;
    }
  } catch (err: any) {
    console.warn('[PYP Upload] GCS initialization warning:', err?.message);
  }
  return null;
}

function resolveLocalStagingDir(): string {
  const dir = process.env.VERCEL
    ? path.join(os.tmpdir(), 'tnpsc-pyp-uploads')
    : path.resolve(process.cwd(), 'uploads', 'previous-papers', 'staging_uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function mapRow(r: any): UploadSessionRecord {
  return {
    id: String(r.id),
    purpose: r.purpose as UploadPurpose,
    storageProvider: r.storage_provider as UploadStorageProvider,
    originalFilename: String(r.original_filename),
    contentType: String(r.content_type || 'application/pdf'),
    fileSizeBytes: Number(r.file_size_bytes || 0),
    expectedSha256: r.expected_sha256 || null,
    actualSha256: r.actual_sha256 || null,
    storageBucket: r.storage_bucket || null,
    storageObjectKey: r.storage_object_key || null,
    driveFileId: r.drive_file_id || null,
    localTempPath: r.local_temp_path || null,
    uploadUrl: r.upload_url || null,
    status: r.status,
    bytesUploaded: Number(r.bytes_uploaded || 0),
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  };
}

export async function getUploadSession(uploadId: string): Promise<UploadSessionRecord | null> {
  await ensurePreviousPaperUploadSchema();
  const res = await pool.query(`SELECT * FROM previous_paper_upload_sessions WHERE id = $1`, [uploadId]);
  if (res.rows.length === 0) return null;
  return mapRow(res.rows[0]);
}

/**
 * Computes SHA-256 and verifies the first 5 bytes are "%PDF-" using a constant-memory stream.
 */
async function hashAndValidatePdfStream(
  readable: NodeJS.ReadableStream
): Promise<{ sha256: string; bytesRead: number; isPdfMagic: boolean }> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    let bytesRead = 0;
    let headerChecked = false;
    let isPdfMagic = false;
    const headerChunks: Buffer[] = [];
    let headerLen = 0;

    readable.on('data', (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      hash.update(buf);
      bytesRead += buf.length;
      if (!headerChecked) {
        headerChunks.push(buf);
        headerLen += buf.length;
        if (headerLen >= 5) {
          const head = Buffer.concat(headerChunks).subarray(0, 5).toString('ascii');
          isPdfMagic = head === '%PDF-';
          headerChecked = true;
          headerChunks.length = 0;
        }
      }
    });
    readable.on('end', () => {
      if (!headerChecked && headerLen > 0) {
        const head = Buffer.concat(headerChunks).subarray(0, 5).toString('ascii');
        isPdfMagic = head === '%PDF-';
      }
      resolve({ sha256: hash.digest('hex'), bytesRead, isPdfMagic });
    });
    readable.on('error', reject);
  });
}

/**
 * Initiates a direct-to-object-storage (GCS / Google Drive) or resumable chunked upload session
 * supporting official TNPSC PDFs up to 200 MB without sending file bodies through Vercel serverless limits.
 */
export async function initiateLargePdfUpload(params: {
  filename: string;
  fileSizeBytes: number;
  contentType?: string;
  purpose: UploadPurpose;
  expectedSha256?: string | null;
  origin?: string;
}): Promise<{
  uploadId: string;
  provider: UploadStorageProvider;
  uploadUrl: string | null;
  chunkEndpoint: string | null;
  chunkSizeBytes: number;
  maxBytes: number;
  expiresAt: string;
}> {
  await ensurePreviousPaperUploadSchema();

  const filename = path.basename(String(params.filename || '').trim());
  const contentType = String(params.contentType || 'application/pdf').trim().toLowerCase();
  const fileSizeBytes = Number(params.fileSizeBytes);

  if (!filename || !filename.toLowerCase().endsWith('.pdf')) {
    const err: any = new Error('Invalid file type. Only official PDF (.pdf) files are accepted.');
    err.statusCode = 400;
    throw err;
  }
  if (contentType && contentType !== 'application/pdf' && contentType !== 'application/octet-stream') {
    const err: any = new Error('Invalid MIME type. File must be application/pdf.');
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    const err: any = new Error('File size must be greater than 0 bytes.');
    err.statusCode = 400;
    throw err;
  }
  if (fileSizeBytes > MAX_PDF_UPLOAD_BYTES) {
    const err: any = new Error(
      `PDF exceeds the maximum supported size of ${Math.round(MAX_PDF_UPLOAD_BYTES / (1024 * 1024))} MB.`
    );
    err.statusCode = 413;
    throw err;
  }

  const uploadId = `pypu_${crypto.randomUUID().replace(/-/g, '')}`;
  const safeBase = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 90);
  const objectKey = `previous-papers/${params.purpose}/${Date.now()}_${uploadId}_${safeBase}`;

  // Tier 1: Google Cloud Storage Direct Resumable Signed Upload URL
  const gcsBucketName = getGcsBucketName();
  const storage = getGcsStorageClient();
  if (gcsBucketName && storage) {
    try {
      const file = storage.bucket(gcsBucketName).file(objectKey);
      const [resumableUrl] = await file.createResumableUpload({
        origin: params.origin,
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            uploadId,
            purpose: params.purpose,
            originalFilename: filename,
          },
        },
      });

      const ins = await pool.query(
        `INSERT INTO previous_paper_upload_sessions (
           id, purpose, storage_provider, original_filename, content_type,
           file_size_bytes, expected_sha256, storage_bucket, storage_object_key,
           upload_url, status
         )
         VALUES ($1, $2, 'gcs', $3, 'application/pdf', $4, $5, $6, $7, $8, 'initiated')
         RETURNING expires_at`,
        [
          uploadId,
          params.purpose,
          filename,
          fileSizeBytes,
          params.expectedSha256 || null,
          gcsBucketName,
          objectKey,
          resumableUrl,
        ]
      );

      return {
        uploadId,
        provider: 'gcs',
        uploadUrl: resumableUrl,
        chunkEndpoint: null,
        chunkSizeBytes: CLOUD_RESUMABLE_CHUNK_BYTES,
        maxBytes: MAX_PDF_UPLOAD_BYTES,
        expiresAt: ins.rows[0].expires_at,
      };
    } catch (gcsErr: any) {
      console.warn('[PYP Upload] GCS resumable init failed, falling back:', gcsErr?.message);
    }
  }

  // Tier 2: Google Drive Direct Resumable Upload Session (already integrated in TNPSC Aspirant Orbit!)
  try {
    const driveStatus = await getConnectionStatus();
    if (driveStatus.connected) {
      const driveFileName = `TNPSC_PYP_${params.purpose}_${Date.now()}_${safeBase}`;
      const { uploadUrl } = await initiateDriveResumableUpload({
        fileName: driveFileName,
        fileSize: fileSizeBytes,
        mimeType: 'application/pdf',
        origin: params.origin,
      });

      const ins = await pool.query(
        `INSERT INTO previous_paper_upload_sessions (
           id, purpose, storage_provider, original_filename, content_type,
           file_size_bytes, expected_sha256, storage_object_key, upload_url, status
         )
         VALUES ($1, $2, 'google_drive', $3, 'application/pdf', $4, $5, $6, $7, 'initiated')
         RETURNING expires_at`,
        [
          uploadId,
          params.purpose,
          filename,
          fileSizeBytes,
          params.expectedSha256 || null,
          driveFileName,
          uploadUrl,
        ]
      );

      return {
        uploadId,
        provider: 'google_drive',
        uploadUrl,
        chunkEndpoint: null,
        chunkSizeBytes: CLOUD_RESUMABLE_CHUNK_BYTES,
        maxBytes: MAX_PDF_UPLOAD_BYTES,
        expiresAt: ins.rows[0].expires_at,
      };
    }
  } catch (driveErr: any) {
    console.warn('[PYP Upload] Google Drive resumable init notice:', driveErr?.message);
  }

  // On Vercel Serverless without GCS or Google Drive connected, warn clearly for files > 4 MB
  if (process.env.VERCEL && fileSizeBytes > 4 * 1024 * 1024) {
    const err: any = new Error(
      'Direct cloud object storage is required for PDFs larger than 4 MB on Vercel. Please connect Google Drive in Admin Panel or configure GCS_PREVIOUS_PAPERS_BUCKET in environment variables.'
    );
    err.statusCode = 503;
    throw err;
  }

  // Tier 3: Local Disk Chunked Resumable Upload (streams 3 MB chunks directly to disk — never RAM!)
  const stagingDir = resolveLocalStagingDir();
  const localTempPath = path.join(stagingDir, `${uploadId}_${safeBase}`);
  const fh = await fs.promises.open(localTempPath, 'w');
  await fh.close();

  const ins = await pool.query(
    `INSERT INTO previous_paper_upload_sessions (
       id, purpose, storage_provider, original_filename, content_type,
       file_size_bytes, expected_sha256, local_temp_path, status
     )
     VALUES ($1, $2, 'local_chunked', $3, 'application/pdf', $4, $5, $6, 'initiated')
     RETURNING expires_at`,
    [
      uploadId,
      params.purpose,
      filename,
      fileSizeBytes,
      params.expectedSha256 || null,
      localTempPath,
    ]
  );

  return {
    uploadId,
    provider: 'local_chunked',
    uploadUrl: null,
    chunkEndpoint: `/api/admin/previous-papers/uploads/${uploadId}/chunk`,
    chunkSizeBytes: LOCAL_CHUNK_BYTES,
    maxBytes: MAX_PDF_UPLOAD_BYTES,
    expiresAt: ins.rows[0].expires_at,
  };
}

/**
 * Streams a single chunk directly to disk at exact byte offset (constant memory, resumable).
 */
export async function writeLocalUploadChunk(params: {
  uploadId: string;
  startByte: number;
  chunkBuffer: Buffer;
}): Promise<{ bytesUploaded: number; totalBytes: number }> {
  const session = await getUploadSession(params.uploadId);
  if (!session) {
    const err: any = new Error('Upload session not found.');
    err.statusCode = 404;
    throw err;
  }
  if (session.storageProvider !== 'local_chunked' || !session.localTempPath) {
    const err: any = new Error('This upload session expects direct upload to cloud storage.');
    err.statusCode = 400;
    throw err;
  }
  if (session.status === 'verified') {
    return { bytesUploaded: session.fileSizeBytes, totalBytes: session.fileSizeBytes };
  }
  if (params.startByte < 0 || params.startByte + params.chunkBuffer.length > session.fileSizeBytes) {
    const err: any = new Error('Chunk byte range exceeds declared PDF file size.');
    err.statusCode = 400;
    throw err;
  }

  const fh = await fs.promises.open(session.localTempPath, 'r+');
  try {
    await fh.write(params.chunkBuffer, 0, params.chunkBuffer.length, params.startByte);
  } finally {
    await fh.close();
  }

  const nextBytes = Math.max(session.bytesUploaded, params.startByte + params.chunkBuffer.length);
  await pool.query(
    `UPDATE previous_paper_upload_sessions
     SET bytes_uploaded = $1, status = 'uploading'
     WHERE id = $2`,
    [nextBytes, session.id]
  );

  return { bytesUploaded: nextBytes, totalBytes: session.fileSizeBytes };
}

/**
 * Verifies upload completion, size match, %PDF- magic header, and streaming SHA-256 integrity.
 */
export async function completeAndVerifyUpload(
  uploadId: string,
  payload?: { driveFileId?: string | null; expectedSha256?: string | null }
): Promise<UploadSessionRecord> {
  const session = await getUploadSession(uploadId);
  if (!session) {
    const err: any = new Error('Upload session not found.');
    err.statusCode = 404;
    throw err;
  }

  const expectedHash = (payload?.expectedSha256 || session.expectedSha256 || '').trim().toLowerCase() || null;
  let actualSha256 = '';
  let verifiedBytes = 0;
  let isPdfMagic = false;
  let resolvedDriveId = payload?.driveFileId || session.driveFileId || null;

  if (session.storageProvider === 'gcs') {
    const storage = getGcsStorageClient();
    if (!storage || !session.storageBucket || !session.storageObjectKey) {
      throw new Error('GCS storage configuration is missing for upload verification.');
    }
    const file = storage.bucket(session.storageBucket).file(session.storageObjectKey);
    const [exists] = await file.exists();
    if (!exists) {
      const err: any = new Error('Uploaded PDF object not found in Cloud Storage. Please retry upload.');
      err.statusCode = 400;
      throw err;
    }
    const [meta] = await file.getMetadata();
    const remoteSize = Number(meta.size || 0);
    if (remoteSize !== session.fileSizeBytes) {
      const err: any = new Error(
        `Uploaded size mismatch (${remoteSize} bytes stored vs ${session.fileSizeBytes} bytes expected).`
      );
      err.statusCode = 400;
      throw err;
    }
    const check = await hashAndValidatePdfStream(file.createReadStream());
    actualSha256 = check.sha256;
    verifiedBytes = check.bytesRead;
    isPdfMagic = check.isPdfMagic;
  } else if (session.storageProvider === 'google_drive') {
    if (!resolvedDriveId) {
      const err: any = new Error('Google Drive file ID is required to complete direct Drive upload.');
      err.statusCode = 400;
      throw err;
    }
    const driveMeta = await verifyDriveUploadedFile(resolvedDriveId);
    if (driveMeta.size > 0 && driveMeta.size !== session.fileSizeBytes) {
      const err: any = new Error(
        `Google Drive file size mismatch (${driveMeta.size} bytes vs ${session.fileSizeBytes} bytes expected).`
      );
      err.statusCode = 400;
      throw err;
    }
    const streamRes = await getFileStream(resolvedDriveId);
    const check = await hashAndValidatePdfStream(streamRes.stream);
    actualSha256 = check.sha256;
    verifiedBytes = check.bytesRead;
    isPdfMagic = check.isPdfMagic;
  } else {
    if (!session.localTempPath || !fs.existsSync(session.localTempPath)) {
      const err: any = new Error('Uploaded file not found on storage disk. Please retry upload.');
      err.statusCode = 400;
      throw err;
    }
    const stat = await fs.promises.stat(session.localTempPath);
    if (stat.size !== session.fileSizeBytes) {
      const err: any = new Error(
        `Incomplete upload: received ${stat.size} of ${session.fileSizeBytes} bytes. Please resume or retry.`
      );
      err.statusCode = 400;
      throw err;
    }
    const check = await hashAndValidatePdfStream(fs.createReadStream(session.localTempPath));
    actualSha256 = check.sha256;
    verifiedBytes = check.bytesRead;
    isPdfMagic = check.isPdfMagic;
  }

  if (!isPdfMagic) {
    await pool.query(`UPDATE previous_paper_upload_sessions SET status = 'failed' WHERE id = $1`, [uploadId]);
    const err: any = new Error('Integrity check failed: uploaded file is not a valid PDF document (%PDF- header missing).');
    err.statusCode = 400;
    throw err;
  }

  if (expectedHash && actualSha256.toLowerCase() !== expectedHash) {
    await pool.query(`UPDATE previous_paper_upload_sessions SET status = 'failed' WHERE id = $1`, [uploadId]);
    const err: any = new Error('File integrity checksum mismatch (SHA-256). Please retry upload.');
    err.statusCode = 400;
    throw err;
  }

  const upd = await pool.query(
    `UPDATE previous_paper_upload_sessions
     SET status = 'verified',
         actual_sha256 = $1,
         bytes_uploaded = $2,
         drive_file_id = COALESCE($3, drive_file_id),
         completed_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [actualSha256, verifiedBytes, resolvedDriveId, uploadId]
  );

  return mapRow(upd.rows[0]);
}

/**
 * Streams a verified uploaded PDF to a local temp file for background extraction,
 * returning { filePath, cleanup } so temp files are always cleaned up cleanly.
 */
export async function materializeStoredPdfToTempFile(source: {
  storageProvider?: string | null;
  storageBucket?: string | null;
  storageObjectKey?: string | null;
  driveFileId?: string | null;
  localPath?: string | null;
}): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  if (source.localPath && fs.existsSync(source.localPath)) {
    return { filePath: source.localPath, cleanup: async () => {} };
  }

  const tmpPath = path.join(os.tmpdir(), `tnpsc_pyp_work_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.pdf`);

  if (source.storageProvider === 'gcs' && source.storageBucket && source.storageObjectKey) {
    const storage = getGcsStorageClient();
    if (!storage) throw new Error('GCS client is not configured to download stored PDF.');
    await pipeline(
      storage.bucket(source.storageBucket).file(source.storageObjectKey).createReadStream(),
      fs.createWriteStream(tmpPath)
    );
    return {
      filePath: tmpPath,
      cleanup: async () => {
        await fs.promises.unlink(tmpPath).catch(() => {});
      },
    };
  }

  if (source.storageProvider === 'google_drive' && source.driveFileId) {
    const streamRes = await getFileStream(source.driveFileId);
    await pipeline(streamRes.stream, fs.createWriteStream(tmpPath));
    return {
      filePath: tmpPath,
      cleanup: async () => {
        await fs.promises.unlink(tmpPath).catch(() => {});
      },
    };
  }

  throw new Error('Stored PDF source could not be located in cloud or local storage.');
}
