import pool from '../src/db';
import { generateAdminToken } from '../src/middleware/auth';
import http from 'http';

interface TestResponse {
  status: number;
  body: any;
}

function request(
  targetPort: number,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : undefined;

    const reqHeaders: Record<string, string> = {
      ...headers,
    };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: targetPort,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('--- STARTING STRICT LESSON-WISE VERIFICATION SUITE ---');

  const targetPort = 5000;
  const token = generateAdminToken({ username: 'admin', role: 'admin' });
  const authHeader = { Authorization: `Bearer ${token}` };

  const createdIds: number[] = [];

  try {
    // 1. Clean up any existing test records
    await pool.query(
      `DELETE FROM questions WHERE lesson_id IN ('test-gt-1-6-t1-l1', 'test-gt-1-6-t1-l2', 'test-invalid-lesson')`
    );

    // TEST 1: Staging questions for Lesson 1.1
    console.log('\n[Test 1] Upload staging questions for Lesson 1.1 (test-gt-1-6-t1-l1)...');
    const lesson1Upload = await request(
      targetPort,
      'POST',
      '/api/questions/upload',
      authHeader,
      {
        questions: [
          {
            category: 'group2',
            unitId: 1,
            classId: 6,
            subject: 'General Tamil',
            lessonTitle: 'இன்பத்தமிழ்',
            lessonId: 'test-gt-1-6-t1-l1',
            topic: 'இன்பத்தமிழ் செய்யுள்',
            difficulty: 'Medium',
            question: 'தமிழுக்கும் அமுதென்று பேர் என்று பாடியவர் யார்?',
            options: ['பாரதிதாசன்', 'பாரதியார்', 'நாமக்கல் கவிஞர்', 'கவிமணி'],
            correctAnswer: 0,
            explanation: 'பாரதிதாசன் இன்பத்தமிழ் பாடலில் தமிழின் சிறப்பைப் போற்றுகிறார்.',
            status: 'staging',
          },
          {
            category: 'group2',
            unitId: 1,
            classId: 6,
            subject: 'General Tamil',
            lessonTitle: 'இன்பத்தமிழ்',
            lessonId: 'test-gt-1-6-t1-l1',
            topic: 'இன்பத்தமிழ் சொல்லும் பொருளும்',
            difficulty: 'Easy',
            question: 'நிருமித்த என்ற சொல்லின் பொருள் என்ன?',
            options: ['உருவாக்கிய', 'அழித்த', 'மகிழ்ந்த', 'பாடிய'],
            correctAnswer: 0,
            explanation: 'நிருமித்த என்றால் உருவாக்கிய என்பது பொருள்.',
            status: 'staging',
          },
        ],
      }
    );

    console.log('Upload status:', lesson1Upload.status, 'Inserted count:', lesson1Upload.body?.inserted);
    if (lesson1Upload.status !== 201 || !lesson1Upload.body?.insertedIds?.length) {
      throw new Error(`Failed to upload Lesson 1.1 questions: ${JSON.stringify(lesson1Upload.body)}`);
    }
    const l1Ids: number[] = lesson1Upload.body.insertedIds;
    createdIds.push(...l1Ids);

    // TEST 2: Rejection on publishing invalid question without lesson metadata
    console.log('\n[Test 2] Verify publishing rejection when question lacks lesson metadata...');
    const invalidInsert = await pool.query(`
      INSERT INTO questions (
        category, unit_id, class_id, subject, lesson_title, lesson_id, topic,
        difficulty, tag, question_text, options, correct_answer, explanation, status
      ) VALUES (
        'group2', 1, 6, 'General Tamil', '', NULL, 'Invalid',
        'Medium', 'TNPSC', 'Dummy question missing lesson metadata for test?',
        '["A","B","C","D"]'::jsonb, 0, 'No explanation', 'staging'
      ) RETURNING id;
    `);
    const invalidId = invalidInsert.rows[0].id;
    createdIds.push(invalidId);

    const publishInvalidRes = await request(
      targetPort,
      'PATCH',
      '/api/questions/publish',
      authHeader,
      { ids: [invalidId] }
    );
    console.log('Publish invalid question status:', publishInvalidRes.status, 'Message:', publishInvalidRes.body?.message);
    if (publishInvalidRes.status !== 422) {
      throw new Error(`Expected 422 Unprocessable Entity when publishing question without lesson metadata, got ${publishInvalidRes.status}`);
    }
    console.log('✓ Validation correctly rejected publishing question missing lesson metadata!');

    // TEST 3: Publish Lesson 1.1 staging questions
    console.log('\n[Test 3] Publish Lesson 1.1 staging questions...');
    const publishRes = await request(
      targetPort,
      'PATCH',
      '/api/questions/publish',
      authHeader,
      { ids: l1Ids }
    );
    console.log('Publish status:', publishRes.status, 'Published count:', publishRes.body?.publishedCount);
    if (publishRes.status !== 200 || publishRes.body?.publishedCount !== l1Ids.length) {
      throw new Error(`Failed to publish Lesson 1.1 questions: ${JSON.stringify(publishRes.body)}`);
    }
    console.log('✓ Lesson 1.1 questions successfully published!');

    // TEST 4: Query public endpoint with lessonId=test-gt-1-6-t1-l1
    console.log('\n[Test 4] Query public questions for Lesson 1.1 (lessonId=test-gt-1-6-t1-l1)...');
    const q1Res = await request(
      targetPort,
      'GET',
      '/api/questions?category=group2_2a&unitId=1&lessonId=test-gt-1-6-t1-l1'
    );
    console.log('Lesson 1.1 count:', q1Res.body?.data?.length);
    if (q1Res.body?.data?.length !== 2) {
      throw new Error(`Expected 2 questions for Lesson 1.1, got ${q1Res.body?.data?.length}`);
    }
    console.log('✓ Lesson 1.1 strictly returned its 2 questions!');

    // TEST 5: Query public endpoint for Lesson 1.2 (lessonId=test-gt-1-6-t1-l2) -> MUST BE 0!
    console.log('\n[Test 5] Query public questions for Lesson 1.2 (lessonId=test-gt-1-6-t1-l2)...');
    const q2Res = await request(
      targetPort,
      'GET',
      '/api/questions?category=group2_2a&unitId=1&lessonId=test-gt-1-6-t1-l2'
    );
    console.log('Lesson 1.2 count:', q2Res.body?.data?.length);
    if (q2Res.body?.data?.length !== 0) {
      throw new Error(`CRITICAL FAILURE: Questions leaked into Lesson 1.2! Expected 0, got ${q2Res.body?.data?.length}`);
    }
    console.log('✓ Lesson 1.2 returned 0 questions (NO cross-lesson leakage)!');

    // TEST 6: Query by exact lessonTitle='இன்பத்தமிழ்'
    console.log('\n[Test 6] Query by exact lessonTitle="இன்பத்தமிழ்"...');
    const qTitle1Res = await request(
      targetPort,
      'GET',
      `/api/questions?category=group2_2a&unitId=1&lesson=${encodeURIComponent('இன்பத்தமிழ்')}`
    );
    console.log('Count for "இன்பத்தமிழ்":', qTitle1Res.body?.data?.length);
    if (qTitle1Res.body?.data?.length < 2) {
      throw new Error(`Expected at least 2 questions for "இன்பத்தமிழ்", got ${qTitle1Res.body?.data?.length}`);
    }
    console.log('✓ Exact lessonTitle matching works perfectly!');

    // TEST 7: Query by different lessonTitle='தமிழ்க்கும்மி' (Lesson 1.2 title) -> MUST NOT match Lesson 1.1!
    console.log('\n[Test 7] Query by lessonTitle="தமிழ்க்கும்மி" (Lesson 1.2)...');
    const qTitle2Res = await request(
      targetPort,
      'GET',
      `/api/questions?category=group2_2a&unitId=1&lesson=${encodeURIComponent('தமிழ்க்கும்மி')}`
    );
    // If no questions uploaded for தமிழ்க்கும்மி yet, must return 0
    const testMatches = (qTitle2Res.body?.data || []).filter((q: any) => createdIds.includes(q.id));
    console.log('Test question leakage count into "தமிழ்க்கும்மி":', testMatches.length);
    if (testMatches.length !== 0) {
      throw new Error(`CRITICAL FAILURE: Questions leaked across lesson titles! Got ${testMatches.length}`);
    }
    console.log('✓ No questions leaked to "தமிழ்க்கும்மி"!');

    // TEST 8: Upload and publish distinct questions for Lesson 1.2
    console.log('\n[Test 8] Upload and publish distinct questions for Lesson 1.2...');
    const lesson2Upload = await request(
      targetPort,
      'POST',
      '/api/questions/upload',
      authHeader,
      {
        questions: [
          {
            category: 'group2',
            unitId: 1,
            classId: 6,
            subject: 'General Tamil',
            lessonTitle: 'தமிழ்க்கும்மி',
            lessonId: 'test-gt-1-6-t1-l2',
            topic: 'தமிழ்க்கும்மி பாடல்',
            difficulty: 'Medium',
            question: 'பெருஞ்சித்திரனாரின் இயற்பெயர் என்ன?',
            options: ['துரை. மாணிக்கம்', 'சுப்புரத்தினம்', 'சுப்ரமணியன்', 'அரங்கநாதன்'],
            correctAnswer: 0,
            explanation: 'பெருஞ்சித்திரனாரின் இயற்பெயர் துரை. மாணிக்கம் ஆகும்.',
            status: 'staging',
          },
        ],
      }
    );
    const l2Ids: number[] = lesson2Upload.body.insertedIds;
    createdIds.push(...l2Ids);
    await request(targetPort, 'PATCH', '/api/questions/publish', authHeader, { ids: l2Ids });

    // TEST 9: Verify 1-to-1 isolation
    console.log('\n[Test 9] Verify strict 1-to-1 isolation between Lesson 1.1 and Lesson 1.2...');
    const finalL1 = await request(
      targetPort,
      'GET',
      '/api/questions?category=group2_2a&unitId=1&lessonId=test-gt-1-6-t1-l1'
    );
    const finalL2 = await request(
      targetPort,
      'GET',
      '/api/questions?category=group2_2a&unitId=1&lessonId=test-gt-1-6-t1-l2'
    );
    console.log('Final Lesson 1.1 questions:', finalL1.body?.data?.length, '(expected 2)');
    console.log('Final Lesson 1.2 questions:', finalL2.body?.data?.length, '(expected 1)');
    if (finalL1.body?.data?.length !== 2 || finalL2.body?.data?.length !== 1) {
      throw new Error('Isolation failed: incorrect question counts per lesson');
    }
    console.log('✓ PERFECT 1-TO-1 STRICT LESSON-WISE ISOLATION CONFIRMED!');

    console.log('\n======================================================');
    console.log('ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (100% GREEN)');
    console.log('======================================================\n');
  } finally {
    // Clean up test records
    if (createdIds.length > 0) {
      await pool.query('DELETE FROM questions WHERE id = ANY($1)', [createdIds]);
      console.log(`Cleaned up ${createdIds.length} test records.`);
    }
    await pool.end();
  }
}

run().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
