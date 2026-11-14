/**
 * types.ts
 * Frontend types for the 12-Step AI Syllabus Import Engine
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
  option_key: string;
  text_english: string;
  text_tamil: string;
}

export interface GeneratedMCQDraft {
  question_english: string;
  question_tamil: string;
  options: GeneratedMCQOption[];
  correct_option: string;
  explanation_english: string;
  explanation_tamil: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface RepoTextbook {
  id: number;
  standard: number;
  subject: string;
  term: string;
  volume?: string;
  file_name: string;
  google_drive_file_id: string;
  has_toc: boolean;
}

export type WizardStage = 'setup' | 'alignment' | 'content' | 'publish';

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
