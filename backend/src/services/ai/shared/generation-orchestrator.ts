/**
 * Unified TNPSC MCQ Generation Orchestrator
 * Coordinates the full-stack MCQ generation workflow for Anthropic Claude and Google Gemini
 * while enforcing complete provider isolation (independent keys, models, prompts, logs, zero fallback).
 */

import pool from '../../../db';
import { StandardizedMcqItem, toDatabaseQuestionPayload } from './mcq-schema';
import { TextbookContentService, VerifiedTextbookContext } from './textbook-content.service';
import { TopicExtractionService } from './topic-extraction.service';
import { SyllabusContextService, StandardizedSyllabusContext } from './syllabus-context.service';
import { validateBatchMcqs } from './mcq-validator';
import { randomizeBatchOptions } from './option-randomizer';
import { filterDuplicates, BatchDuplicateFilterResult } from './duplicate-detector';
import { ClaudeService } from '../providers/claude/claude.service';
import { GeminiService } from '../providers/gemini/gemini.service';
import { OpenAIService } from '../providers/openai/openai.service';
import { getClaudeModel } from '../providers/claude/claude.config';
import { getGeminiModel } from '../providers/gemini/gemini.config';
import { getOpenAiModel } from '../providers/openai/openai.config';
import { CLAUDE_DEFAULT_PROMPTS } from '../providers/claude/claude.prompts';
import { GEMINI_DEFAULT_PROMPTS } from '../providers/gemini/gemini.prompts';
import { AILogsService } from '../ai-logs.service';
import { AIProviderName } from '../ai-provider.interface';

export interface McqGenerationInput {
  groupId: string;
  subject: string;
  standard: string;
  unitId: number | string;
  term?: string;
  lessonTitle: string;
  lessonKey?: string;
  lessonNumber?: string;
  volume?: string;
  language?: 'tamil' | 'english' | 'Tamil' | 'English';
  count?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Mixed';
  provider?: 'claude' | 'gemini';
  model?: string;
  autoStage?: boolean;
  textbookId?: number;
  materialId?: number;
  gdriveFileId?: string;
  /** Admin-selected topic(s) for scoped MCQ generation (from Step 7 topic selector) */
  selectedTopics?: string[];
}

export interface McqGenerationOutput {
  success: boolean;
  provider: AIProviderName;
  model: string;
  questions: StandardizedMcqItem[];
  totalGenerated: number;
  validCount: number;
  duplicateCount: number;
  stagedCount: number;
  executionTimeMs: number;
  syllabus: StandardizedSyllabusContext;
  duplicateDetails: BatchDuplicateFilterResult['duplicateDetails'];
  stagedQuestionIds: number[];
}

export class GenerationOrchestrator {
  /**
   * Loads the current active prompt for the chosen provider and prompt type from DB or code defaults.
   */
  private static async getProviderPrompt(
    provider: AIProviderName,
    promptType: 'mcq_system' | 'mcq_template'
  ): Promise<string> {
    try {
      const res = await pool.query(
        'SELECT content FROM ai_provider_prompts WHERE provider = $1 AND prompt_type = $2 AND is_current = true LIMIT 1',
        [provider, promptType]
      );
      if (res.rows.length > 0 && res.rows[0].content) {
        return res.rows[0].content;
      }
    } catch {
      // Fallback to coded default
    }

    const defMap = provider === 'claude' ? CLAUDE_DEFAULT_PROMPTS : provider === 'openai' ? CLAUDE_DEFAULT_PROMPTS : GEMINI_DEFAULT_PROMPTS;
    return defMap[promptType].content;
  }

