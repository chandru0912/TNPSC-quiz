/**
 * Unified Cloud Generation Orchestrator
 * Coordinates complete lesson extraction, study notes generation, MCQ generation,
 * topic coverage validation, strict deduplication, and streaming progress updates.
 */

import pool from '../db';
import { retrieveRelevantTextbookContent, TextbookSearchQuery } from './textbookRag';
import { generateStudyNotes, GeneratedStudyNotesResult } from './studyNotesGenerator';
import { generateMcqs, GeneratedMcqItem, McqGenerationResult } from './mcqGenerator';
import { CloudAIService } from './cloudAi/cloudAiService';
import { cleanTamilUnicodeText } from './tamilUnicodeCleaner';
import { splitAndAlignNotesByTopic, persistTopicAlignedNotes, AlignedTopicItem, TopicSeparationResult } from './topicAlignmentService';
import { extractTextFromGoogleDrivePdf } from './googleDriveService';
import { resolveMcqSelection, ResolvedMcqSelection } from './mcqCascadeService';
import { AIProviderFactory } from './ai/ai-provider.factory';
import { AILogsService } from './ai/ai-logs.service';
import { AIProviderName } from './ai/ai-provider.interface';

export type GenerationMode = 'notes' | 'mcq' | 'both';
export type NotesFormatOption = 'short' | 'full' | 'both';

export interface UnifiedGenerationRequest {
  provider?: AIProviderName;
  category: string;
  standard: number;
  subject: string;
  term?: string;
  volume?: string;
  unitId: number;
  unitTitle?: string;
  lessonTitle: string;
  lessonId?: string;
  lessonNumber?: string;
  topic?: string;
  language: 'tamil' | 'english';
  mode: GenerationMode;
  notesFormat?: NotesFormatOption;
  questionCount?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Mixed';
  textbookMode?: 'auto' | 'specific' | 'custom_text' | 'gdrive';
  textbookId?: number;
  gdriveFileId?: string;
  gdriveMaterialId?: number;
  customText?: string;
  autoSaveToStaging?: boolean;
}

export interface ProgressCallbackData {
  step: number;
  totalSteps: number;
  stepName: string;
  progressPercent: number;
  meta?: any;
}

export type ProgressCallback = (data: ProgressCallbackData) => void;

export interface GeneratedNoteView {
  id?: number;
  title: string;
  content: string;
  topics: string[];
  topicsList?: AlignedTopicItem[];
  validation: any;
  status: 'staging' | 'preview';
  noteFormat: 'short' | 'full';
}

export interface UnifiedGenerationResult {
  status: 'success' | 'partial' | 'error';
  mode: GenerationMode;
  notesFormat?: NotesFormatOption;
  provider: string;
  model: string;
  textbookUsed?: {
    id: number | null;
    name: string | null;
    pageCount: number;
    relevantPages: number[];
  };
  studyNotes?: GeneratedNoteView;
  fullStudyNotes?: GeneratedNoteView;
  mcqs?: {
    questions: GeneratedMcqItem[];
    totalGenerated: number;
    duplicateCount: number;
    invalidCount: number;
    status: 'staging' | 'preview';
  };
}

