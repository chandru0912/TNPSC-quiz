import assert from 'node:assert/strict';
import 'dotenv/config';
import pool from '../db';
import { generateAdminToken } from '../middleware/auth';

const API_BASE = 'http://localhost:5000';

function buildFixture(): string {
  const tag = `PARITY_${Date.now()}`;
  return [
    `# TNPSC Group II Dual-Module Parity Fixture`,
    `**Exam:** General Studies & Tamil`,
    `### Q1.\n[${tag}] Match the following:\n- (a) Art. 123 — 1. Ordinance\n- (b) Art. 72 — 2. Pardon\n- (c) Art. 85 — 3. Sessions\n- (d) Art. 352 — 4. Emergency\nCodes (a) (b) (c) (d):\n- (A) 1, 2, 3, 4\n- (B) 2, 1, 4, 3\n- (C) 4, 3, 2, 1\n- (D) 3, 4, 1, 2\n- (E) Answer not known\n**Answer: (A)**\n**Explanation:** Constitutional articles match.`,
    `### Q2.\n[${tag}] திருக்குறளில் எத்தனை அதிகாரங்கள் உள்ளன?\n(அ) 100\n(ஆ) 133\n(இ) 150\n(ஈ) 120\n(உ) விடை தெரியவில்லை\nவிடை: ஆ\nவிளக்கம்: 133 அதிகாரங்கள்.`,
    `### Q3.\n[${tag}] Mixed Tamil-English: Who wrote Silappathikaram (சிலப்பதிகாரம்)?\n- **(A)** Ilango Adigal (இளங்கோவடிகள்)\n- **(B)** Kamban\n- **(C)** Thiruvalluvar\n- **(D)** Avvaiyar\n- **(E)** Answer not known\n**Correct Answer: (A)**`,
    `### Q4.\n[${tag}] Multiline question:\n1. Statement I is true.\n2. Statement II is true.\nWhich is correct?\n(A) 1 only\n(B) 2 only\n(C) Both 1 and 2\n(D) Neither\n(E) Answer not known\nAns: C`,
    `### Q5.\n[${tag}] SI unit of Force?\nA) Joule\nB) Newton\nC) Watt\nD) Pascal\nE) Answer not known\nAnswer: B`,
    `### Q6.\n[${tag}] Capital of Tamil Nadu?\n(A) Madurai\n(B) Chennai\n(C) Trichy\n(D) Salem\n(E) Answer not known\n**Answer:** **(B)**`,
  ].join('\n\n');
}

