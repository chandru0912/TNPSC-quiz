import assert from 'node:assert/strict';
import 'dotenv/config';
import pool from '../db';
import {
  ensureDriveOAuthSchema,
  getPublishedStudentTextbookById,
  listPublishedStudentTextbooks,
} from '../services/driveOAuthService';
import {
  bulkPublishDriveTextbooks,
  bulkSoftDeleteDriveTextbooks,
  bulkUnpublishDriveTextbooks,
  getDriveTextbookAuditLogs,
  getDriveTextbookCounts,
  queryDriveTextbooksPaginated,
  restoreTrashedDriveTextbooks,
} from '../services/driveBulkTextbookService';
import { requireSuperAdminDriveAuth } from '../routes/drive';
import { generateAdminToken } from '../middleware/auth';

async function main() {
  await ensureDriveOAuthSchema();
  const tag = `bulk_test_${Date.now()}`;
  const insertedIds: number[] = [];

  try {
    // Seed 5 isolated test textbook rows (never touching the 136 real Drive textbooks!)
    const seedRows = [
      { std: 6, subj: 'Science', med: 'English', term: 'Term 1', vol: null, name: `${tag} 6th Science T1`, pub: 'PENDING_REVIEW', rev: 'PENDING_REVIEW', avail: true },
      { std: 7, subj: 'Mathematics', med: 'Tamil', term: 'Term 2', vol: null, name: `${tag} 7th Maths T2`, pub: 'PENDING_REVIEW', rev: 'PENDING_REVIEW', avail: true },
      { std: 10, subj: 'Social Science', med: 'English', term: 'Full Year', vol: null, name: `${tag} 10th Social`, pub: 'PENDING_REVIEW', rev: 'APPROVED', avail: true },
      { std: 11, subj: 'Physics', med: 'English', term: 'Volume 1', vol: 'Volume 1', name: `${tag} 11th Physics V1`, pub: 'REJECTED', rev: 'REJECTED', avail: true },
      { std: 12, subj: 'Chemistry', med: 'Tamil', term: 'Volume 2', vol: 'Volume 2', name: `${tag} 12th Chem V2`, pub: 'PENDING_REVIEW', rev: 'PENDING_REVIEW', avail: false },
    ];

    for (let i = 0; i < seedRows.length; i++) {
      const s = seedRows[i];
      const res = await pool.query(
        `INSERT INTO textbooks (
           group_id, standard, subject, medium, term, volume, book_name,
           file_path, file_name, mime_type, file_size, google_drive_file_id,
           drive_available, review_status, publication_status, status, last_synced_at
         ) VALUES ('group1',$1,$2,$3,$4,$5,$6,$7,$8,'application/pdf',$9,$10,$11,$12,$13,'uploaded',NOW())
         RETURNING id`,
        [
          s.std, s.subj, s.med, s.term, s.vol, s.name,
          `gdrive://${tag}_${i}`, `${s.name}.pdf`, (i + 1) * 1024 * 1024, `${tag}_${i}`,
          s.avail, s.rev, s.pub,
        ]
      );
      insertedIds.push(Number(res.rows[0].id));
    }

    const [id1, id2, id3, idRejected, idUnavailable] = insertedIds;

    console.log('=== 1. Real-time Counts, Filtering, Pagination & Sorting ===');
    const countsBefore = await getDriveTextbookCounts();
    assert.ok(countsBefore.totalTextbooks >= 5);

    const page1 = await queryDriveTextbooksPaginated({
      filters: { search: tag },
      page: 1,
      pageSize: 10,
      sortBy: 'standard',
      sortDir: 'asc',
    });
    assert.equal(page1.pagination.total, 5);
    assert.equal(page1.pagination.pageSize, 10);
    assert.equal(page1.pagination.totalPages, 1);
    assert.equal(page1.items.length, 5);
    assert.equal(page1.items[0].standard, 6);
    assert.equal(page1.items[4].standard, 12);

    const tamilFiltered = await queryDriveTextbooksPaginated({
      filters: { search: tag, medium: 'Tamil' },
      page: 1,
      pageSize: 10,
    });
    assert.equal(tamilFiltered.pagination.total, 2);
    console.log('PASS: Counts, filtering, pagination, and sorting verified.');

    console.log('=== 2. Bulk Publish Dry-Run, Eligible Validation, Selected & Filtered Publish ===');
    const dry = await bulkPublishDriveTextbooks({
      scope: 'filtered',
      filters: { search: tag },
      approvePending: false,
      dryRun: true,
      adminUsername: 'super_admin_test',
      adminRole: 'super_admin',
    });
    assert.equal(dry.totalMatched, 5);
    assert.equal(dry.eligibleToPublish, 1, 'Only pre-approved id3 is eligible when approvePending=false');

    // Publish selected (id1 + id2 with explicit approvePending=true)
    const pubSel = await bulkPublishDriveTextbooks({
      scope: 'selected',
      selectedIds: [id1, id2, idRejected, idUnavailable],
      approvePending: true,
      dryRun: false,
      adminUsername: 'super_admin_test',
      adminRole: 'super_admin',
    });
    assert.equal(pubSel.publishedCount, 2, 'Only id1 & id2 should publish; rejected & unavailable must fail validation');
    assert.equal(pubSel.failedCount, 2);

    // Student Library immediately reflects published id1 & id2, never rejected/unavailable
    assert.ok(await getPublishedStudentTextbookById(id1));
    assert.ok(await getPublishedStudentTextbookById(id2));
    assert.equal(await getPublishedStudentTextbookById(idRejected), null);
    assert.equal(await getPublishedStudentTextbookById(idUnavailable), null);

    // Publish all filtered with excludedIds
    const pubFiltered = await bulkPublishDriveTextbooks({
      scope: 'filtered',
      filters: { search: tag },
      excludedIds: [id3],
      approvePending: true,
      dryRun: false,
      adminUsername: 'super_admin_test',
      adminRole: 'super_admin',
    });
    assert.equal(pubFiltered.publishedCount, 0);
    assert.equal(pubFiltered.skippedCount, 2, 'id1 & id2 already published');
    assert.equal(await getPublishedStudentTextbookById(id3), null, 'Excluded id3 must remain unpublished');
    console.log('PASS: Dry-run, validation, selected publish, excludedIds, and Student Library sync verified.');

    console.log('=== 3. Bulk Unpublish Selected & Filtered ===');
    const unpub = await bulkUnpublishDriveTextbooks({
      scope: 'filtered',
      filters: { search: tag },
      dryRun: false,
      adminUsername: 'super_admin_test',
      adminRole: 'super_admin',
    });
    assert.ok(Number(unpub.unpublishedCount || 0) >= 2);
    const studentVisible = await listPublishedStudentTextbooks({ search: tag });
    assert.equal(studentVisible.length, 0, 'Unpublished books must immediately vanish from Student Library');
    console.log('PASS: Bulk unpublish & immediate Student Library removal verified.');

    console.log('=== 4. Delete Selected, Global Delete Phrase Enforcement, Soft-Delete & Trash Restore ===');
    // Global delete without exact phrase must fail with 400
    let phraseRejected = false;
    try {
      await bulkSoftDeleteDriveTextbooks({
        scope: 'filtered',
        filters: { search: tag },
        confirmPhrase: 'WRONG PHRASE',
        adminUsername: 'super_admin_test',
        adminRole: 'super_admin',
      });
    } catch (e: any) {
      phraseRejected = e.statusCode === 400;
    }
    assert.equal(phraseRejected, true, 'Global delete must require exact phrase DELETE ALL TEXTBOOKS');

    // Delete selected (id1)
    const delSel = await bulkSoftDeleteDriveTextbooks({
      scope: 'selected',
      selectedIds: [id1],
      adminUsername: 'super_admin_test',
      adminRole: 'super_admin',
    });
    assert.equal(delSel.deletedCount, 1);
    assert.equal(delSel.driveFilesPreserved, true);

    // Delete all filtered with exact confirmation phrase
    const delFiltered = await bulkSoftDeleteDriveTextbooks({
      scope: 'filtered',
      filters: { search: tag },
      confirmPhrase: 'DELETE ALL TEXTBOOKS',
      adminUsername: 'super_admin_test',
      adminRole: 'super_admin',
    });
    assert.equal(delFiltered.deletedCount, 4);

    // Active query shows 0; Trash query shows 5
    const activeAfterDel = await queryDriveTextbooksPaginated({ filters: { search: tag } });
    assert.equal(activeAfterDel.pagination.total, 0);
    const trashView = await queryDriveTextbooksPaginated({ filters: { search: tag, includeTrashed: true } });
    assert.equal(trashView.pagination.total, 5);

    // Restore from Trash works
    const restored = await restoreTrashedDriveTextbooks({
      ids: insertedIds,
      adminUsername: 'super_admin_test',
      adminRole: 'super_admin',
    });
    assert.equal(restored.restoredCount, 5);
    console.log('PASS: Soft-delete, phrase guard, Drive preservation, and Trash restore verified.');

    console.log('=== 5. Super Admin Role Enforcement & Audit Logs ===');
    const editorToken = generateAdminToken('editor_user', 'Editor', 'editor');
    let editorStatus = 0;
    let editorNext = false;
    requireSuperAdminDriveAuth(
      { headers: { authorization: `Bearer ${editorToken}` }, query: {} } as any,
      { status(c: number) { editorStatus = c; return this; }, json() { return this; } } as any,
      () => { editorNext = true; }
    );
    assert.equal(editorNext, false);
    assert.equal(editorStatus, 403, 'Non-super-admin must receive 403 on bulk endpoints');

    const superToken = generateAdminToken('super_user', 'Super Admin', 'super_admin');
    let superNext = false;
    requireSuperAdminDriveAuth(
      { headers: { authorization: `Bearer ${superToken}` }, query: {} } as any,
      { status() { return this; }, json() { return this; } } as any,
      () => { superNext = true; }
    );
    assert.equal(superNext, true, 'Super Admin must pass requireSuperAdminDriveAuth');

    const audits = await getDriveTextbookAuditLogs(10);
    assert.ok(audits.some((a: any) => a.admin_username === 'super_admin_test'));
    console.log('PASS: Super Admin RBAC & audit log persistence verified.');
  } finally {
    if (insertedIds.length > 0) {
      await pool.query(`DELETE FROM textbooks WHERE id = ANY($1::int[])`, [insertedIds]);
    }
    await pool.query(`DELETE FROM google_drive_textbook_audit_logs WHERE admin_username = 'super_admin_test'`);
    await pool.end();
  }

  console.log('\nALL 20 BULK TEXTBOOK MANAGEMENT SCENARIOS PASSED.');
}

main().catch((err) => {
  console.error('BULK MANAGEMENT TEST FAILED:', err);
  process.exit(1);
});
