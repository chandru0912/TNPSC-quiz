// Seeds an English Science textbook from the native English PDF, extracts it, then runs
// the MCQ pipeline (real retrieval/validation, stubbed AI transport).
const path = require('path');
const fs = require('fs');
process.chdir(__dirname);
const pool = require('./dist/db').default;
const svc = require('./dist/services/pdfExtractionService');
const { resolveMcqSelection } = require('./dist/services/mcqCascadeService');
const { generateMcqs } = require('./dist/services/mcqGenerator');
const { AIProviderFactory } = require('./dist/services/ai/ai-provider.factory');

const originalGetProvider = AIProviderFactory.getProvider.bind(AIProviderFactory);
let lastPrompt = '', lastSystem = '';
AIProviderFactory.getProvider = (name) => {
  const real = originalGetProvider(name);
  return {
    ...real,
    async generateJson(prompt, options) {
      lastPrompt = prompt; lastSystem = options?.systemPrompt || '';
      const source = prompt.split('"""')[1] || '';
      const lines = source.split('\n').map(l => l.trim()).filter(l => l.length > 30).slice(0, 4);
      return { questions: lines.map((line, i) => ({
        question: `Q${i + 1}: ${line.slice(0, 70)}?`,
        options: [`A-${i}`, `B-${i}`, `C-${i}`, `D-${i}`],
        correctAnswer: i % 4,
        explanation: `Grounded in: ${line.slice(0, 50)}`,
        difficulty: 'Easy',
      })) };
    },
  };
};

(async () => {
  const filePath = path.resolve(__dirname, '..', '497_group 1 preliminary syllabus.pdf');
  await pool.query(`DELETE FROM textbooks WHERE book_name='__extract_test_en_sci__'`);
  const ins = await pool.query(
    `INSERT INTO textbooks (group_id, standard, subject, medium, term, book_name, file_path, file_size, status)
     VALUES ('group1', 6, 'Science', 'English', 'Full Year', '__extract_test_en_sci__', $1, $2, 'uploaded') RETURNING id`,
    [filePath, fs.statSync(filePath).size]
  );
  const id = ins.rows[0].id;
  const ex = await svc.processAutomaticPdfExtraction({ textbookId: id, maxDurationMs: 120000 });
  console.log('EXTRACT', { status: ex.status, pages: ex.totalPages, native: ex.nativePagesCount, ocr: ex.ocrPagesCount });

  const selection = await resolveMcqSelection({
    groupId: 'group1', subject: 'General Studies', standard: 6, unitId: 1,
    textbookId: id, term: 'Full Year', lessonTitle: 'Science Chapter 1',
  });
  console.log('SELECTION', { lesson: selection.lesson.title, pages: selection.pages, chars: selection.content.length });

  const result = await generateMcqs({
    provider: 'gemini', category: 'group1', standard: 6, subject: 'General Studies',
    term: selection.term || 'Full Year', unitId: 1, unitTitle: selection.lesson.unitTitle || undefined,
    lessonTitle: selection.lesson.title, language: 'english', count: 5, difficulty: 'Easy',
    textbookContent: selection.content, textbookId: id, sourcePdf: selection.sourcePdf, sourcePages: selection.pages,
  });
  console.log('PROMPT HEAD', JSON.stringify(lastPrompt.slice(0, 260)));
  const checks = {
    generated: result.generatedCount,
    validOptions: result.questions.every(q => q.options.length === 4),
    englishPrompt: /TNPSC Examination/.test(lastPrompt) && /Language: ENGLISH/i.test(lastPrompt),
    grounded: lastPrompt.includes(selection.content.slice(0, 40)),
    textbookLinked: result.questions.every(q => q.textbookId === id),
  };
  console.log('ENGLISH PIPELINE', checks);
  const ok = result.generatedCount > 0 && checks.validOptions && checks.englishPrompt && checks.grounded && checks.textbookLinked;
  console.log(ok ? 'ENGLISH PIPELINE PASSED' : 'ENGLISH PIPELINE FAILED');
  await pool.end();
  process.exit(ok ? 0 : 1);
})().catch(async (e) => { console.error('TEST FAILED', e); try { await pool.end(); } catch {} process.exit(1); });