async function run() {
  const token = generateAdminToken('admin', 'Admin', 'admin');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fixture = buildFixture();
  const createdSessionIds: string[] = [];
  let createdPaperId = 0;

  try {
    // 1. Convert identical fixture through BOTH Question Bank AND Previous Year Papers endpoints
    const [qbRes, pypRes] = await Promise.all([
      fetch(`${API_BASE}/api/questions/paste-import/convert`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sourceText: fixture,
          expectedQuestions: 6,
          metadata: {
            category: 'group2',
            subject: 'General Studies',
            classId: 10,
            unitId: 1,
            lessonTitle: '__parity_test_lesson',
            topic: '__parity_test_lesson',
            difficulty: 'Medium',
            language: 'bilingual',
            targetSystem: 'study_materials',
          },
        }),
      }),
      fetch(`${API_BASE}/api/admin/previous-papers/paste-import/convert`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sourceText: fixture,
          expectedQuestions: 6,
          metadata: {
            group: 'group2_2a',
            examName: `Parity Test Paper ${Date.now()}`,
            year: 2026,
            subject: 'General Studies',
            medium: 'Bilingual',
            paperType: 'Prelims',
          },
        }),
      }),
    ]);

    assert.equal(qbRes.status, 200);
    assert.equal(pypRes.status, 200);
    const qbJson: any = await qbRes.json();
    const pypJson: any = await pypRes.json();

    const qbData = qbJson.data;
    const pypData = pypJson.data;
    if (qbData.sessionId) createdSessionIds.push(qbData.sessionId);
    if (pypData.sessionId) createdSessionIds.push(pypData.sessionId);

    // Verify 100% identical extraction across BOTH modules
    assert.equal(qbData.detectedQuestions, 6);
    assert.equal(pypData.detectedQuestions, 6);
    assert.equal(qbData.validQuestions, 6);
    assert.equal(pypData.validQuestions, 6);
    assert.equal(qbData.sourceSha256, pypData.sourceSha256);

    for (let i = 0; i < 6; i++) {
      assert.equal(qbData.questions[i].sourceOrder, pypData.questions[i].sourceOrder);
      assert.equal(qbData.questions[i].originalNumber, pypData.questions[i].originalNumber);
      assert.equal(qbData.questions[i].questionText, pypData.questions[i].questionText);
      assert.deepEqual(qbData.questions[i].options, pypData.questions[i].options);
      assert.equal(qbData.questions[i].correctAnswer, pypData.questions[i].correctAnswer);
      assert.equal(qbData.questions[i].explanation, pypData.questions[i].explanation);
    }
    console.log('PASS 1: Identical extraction parity between Question Bank and Previous Year Papers');

    // 2. Sequential PYP Staging + Interrupt/Resume + Idempotent Retry + Strict DB Isolation
    const pypSid = pypData.sessionId;
    const batch1Res = await fetch(`${API_BASE}/api/admin/previous-papers/paste-import/sessions/${pypSid}/stage-next`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sourceOrders: [1, 2, 3] }),
    });
    assert.equal(batch1Res.status, 200);
    const batch1: any = await batch1Res.json();
    createdPaperId = Number(batch1.data.paperId);
    assert.ok(createdPaperId > 0, 'PYP staging paper must be created');
    assert.equal(batch1.data.insertedCount, 3);
    assert.equal(batch1.data.summary.staged, 3);
    assert.equal(batch1.data.summary.pending, 3);

    // Resume [4, 5, 6]
    const batch2Res = await fetch(`${API_BASE}/api/admin/previous-papers/paste-import/sessions/${pypSid}/stage-next`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sourceOrders: [4, 5, 6] }),
    });
    assert.equal(batch2Res.status, 200);
    const batch2: any = await batch2Res.json();
    assert.equal(Number(batch2.data.paperId), createdPaperId, 'Resume must reuse same paperId');
    assert.equal(batch2.data.insertedCount, 3);
    assert.equal(batch2.data.summary.staged, 6);
    assert.equal(batch2.data.summary.status, 'completed');

    // Idempotent retry [2, 3, 4] -> 0 duplicates
    const retryRes = await fetch(`${API_BASE}/api/admin/previous-papers/paste-import/sessions/${pypSid}/stage-next`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sourceOrders: [2, 3, 4] }),
    });
    assert.equal(retryRes.status, 200);
    const retry: any = await retryRes.json();
    assert.equal(retry.data.insertedCount, 0, 'Retry must insert 0 duplicate PYP questions');
    assert.ok(retry.data.results.every((r: any) => r.status === 'staged' && r.alreadyStaged === true));

    // Verify PostgreSQL tables: PYP rows in previous_year_papers + previous_year_paper_questions, ZERO in questions!
    const pypPaperRow = await pool.query(
      `SELECT id, status, year, category, paper_type, medium, total_questions FROM previous_year_papers WHERE id = $1`,
      [createdPaperId]
    );
    assert.equal(pypPaperRow.rows[0].status, 'staging', 'PYP paper must remain in staging (never auto-published)');
    assert.equal(Number(pypPaperRow.rows[0].total_questions), 6);

    const pypQRows = await pool.query(
      `SELECT id, question_number, original_question_number, option_e, is_approved
       FROM previous_year_paper_questions
       WHERE paper_id = $1
       ORDER BY question_number ASC`,
      [createdPaperId]
    );
    assert.equal(pypQRows.rows.length, 6, 'Exactly 6 rows in previous_year_paper_questions');
    assert.ok(pypQRows.rows.every((r: any, idx: number) => Number(r.question_number) === idx + 1 && r.is_approved === false));
    assert.equal(pypQRows.rows[1].option_e, 'விடை தெரியவில்லை', 'Tamil Option E preserved in PYP table');

    const leakedToQb = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM questions WHERE upload_session_id = $1`,
      [pypSid]
    );
    assert.equal(Number(leakedToQb.rows[0].cnt), 0, 'PYP paste session must NEVER write into questions table');

    console.log(
      JSON.stringify(
        {
          status: 'PASS',
          pypSessionId: pypSid,
          pypPaperId: createdPaperId,
          pypStagedQuestions: pypQRows.rows.length,
          pypPaperStatus: pypPaperRow.rows[0].status,
          retryDuplicates: retry.data.insertedCount,
          leakedToQuestionBankTable: Number(leakedToQb.rows[0].cnt),
        },
        null,
        2
      )
    );
  } finally {
    if (createdPaperId > 0) {
      await pool.query(`DELETE FROM previous_year_papers WHERE id = $1`, [createdPaperId]);
    }
    for (const sid of createdSessionIds) {
      await pool.query(`DELETE FROM paste_import_sessions WHERE session_id = $1`, [sid]);
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('DUAL MODULE TEST FAILED:', err);
    process.exit(1);
  });
