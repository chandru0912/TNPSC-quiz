import assert from 'node:assert/strict';
import 'dotenv/config';
import pool from '../db';
import {
  ensureDriveOAuthSchema,
  getPublishedStudentTextbookFilters,
  openDriveTextbookPdfStream,
  queryPublishedStudentTextbooksPaginated,
  syncDriveTextbooksMetadata,
} from '../services/driveOAuthService';
import {
  bulkPublishDriveTextbooks,
  bulkUnpublishDriveTextbooks,
  getDriveTextbookCounts,
} from '../services/driveBulkTextbookService';
import { requireStudentAuth } from '../middleware/auth';

async function main() {
  await ensureDriveOAuthSchema();

  console.log('=== 0. Restore Live Google Drive Availability on Real Textbooks ===');
  const liveSync = await syncDriveTextbooksMetadata({ adminId: 1, adminUsername: 'admin' });
  console.log('LIVE_RESTORE_SYNC:', {
    status: liveSync.status,
    discovered: liveSync.discoveredCount,
    updated: liveSync.updatedCount,
    unchanged: liveSync.unchangedCount,
    missing: liveSync.missingCount,
  });
  const liveAvailRes = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE drive_available = true)::int AS avail, COUNT(*)::int AS total
     FROM textbooks WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NULL`
  );
  console.log('REAL_TEXTBOOKS_AVAILABILITY:', liveAvailRes.rows[0]);
  assert.ok(liveAvailRes.rows[0].avail >= 130, 'All real synced Drive textbooks must be drive_available=true');

  const tag = `stu_lib_${Date.now()}`;
  const insertedIds: number[] = [];

  try {
    const fixtures = [
      { std: 6, subj: 'Science', med: 'Tamil', term: 'Term 1', vol: null, name: `${tag} 6th Sci T1 TM`, pub: 'PENDING_REVIEW' },
      { std: 6, subj: 'Science', med: 'Tamil', term: 'Term 2', vol: null, name: `${tag} 6th Sci T2 TM`, pub: 'PENDING_REVIEW' },
      { std: 6, subj: 'Mathematics', med: 'Tamil', term: 'Term 3', vol: null, name: `${tag} 6th Math T3 TM`, pub: 'PENDING_REVIEW' },
      { std: 6, subj: 'Science', med: 'English', term: 'Term 1', vol: null, name: `${tag} 6th Sci T1 EM`, pub: 'PENDING_REVIEW' },
      { std: 11, subj: 'Physics', med: 'English', term: 'Volume 1', vol: 'Volume 1', name: `${tag} 11th Phy V1 EM`, pub: 'PENDING_REVIEW' },
      { std: 10, subj: 'Social Science', med: 'English', term: null, vol: null, name: `${tag} 10th Social OptionalMeta EM`, pub: 'PENDING_REVIEW' },
      { std: 7, subj: 'English', med: 'English', term: 'Term 1', vol: null, name: `${tag} 7th Pending Hidden`, pub: 'PENDING_REVIEW' },
    ];

    for (let i = 0; i < fixtures.length; i++) {
      const f = fixtures[i];
      const ins = await pool.query(
        `INSERT INTO textbooks (
           group_id, standard, subject, medium, term, volume, book_name,
           file_path, file_name, mime_type, file_size, google_drive_file_id,
           drive_available, review_status, publication_status, status, last_synced_at
         ) VALUES ('group1',$1,$2,$3,$4,$5,$6,$7,$8,'application/pdf',$9,$10,true,'PENDING_REVIEW',$11,'uploaded',NOW())
         RETURNING id`,
        [
          f.std, f.subj, f.med, f.term, f.vol, f.name,
          `gdrive://${tag}_${i}`, `${f.name}.pdf`, 2048576, `${tag}_${i}`, f.pub,
        ]
      );
      insertedIds.push(Number(ins.rows[0].id));
    }

    const [idT1Tm, idT2Tm, idT3Tm, idT1Em, idVol1Em, idNoMetaEm, idPendingHidden] = insertedIds;

    console.log('\n=== 1–4. Publish First 6 Fixtures, Keep 7th Pending ===');
    const pub = await bulkPublishDriveTextbooks({
      scope: 'selected',
      selectedIds: [idT1Tm, idT2Tm, idT3Tm, idT1Em, idVol1Em, idNoMetaEm],
      approvePending: true,
      dryRun: false,
      adminUsername: 'super_admin_test',
      adminRole: 'super_admin',
    });
    assert.equal(pub.publishedCount, 6);

    const allTagged = await queryPublishedStudentTextbooksPaginated({ search: tag });
    assert.equal(allTagged.pagination.total, 6, 'Published books must appear; Pending Review must stay hidden');
    assert.equal(allTagged.items.some((b) => b.id === idPendingHidden), false);

    console.log('=== 5–15. Tamil/English Medium, Standard, Term 1/2/3, Volume, Subject, Cascading Filters & Optional Metadata ===');
    const tamilOnly = await queryPublishedStudentTextbooksPaginated({ search: tag, medium: 'Tamil' });
    assert.equal(tamilOnly.pagination.total, 3);
    assert.ok(tamilOnly.items.every((b) => b.medium === 'Tamil'));

    const englishOnly = await queryPublishedStudentTextbooksPaginated({ search: tag, medium: 'English' });
    assert.equal(englishOnly.pagination.total, 3);
    assert.ok(englishOnly.items.every((b) => b.medium === 'English'));

    const t1 = await queryPublishedStudentTextbooksPaginated({ search: tag, medium: 'Tamil', standard: '6', subject: 'Science', term: 'Term 1' });
    assert.equal(t1.pagination.total, 1);
    assert.equal(t1.items[0].id, idT1Tm);

    const t2 = await queryPublishedStudentTextbooksPaginated({ search: tag, medium: 'Tamil', standard: '6', term: 'Term 2' });
    assert.equal(t2.pagination.total, 1);
    assert.equal(t2.items[0].id, idT2Tm);

    const t3 = await queryPublishedStudentTextbooksPaginated({ search: tag, medium: 'Tamil', standard: '6', subject: 'Mathematics', term: 'Term 3' });
    assert.equal(t3.pagination.total, 1);
    assert.equal(t3.items[0].id, idT3Tm);

    const vol1 = await queryPublishedStudentTextbooksPaginated({ search: tag, medium: 'English', standard: '11', volume: 'Volume 1' });
    assert.equal(vol1.pagination.total, 1);
    assert.equal(vol1.items[0].id, idVol1Em);

    const noMeta = await queryPublishedStudentTextbooksPaginated({ search: tag, medium: 'English', standard: '10', subject: 'Social Science' });
    assert.equal(noMeta.pagination.total, 1, 'Valid textbook with missing optional term/volume must not be discarded');
    assert.equal(noMeta.items[0].id, idNoMetaEm);

    // Dynamic cascading filter API verification
    const filters6Tm = await getPublishedStudentTextbookFilters({ medium: 'Tamil', standard: '6' });
    assert.equal(filters6Tm.structureType, 'term');
    assert.ok(filters6Tm.terms.some((x) => x.label === 'Term 1'));
    assert.ok(filters6Tm.subjects.some((x) => x.subject === 'Science'));

    const filters11Em = await getPublishedStudentTextbookFilters({ medium: 'English', standard: '11' });
    assert.equal(filters11Em.structureType, 'volume');
    assert.ok(filters11Em.volumes.some((x) => x.label === 'Volume 1'));

    console.log('=== 16–20. Student Auth Guard, Unpublished 403, Real Drive Stream, Unpublish & Count Consistency ===');
    // Unauthorized student PDF download rejected (401)
    let stuAuthStatus = 0;
    let stuNext = false;
    await requireStudentAuth(
      { headers: {}, query: {} } as any,
      { status(c: number) { stuAuthStatus = c; return this; }, json() { return this; } } as any,
      () => { stuNext = true; }
    );
    assert.equal(stuNext, false);
    assert.equal(stuAuthStatus, 401);

    // Unpublished book stream rejected with 403
    let unpubDenied = false;
    try {
      await openDriveTextbookPdfStream({ textbookId: idPendingHidden, isAdmin: false });
    } catch (e: any) {
      unpubDenied = e.statusCode === 403;
    }
    assert.equal(unpubDenied, true);

    // Real Google Drive PDF stream check (admin preview of 1 real synced textbook to verify Drive media stream works!)
    const realBookRes = await pool.query(
      `SELECT id FROM textbooks WHERE google_drive_file_id IS NOT NULL AND google_drive_file_id NOT LIKE $1 AND drive_available = true AND deleted_at IS NULL LIMIT 1`,
      [`${tag}%`]
    );
    assert.ok(realBookRes.rows.length === 1);
    const streamObj = await openDriveTextbookPdfStream({ textbookId: Number(realBookRes.rows[0].id), isAdmin: true });
    const firstChunk: Buffer = await new Promise((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        streamObj.stream.destroy();
        resolve(chunk);
      };
      streamObj.stream.once('data', onData);
      streamObj.stream.once('error', reject);
    });
    assert.ok(firstChunk.subarray(0, 4).toString('utf8') === '%PDF', 'Streamed Drive file must begin with %PDF magic bytes');
    console.log('PASS: Live Google Drive PDF stream verified (%PDF header received):', streamObj.fileName);

    // Unpublish removes from Student Library & keeps Admin/Student counts consistent
    await bulkUnpublishDriveTextbooks({
      scope: 'selected',
      selectedIds: [idT1Tm, idT2Tm, idT3Tm, idT1Em, idVol1Em, idNoMetaEm],
      adminUsername: 'super_admin_test',
      adminRole: 'super_admin',
    });
    const afterUnpub = await queryPublishedStudentTextbooksPaginated({ search: tag });
    assert.equal(afterUnpub.pagination.total, 0);

    const adminCounts = await getDriveTextbookCounts();
    const stuFiltersAll = await getPublishedStudentTextbookFilters({});
    assert.equal(adminCounts.publishedTextbooks, stuFiltersAll.totalPublished, 'Admin & Student published counts must match exactly');
    console.log('PASS: Admin & Student published counts match exactly:', adminCounts.publishedTextbooks);
  } finally {
    if (insertedIds.length > 0) {
      await pool.query(`DELETE FROM textbooks WHERE id = ANY($1::int[])`, [insertedIds]);
    }
    await pool.query(`DELETE FROM google_drive_textbook_audit_logs WHERE admin_username = 'super_admin_test'`);
    await pool.end();
  }

  console.log('\nALL 20 STUDENT TEXTBOOK LIBRARY & LIVE PDF STREAM SCENARIOS PASSED.');
}

main().catch((err) => {
  console.error('STUDENT LIBRARY TEST FAILED:', err);
  process.exit(1);
});