  /**
   * Executes the standardized 12-step MCQ generation workflow with complete provider isolation.
   */
  public static async generateMcqs(input: McqGenerationInput): Promise<McqGenerationOutput> {
    const startTime = Date.now();

    // 1. Resolve Provider (Strict Isolation)
    let selectedProvider: AIProviderName =
      (input.provider || 'claude').toLowerCase() === 'gemini'
        ? 'gemini'
        : (input.provider || 'claude').toLowerCase() === 'openai'
        ? 'openai'
        : 'claude';
    let selectedModel = input.model || (selectedProvider === 'claude' ? getClaudeModel() : selectedProvider === 'openai' ? getOpenAiModel() : getGeminiModel());

    // 2. Resolve Syllabus Context
    const syllabus = SyllabusContextService.resolveContext({
      groupId: input.groupId,
      subject: input.subject,
      standard: input.standard,
      unitId: input.unitId,
      term: input.term,
      lessonTitle: input.lessonTitle,
      lessonNumber: input.lessonNumber,
      language: input.language,
    });

    // 3. Retrieve Verified Textbook Content (Read-Only)
    let textbookCtx: VerifiedTextbookContext;
    try {
      textbookCtx = await TextbookContentService.getVerifiedContent({
        groupId: syllabus.groupId,
        subject: syllabus.subject,
        standard: syllabus.standardNumber,
        unitId: syllabus.unitId,
        term: syllabus.term,
        lessonTitle: syllabus.lessonTitle,
        lessonKey: input.lessonKey,
        lessonNumber: syllabus.lessonNumber,
        volume: input.volume,
        textbookId: input.textbookId,
        materialId: input.materialId,
        gdriveFileId: input.gdriveFileId,
      });
    } catch (err: any) {
      // Content retrieval error — do NOT call AI providers
      throw new Error(`[Textbook Content Error] ${err.message}`);
    }

    // 4. Topic Extraction from Verified Content
    const topicSummary = TopicExtractionService.extractTopics(textbookCtx.content, syllabus.lessonTitle);

    // 5. Build Prompts
    const systemPromptTemplate = await this.getProviderPrompt(selectedProvider, 'mcq_system');
    const userPromptTemplate = await this.getProviderPrompt(selectedProvider, 'mcq_template');

    const requestedCount = Math.min(100, Math.max(1, Number(input.count) || 10));
    const requestedDifficulty = input.difficulty || 'Medium';

    const userPrompt = userPromptTemplate
      .replace(/{COUNT}/g, String(requestedCount))
      .replace(/{DIFFICULTY}/g, requestedDifficulty)
      .replace(/{GROUP_ID}/g, syllabus.examGroup)
      .replace(/{SUBJECT}/g, syllabus.subject)
      .replace(/{STANDARD}/g, syllabus.standard)
      .replace(/{UNIT_ID}/g, String(syllabus.unitId))
      .replace(/{TERM}/g, syllabus.term)
      .replace(/{LESSON_TITLE}/g, syllabus.lessonTitle)
      .replace(/{LANGUAGE}/g, syllabus.language)
      .replace(/{SOURCE_TEXTBOOK}/g, textbookCtx.textbookName)
      .replace(/{SUBTOPICS_GUIDANCE}/g, topicSummary.coverageGuidance)
      .replace(/{PAGE_NUMBER}/g, String(textbookCtx.startPage))
      .replace(/{SELECTED_TOPICS}/g,
        input.selectedTopics && input.selectedTopics.length > 0
          ? `Focus ONLY on these admin-selected topics: ${input.selectedTopics.map((t) => `"${t}"`).join(', ')}.`
          : 'Cover ALL topics and subtopics in this lesson comprehensively.'
      )
      .replace(/{TEXTBOOK_CONTENT}/g, textbookCtx.content.slice(0, 48000)); // Guard token window

    // 6. Execute Provider Completion (Zero Cross-Fallback Isolation)
    let rawItems: any[] = [];
    try {
      if (selectedProvider === 'claude') {
        rawItems = await ClaudeService.generateJson<any[]>(userPrompt, {
          systemPrompt: systemPromptTemplate,
          maxTokens: Math.min(8192, Math.max(2048, requestedCount * 400)),
          temperature: 0.3,
        });
      } else if (selectedProvider === 'openai') {
        rawItems = await OpenAIService.generateJson<any[]>(userPrompt, {
          systemPrompt: systemPromptTemplate,
          maxTokens: Math.min(8192, Math.max(2048, requestedCount * 400)),
          temperature: 0.3,
        });
      } else {
        rawItems = await GeminiService.generateJson<any[]>(userPrompt, {
          systemPrompt: systemPromptTemplate,
          maxTokens: Math.min(8192, Math.max(2048, requestedCount * 400)),
          temperature: 0.3,
        });
      }
    } catch (aiErr: any) {
      // Log independent failure
      await AILogsService.logGeneration({
        provider: selectedProvider,
        model: selectedModel,
        generationType: 'mcq',
        groupId: syllabus.groupId,
        standard: syllabus.standardNumber,
        subject: syllabus.subject,
        unitId: syllabus.unitId,
        lessonTitle: syllabus.lessonTitle,
        language: syllabus.language.toLowerCase(),
        status: 'failed',
        errorMessage: aiErr.message,
        itemsCount: 0,
      });

      // Strict isolation rule: Never fallback to the alternate AI provider
      throw new Error(`[${selectedProvider.toUpperCase()} Generation Error] ${aiErr.message}`);
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new Error(`[${selectedProvider.toUpperCase()}] AI returned an empty or invalid question array.`);
    }

    // 7. Validate Items (Part 7)
    const { validQuestions } = validateBatchMcqs(rawItems);

    // 8. Server-Side Option Randomizer & Distribution Balancing (Part 5)
    // Decorate metadata first
    const questionsWithMeta = validQuestions.map((q) => ({
      ...q,
      subject: syllabus.subject,
      standard: syllabus.standard,
      unit: syllabus.unitTitle,
      term: syllabus.term,
      lesson: syllabus.lessonTitle,
      sourceTextbook: textbookCtx.textbookName,
      sourcePage: q.sourcePage || textbookCtx.startPage,
      aiProvider: selectedProvider,
      modelUsed: selectedModel,
    }));

    const randomizedQuestions = randomizeBatchOptions(questionsWithMeta);

    // 9. Duplicate Prevention & Semantic Filtering (Part 6)
    const duplicateCheck = await filterDuplicates(randomizedQuestions, {
      subject: syllabus.subject,
      classId: syllabus.standardNumber,
      unitId: syllabus.unitId,
      lessonTitle: syllabus.lessonTitle,
    });

    const finalQuestions = duplicateCheck.uniqueQuestions;

    // 10. Persist Staging Questions (Part 12)
    const stagedIds: number[] = [];
    if (input.autoStage !== false && finalQuestions.length > 0) {
      for (const q of finalQuestions) {
        try {
          const payload = toDatabaseQuestionPayload(q, {
            category: syllabus.groupId,
            classId: syllabus.standardNumber,
            unitId: syllabus.unitId,
            lessonId: syllabus.lessonCode,
            lessonNumber: syllabus.lessonNumber,
            term: syllabus.term,
            volume: input.volume || null,
            sourcePdf: textbookCtx.sourcePdf,
            status: 'staging',
          });

          const insertRes = await pool.query(
            `INSERT INTO questions (
              category, unit_id, class_id, subject, lesson_title, lesson_id,
              lesson_number, topic, difficulty, question_text, options,
              correct_answer, explanation, status, source_reference, source_page,
              source_pdf, language, ai_provider, option_a, option_b, option_c,
              option_d, term, volume, target_system, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb,
              $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
              $23, $24, $25, $26, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) RETURNING id`,
            [
              payload.category,
              payload.unit_id,
              payload.class_id,
              payload.subject,
              payload.lesson_title,
              payload.lesson_id,
              payload.lesson_number,
              payload.topic,
              payload.difficulty,
              payload.question_text,
              JSON.stringify(payload.options),
              payload.correct_answer,
              payload.explanation,
              payload.status,
              payload.source_reference,
              payload.source_page,
              payload.source_pdf,
              payload.language,
              payload.ai_provider,
              payload.option_a,
              payload.option_b,
              payload.option_c,
              payload.option_d,
              payload.term,
              payload.volume,
              payload.target_system,
            ]
          );

          if (insertRes.rows.length > 0) {
            const newId = insertRes.rows[0].id;
            q.id = newId;
            stagedIds.push(newId);
          }
        } catch (dbInsertErr) {
          console.warn('[GenerationOrchestrator] Error staging question row:', dbInsertErr);
        }
      }
    }

    const executionTimeMs = Date.now() - startTime;

    // 11. Record Successful AI Audit Log
    await AILogsService.logGeneration({
      provider: selectedProvider,
      model: selectedModel,
      generationType: 'mcq',
      groupId: syllabus.groupId,
      standard: syllabus.standardNumber,
      subject: syllabus.subject,
      unitId: syllabus.unitId,
      lessonTitle: syllabus.lessonTitle,
      language: syllabus.language.toLowerCase(),
      status: 'success',
      itemsCount: finalQuestions.length,
      metadata: {
        rawCount: rawItems.length,
        validCount: validQuestions.length,
        duplicateCount: duplicateCheck.duplicateCount,
        stagedCount: stagedIds.length,
        executionTimeMs,
      },
    });

    return {
      success: true,
      provider: selectedProvider,
      model: selectedModel,
      questions: finalQuestions,
      totalGenerated: rawItems.length,
      validCount: validQuestions.length,
      duplicateCount: duplicateCheck.duplicateCount,
      stagedCount: stagedIds.length,
      executionTimeMs,
      syllabus,
      duplicateDetails: duplicateCheck.duplicateDetails,
      stagedQuestionIds: stagedIds,
    };
  }
}
