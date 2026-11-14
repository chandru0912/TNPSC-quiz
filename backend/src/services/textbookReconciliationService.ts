import pool from '../db';

/**
 * Verified 27 English Medium Google Drive File IDs from the read-only reconciliation audit.
 * Keyed strictly by `google_drive_file_id` (never by filename alone).
 */
export const VERIFIED_ENGLISH_MEDIUM_DRIVE_IDS: ReadonlySet<string> = new Set([
  '1YigwNDAjK1vpp_1ZjD1W1AFG3yfUMIZJ', // 6th Mathematics Term 1
  '1cD-9yc7lAsQZxxEN75Lg4xFLVQbLu_ij', // 6th Science Term 1
  '1BstE-GUlUO1V8XwlcTpiqpS-ZMh3nkyw', // 7th Mathematics Term 1
  '1xqpDv7SwYoCKe4_I9qZ0tLuX3rF4-zOZ', // 6th Social Science Term 1
  '1A3Qz3kLvQaNnniBOOFxgn-IQ0VhtlWEh', // 7th Science Term 1
  '1dm1jtHgzyr6-2R0uq6WriAE0WKESFG5L', // 7th Social Science Term 1
  '1tMPloCLkA1er63Hwqo3Qw4umoC9aZoTK', // 7th Science Term 2
  '1KnPIKOMnaj_zt02RRZE3wLYbvgUImNmv', // 7th Social Science Term 2
  '1vxPsYsh3mFWBfldskc1AbgZUXN2qTfrH', // 7th Mathematics Term 2
  '1ZJF9Ba5O1eYcUoIJXHofCYWF4I0IzBYk', // 7th Mathematics Term 3
  '1GtBwJlJuo5eY8lhidF3yfwrMzZhnFFUb', // 7th Social Science Term 3
  '1QCB1DNLKVOkXoB-stwG9b4FWx1iAYhho', // 7th Science Term 3
  '1SP0DbrBvMDA2Oc5YKy2hD0dpjqFT7iNf', // 6th Mathematics Term 2
  '1ZlcqcEgNT1_-WrCrh9pQd7yAfLLVOfR9', // 6th Science Term 2
  '10ksqR25e9oshsMNrWk1D4NdFTi_itjfI', // 6th Social Science Term 2
  '1kp5xOHq6EXXp_hStbqSNx4I9SgDB9RoM', // 6th Mathematics Term 3
  '1TXu-HsNLIxGgdVN8tlTIT3t7tCy3QQ8M', // 6th Social Science Term 3
  '1S4p52RDzaDdZtaRyKQ-P0smVrEn-wmI2', // 6th Science Term 3
  '1dJzBEGuvYZjxVd5E2kVuVxrRfBzraofL', // 8th Science Term 1
  '1FQIYh3OZ8gnxI4cJ-trtKR0x47Mvb6XZ', // 8th Mathematics Term 1
  '1p1OoxmUDV1qv-7e-Qx6GKsqjstz8nRNH', // 8th Social Science Term 1
  '1chHfILrICmk8C6kyh2ZFrc_-N_Y14KNv', // 9th Science Term 1
  '1r2TbX57WBym0YZJw1ui6nFLF9WBhTq53', // 9th Social Science Term 1
  '1VZlnmXDAt_Y5uaQG4mrzyW35vnfVe5lq', // 9th Mathematics Term 1
  '1lBb_blWNhIZylr2t_BtYGZ-6svr25VzL', // 10th Science Full Year
  '1-HhymZ8j06zg0WVkANq5ZFk5oXtovpPz', // 10th Mathematics Full Year
  '1nFhg8k_G6AcwjPsRgFIhGiEV08QAxvF2', // 10th Social Science Full Year
]);

let textbookSchemaEnsured = false;

export async function ensureTextbookDriveIdSchema(): Promise<void> {
  if (textbookSchemaEnsured) return;
  await pool.query(`
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS google_drive_file_id VARCHAR(255);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_textbooks_google_drive_file_id
      ON textbooks (google_drive_file_id)
      WHERE google_drive_file_id IS NOT NULL;
  `);
  textbookSchemaEnsured = true;
}

