import assert from 'assert';
import pool from '../db';
import {
  approvePaperQuestions,
  createPaperFromPastedQuestions,
  deleteAdminPreviousPaper,
  getAdminPreviousPapersStats,
  listAdminPreviousPapersPaginated,
  updateAdminPreviousPaperStatus,
} from '../services/previousPapersAdminService';
import {
  bulkApprovePreviousPapers,
  bulkPublishPreviousPapers,
  bulkRejectPreviousPapers,
  bulkRestorePreviousPapers,
  bulkSoftDeletePreviousPapers,
  bulkUnpublishPreviousPapers,
  listPreviousPaperAuditLogs,
  previewBulkPreviousPapers,
} from '../services/previousPapersBulkService';
import { listPreviousPapers } from '../services/previousPapersService';
import { requireSuperAdminPapersAuth } from '../routes/previousPapersRoutes';
import { generateAdminToken, generateStudentToken } from '../middleware/auth';

const SUPER_ACTOR = { adminUsername: 'super_admin_pyp_test', adminRole: 'super_admin' };
const REGULAR_ACTOR = { adminUsername: 'regular_admin_pyp_test', adminRole: 'admin' };

async function main() {
  const tag = `PYP_BULK_TEST_${Date.now()}`;
  const createdIds: number[] = [];

  try {
    console.log('=== 1. Create 4 Staging Test Examinations (2 Valid Approved, 1 Needs Review, 1 Staging Unapproved) ===');
    const makeValidQs = (prefix: string) => [
      {
        originalQuestionNumber: '1',
        questionText: `${prefix} Q1: Capital of Tamil Nadu?`,
        optionA: 'Chennai',
        optionB: 'Madurai',
        optionC: 'Salem',
        optionD: 'Trichy',
        correctAnswer: 0,
        explanation: 'Chennai is the capital.',
        subject: 'Geography',
      },
      {
        originalQuestionNumber: '2',
        questionText: `${prefix} Q2: SI unit of force?`,
        optionA: 'Joule',
        optionB: 'Newton',
        optionC: 'Watt',
        optionD: 'Pascal',
        correctAnswer: 1,
        explanation: 'Newton is the SI unit of force.',
        subject: 'Physics',
      },
    ];

    const p1 = await createPaperFromPastedQuestions({
      group: 'group4',
      year: 2024,
      paperTitle: `${tag} Approved Paper A`,
      medium: 'English',
      questions: makeValidQs(`${tag}_A`),
    });
    assert.ok(p1?.paper.id);
    createdIds.push(p1!.paper.id);

    const p2 = await createPaperFromPastedQuestions({
      group: 'group4',
      year: 2023,
      paperTitle: `${tag} Approved Paper B`,
      medium: 'Tamil',
      questions: makeValidQs(`${tag}_B`),
    });
    assert.ok(p2?.paper.id);
    createdIds.push(p2!.paper.id);

    const p3 = await createPaperFromPastedQuestions({
      group: 'group1',
      year: 2022,
      paperTitle: `${tag} Needs Review Paper C`,
      medium: 'English',
      questions: [
        ...makeValidQs(`${tag}_C`),
        {
          originalQuestionNumber: '3',
          questionText: `${tag}_C Q3 missing answer`,
          optionA: 'A',
          optionB: 'B',
          optionC: 'C',
          optionD: 'D',
          correctAnswer: null,
          needsReview: true,
        },
      ],
    });
    assert.ok(p3?.paper.id);
    createdIds.push(p3!.paper.id);

    const p4 = await createPaperFromPastedQuestions({
      group: 'group2_2a',
      year: 2025,
      paperTitle: `${tag} Staging Unapproved Paper D`,
      medium: 'English',
      questions: makeValidQs(`${tag}_D`),
    });
    assert.ok(p4?.paper.id);
    createdIds.push(p4!.paper.id);

    // Approve all valid questions in p1 & p2 (existing staging -> approved workflow)
    const app1 = await approvePaperQuestions(p1!.paper.id, { approveAllValid: true });
    const app2 = await approvePaperQuestions(p2!.paper.id, { approveAllValid: true });
    assert.equal(app1?.paper?.status, 'approved');
    assert.equal(app2?.paper?.status, 'approved');

    // Attempt approving p3 — Q3 is unverified so p3 must remain STAGING
    const app3 = await approvePaperQuestions(p3!.paper.id, { approveAllValid: true });
    assert.equal(app3?.paper?.status, 'staging');
    assert.equal(app3?.skippedInvalidCount, 1);
    console.log('PASS: Existing staging & question approval workflow preserved.');

    console.log('=== 2. Verify Pagination, Sorting & Scoped Preview (Selected / Filtered / All) ===');
    const page1 = await listAdminPreviousPapersPaginated({ search: tag, page: 1, limit: 2, sortBy: 'year', sortDir: 'desc' });
    assert.equal(page1.items.length, 2);
    assert.equal(page1.pagination.total, 4);
    assert.equal(page1.pagination.totalPages, 2);
    assert.ok(page1.items[0].year >= page1.items[1].year);

    const previewFiltered = await previewBulkPreviousPapers({
      scope: 'filtered',
      filters: { search: tag },
    });
    assert.equal(previewFiltered.totalSelected, 4);
    assert.equal(previewFiltered.totalQuestions, 9);
    assert.equal(previewFiltered.approvedQuestions, 6);
    assert.equal(previewFiltered.needsReviewQuestions, 1);
    assert.equal(previewFiltered.eligibleForPublish, 2);
    assert.equal(previewFiltered.ineligibleCount, 2);

    const previewWithExcluded = await previewBulkPreviousPapers({
      scope: 'filtered',
      filters: { search: tag },
      excludedIds: [p1!.paper.id],
    });
    assert.equal(previewWithExcluded.totalSelected, 3);
    assert.equal(previewWithExcluded.eligibleForPublish, 1);
    console.log('PASS: Pagination, sorting, filtered scope, and excludedIds preview verified.');

    console.log('=== 3. Verify Super Admin Permission Guards (Middleware & Service) ===');
    const runGuard = (token?: string) => {
      let status = 200;
      let nextCalled = false;
      requireSuperAdminPapersAuth(
        { headers: token ? { authorization: `Bearer ${token}` } : {}, query: {} } as any,
        { status(c: number) { status = c; return this; }, json() { return this; } } as any,
        () => { nextCalled = true; }
      );
      return { status, nextCalled };
    };
    assert.equal(runGuard(undefined).status, 401);
    assert.equal(runGuard(generateStudentToken(1, 's@test.com', 'Student')).status, 401);
    assert.equal(runGuard(generateAdminToken('content_admin', 'Content', 'admin')).status, 403);
    assert.equal(runGuard(generateAdminToken('admin', 'Super', 'super_admin')).nextCalled, true);

    let serviceBlocked = false;
    try {
      await bulkPublishPreviousPapers({ scope: 'selected', selectedIds: [p1!.paper.id] }, REGULAR_ACTOR);
    } catch (e: any) {
      serviceBlocked = e.statusCode === 403;
    }
    assert.equal(serviceBlocked, true);
    console.log('PASS: Super Admin authorization enforced on middleware and service.');

    console.log('=== 4. Individual Publish, Bulk Publish, Student Website Visibility & Unpublish ===');
    // Individual publish p1
    const indPub = await updateAdminPreviousPaperStatus(p1!.paper.id, 'published', SUPER_ACTOR.adminUsername);
    assert.equal(indPub?.paper.status, 'published');

    // Bulk publish filtered (p1 already published, p2 eligible, p3 needs review, p4 staging -> ONLY p2 should publish!)
    const bulkPub = await bulkPublishPreviousPapers(
      { scope: 'filtered', filters: { search: tag } },
      SUPER_ACTOR
    );
    assert.equal(bulkPub.publishedCount, 1);
    assert.deepEqual(bulkPub.publishedIds, [p2!.paper.id]);
    assert.equal(bulkPub.skippedCount, 3);

    // Verify published_by recorded & visible on Student Website
    const pubRow = await pool.query(`SELECT published_by, published_at FROM previous_year_papers WHERE id = $1`, [p2!.paper.id]);
    assert.equal(pubRow.rows[0].published_by, SUPER_ACTOR.adminUsername);
    assert.ok(pubRow.rows[0].published_at);

    const studentVisible = await listPreviousPapers({ subject: tag });
    const studentIds = studentVisible.map((r) => r.id);
    assert.ok(studentIds.includes(p1!.paper.id), 'Published paper p1 visible on Student Website');
    assert.ok(studentIds.includes(p2!.paper.id), 'Bulk-published paper p2 visible on Student Website');
    assert.ok(!studentIds.includes(p3!.paper.id), 'Needs-review paper p3 must NOT appear on Student Website');
    assert.ok(!studentIds.includes(p4!.paper.id), 'Unapproved staging paper p4 must NOT appear on Student Website');

    // Bulk Unpublish p1 & p2
    const bulkUnpub = await bulkUnpublishPreviousPapers(
      { scope: 'selected', selectedIds: [p1!.paper.id, p2!.paper.id] },
      SUPER_ACTOR
    );
    assert.equal(bulkUnpub.unpublishedCount, 2);
    const studentAfterUnpub = await listPreviousPapers({ subject: tag });
    assert.equal(studentAfterUnpub.length, 0);

    // Bulk Approve p4 (valid staging) & skip p3 (unverified answer key)
    const bulkApp = await bulkApprovePreviousPapers(
      { scope: 'selected', selectedIds: [p4!.paper.id, p3!.paper.id] },
      SUPER_ACTOR
    );
    assert.equal(bulkApp.approvedCount, 1);
    assert.deepEqual(bulkApp.approvedIds, [p4!.paper.id]);
    assert.equal(bulkApp.skippedCount, 1);

    // Bulk Reject p3 with rejection reason & confirm excluded from Student Website
    const bulkRej = await bulkRejectPreviousPapers(
      { scope: 'selected', selectedIds: [p3!.paper.id], rejectionReason: 'Missing answer key on Q3' },
      SUPER_ACTOR
    );
    assert.equal(bulkRej.rejectedCount, 1);
    const rejRow = await pool.query(`SELECT status, rejection_reason FROM previous_year_papers WHERE id = $1`, [p3!.paper.id]);
    assert.equal(rejRow.rows[0].status, 'rejected');
    assert.equal(rejRow.rows[0].rejection_reason, 'Missing answer key on Q3');
    console.log('PASS: Individual publish, bulk approve, bulk reject, bulk publish, Student Website sync & bulk unpublish verified.');

    console.log('=== 5. Soft Delete (Individual, Bulk, Global Confirmation Guard) & Trash Restore ===');
    // Global delete without exact confirmation phrase MUST fail with 400
    let confirmBlocked = false;
    try {
      await bulkSoftDeletePreviousPapers({ scope: 'all', confirmText: 'wrong phrase' }, SUPER_ACTOR);
    } catch (e: any) {
      confirmBlocked = e.statusCode === 400;
    }
    assert.equal(confirmBlocked, true);

    // Individual soft delete p4
    const indDel = await deleteAdminPreviousPaper(p4!.paper.id, SUPER_ACTOR.adminUsername);
    assert.equal(indDel, true);

    // Bulk soft delete p1, p2, p3 (filtered)
    const bulkDel = await bulkSoftDeletePreviousPapers(
      { scope: 'filtered', filters: { search: tag } },
      SUPER_ACTOR
    );
    assert.equal(bulkDel.deletedCount, 3);
    assert.equal(bulkDel.recoverable, true);

    // Active filtered list should now be 0; Trash list should be 4
    const activeAfterDel = await listAdminPreviousPapersPaginated({ search: tag });
    assert.equal(activeAfterDel.pagination.total, 0);
    const trashAfterDel = await listAdminPreviousPapersPaginated({ search: tag, includeDeleted: true });
    assert.equal(trashAfterDel.pagination.total, 4);

    // Restore p1 from Trash
    const restored = await bulkRestorePreviousPapers([p1!.paper.id], SUPER_ACTOR);
    assert.equal(restored.restoredCount, 1);
    const activeAfterRestore = await listAdminPreviousPapersPaginated({ search: tag });
    assert.equal(activeAfterRestore.pagination.total, 1);
    console.log('PASS: Soft delete, DELETE ALL EXAMINATIONS guard, Trash & Restore verified.');

    console.log('=== 6. Audit Logs & Real-Time PostgreSQL Stats Consistency ===');
    const logs = await listPreviousPaperAuditLogs(50);
    const testLogs = logs.filter((l) => l.adminId === SUPER_ACTOR.adminUsername);
    assert.ok(testLogs.some((l) => l.action === 'PUBLISH'));
    assert.ok(testLogs.some((l) => l.action === 'BULK_PUBLISH' && Boolean(l.bulkOperationId)));
    assert.ok(testLogs.some((l) => l.action === 'BULK_UNPUBLISH' && Boolean(l.bulkOperationId)));
    assert.ok(testLogs.some((l) => l.action === 'BULK_DELETE' && Boolean(l.bulkOperationId)));
    assert.ok(testLogs.some((l) => l.action === 'RESTORE_FROM_TRASH'));

    const stats = await getAdminPreviousPapersStats();
    const dbCountRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM previous_year_papers WHERE deleted_at IS NULL`);
    assert.equal(stats.totalPapers, Number(dbCountRes.rows[0].cnt));
    console.log('PASS: Audit logs & PostgreSQL stats consistency verified:', {
      totalActivePapers: stats.totalPapers,
      auditEntriesCreated: testLogs.length,
    });
  } finally {
    if (createdIds.length > 0) {
      await pool.query(`DELETE FROM previous_year_papers WHERE id = ANY($1::int[])`, [createdIds]);
    }
    await pool.query(`DELETE FROM previous_paper_audit_logs WHERE admin_id = $1`, [SUPER_ACTOR.adminUsername]);
    await pool.end();
  }

  console.log('\nALL 18 PREVIOUS YEAR PAPERS BULK MANAGEMENT SCENARIOS PASSED.');
}

main().catch((err) => {
  console.error('PREVIOUS PAPERS BULK TEST FAILED:', err);
  process.exit(1);
});
