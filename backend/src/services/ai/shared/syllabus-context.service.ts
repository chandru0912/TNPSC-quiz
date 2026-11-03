/**
 * Syllabus Context Resolution Service
 * Strictly shared across Anthropic Claude AI and Google Gemini AI.
 * 
 * Provides unified, provider-neutral TNPSC syllabus context:
 * - Group normalization (Group 1, Group 2, Group 2A, Group 4)
 * - Subject and unit metadata resolution
 * - Canonical lesson code mapping
 * - Standardized prompt context block generation
 */

import { buildCanonicalLessonCode } from '../../lessonMapping';
import { getCanonicalLessons } from '../../../data/canonicalSyllabusLessons';

export interface StandardizedSyllabusContext {
  examGroup: string;
  groupId: string;
  subject: string;
  standard: string;
  standardNumber: number;
  unitId: number;
  unitTitle: string;
  term: string;
  lessonTitle: string;
  lessonNumber: string;
  lessonCode: string;
  language: 'Tamil' | 'English';
  canonicalTopics: string[];
}

export class SyllabusContextService {
  /**
   * Resolves a fully qualified syllabus context from cascade selections.
   */
  public static resolveContext(params: {
    groupId?: string;
    subject?: string;
    standard?: string;
    unitId?: number | string;
    term?: string;
    lessonTitle?: string;
    lessonNumber?: string;
    language?: string;
  }): StandardizedSyllabusContext {
    const rawGroup = String(params.groupId || 'group4').toLowerCase().replace(/\s+/g, '');
    let examGroup = 'TNPSC Group 4';
    let cleanGroupId = 'group4';

    if (rawGroup.includes('group1') || rawGroup === 'g1') {
      examGroup = 'TNPSC Group 1';
      cleanGroupId = 'group1';
    } else if (rawGroup.includes('group2a') || rawGroup === 'g2a') {
      examGroup = 'TNPSC Group 2A';
      cleanGroupId = 'group2a';
    } else if (rawGroup.includes('group2') || rawGroup === 'g2') {
      examGroup = 'TNPSC Group 2';
      cleanGroupId = 'group2';
    } else {
      examGroup = 'TNPSC Group 4';
      cleanGroupId = 'group4';
    }

    const standardRaw = String(params.standard || '6th Standard');
    const stdMatch = standardRaw.match(/\d+/);
    const standardNumber = stdMatch ? parseInt(stdMatch[0], 10) : 6;
    const standard = `${standardNumber}th Standard`;

    const unitNumber = typeof params.unitId === 'number' ? params.unitId : parseInt(String(params.unitId || '1'), 10) || 1;
    const unitTitle = `Unit ${unitNumber}`;

    const term = String(params.term || 'Term 1').trim();
    const subject = String(params.subject || 'General Studies').trim();
    const lessonTitle = String(params.lessonTitle || '').trim();
    const lessonNumber = String(params.lessonNumber || `${unitNumber}.1`).trim();

    const lessonCode = buildCanonicalLessonCode({
      category: cleanGroupId,
      classId: standardNumber,
      subject,
      unitId: unitNumber,
      term,
      lessonNumber,
      lessonTitle,
    });

    const isEnglish = String(params.language || '').toLowerCase() === 'english';
    const language: 'Tamil' | 'English' = isEnglish ? 'English' : 'Tamil';

    // Retrieve canonical topics if defined
    let canonicalTopics: string[] = [];
    try {
      const canonicalLessons = getCanonicalLessons(subject, standardNumber, unitNumber, term);
      const matched = canonicalLessons.find(
        (cl) => cl.title.toLowerCase() === lessonTitle.toLowerCase() || cl.lessonNumber === lessonNumber
      );
      if (matched && matched.mappedSubject) {
        canonicalTopics = [matched.mappedSubject];
      }
    } catch {
      // Best-effort
    }

    return {
      examGroup,
      groupId: cleanGroupId,
      subject,
      standard,
      standardNumber,
      unitId: unitNumber,
      unitTitle,
      term,
      lessonTitle,
      lessonNumber,
      lessonCode,
      language,
      canonicalTopics,
    };
  }

  /**
   * Generates a standardized textual header block for injection into AI prompts.
   */
  public static buildPromptContextBlock(ctx: StandardizedSyllabusContext): string {
    return [
      `=== TNPSC SYLLABUS SPECIFICATION ===`,
      `Target Examination: ${ctx.examGroup}`,
      `Subject: ${ctx.subject}`,
      `Standard: ${ctx.standard}`,
      `Unit: ${ctx.unitTitle}`,
      `Term: ${ctx.term}`,
      `Lesson: ${ctx.lessonNumber}. ${ctx.lessonTitle}`,
      `Lesson Code: ${ctx.lessonCode}`,
      `Language of Output: ${ctx.language}`,
      ctx.canonicalTopics.length > 0 ? `Canonical Syllabus Topics: ${ctx.canonicalTopics.join(', ')}` : null,
      `====================================`,
    ]
      .filter(Boolean)
      .join('\n');
  }
}
