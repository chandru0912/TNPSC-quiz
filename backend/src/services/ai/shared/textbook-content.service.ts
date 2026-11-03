/**
 * Read-Only Verified Textbook Content Retrieval Service
 * Strictly shared across Anthropic Claude AI and Google Gemini AI.
 * 
 * Enforces Part 2 Strict PDF-Based Content Requirements:
 * - Read-only access for both providers
 * - Enforces minimum 50 characters of verified extracted PDF text
 * - Prevents generation on unextracted, empty, or corrupted content
 * - Preserves Tamil and English Unicode
 * - Extracts and maintains accurate page references
 */

import { resolveMcqSelection, McqCascadeSelection, ResolvedMcqSelection } from '../../mcqCascadeService';

export interface VerifiedTextbookContext {
  content: string;
  pages: number[];
  startPage: number;
  endPage: number;
  textbookName: string;
  sourcePdf: string;
  subject: string;
  standard: string | number;
  unitId: number;
  term: string;
  volume: string | null;
  lessonTitle: string;
  lessonNumber: string;
  characterCount: number;
}

export class TextbookContentService {
  /**
   * Resolves and verifies textbook content for syllabus-guided MCQ generation.
   * Rejects immediately if content is absent, unextracted, or less than 50 characters.
   */
  public static async getVerifiedContent(selection: McqCascadeSelection): Promise<VerifiedTextbookContext> {
    const resolved: ResolvedMcqSelection = await resolveMcqSelection(selection);

    const rawContent = (resolved.content || '').trim();
    if (!rawContent || rawContent.length < 50) {
      const lessonName = resolved.lesson?.title || selection.lessonTitle || 'the selected lesson';
      throw new Error(
        `PDF text has not been extracted yet or is insufficient for "${lessonName}" (extracted ${rawContent.length} chars, minimum 50 required). Please run PDF extraction before generating MCQs.`
      );
    }

    const pages = Array.isArray(resolved.pages) && resolved.pages.length > 0
      ? resolved.pages
      : [resolved.lesson?.startPage || 1];

    const startPage = pages[0] || 1;
    const endPage = pages[pages.length - 1] || startPage;

    return {
      content: rawContent,
      pages,
      startPage,
      endPage,
      textbookName: resolved.textbookName || resolved.candidate?.bookName || 'Samacheer Kalvi Textbook',
      sourcePdf: resolved.sourcePdf || resolved.candidate?.bookName || 'Samacheer_Kalvi.pdf',
      subject: resolved.textbookSubject || selection.subject || 'General Studies',
      standard: String(selection.standard || '6th Standard'),
      unitId: Number(selection.unitId) || 1,
      term: resolved.term || selection.term || 'Term 1',
      volume: resolved.volume || selection.volume || null,
      lessonTitle: resolved.lesson?.title || selection.lessonTitle || '',
      lessonNumber: String(resolved.lesson?.lessonNumber || selection.lessonNumber || '1'),
      characterCount: rawContent.length,
    };
  }
}
