import assert from 'assert';
import {
  extractQuestionsFromPreviousPaperPdf,
  parseOfficialAnswerKeyText,
  detectAnswerKeyTierFromText,
  ANSWER_STATUS_PRIORITY,
  keyTierToAnswerStatus,
} from '../services/previousPaperPdfParser';
import { normalizeGroupCategory } from '../services/previousPapersAdminService';

/**
 * Generates a valid multi-page PDF 1.4 binary buffer containing the given page texts
 * so pdf-parse extracts the text authentically end-to-end.
 */
function buildTextPdfBuffer(pages: string[]): Buffer {
  const objects: string[] = [];
  const addObj = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const fontId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds: number[] = [];

  for (const pageText of pages) {
    const lines = pageText.split('\n');
    const ops: string[] = ['BT', '/F1 10 Tf', '40 780 Td', '12 TL'];
    for (const line of lines) {
      const escaped = line
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/[^\x20-\x7E]/g, ' ');
      ops.push(`(${escaped}) Tj T*`);
    }
    ops.push('ET');
    const stream = ops.join('\n');
    const contentId = addObj(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
    const pageId = addObj(
      `<< /Type /Page /Parent PAGES_REF /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  const pagesId = addObj(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
  );
  for (const pid of pageIds) {
    objects[pid - 1] = objects[pid - 1].replace('PAGES_REF', `${pagesId} 0 R`);
  }
  const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

async function main() {
  console.log('=== TNPSC Previous Year Papers Automatic Exam Generator — Automated Tests ===\n');

  // 1. Group normalization (Group 1, Group 2, Group 2A, Group 2 & 2A, Group 4)
  assert.strictEqual(normalizeGroupCategory('group1').category, 'group1');
  assert.strictEqual(normalizeGroupCategory('group2').category, 'group2');
  assert.strictEqual(normalizeGroupCategory('group2a').category, 'group2a');
  assert.strictEqual(normalizeGroupCategory('group2_2a').category, 'group2_2a');
  assert.strictEqual(normalizeGroupCategory('group4').category, 'group4');
  console.log('✓ 1. Group normalization verified (Group 1, Group 2, Group 2A, Group 2 & 2A, Group 4)');

  // 2. Full 200-question official English PDF + Multi-series Booklet B Official Final Answer Key
  const qPages: string[] = [];
  const keyLines: string[] = ['TNPSC GROUP 4 2025 FINAL ANSWER KEY', 'Q.No   A   B   C   D'];
  const letters = ['A', 'B', 'C', 'D'];
  for (let page = 0; page < 20; page++) {
    const lines: string[] = [page === 0 ? 'PART A - GENERAL STUDIES' : page === 10 ? 'PART B - APTITUDE AND MENTAL ABILITY' : ''];
    for (let j = 1; j <= 10; j++) {
      const qNum = page * 10 + j;
      lines.push(`${qNum}. Official TNPSC question number ${qNum} regarding Indian Constitution and Tamil Nadu administration?`);
      lines.push(`(A) Choice Alpha ${qNum}`);
      lines.push(`(B) Choice Beta ${qNum}`);
      lines.push(`(C) Choice Gamma ${qNum}`);
      lines.push(`(D) Choice Delta ${qNum} (E) Answer not known`);
      const ansB = letters[qNum % 4];
      keyLines.push(`${qNum}   ${letters[(qNum + 1) % 4]}   ${ansB}   ${letters[(qNum + 2) % 4]}   ${letters[(qNum + 3) % 4]}`);
    }
    qPages.push(lines.join('\n'));
  }

  const qPdf200 = buildTextPdfBuffer(qPages);
  const keyPages: string[] = [];
  for (let i = 0; i < keyLines.length; i += 50) {
    keyPages.push(keyLines.slice(i, i + 50).join('\n'));
  }
  const keyPdf200 = buildTextPdfBuffer(keyPages);

  const res200 = await extractQuestionsFromPreviousPaperPdf({
    questionPdfBuffer: qPdf200,
    answerKeyPdfBuffer: keyPdf200,
    answerKeyFilename: 'TNPSC_Group4_2025_Final_Answer_Key.pdf',
    bookletCode: 'B',
    expectedTotalQuestions: 200,
    defaultSubject: 'General Studies',
    medium: 'English',
  });

  assert.strictEqual(res200.extractedCount, 200, `Expected 200 extracted, got ${res200.extractedCount}`);
  assert.strictEqual(res200.missingQuestionNumbers.length, 0, 'Expected 0 missing question numbers');
  assert.strictEqual(res200.matchedAnswerKeysCount, 200, `Expected 200 matched keys, got ${res200.matchedAnswerKeysCount}`);
  assert.strictEqual(res200.unverifiedAnswerCount, 0, 'Expected 0 unverified answers');
  assert.strictEqual(res200.questions[0].answerStatus, 'verified_final');
  assert.strictEqual(res200.questions[0].optionD, 'Choice Delta 1', 'Option E must be cleanly separated from Option D');
  assert.strictEqual(res200.questions[0].optionE, 'Answer not known');
  assert.strictEqual(res200.questions[0].correctAnswer, 1 % 4, 'Booklet B answer must match Series B column');
  assert.strictEqual(res200.questions[199].originalQuestionNumber, '200');
  console.log('✓ 2. 200-question PDF + Multi-series Booklet B Final Key verified (200/200 extracted & matched, Option E separated)');

  // 3. Missing Answer Key -> UNVERIFIED (never guessed!)
  const resNoKey = await extractQuestionsFromPreviousPaperPdf({
    questionPdfBuffer: buildTextPdfBuffer([
      '1. Which Article guarantees Equality Before Law?\n(A) Art 14\n(B) Art 19\n(C) Art 21\n(D) Art 32\n' +
      '2. Who led the Vedaranyam Salt Satyagraha?\n(A) Rajaji\n(B) Kamaraj\n(C) Bharati\n(D) VOC',
    ]),
    answerKeyPdfBuffer: null,
    expectedTotalQuestions: 2,
    defaultSubject: 'General Studies',
    medium: 'English',
  });
  assert.strictEqual(resNoKey.extractedCount, 2);
  assert.strictEqual(resNoKey.unverifiedAnswerCount, 2);
  assert.strictEqual(resNoKey.questions[0].answerStatus, 'unverified');
  assert.strictEqual(resNoKey.questions[0].needsReview, true);
  console.log('✓ 3. Missing Answer Key verified (marked UNVERIFIED & needsReview=true, never guessed)');

  // 4. Tentative Answer Key tier & Priority ordering
  const tentKey = parseOfficialAnswerKeyText('TNPSC Tentative Answer Key 2025\n1. A\n2. C', {
    filename: 'tentative_key_2025.pdf',
  });
  assert.strictEqual(tentKey.detectedKeyType, 'tentative');
  assert.strictEqual(tentKey.answers.get(1), 0);
  assert.strictEqual(tentKey.answers.get(2), 2);
  assert.ok(ANSWER_STATUS_PRIORITY[keyTierToAnswerStatus('final')] > ANSWER_STATUS_PRIORITY[keyTierToAnswerStatus('revised')]);
  assert.ok(ANSWER_STATUS_PRIORITY[keyTierToAnswerStatus('revised')] > ANSWER_STATUS_PRIORITY[keyTierToAnswerStatus('tentative')]);
  assert.ok(ANSWER_STATUS_PRIORITY[keyTierToAnswerStatus('tentative')] > ANSWER_STATUS_PRIORITY['admin_verified']);
  assert.strictEqual(detectAnswerKeyTierFromText('Official Revised Answer Key'), 'revised');
  console.log('✓ 4. Answer Key priority hierarchy verified (Final > Revised > Tentative > Admin > Unverified)');

  // 5. Conflict Detection (uploaded key disagrees with inline key)
  const conflictQPdf = buildTextPdfBuffer([
    '1. What is the SI unit of luminous intensity in the International System of Units?\n(A) Kelvin\n(B) Candela\n(C) Mole\n(D) Ampere\nAnswer: C\n' +
    '2. Which river is known as the Dakshin Ganga of South India?\n(A) Vaigai\n(B) Kaveri\n(C) Palar\n(D) Pennaiyar\nAnswer: B',
  ]);
  const conflictKeyPdf = buildTextPdfBuffer(['FINAL ANSWER KEY\n1. B\n2. B']);
  const resConflict = await extractQuestionsFromPreviousPaperPdf({
    questionPdfBuffer: conflictQPdf,
    answerKeyPdfBuffer: conflictKeyPdf,
    expectedTotalQuestions: 1,
    defaultSubject: 'General Science',
    medium: 'English',
  });
  assert.strictEqual(resConflict.conflictCount, 1);
  assert.strictEqual(resConflict.questions[0].answerStatus, 'conflict');
  assert.strictEqual(resConflict.questions[0].needsReview, true);
  console.log('✓ 5. Conflicting Answer Key detection verified (flagged as CONFLICT for Admin review)');

  // 6. Missing Question Accounting + Duplicate Detection (never invents artificial questions)
  const partialPdf = buildTextPdfBuffer([
    '1. First unique TNPSC polity question about fundamental rights?\n(A) One\n(B) Two\n(C) Three\n(D) Four\n' +
    '2. First unique TNPSC polity question about fundamental rights?\n(A) One\n(B) Two\n(C) Three\n(D) Four\n' +
    '4. Question four with valid options?\n(A) Alpha\n(B) Beta\n(C) Gamma\n(D) Delta',
  ]);
  const resPartial = await extractQuestionsFromPreviousPaperPdf({
    questionPdfBuffer: partialPdf,
    expectedTotalQuestions: 5,
    defaultSubject: 'General Studies',
    medium: 'English',
  });
  assert.strictEqual(resPartial.extractedCount, 3, 'Must NOT invent missing questions 3 and 5');
  assert.deepStrictEqual(resPartial.missingQuestionNumbers, [3, 5]);
  assert.strictEqual(resPartial.duplicateCount, 1);
  assert.strictEqual(resPartial.questions[1].isDuplicate, true);
  console.log('✓ 6. Missing question accounting ([3, 5]) & duplicate detection verified (zero artificial questions created)');

  // 7. Scanned / empty-text PDF graceful handling
  const scannedPdf = buildTextPdfBuffer(['']);
  const resScanned = await extractQuestionsFromPreviousPaperPdf({
    questionPdfBuffer: scannedPdf,
    expectedTotalQuestions: 100,
    defaultSubject: 'General Studies',
    medium: 'Tamil',
  });
  assert.strictEqual(resScanned.extractionMethod, 'scanned_flagged');
  assert.strictEqual(resScanned.extractedCount, 0);
  assert.strictEqual(resScanned.failedExtractionCount, 100);
  assert.ok(resScanned.warnings.length > 0);
  console.log('✓ 7. Scanned PDF fallback handling verified (gracefully flagged with 100 failed/missing accounted)');

  console.log('\nALL 7 AUTOMATED TEST SUITES PASSED! ✓');
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
