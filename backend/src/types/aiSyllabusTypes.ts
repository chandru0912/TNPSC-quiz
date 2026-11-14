/**
 * aiSyllabusTypes.ts
 *
 * Types for the 12-Step AI Syllabus Import Engine.
 * Supports Single Parent Unit nesting, 6th-12th standard mapping,
 * bilingual study notes, and exam MCQs.
 */

export interface ExtractedTopicDraft {
  topic_name: string;
  display_order: number;
  syllabus_reference?: string;
}

export interface MatchedLessonDraft {
  id?: string;
  standard_number: number;
  term: string;
  volume?: string;
  lesson_number: string;
  title: string;
  description?: string;
  unit_number?: number;
  subject_slug?: string;
  textbook_id?: number;
  textbook_title?: string;
  textbook_unit_number?: string;
  textbook_unit_title?: string;
  matched_syllabus_topics?: string[];
  syllabus_reference?: string;
  textbook_page_reference?: string;
  mapping_status?: 'FULLY MAPPED' | 'PARTIALLY MAPPED' | 'NOT FOUND';
  verification_status?: 'VERIFIED' | 'UNVERIFIED';
  import_batch_id?: string;
  source_page_start?: number;
  source_page_end?: number;
  topics: ExtractedTopicDraft[];
  selected_for_publish?: boolean;
}

export interface CanonicalUnitDraft {
  unit_number: number;
  unit_code: string;
  title: string;
  description?: string;
  subject_slug?: string;
  subject_name?: string;
  syllabus_topics: string[];
  lessons: MatchedLessonDraft[];
  selected_for_publish?: boolean;
}

export interface GeneratedNotesDraft {
  lesson_id?: string;
  lesson_number?: string;
  lesson_title: string;
  standard_number: number;
  content_tamil: string;
  content_english: string;
  key_points: string[];
  summary: string;
}

export interface GeneratedMCQOption {
  option_key: string; // 'A', 'B', 'C', 'D'
  text_english: string;
  text_tamil: string;
}

export interface GeneratedMCQDraft {
  question_english: string;
  question_tamil: string;
  options: GeneratedMCQOption[];
  correct_option: string; // 'A', 'B', 'C', or 'D'
  explanation_english: string;
  explanation_tamil: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  syllabus_topic_ref?: string;
}

export interface PublishSyllabusPayload {
  examId: string;
  subjectSlug: string;
  subjectName: string;
  units: CanonicalUnitDraft[];
  notes?: Record<string, GeneratedNotesDraft>; // keyed by `${unit_number}_${standard}_${lesson_number}`
  mcqs?: Record<string, GeneratedMCQDraft[]>;
}

export interface PublishResult {
  success: boolean;
  message: string;
  stats: {
    units_created: number;
    units_updated: number;
    units_reused?: number;
    lessons_created: number;
    lessons_updated: number;
    lessons_reused?: number;
    topics_created: number;
    notes_saved: number;
    mcqs_saved: number;
    duplicates_detected?: number;
    validation_report?: {
      total_units_identified: number;
      total_units_created_or_reused: number;
      total_lessons_created_or_reused: number;
      total_topics_created_or_reused: number;
      duplicates_detected: number;
      missing_lesson_mappings: number;
      invalid_connections: number;
      records_ready_for_review: number;
    };
  };
}

export type SyllabusJobStatus =
  | 'queued'
  | 'analyzing'
  | 'matching'
  | 'paused'
  | 'completed'
  | 'completed_with_errors'
  | 'failed';

export type SyllabusJobStage = 'analyze' | 'match' | 'done';

export interface SyllabusJobBatch {
  batchIndex: number;
  textbookIds: number[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  succeededIds: number[];
  failedIds: number[];
  error?: string;
}

export interface SyllabusImportJobSnapshot {
  id: string;
  examId: string;
  targetSubject?: string | null;
  selectedStandards: number[];
  selectedTextbookIds: number[];
  status: SyllabusJobStatus;
  stage: SyllabusJobStage;
  batchSize: number;
  totalTextbooks: number;
  processedTextbooks: number;
  successfulTextbooks: number;
  failedTextbooks: number;
  currentTextbook: string | null;
  progressPercent: number;
  analyzedUnitsCount: number;
  units: CanonicalUnitDraft[];
  batches: SyllabusJobBatch[];
  errorMessage: string | null;
  errorStatus: number | null;
  errorType: string | null;
  createdAt: string;
  updatedAt: string;
}