function toEnglishFileName(fileName: string): string {
  if (!fileName) return 'English Medium.pdf';
  if (/tamil medium/i.test(fileName)) {
    return fileName.replace(/tamil medium/gi, 'English Medium');
  }
  if (/english medium/i.test(fileName)) {
    return fileName;
  }
  return fileName.replace(/\.pdf$/i, '') + ' - English Medium.pdf';
}

function toBookNameWithoutExt(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').trim();
}

export interface ReconciliationResult {
  dryRun: boolean;
  activeDrivePdfs: number;
  englishDrivePdfsFound: number;
  englishDriveMaterialsUpdated: number;
  englishTextbooksInserted: number;
  englishTextbooksUpdated: number;
  existingTextbooksBackfilled: number;
  uniqueMappedTextbooks: number;
  unmappedActiveDrivePdfs: number;
  duplicateMappings: number;
  details: {
    englishUpdated: Array<{ googleDriveFileId: string; oldFileName: string; newFileName: string; textbookId: number }>;
    backfilled: Array<{ textbookId: number; bookName: string; googleDriveFileId: string }>;
    unmappedDriveIds: string[];
  };
}

/**
 * Safely reconciles `google_drive_materials` and `textbooks` using `google_drive_file_id`:
 * - Corrects the 27 verified English Medium PDFs (`medium = 'English'`, `file_name = '...English Medium.pdf'`)
 * - Inserts/updates their 27 English Medium `textbooks` records linked by `google_drive_file_id`
 * - Backfills `google_drive_file_id` onto the 45 existing matched `textbooks` records without duplicating or overwriting extraction data
 * - Supports `dryRun: true` (executes inside a transaction and rolls back)
 */
