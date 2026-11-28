import assert from 'node:assert/strict';
import 'dotenv/config';
import pool from '../db';
import { generateAdminToken } from '../middleware/auth';

const API_BASE = 'http://localhost:5000';

async function getLiveAdminToken(): Promise<string> {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || '';
  if (password) {
    const loginRes = await fetch(`${API_BASE}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const loginJson: any = await loginRes.json().catch(() => ({}));
    if (loginRes.ok && loginJson.token) return loginJson.token;
  }
  return generateAdminToken(username, 'E2E Admin', 'admin');
}

async function runE2E() {
  const adminToken = await getLiveAdminToken();
  const headers = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  };

  const uniqueTag = `E2E_STAGING_${Date.now()}`;
  const pasteText = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `### Q${n}.\n` +
        `[${uniqueTag}] Controlled E2E verification question #${n}?\n` +
        `- (A) Choice A-${n}\n` +
        `- (B) Choice B-${n}\n` +
        `- (C) Choice C-${n}\n` +
        `- (D) Choice D-${n}\n` +
        `- (E) Answer not known\n` +
        `**Answer: (${(['A', 'B', 'C', 'D'] as const)[(n - 1) % 4]})**\n` +
        `**Explanation:** E2E verified explanation #${n}.`
    )
    .join('\n\n');

  let sessionId: string | null = null;

  try {
    // Before count in Question Bank Management API
    const beforeRes = await fetch(`${API_BASE}/api/study-materials/questions/admin?status=staging&limit=50&offset=0`, {
      headers,
    });
    assert.equal(beforeRes.status, 200, 'Before Question Bank API check must succeed');
    const beforeJson: any = await beforeRes.json();
    const beforeStagingCount = Number(beforeJson.metrics?.stagingCount ?? 0);

    // Step 1-3: Paste -> Convert to JSON -> Validate 5
    const convertRes = await fetch(`${API_BASE}/api/questions/paste-import/convert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sourceText: pasteText,
        expectedQuestions: 5,
        metadata: {
          category: 'group1',
          subject: 'General Studies',
          classId: 6,
          unitId: 1,
          lessonTitle: 'Measurements and SI Units',
          lessonId: '1-6-l1',
          topic: 'Measurements: SI Units, Length, Mass, Time',
          difficulty: 'Medium',
          language: 'english',
          targetSystem: 'study_materials',
          sourceReference: 'Samacheer Kalvi Class 6',
        },
      }),
    });
    assert.equal(convertRes.status, 200, 'Convert API must return 200');
    const convertJson: any = await convertRes.json();
    assert.equal(convertJson.status, 'success');
    assert.equal(convertJson.data.detectedQuestions, 5);
    assert.equal(convertJson.data.validQuestions, 5);
    assert.equal(convertJson.data.invalidQuestions, 0);
    assert.equal(convertJson.data.canStage, true);
    sessionId = convertJson.data.sessionId;
    assert.ok(sessionId, 'Session ID must be created');

    // Step 4: Sequential staging upload ([1, 2, 3] then [4, 5])
    const stage1Res = await fetch(`${API_BASE}/api/questions/paste-import/sessions/${sessionId}/stage-next`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sourceOrders: [1, 2, 3] }),
    });
    assert.equal(stage1Res.status, 200);
    const stage1Json: any = await stage1Res.json();
    assert.equal(stage1Json.data.insertedCount, 3);
    assert.equal(stage1Json.data.summary.staged, 3);
    assert.equal(stage1Json.data.summary.pending, 2);

    const stage2Res = await fetch(`${API_BASE}/api/questions/paste-import/sessions/${sessionId}/stage-next`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sourceOrders: [4, 5] }),
    });
    assert.equal(stage2Res.status, 200);
    const stage2Json: any = await stage2Res.json();
    assert.equal(stage2Json.data.insertedCount, 2);
    assert.equal(stage2Json.data.summary.staged, 5);
    assert.equal(stage2Json.data.summary.pending, 0);
    assert.equal(stage2Json.data.summary.status, 'completed');

    const insertedIds: number[] = [...stage1Json.data.insertedIds, ...stage2Json.data.insertedIds];
    assert.equal(insertedIds.length, 5, 'Must return 5 real database IDs');

    // Step 5: Direct PostgreSQL verification
    const dbRes = await pool.query(
      `SELECT id, status, target_system, category, subject, class_id, unit_id, lesson_title, lesson_id, topic, difficulty, language, source_order, option_e, question_text
       FROM questions
       WHERE upload_session_id = $1
       ORDER BY source_order ASC`,
      [sessionId]
    );
    assert.equal(dbRes.rows.length, 5, 'Exactly 5 committed rows in PostgreSQL questions table');
    for (let i = 0; i < 5; i++) {
      const r = dbRes.rows[i];
      assert.equal(Number(r.id), insertedIds[i]);
      assert.equal(r.status, 'staging');
      assert.equal(r.target_system, 'study_materials');
      assert.equal(r.category, 'group1');
      assert.equal(r.subject, 'General Studies');
      assert.equal(Number(r.class_id), 6);
      assert.equal(Number(r.unit_id), 1);
      assert.equal(r.lesson_title, 'Measurements and SI Units');
      assert.equal(r.lesson_id, '1-6-l1');
      assert.equal(Number(r.source_order), i + 1);
      assert.equal(r.option_e, 'Answer not known');
    }

    // Step 6 & 7: Retrieve via Question Bank Management API (exact endpoint used by Admin.tsx)
    const qbRes = await fetch(
      `${API_BASE}/api/study-materials/questions/admin?status=staging&search=${encodeURIComponent(uniqueTag)}&limit=50&offset=0`,
      { headers }
    );
    assert.equal(qbRes.status, 200);
    const qbJson: any = await qbRes.json();
    assert.equal(qbJson.status, 'success');
    assert.equal(qbJson.data.length, 5, 'All 5 staged questions MUST be returned by Question Bank Management API');
    assert.equal(Number(qbJson.metrics.stagingCount), beforeStagingCount + 5, 'Staging metric increased by exactly 5');
    const returnedIds = qbJson.data.map((q: any) => Number(q.id)).sort((a: number, b: number) => a - b);
    assert.deepEqual(returnedIds, [...insertedIds].sort((a, b) => a - b));

    // Step 8: Confirm NONE of the 5 appear as published on student endpoint
    const pubRes = await fetch(
      `${API_BASE}/api/study-materials/questions?category=group1&classId=6&unitId=1`,
      { headers }
    );
    const pubJson: any = await pubRes.json();
    const leaked = (pubJson.data || []).filter((q: any) => String(q.question || '').includes(uniqueTag));
    assert.equal(leaked.length, 0, 'Staged questions MUST NOT leak to published student endpoint');

    // Step 9: Retry all 5 -> 0 duplicates
    const retryRes = await fetch(`${API_BASE}/api/questions/paste-import/sessions/${sessionId}/stage-next`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sourceOrders: [1, 2, 3, 4, 5] }),
    });
    assert.equal(retryRes.status, 200);
    const retryJson: any = await retryRes.json();
    assert.equal(retryJson.data.insertedCount, 0, 'Retry must insert 0 duplicate rows');
    assert.ok(retryJson.data.results.every((r: any) => r.status === 'staged' && r.alreadyStaged === true));

    const dbCountAfterRetry = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM questions WHERE upload_session_id = $1`,
      [sessionId]
    );
    assert.equal(Number(dbCountAfterRetry.rows[0].cnt), 5, 'PostgreSQL still has exactly 5 rows after retry');

    console.log(
      JSON.stringify(
        {
          status: 'PASS',
          sessionId,
          beforeStagingCount,
          afterStagingCount: Number(qbJson.metrics.stagingCount),
          expectedUploadCount: 5,
          apiInsertedCount: insertedIds.length,
          actualDbInsertCount: dbRes.rows.length,
          questionBankApiDisplayCount: qbJson.data.length,
          insertedIds,
          retryInsertedCount: retryJson.data.insertedCount,
          leakedToStudentPublished: leaked.length,
        },
        null,
        2
      )
    );
  } finally {
    if (sessionId) {
      await pool.query(`DELETE FROM questions WHERE upload_session_id = $1`, [sessionId]);
      await pool.query(`DELETE FROM paste_import_sessions WHERE session_id = $1`, [sessionId]);
    }
  }
}

runE2E()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('E2E FAILED:', err);
    process.exit(1);
  });
