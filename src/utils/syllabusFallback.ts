/**
 * Client-Side Syllabus MCQ Generation Helper
 * Strict textbook grounding is enforced on the backend; client fallback templates
 * that repeat placeholder questions are disabled.
 */

export interface GeneratedQuestionItem {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category?: string;
  subject?: string;
  classId?: number;
  unitId?: number;
  lessonTitle?: string;
  topic?: string;
  difficulty?: string;
  selected?: boolean;
}

export function generateClientSyllabusFallback(_params: {
  category: string;
  subject: string;
  classId: number;
  unitId: number;
  unitTitle?: string;
  lessonTitle: string;
  topic: string;
  count: number;
  difficulty: string;
}): GeneratedQuestionItem[] {
  throw new Error(
    'Strict textbook grounding is enabled: cannot generate fabricated fallback questions when textbook content is unavailable.'
  );
}
