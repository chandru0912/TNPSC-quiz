import { apiFetch } from './api'

export const MAX_PDF_UPLOAD_BYTES = 200 * 1024 * 1024 // 200 MB

export type UploadStorageProvider = 'gcs' | 'google_drive' | 'local_chunked'

export interface LargePdfUploadProgress {
  stage: 'initiating' | 'uploading' | 'verifying' | 'done'
  provider?: UploadStorageProvider
  filename: string
  bytesUploaded: number
  totalBytes: number
  percent: number
}

export interface LargePdfUploadResult {
  uploadId: string
  provider: UploadStorageProvider
  actualSha256: string | null
  fileSizeBytes: number
}

async function sleep(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function withRetries<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < maxRetries) {
        await sleep(500 * attempt)
      }
    }
  }
  throw lastErr
}

/**
 * Uploads a large PDF (up to 200 MB) directly to cloud object storage (GCS / Google Drive)
 * or via resumable disk-streamed chunks (local dev), never sending large binary bodies
 * through Vercel serverless API request limits.
 */
export async function uploadLargePdfDirect(params: {
  file: File
  purpose: 'question_pdf' | 'answer_key_pdf'
  token: string
  onProgress?: (progress: LargePdfUploadProgress) => void
}): Promise<LargePdfUploadResult> {
  const { file, purpose, token, onProgress } = params

  if (file.size <= 0) {
    throw new Error('Selected PDF file is empty (0 bytes).')
  }
  if (file.size > MAX_PDF_UPLOAD_BYTES) {
    throw new Error(
      `PDF file exceeds the maximum supported size of ${Math.round(MAX_PDF_UPLOAD_BYTES / (1024 * 1024))} MB.`
    )
  }

  onProgress?.({
    stage: 'initiating',
    filename: file.name,
    bytesUploaded: 0,
    totalBytes: file.size,
    percent: 0,
  })

  // 1. Initiate direct-to-storage / resumable session (tiny JSON request)
  const initRes = await apiFetch('/api/admin/previous-papers/uploads/init', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: file.name,
      fileSizeBytes: file.size,
      contentType: file.type || 'application/pdf',
      purpose,
    }),
  })
  const initJson = await initRes.json().catch(() => ({}))
  if (!initRes.ok || initJson.status !== 'success' || !initJson.data) {
    throw new Error(initJson.message || 'Failed to initialize direct PDF upload session.')
  }

  const {
    uploadId,
    provider,
    uploadUrl,
    chunkEndpoint,
    chunkSizeBytes,
  }: {
    uploadId: string
    provider: UploadStorageProvider
    uploadUrl: string | null
    chunkEndpoint: string | null
    chunkSizeBytes: number
  } = initJson.data

  const effectiveChunkSize = Math.max(256 * 1024, Number(chunkSizeBytes) || 3 * 1024 * 1024)
  let driveFileId: string | null = null

  // 2. Stream resumable chunks directly to GCS / Google Drive or local disk chunk endpoint
  let offset = 0
  while (offset < file.size) {
    const endExclusive = Math.min(offset + effectiveChunkSize, file.size)
    const endInclusive = endExclusive - 1
    const chunkBlob = file.slice(offset, endExclusive)

    if ((provider === 'gcs' || provider === 'google_drive') && uploadUrl) {
      const chunkResp = await withRetries(async () => {
        const res = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Range': `bytes ${offset}-${endInclusive}/${file.size}`,
          },
          body: chunkBlob,
        })
        // 308 Resume Incomplete is the standard success status for intermediate chunks in GCS & Google Drive
        if (res.status !== 200 && res.status !== 201 && res.status !== 308) {
          const text = await res.text().catch(() => '')
          throw new Error(`Direct storage upload failed at byte ${offset} (HTTP ${res.status}): ${text.slice(0, 180)}`)
        }
        return res
      })

      if (provider === 'google_drive' && (chunkResp.status === 200 || chunkResp.status === 201)) {
        const driveJson = await chunkResp.json().catch(() => null)
        if (driveJson?.id) {
          driveFileId = String(driveJson.id)
        }
      }
    } else if (provider === 'local_chunked' && chunkEndpoint) {
      await withRetries(async () => {
        const res = await apiFetch(chunkEndpoint, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
            'X-Chunk-Start': String(offset),
          },
          body: chunkBlob,
        })
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.message || `Chunk upload failed at byte ${offset} (HTTP ${res.status})`)
        }
      })
    } else {
      throw new Error('Upload session did not return a valid storage target.')
    }

    offset = endExclusive
    const percent = Math.min(99, Math.round((offset / file.size) * 100))
    onProgress?.({
      stage: 'uploading',
      provider,
      filename: file.name,
      bytesUploaded: offset,
      totalBytes: file.size,
      percent,
    })
  }

  // 3. Verify upload completion, %PDF- header, size, and SHA-256 integrity on backend
  onProgress?.({
    stage: 'verifying',
    provider,
    filename: file.name,
    bytesUploaded: file.size,
    totalBytes: file.size,
    percent: 99,
  })

  const completeRes = await apiFetch(`/api/admin/previous-papers/uploads/${uploadId}/complete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      driveFileId,
    }),
  })
  const completeJson = await completeRes.json().catch(() => ({}))
  if (!completeRes.ok || completeJson.status !== 'success' || !completeJson.data) {
    throw new Error(completeJson.message || 'Uploaded PDF failed integrity verification.')
  }

  onProgress?.({
    stage: 'done',
    provider,
    filename: file.name,
    bytesUploaded: file.size,
    totalBytes: file.size,
    percent: 100,
  })

  return {
    uploadId,
    provider,
    actualSha256: completeJson.data.actualSha256 || null,
    fileSizeBytes: Number(completeJson.data.fileSizeBytes || file.size),
  }
}
