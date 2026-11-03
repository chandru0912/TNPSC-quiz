// Pipeline test: real lesson retrieval + real validation/dedup, stubbed AI transport.
// Real provider calls are blocked by account billing (Claude credits, Gemini project free tier).
const pool = require('./dist/db').default;
const { resolveMcqSelection } = require('./dist/services/mcqCascadeService');
const { generateMcqs } = require('./dist/services/mcqGenerator');
const { AIProviderFactory } = require('./dist/services/ai/ai-provider.factory');

const originalGetProvider = AIProviderFactory.getProvider.bind(AIProviderFactory);
let lastPrompt = '';
let lastSystem = '';

AIProviderFactory.getProvider = (name) => {
  const real = originalGetProvider(name);
  return {
    ...real,
    name: real.name,
    displayName: real.displayName,
    getStatus: () => real.getStatus(),
    async generateJson(prompt, options) {
      lastPrompt = prompt;
      lastSystem = options?.systemPrompt || '';
      // Derive grounded questions from the real source text in the prompt.
      const source = prompt.split('"""')[1] || '';
      const lines = source.split('\n').map(l => l.trim()).filter(l => l.length > 30).slice(0, 5);
      return {
        questions: lines.map((line, i) => ({
          question: `Q${i + 1}: ${line.slice(0, 70)}?`,
          options: [`A-${i}`, `B-${i}`, `C-${i}`, `D-${i}`],
          correctAnswer: i % 4,
          explanation: `Grounded in: ${line.slice(0, 50)}`,
          difficulty: 'Medium',
          topic: 'pipeline-test',
        })),
      };
    },
  };
};

(async () => {
  const providerArg = process.argv[2] || 'gemini';
  const tbId = Number(process.argv[3] || 613);
  const lessonTitle = process.argv[4] || 'இன்பத்தமிழ்';
  const language = process.argv[5] || 'tamil';

  const selection = await resolveMcqSelection({
    groupId: 'group4',
    subject: language === 'tamil' ? 'Tamil' : 'General Studies',
    standard: 6,
    unitId: 1,
    textbookId: tbId,
    term: 'Term 1',
    lessonTitle,
  });
  console.log('SELECTION', {
    lesson: selection.lesson.title,
    unit: selection.lesson.unitTitle,
    pages: selection.pages,
    contentChars: selection.content.length,
  });

  const result = await generateMcqs({
    provider: providerArg,
    category: 'group4',
    standard: 6,
    subject: language === 'tamil' ? 'Tamil' : 'General Studies',
    term: selection.term || 'Term 1',
    unitId: 1,
    unitTitle: selection.lesson.unitTitle || undefined,
    lessonTitle: selection.lesson.title,
    language,
    count: 5,
    difficulty: 'Medium',
    textbookContent: selection.content,
    textbookId: tbId,
    sourcePdf: selection.sourcePdf,
    sourcePages: selection.pages,
  });

  const tamilPrompt = /தமிழ்|TNPSC தேர்வு/.test(lastPrompt + lastSystem);
  const checks = {
    generated: result.generatedCount,
    validOptions: result.questions.every(q => q.options.length === 4),
    validAnswer: result.questions.every(q => q.correctAnswer >= 0 && q.correctAnswer <= 3),
    groundedSourceInPrompt: lastPrompt.includes(selection.content.slice(0, 40)),
    languagePrompt: language === 'tamil' ? tamilPrompt : !tamilPrompt,
    textbookLinked: result.questions.every(q => q.textbookId === tbId),
    pagesLinked: result.questions.every(q => q.sourcePage === selection.pages[0]),
  };
  console.log('PIPELINE CHECKS', checks);
  const ok = result.generatedCount > 0 && checks.validOptions && checks.validAnswer && checks.groundedSourceInPrompt && checks.languagePrompt && checks.textbookLinked;
  console.log(ok ? 'PIPELINE TEST PASSED' : 'PIPELINE TEST FAILED');
  await pool.end();
  process.exit(ok ? 0 : 1);
})().catch(async (e) => { console.error('TEST FAILED', e); try { await pool.end(); } catch {} process.exit(1); });