export async function reconcileTextbooksWithDrive(options: { dryRun?: boolean } = {}): Promise<ReconciliationResult> {
  const dryRun = Boolean(options.dryRun);
  await ensureTextbookDriveIdSchema();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const activeRes = await client.query(
      `SELECT id, file_name, original_file_name, file_size, google_drive_file_id,
              tnpsc_group, subject, standard, term, medium,
              page_count, total_pages, native_pages, ocr_pages, failed_pages,
              completion_percentage, extraction_status, extraction_method, pdf_type, extracted_at
       FROM google_drive_materials
       WHERE COALESCE(sync_status, 'ACTIVE') = 'ACTIVE'
         AND google_drive_file_id IS NOT NULL
       ORDER BY id ASC`
    );

    const activeMaterials = activeRes.rows;
    const englishUpdated: ReconciliationResult['details']['englishUpdated'] = [];
    const backfilled: ReconciliationResult['details']['backfilled'] = [];

    let englishDrivePdfsFound = 0;
    let englishDriveMaterialsUpdated = 0;
    let englishTextbooksInserted = 0;
    let englishTextbooksUpdated = 0;
    let existingTextbooksBackfilled = 0;

    // 1. Process the 27 verified English Medium Drive File IDs first
    for (const mat of activeMaterials) {
      if (!VERIFIED_ENGLISH_MEDIUM_DRIVE_IDS.has(mat.google_drive_file_id)) continue;
      englishDrivePdfsFound++;

      const newFileName = toEnglishFileName(mat.file_name);
      const bookName = toBookNameWithoutExt(newFileName);

      if (mat.medium !== 'English' || mat.file_name !== newFileName) {
        await client.query(
          `UPDATE google_drive_materials
           SET medium = 'English',
               file_name = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [newFileName, mat.id]
        );
        englishDriveMaterialsUpdated++;
      }

      // Check if a textbook already exists for this exact google_drive_file_id
      const byDriveRes = await client.query(
        `SELECT id FROM textbooks WHERE google_drive_file_id = $1 LIMIT 1`,
        [mat.google_drive_file_id]
      );

      let textbookId: number;
      if (byDriveRes.rows.length > 0) {
        textbookId = Number(byDriveRes.rows[0].id);
        await client.query(
          `UPDATE textbooks
           SET medium = 'English',
               book_name = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [bookName, textbookId]
        );
        englishTextbooksUpdated++;
      } else {
        // Check if an unlinked English Medium textbook already exists for (standard, subject, term, medium='English')
        const byTupleRes = await client.query(
          `SELECT id FROM textbooks
           WHERE google_drive_file_id IS NULL
             AND standard = $1
             AND LOWER(subject) = LOWER($2)
             AND LOWER(COALESCE(medium, '')) = 'english'
             AND LOWER(COALESCE(term, 'Full Year')) = LOWER($3)
           ORDER BY id ASC
           LIMIT 1`,
          [mat.standard || 6, mat.subject || 'General Studies', mat.term || 'Full Year']
        );

        if (byTupleRes.rows.length > 0) {
          textbookId = Number(byTupleRes.rows[0].id);
          await client.query(
            `UPDATE textbooks
             SET google_drive_file_id = $1,
                 book_name = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [mat.google_drive_file_id, bookName, textbookId]
          );
          englishTextbooksUpdated++;
        } else {
          const insRes = await client.query(
            `INSERT INTO textbooks (
               group_id, standard, subject, medium, term, book_name,
               file_size, page_count, status, pdf_type, total_pages,
               native_pages, ocr_pages, failed_pages, completion_percentage,
               extraction_status, extraction_method, extracted_at, google_drive_file_id
             )
             VALUES ($1, $2, $3, 'English', $4, $5, $6, $7, 'completed', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
             RETURNING id`,
            [
              mat.tnpsc_group || 'group4',
              mat.standard || 6,
              mat.subject || 'General Studies',
              mat.term || 'Full Year',
              bookName,
              Number(mat.file_size || 0),
              mat.page_count || mat.total_pages || 0,
              mat.pdf_type || 'UNKNOWN',
              mat.total_pages || mat.page_count || 0,
              mat.native_pages || 0,
              mat.ocr_pages || 0,
              mat.failed_pages || 0,
              mat.completion_percentage || 0,
              mat.extraction_status || 'PENDING',
              mat.extraction_method || 'native',
              mat.extracted_at || null,
              mat.google_drive_file_id,
            ]
          );
          textbookId = Number(insRes.rows[0].id);
          englishTextbooksInserted++;
        }
      }

      englishUpdated.push({
        googleDriveFileId: mat.google_drive_file_id,
        oldFileName: mat.file_name,
        newFileName,
        textbookId,
      });
    }

    // 2. Backfill google_drive_file_id onto the remaining 45 existing matched textbook records
    for (const mat of activeMaterials) {
      if (VERIFIED_ENGLISH_MEDIUM_DRIVE_IDS.has(mat.google_drive_file_id)) continue;

      const alreadyLinked = await client.query(
        `SELECT id FROM textbooks WHERE google_drive_file_id = $1 LIMIT 1`,
        [mat.google_drive_file_id]
      );
      if (alreadyLinked.rows.length > 0) continue;

      const cleanBookName = toBookNameWithoutExt(mat.file_name);
      const matchRes = await client.query(
        `SELECT id, book_name FROM textbooks
         WHERE google_drive_file_id IS NULL
           AND (
             LOWER(book_name) = LOWER($1)
             OR LOWER(book_name) = LOWER($2)
             OR (
               standard = $3
               AND LOWER(subject) = LOWER($4)
               AND LOWER(COALESCE(medium, 'Tamil')) = LOWER($5)
               AND LOWER(COALESCE(term, 'Full Year')) = LOWER($6)
             )
           )
         ORDER BY id ASC
         LIMIT 1`,
        [
          cleanBookName,
          mat.file_name,
          mat.standard || 6,
          mat.subject || 'General Studies',
          mat.medium || 'Tamil',
          mat.term || 'Full Year',
        ]
      );

      if (matchRes.rows.length > 0) {
        const tb = matchRes.rows[0];
        await client.query(
          `UPDATE textbooks
           SET google_drive_file_id = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [mat.google_drive_file_id, tb.id]
        );
        existingTextbooksBackfilled++;
        backfilled.push({
          textbookId: Number(tb.id),
          bookName: tb.book_name,
          googleDriveFileId: mat.google_drive_file_id,
        });
      }
    }

    // 3. Verify final mapping integrity inside the same transaction
    const mappedRes = await client.query(
      `SELECT g.google_drive_file_id, t.id AS textbook_id
       FROM google_drive_materials g
       LEFT JOIN textbooks t ON t.google_drive_file_id = g.google_drive_file_id
       WHERE COALESCE(g.sync_status, 'ACTIVE') = 'ACTIVE'
         AND g.google_drive_file_id IS NOT NULL`
    );

    const unmappedDriveIds = mappedRes.rows
      .filter((r) => !r.textbook_id)
      .map((r) => r.google_drive_file_id);

    const dupRes = await client.query(
      `SELECT google_drive_file_id, COUNT(*)::int AS cnt
       FROM textbooks
       WHERE google_drive_file_id IS NOT NULL
       GROUP BY google_drive_file_id
       HAVING COUNT(*) > 1`
    );

    const uniqueMappedRes = await client.query(
      `SELECT COUNT(DISTINCT google_drive_file_id)::int AS cnt
       FROM textbooks
       WHERE google_drive_file_id IS NOT NULL`
    );

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }

    return {
      dryRun,
      activeDrivePdfs: activeMaterials.length,
      englishDrivePdfsFound,
      englishDriveMaterialsUpdated,
      englishTextbooksInserted,
      englishTextbooksUpdated,
      existingTextbooksBackfilled,
      uniqueMappedTextbooks: Number(uniqueMappedRes.rows[0]?.cnt || 0),
      unmappedActiveDrivePdfs: unmappedDriveIds.length,
      duplicateMappings: dupRes.rows.length,
      details: {
        englishUpdated,
        backfilled,
        unmappedDriveIds,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Strictly read-only comparison between Textbook #55 and Textbook #8.
 */
export async function compareTextbooks55And8() {
  const [tbRes, tcRes, qRes, jobRes] = await Promise.all([
    pool.query(`SELECT * FROM textbooks WHERE id IN (55, 8) ORDER BY id ASC`),
    pool.query(`SELECT textbook_id, COUNT(*)::int AS page_rows FROM textbook_content WHERE textbook_id IN (55, 8) GROUP BY textbook_id`),
    pool.query(`SELECT textbook_id, COUNT(*)::int AS question_rows FROM questions WHERE textbook_id IN (55, 8) GROUP BY textbook_id`),
    pool.query(`SELECT textbook_id, COUNT(*)::int AS job_rows FROM textbook_processing_jobs WHERE textbook_id IN (55, 8) GROUP BY textbook_id`),
  ]);

  const tcMap = new Map(tcRes.rows.map((r) => [Number(r.textbook_id), Number(r.page_rows)]));
  const qMap = new Map(qRes.rows.map((r) => [Number(r.textbook_id), Number(r.question_rows)]));
  const jobMap = new Map(jobRes.rows.map((r) => [Number(r.textbook_id), Number(r.job_rows)]));

  return tbRes.rows.map((r) => ({
    id: r.id,
    bookName: r.book_name,
    standard: r.standard,
    subject: r.subject,
    medium: r.medium,
    term: r.term,
    fileSize: Number(r.file_size || 0),
    status: r.status,
    extractionStatus: r.extraction_status,
    totalPages: r.total_pages || r.page_count || 0,
    googleDriveFileId: r.google_drive_file_id || null,
    extractedContentRows: tcMap.get(Number(r.id)) || 0,
    referencedQuestions: qMap.get(Number(r.id)) || 0,
    processingJobs: jobMap.get(Number(r.id)) || 0,
    createdAt: r.created_at,
  }));
}
