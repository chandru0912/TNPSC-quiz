const pool = require('./dist/db').default;
const { resolveMcqSelection } = require('./dist/services/mcqCascadeService');
const { generateMcqs } = require('./dist/services/mcqGenerator');
const { AIProviderFactory } = require('./dist/services/ai/ai-provider.factory');

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
    bookName: selection.candidate.bookName,
    sourceType: selection.candidate.sourceType,
    lesson: selection.lesson.title,
    unit: selection.lesson.unitTitle,
    pages: selection.pages,
    contentChars: selection.content.length,
    sourcePdf: selection.sourcePdf,
    term: selection.term,
  });
  if (selection.content.length < 50) throw new Error('Selected lesson content too short');
  if (!selection.pages.length) throw new Error('No pages mapped');

  // Provider isolation: distinct instances, keys, models.
  const gem = AIProviderFactory.getProvider('gemini');
  const cla = AIProviderFactory.getProvider('claude');
  const [gemStatus, claStatus] = await Promise.all([gem.getStatus(), cla.getStatus()]);
  console.log('ISOLATION', {
    distinctInstances: gem !== cla,
    geminiName: gemStatus.name, geminiModel: gemStatus.model, geminiConfigured: gemStatus.configured,
    claudeName: claStatus.name, claudeModel: claStatus.model, claudeConfigured: claStatus.configured,
    keysDistinct: gemStatus.maskedKey !== claStatus.maskedKey,
  });

  try {
    const result = await generateMcqs({
      provider: providerArg,
      category: 'group4',
      standard: 6,
      subject: language === 'tamil' ? 'Tamil' : 'General Studies',
      term: selection.term || 'Term 1',
      volume: selection.volume || undefined,
      unitId: 1,
      unitTitle: selection.lesson.unitTitle || undefined,
      lessonTitle: selection.lesson.title,
      lessonNumber: selection.lesson.lessonNumber || undefined,
      language,
      count: 5,
      difficulty: 'Medium',
      textbookContent: selection.content,
      textbookId: tbId,
      textbookName: selection.textbookName,
      textbookSubject: selection.textbookSubject,
      sourcePdf: selection.sourcePdf,
      sourcePages: selection.pages,
    });
    console.log('GENERATED', {
      provider: providerArg,
      generated: result.generatedCount,
      requested: result.requestedCount,
      duplicates: result.duplicateCount,
      invalid: result.invalidCount,
    });
    console.log('SAMPLE', result.questions.slice(0, 2).map(q => ({
      q: q.question,
      options: q.options,
      correct: q.correctAnswer,
      lang: q.language,
      textbookId: q.textbookId,
    })));
    const ok = result.generatedCount > 0 && result.questions.every(q => q.options.length === 4 && q.correctAnswer >= 0 && q.correctAnswer <= 3);
    console.log(ok ? 'MCQ TEST PASSED' : 'MCQ TEST FAILED');
    await pool.end();
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error(`MCQ ${providerArg.toUpperCase()} ERROR:`, err.message);
    await pool.end();
    process.exit(2);
  }
})().catch(async (e) => { console.error('TEST FAILED', e); try { await pool.end(); } catch {} process.exit(1); });