export class CloudContentOrchestrator {
  /**
   * Main execution pipeline supporting streaming progress events.
   */
  static async execute(
    req: UnifiedGenerationRequest,
    onProgress?: ProgressCallback
  ): Promise<UnifiedGenerationResult> {
    const notesFormat = req.notesFormat || 'short';
    const isNotesMode = req.mode === 'notes' || req.mode === 'both';
    const totalSteps = req.mode === 'both' ? (notesFormat === 'both' ? 8 : 7) : (notesFormat === 'both' ? 6 : 5);
    let currentStep = 1;

    const report = (name: string, pct: number, meta?: any) => {
      onProgress?.({
        step: currentStep++,
        totalSteps,
        stepName: name,
        progressPercent: pct,
        meta,
      });
    };

    // Step 1: Provider Status Check & Verification
    const activeDefault = await AIProviderFactory.getActiveProvider();
    const targetProviderName: AIProviderName =
      req.provider === 'gemini'
        ? 'gemini'
        : req.provider === 'claude'
        ? 'claude'
        : activeDefault.name;

    const aiProvider = AIProviderFactory.getProvider(targetProviderName);
    report(`Connecting to ${aiProvider.displayName} & Checking Provider Readiness`, 10);
    const providerInfo = await aiProvider.getStatus();
    if (!providerInfo.configured) {
      const keyName = targetProviderName === 'gemini' ? 'GEMINI_API_KEY' : 'ANTHROPIC_API_KEY';
      throw new Error(
        `${aiProvider.displayName} is not configured. Set ${keyName} in backend environment or Admin Panel.`
      );
    }

    // Step 2: Textbook Content Extraction
    let textbookText = (req.customText || '').trim();
    let textbookDetails = {
      id: req.textbookId || req.gdriveMaterialId || null,
      name: null as string | null,
      pageCount: 0,
      relevantPages: [] as number[],
    };

    let mcqSelection: ResolvedMcqSelection | undefined;
    if (req.mode === 'mcq') {
      report('Re-validating selections against the processed lesson PDF', 15);
      mcqSelection = await resolveMcqSelection({
        groupId: req.category,
        subject: req.subject,
        standard: req.standard,
        unitId: req.unitId,
        textbookId: req.textbookId,
        materialId: req.gdriveMaterialId,
        gdriveFileId: req.gdriveFileId,
        term: req.term,
        volume: req.volume,
        lessonTitle: req.lessonTitle,
        lessonNumber: req.lessonNumber,
      });
      textbookText = mcqSelection.content;
      textbookDetails = {
        id: mcqSelection.candidate.textbookId || mcqSelection.candidate.materialId,
        name: mcqSelection.candidate.bookName,
        pageCount: mcqSelection.pages.length,
        relevantPages: mcqSelection.pages,
      };
    }

    if (!mcqSelection && req.textbookMode === 'gdrive' && (req.gdriveFileId || req.gdriveMaterialId)) {
      report('Retrieving & Extracting Textbook PDF from Google Drive', 20);
      try {
        const driveExtraction = await extractTextFromGoogleDrivePdf({
          fileId: req.gdriveFileId || '',
          materialId: req.gdriveMaterialId,
          lessonTitle: req.lessonTitle,
          unitId: req.unitId,
          standard: req.standard,
          subject: req.subject,
        });

        if (driveExtraction && driveExtraction.text && driveExtraction.text.length >= 50) {
          textbookText = driveExtraction.text;
          textbookDetails = {
            id: req.gdriveMaterialId || null,
            name: `[Google Drive] ${driveExtraction.fileName}`,
            pageCount: driveExtraction.pageCount,
            relevantPages: driveExtraction.relevantPages,
          };
          console.log(`[CloudOrchestrator] Using Google Drive textbook "${driveExtraction.fileName}" (${driveExtraction.text.length} chars, pages: ${driveExtraction.relevantPages.join(',') || 'full'}) for generation.`);
        } else {
          console.warn(`[CloudOrchestrator] Google Drive PDF extraction returned insufficient text. Falling back to syllabus matching.`);
        }
      } catch (gdriveErr: any) {
        console.error(`[CloudOrchestrator] Google Drive PDF extraction error:`, gdriveErr.message);
        throw new Error(`Google Drive PDF extraction failed: ${gdriveErr.message}`);
      }
    } else if (!mcqSelection && !textbookText) {
      report('Extracting Complete Lesson Textbook Content & Headings', 20);
      const ragQuery: TextbookSearchQuery = {
        groupId: req.category,
        standard: req.standard,
        subject: req.subject,
        term: req.term,
        unitId: req.unitId,
        lessonTitle: req.lessonTitle,
        topic: req.topic,
        textbookId: req.textbookId,
        maxPages: 100, // Process complete lesson without arbitrary small limits
      };

      const ragResult = await retrieveRelevantTextbookContent(ragQuery);

      if (ragResult.hasSufficientContent && ragResult.chunks.length > 0) {
        textbookText = ragResult.chunks.map((c) => c.content).join('\n\n');
        textbookDetails = {
          id: ragResult.textbookId,
          name: ragResult.bookName,
          pageCount: ragResult.chunks.length,
          relevantPages: ragResult.relevantPages,
        };
      }
    }

    // No textbook was provided; Claude will generate from the selected syllabus only.
    if (!textbookText || textbookText.length < 50) {
      if (req.mode === 'mcq') {
        throw new Error(
          'No verified lesson PDF content is available. Select a processed textbook lesson before generating MCQs.'
        );
      }
      textbookText = '';
    }

    let shortNotesResult: GeneratedStudyNotesResult | undefined;
    let fullNotesResult: GeneratedStudyNotesResult | undefined;
    let shortSeparation: TopicSeparationResult | undefined;
    let fullSeparation: TopicSeparationResult | undefined;
    let savedShortNoteId: number | undefined;
    let savedFullNoteId: number | undefined;

    const sourceRef = mcqSelection
      ? `${mcqSelection.sourcePdf}${mcqSelection.term ? `, ${mcqSelection.term}` : ''}${mcqSelection.volume ? `, ${mcqSelection.volume}` : ''} (Pages: ${mcqSelection.pages.join(',')})`
      : textbookDetails.name
      ? `${textbookDetails.name} (Pages: ${textbookDetails.relevantPages.join(',')})`
      : `${aiProvider.displayName} generation (no textbook PDF provided)`;

    // Study Notes Generation
    if (isNotesMode) {
      const shouldGenShort = notesFormat === 'short' || notesFormat === 'both';
      const shouldGenFull = notesFormat === 'full' || notesFormat === 'both';

      if (shouldGenShort) {
        report(
          notesFormat === 'both'
            ? 'Generating Concise Exam-Oriented Short Notes (1/2)'
            : 'Generating Concise Exam-Oriented Short Notes',
          notesFormat === 'both' ? 35 : 40
        );

        shortNotesResult = await generateStudyNotes({
          provider: targetProviderName,
          category: req.category,
          standard: req.standard,
          subject: req.subject,
          unitId: req.unitId,
          unitTitle: req.unitTitle,
          lessonTitle: req.lessonTitle,
          lessonId: req.lessonId,
          lessonNumber: req.lessonNumber,
          language: req.language,
          noteFormat: 'short',
          textbookContent: textbookText,
          extractedPages: textbookDetails.relevantPages,
          textbookName: textbookDetails.name || undefined,
        });

        // Automatically separate into distinct topic notes
        shortSeparation = splitAndAlignNotesByTopic({
          content: shortNotesResult.content,
          category: req.category,
          subject: req.subject,
          classId: req.standard,
          unitId: req.unitId,
          lessonTitle: req.lessonTitle,
          lessonId: req.lessonId,
          lessonNumber: req.lessonNumber,
          language: req.language,
        });

        if (req.autoSaveToStaging) {
          const persistResult = await persistTopicAlignedNotes(pool, {
            category: req.category,
            subject: req.subject,
            classId: req.standard,
            unitId: req.unitId,
            term: req.term || 'Term 1',
            lessonId: req.lessonId,
            lessonNumber: req.lessonNumber,
            lessonTitle: req.lessonTitle,
            language: req.language,
            noteFormat: 'short',
            sourceReference: sourceRef,
            status: 'staging',
            separationResult: shortSeparation,
          });
          savedShortNoteId = persistResult.masterNoteId;
        }
      }

      if (shouldGenFull) {
        report(
          notesFormat === 'both'
            ? 'Generating In-Depth Full Comprehensive Notes (2/2)'
            : 'Generating In-Depth Full Comprehensive Notes',
          notesFormat === 'both' ? 55 : 40
        );

        fullNotesResult = await generateStudyNotes({
          provider: targetProviderName,
          category: req.category,
          standard: req.standard,
          subject: req.subject,
          unitId: req.unitId,
          unitTitle: req.unitTitle,
          lessonTitle: req.lessonTitle,
          lessonId: req.lessonId,
          lessonNumber: req.lessonNumber,
          language: req.language,
          noteFormat: 'full',
          textbookContent: textbookText,
          extractedPages: textbookDetails.relevantPages,
          textbookName: textbookDetails.name || undefined,
        });

        // Automatically separate into distinct topic notes
        fullSeparation = splitAndAlignNotesByTopic({
          content: fullNotesResult.content,
          category: req.category,
          subject: req.subject,
          classId: req.standard,
          unitId: req.unitId,
          lessonTitle: req.lessonTitle,
          lessonId: req.lessonId,
          lessonNumber: req.lessonNumber,
          language: req.language,
        });

        if (req.autoSaveToStaging) {
          const persistResult = await persistTopicAlignedNotes(pool, {
            category: req.category,
            subject: req.subject,
            classId: req.standard,
            unitId: req.unitId,
            term: req.term || 'Term 1',
            lessonId: req.lessonId,
            lessonNumber: req.lessonNumber,
            lessonTitle: req.lessonTitle,
            language: req.language,
            noteFormat: 'full',
            sourceReference: sourceRef,
            status: 'staging',
            separationResult: fullSeparation,
          });
          savedFullNoteId = persistResult.masterNoteId;
        }
      }

      report('Validating Topic Coverage & Syllabus Alignment', 65, {
        shortTopics: shortNotesResult?.topics,
        fullTopics: fullNotesResult?.topics,
      });
    }

    let mcqsResult: McqGenerationResult | undefined;

    // MCQ Generation (if requested)
    if (req.mode === 'mcq' || req.mode === 'both') {
      report('Generating High-Yield TNPSC Questions', 75);

      mcqsResult = await generateMcqs(
        {
          provider: targetProviderName,
          category: req.category,
          standard: req.standard,
          subject: req.subject,
          term: mcqSelection?.term || req.term,
          volume: mcqSelection?.volume || req.volume,
          unitId: req.unitId,
          unitTitle: req.unitTitle,
          lessonTitle: req.lessonTitle,
          lessonId: req.lessonId,
          lessonNumber: req.lessonNumber,
          topic: req.topic,
          language: req.language,
          count: req.questionCount || 20,
          difficulty: req.difficulty || 'Medium',
          textbookContent: textbookText,
          textbookId: mcqSelection?.candidate.textbookId || undefined,
          textbookName: mcqSelection?.textbookName,
          textbookSubject: mcqSelection?.textbookSubject,
          sourcePdf: mcqSelection?.sourcePdf,
          sourcePages: mcqSelection?.pages,
        },
        (progressPct, msg) => {
          onProgress?.({
            step: currentStep,
            totalSteps,
            stepName: msg,
            progressPercent: progressPct,
          });
        }
      );

      report('Conducting Quality Review & Strict Semantic Deduplication', 90, {
        approved: mcqsResult.questions.length,
        duplicatesFiltered: mcqsResult.duplicateCount,
      });

      // Auto-save to database staging if flag is active
      if (req.autoSaveToStaging && mcqsResult.questions.length > 0) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          for (const q of mcqsResult.questions) {
            await client.query(
              `INSERT INTO questions (
                category, unit_id, class_id, subject, lesson_title, lesson_number,
                topic, difficulty, question_text, options, correct_answer,
                explanation, status, source_reference, target_system,
                language, option_a, option_b, option_c, option_d,
                term, volume, source_pdf, source_page, textbook_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'staging', $13, 'study_materials', $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
              ON CONFLICT (lesson_title, question_text) DO NOTHING`,
              [
                q.category,
                q.unitId,
                q.standard,
                q.subject,
                q.lessonTitle,
                req.lessonNumber || null,
                q.topic || q.lessonTitle,
                q.difficulty,
                q.question,
                JSON.stringify(q.options),
                q.correctAnswer,
                q.explanation,
                mcqSelection ? sourceRef : (textbookDetails.name || 'Claude AI generation (no textbook PDF provided)'),
                q.language || 'tamil',
                q.optionA || q.options[0] || '',
                q.optionB || q.options[1] || '',
                q.optionC || q.options[2] || '',
                q.optionD || q.options[3] || '',
                mcqSelection?.term || req.term || null,
                mcqSelection?.volume || req.volume || null,
                mcqSelection?.sourcePdf || textbookDetails.name || null,
                mcqSelection?.pages[0] ?? null,
                mcqSelection?.candidate.textbookId || null,
              ]
            );
          }
          await client.query('COMMIT');
        } catch (dbErr) {
          await client.query('ROLLBACK');
          console.warn('[Orchestrator] Could not auto-save MCQs to staging:', dbErr);
        } finally {
          client.release();
        }
      }
    }

    // Step Final: Ready
    report('Generation Completed Successfully', 100);

    const studyNotesOutput: GeneratedNoteView | undefined = shortNotesResult
      ? {
          id: savedShortNoteId,
          title: shortNotesResult.title,
          content: shortNotesResult.content,
          topics: shortNotesResult.topics,
          topicsList: shortSeparation?.topics,
          validation: shortNotesResult.validation,
          status: savedShortNoteId ? 'staging' : 'preview',
          noteFormat: 'short',
        }
      : (fullNotesResult && notesFormat === 'full'
          ? {
              id: savedFullNoteId,
              title: fullNotesResult.title,
              content: fullNotesResult.content,
              topics: fullNotesResult.topics,
              topicsList: fullSeparation?.topics,
              validation: fullNotesResult.validation,
              status: savedFullNoteId ? 'staging' : 'preview',
              noteFormat: 'full',
            }
          : undefined);

    const fullNotesOutput: GeneratedNoteView | undefined = fullNotesResult
      ? {
          id: savedFullNoteId,
          title: fullNotesResult.title,
          content: fullNotesResult.content,
          topics: fullNotesResult.topics,
          topicsList: fullSeparation?.topics,
          validation: fullNotesResult.validation,
          status: savedFullNoteId ? 'staging' : 'preview',
          noteFormat: 'full',
        }
      : undefined;

    // Log generation history independently
    await AILogsService.logGeneration({
      provider: targetProviderName,
      model: providerInfo.model,
      generationType: req.mode,
      groupId: req.category,
      standard: req.standard,
      subject: req.subject,
      unitId: req.unitId,
      lessonTitle: req.lessonTitle,
      language: req.language,
      status: 'success',
      itemsCount: (mcqsResult?.questions?.length || 0) + (shortNotesResult ? 1 : 0) + (fullNotesResult ? 1 : 0),
      metadata: {
        textbook: textbookDetails.name,
        pages: textbookDetails.relevantPages,
        duplicatesFiltered: mcqsResult?.duplicateCount || 0,
      },
    });

    return {
      status: 'success',
      mode: req.mode,
      notesFormat,
      provider: targetProviderName,
      model: providerInfo.model,
      textbookUsed: textbookDetails,
      studyNotes: studyNotesOutput,
      fullStudyNotes: fullNotesOutput,
      mcqs: mcqsResult
        ? {
            questions: mcqsResult.questions,
            totalGenerated: mcqsResult.generatedCount,
            duplicateCount: mcqsResult.duplicateCount,
            invalidCount: mcqsResult.invalidCount,
            status: req.autoSaveToStaging ? 'staging' : 'preview',
          }
        : undefined,
    };
  }

  /**
   * Saves or updates a study note in staging, strictly preventing duplicates during regeneration.
   */
  static async saveOrUpdateStagingNote(params: {
    category: string;
    unitId: number;
    classId: number;
    subject: string;
    term: string;
    lessonId?: string;
    lessonNumber?: string;
    lessonTitle: string;
    topic: string;
    language: string;
    title: string;
    content: string;
    sourceReference: string;
    noteFormat: 'short' | 'full';
  }): Promise<number | undefined> {
    try {
      // 1. Check if a note already exists for this exact lesson, language, and note_format
      const existing = await pool.query(
        `SELECT id FROM study_notes
         WHERE category = $1
           AND subject = $2
           AND class_id = $3
           AND unit_id = $4
           AND (LOWER(lesson_title) = LOWER($5) OR (lesson_id IS NOT NULL AND lesson_id = $6))
           AND language = $7
           AND COALESCE(note_format, 'short') = $8
         ORDER BY id DESC LIMIT 1`,
        [
          params.category,
          params.subject,
          params.classId,
          params.unitId,
          params.lessonTitle.trim(),
          params.lessonId || '',
          params.language,
          params.noteFormat,
        ]
      );

      if (existing.rows.length > 0) {
        const existingId = existing.rows[0].id;
        await pool.query(
          `UPDATE study_notes
           SET title = $1, content = $2, source_reference = $3, note_format = $4, updated_at = NOW()
           WHERE id = $5`,
          [params.title, params.content, params.sourceReference, params.noteFormat, existingId]
        );
        return existingId;
      }

      const insertRes = await pool.query(
        `INSERT INTO study_notes (
          category, unit_id, class_id, subject, term,
          lesson_id, lesson_number, lesson_title, topic,
          language, title, content, status, source_reference, note_format
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'staging', $13, $14)
        RETURNING id`,
        [
          params.category,
          params.unitId,
          params.classId,
          params.subject,
          params.term || 'Term 1',
          params.lessonId || null,
          params.lessonNumber || '1.1',
          params.lessonTitle,
          params.topic || params.lessonTitle,
          params.language,
          params.title,
          params.content,
          params.sourceReference,
          params.noteFormat,
        ]
      );
      return insertRes.rows[0]?.id;
    } catch (err) {
      console.warn(`[Orchestrator] Error saving staging note (${params.noteFormat}):`, err);
      return undefined;
    }
  }
}

