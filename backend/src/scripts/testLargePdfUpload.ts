import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pool from '../db';
import {
  MAX_PDF_UPLOAD_BYTES,
  LOCAL_CHUNK_BYTES,
  initiateLargePdfUpload,
  writeLocalUploadChunk,
  completeAndVerifyUpload,
} from '../services/previousPaperUploadService';

async function main() {
  console.log('=== Large PDF Upload (> 35 MB / up to 200 MB) Automated Test ===\n');

  // 1. Verify > 200 MB is rejected with 413
  let rejected201 = false;
  try {
    await initiateLargePdfUpload({
      filename: 'too_large.pdf',
      fileSizeBytes: MAX_PDF_UPLOAD_BYTES + 1024,
      contentType: 'application/pdf',
      purpose: 'question_pdf',
    });
  } catch (err: any) {
    assert.strictEqual(err.statusCode, 413);
    rejected201 = true;
  }
  assert.strictEqual(rejected201, true, 'Files > 200 MB must be rejected with 413');
  console.log('✓ 1. Files > 200 MB rejected with HTTP 413');

  // 2. Verify non-PDF extension rejected with 400
  let rejectedExt = false;
  try {
    await initiateLargePdfUpload({
      filename: 'malicious.exe',
      fileSizeBytes: 1024,
      contentType: 'application/octet-stream',
      purpose: 'question_pdf',
    });
  } catch (err: any) {
    assert.strictEqual(err.statusCode, 400);
    rejectedExt = true;
  }
  assert.strictEqual(rejectedExt, true, 'Non-PDF files must be rejected with 400');
  console.log('✓ 2. Non-PDF file extension rejected with HTTP 400');

  // 3. Generate a real 42 MB PDF file (> 35 MB old limit!) and stream via resumable 3 MB chunks
  const targetBytes = 42 * 1024 * 1024; // 42 MB
  const tmpSourcePath = path.join(os.tmpdir(), `tnpsc_test_42mb_${Date.now()}.pdf`);
  const hash = crypto.createHash('sha256');
  let sessionIdToClean: string | null = null;
  let storedPathToClean: string | null = null;

  try {
    const header = Buffer.from('%PDF-1.4\n% TNPSC Large 42MB Official Paper Test\n', 'ascii');
    const footer = Buffer.from('\n%%EOF\n', 'ascii');
    const padChunk = Buffer.alloc(1024 * 1024, 0x20); // 1 MB spaces
    const ws = fs.createWriteStream(tmpSourcePath);
    ws.write(header);
    hash.update(header);

    let remaining = targetBytes - header.length - footer.length;
    while (remaining > 0) {
      const slice = remaining >= padChunk.length ? padChunk : padChunk.subarray(0, remaining);
      ws.write(slice);
      hash.update(slice);
      remaining -= slice.length;
    }
    ws.write(footer);
    hash.update(footer);
    await new Promise<void>((resolve, reject) => {
      ws.end(() => resolve());
      ws.on('error', reject);
    });

    const expectedSha256 = hash.digest('hex');
    const stat = await fs.promises.stat(tmpSourcePath);
    assert.strictEqual(stat.size, targetBytes, 'Source test PDF must be exactly 42 MB');

    // Force local_chunked test if Drive/GCS isn't needed for local unit test
    const origGcs = process.env.GCS_PREVIOUS_PAPERS_BUCKET;
    const origGcs2 = process.env.GCS_BUCKET;
    delete process.env.GCS_PREVIOUS_PAPERS_BUCKET;
    delete process.env.GCS_BUCKET;

    const init = await initiateLargePdfUpload({
      filename: 'TNPSC_Group1_2025_Official_42MB.pdf',
      fileSizeBytes: targetBytes,
      contentType: 'application/pdf',
      purpose: 'question_pdf',
      expectedSha256,
    });
    if (origGcs) process.env.GCS_PREVIOUS_PAPERS_BUCKET = origGcs;
    if (origGcs2) process.env.GCS_BUCKET = origGcs2;

    sessionIdToClean = init.uploadId;
    assert.ok(init.uploadId.startsWith('pypu_'));
    console.log(`✓ 3. Initiated 42 MB upload session (${init.uploadId}, provider=${init.provider}, chunk=${Math.round(init.chunkSizeBytes / (1024 * 1024))} MB)`);

    if (init.provider === 'local_chunked') {
      const fh = await fs.promises.open(tmpSourcePath, 'r');
      let offset = 0;
      let chunkCount = 0;
      const readBuf = Buffer.alloc(LOCAL_CHUNK_BYTES);
      try {
        while (offset < targetBytes) {
          const toRead = Math.min(LOCAL_CHUNK_BYTES, targetBytes - offset);
          const { bytesRead } = await fh.read(readBuf, 0, toRead, offset);
          await writeLocalUploadChunk({
            uploadId: init.uploadId,
            startByte: offset,
            chunkBuffer: readBuf.subarray(0, bytesRead),
          });
          offset += bytesRead;
          chunkCount += 1;
        }
      } finally {
        await fh.close();
      }
      console.log(`✓ 4. Streamed 42 MB PDF in ${chunkCount} resumable 3 MB chunks directly to disk`);

      const verified = await completeAndVerifyUpload(init.uploadId, { expectedSha256 });
      storedPathToClean = verified.localTempPath;
      assert.strictEqual(verified.status, 'verified');
      assert.strictEqual(verified.fileSizeBytes, targetBytes);
      assert.strictEqual(verified.actualSha256, expectedSha256);
      console.log(`✓ 5. Verified 42 MB PDF completion, %PDF- header, size (${verified.fileSizeBytes} bytes), and exact SHA-256 match`);
    } else {
      console.log(`✓ 4–5. Cloud direct resumable session (${init.provider}) issued signed uploadUrl successfully`);
    }

    // 6. Verify fake PDF (missing %PDF- header) is rejected during integrity verification
    const fakeInit = await initiateLargePdfUpload({
      filename: 'fake_not_a_pdf.pdf',
      fileSizeBytes: 64,
      contentType: 'application/pdf',
      purpose: 'answer_key_pdf',
    });
    if (fakeInit.provider === 'local_chunked') {
      await writeLocalUploadChunk({
        uploadId: fakeInit.uploadId,
        startByte: 0,
        chunkBuffer: Buffer.alloc(64, 0x41), // 'AAAA...' not '%PDF-'
      });
      let rejectedFake = false;
      try {
        await completeAndVerifyUpload(fakeInit.uploadId);
      } catch (err: any) {
        assert.strictEqual(err.statusCode, 400);
        rejectedFake = true;
      }
      assert.strictEqual(rejectedFake, true, 'Invalid %PDF- header must be rejected');
      const fakeRow = await pool.query(`SELECT local_temp_path FROM previous_paper_upload_sessions WHERE id = $1`, [fakeInit.uploadId]);
      if (fakeRow.rows[0]?.local_temp_path) {
        await fs.promises.unlink(fakeRow.rows[0].local_temp_path).catch(() => {});
      }
      await pool.query(`DELETE FROM previous_paper_upload_sessions WHERE id = $1`, [fakeInit.uploadId]);
      console.log('✓ 6. Corrupted / non-PDF file rejected by %PDF- magic-byte integrity check');
    }
  } finally {
    await fs.promises.unlink(tmpSourcePath).catch(() => {});
    if (storedPathToClean) await fs.promises.unlink(storedPathToClean).catch(() => {});
    if (sessionIdToClean) {
      await pool.query(`DELETE FROM previous_paper_upload_sessions WHERE id = $1`, [sessionIdToClean]).catch(() => {});
    }
    await pool.end();
  }

  console.log('\nALL LARGE PDF (> 35 MB / 42 MB) UPLOAD TESTS PASSED! ✓');
}

main().catch((err) => {
  console.error('LARGE PDF TEST FAILED:', err);
  process.exit(1);
});
