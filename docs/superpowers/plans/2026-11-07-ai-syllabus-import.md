# AI Syllabus Import (12-Step Checkpoint Architecture) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete 12-step AI Syllabus Import engine for TNPSC Study Hub, enabling admins to ingest official TNPSC syllabi, match textbook chapters from the 72 existing Samacheer Kalvi books in `google_drive_materials` under a Single Parent Unit container across 6th–12th standards, generate bilingual notes & MCQs, and atomically commit to PostgreSQL with safe non-destructive merging.

**Architecture:** A modular 4-phase, 12-step checkpoint wizard in React/TypeScript integrated into `StudyMaterialsManagement.tsx`, powered by dedicated backend service `aiSyllabusEngineService.ts` and REST routes in `aiSyllabusImportRoutes.ts`, committing atomically via PostgreSQL transactions.

**Tech Stack:** React 19, TypeScript, Vite, Node.js, Express, PostgreSQL (`pg`), Google Gemini API (`@google/genai` / `@google/generative-ai`), Lucide icons.

**Spec:** `docs/superpowers/specs/2026-11-07-ai-syllabus-import-design.md`

## Global Constraints

- Never create duplicate parent unit boxes for individual standards (Single Parent Unit container rule).
- Never duplicate textbook PDFs; strictly query existing `google_drive_materials` records and `extracted_toc`.
- Preserve existing database records: 51 units, 1,725 lessons, 6,002 topics, 592 study notes, 72 textbooks.
- Non-destructive merge policy (Option A) on publish: retain existing lessons and append newly mapped standards/lessons.
- Both frontend (`tsc -b && vite build`) and backend (`tsc`) must pass with 0 errors after every task.

## Review Focus

1. **Large Syllabus Input Payload**: A user pasting a 30,000-character complete syllabus must be chunked or parsed without payload size rejection.
2. **Missing Textbook TOCs**: If a selected textbook has null `extracted_toc`, the matcher must gracefully fallback to title/standard heuristic rather than crashing.
3. **LLM Generation Failures/Timeouts**: Note/MCQ generation must handle individual lesson API failures gracefully with retry buttons instead of aborting the wizard.
4. **Duplicate Lesson Insertion**: When merging new lessons under an existing parent unit, matching by `(unit_id, standard_number, lesson_number)` must update existing lessons rather than inserting duplicates.
5. **Session Auto-Save Integrity**: Corrupted or outdated `sessionStorage` drafts must be validated with a fallback to clean reset rather than rendering a broken UI state.

---

### Task 1: Backend Domain Models & Engine Service Core (Steps 01–05)

**Files:**
- Create: `backend/src/services/aiSyllabusEngineService.ts`
- Create: `backend/src/types/aiSyllabusTypes.ts`

**Interfaces:**
- Produces:
  - `interface CanonicalUnitDraft`: `{ unit_number: number; unit_code: string; title: string; description?: string; syllabus_topics: string[]; }`
  - `interface MatchedLessonDraft`: `{ standard_number: number; term?: string; lesson_number: string; title: string; textbook_id: number; textbook_title: string; matched_topics: string[]; }`
  - `AISyllabusEngineService.analyzeSyllabus(examId: string, text: string): Promise<CanonicalUnitDraft[]>`
  - `AISyllabusEngineService.matchTextbooks(units: CanonicalUnitDraft[], textbookIds: number[]): Promise<Map<number, MatchedLessonDraft[]>>`

- [ ] **Step 1: Define TypeScript types in `backend/src/types/aiSyllabusTypes.ts`**
  - Define `CanonicalUnitDraft`, `MatchedLessonDraft`, `ExtractedTopicDraft`, `GeneratedNotesDraft`, `GeneratedMCQDraft`, `PublishSyllabusPayload`.
- [ ] **Step 2: Implement `analyzeSyllabus` with structured Gemini prompt**
  - Extract units with unit numbers, codes (e.g. `Unit I`), canonical titles, and syllabus topics using `@google/genai` or Gemini REST call.
- [ ] **Step 3: Implement `matchTextbooks` using PostgreSQL `extracted_toc`**
  - Query `google_drive_materials` for selected `textbookIds`, extract chapter list from `extracted_toc`, and correlate against unit syllabus topics.
- [ ] **Step 4: Verify with test script**
  - Run node test script on `backend/src/services/aiSyllabusEngineService.ts` with mock syllabus text.
- [ ] **Step 5: Verify backend compiles**
  - Run `npm run build --prefix backend` and ensure 0 errors.

---

### Task 2: Backend Content Synthesis & Atomic Publishing (Steps 06–12)

**Files:**
- Modify: `backend/src/services/aiSyllabusEngineService.ts`

**Interfaces:**
- Produces:
  - `AISyllabusEngineService.generateLessonNotes(lessonTitle: string, standard: number, topics: string[]): Promise<GeneratedNotesDraft>`
  - `AISyllabusEngineService.generateLessonMCQs(lessonTitle: string, standard: number, topics: string[]): Promise<GeneratedMCQDraft[]>`
  - `AISyllabusEngineService.publishSyllabusTransaction(payload: PublishSyllabusPayload): Promise<{ success: boolean; stats: any }>`

- [ ] **Step 1: Implement `generateLessonNotes`**
  - Call Gemini with prompt requiring bilingual (Tamil + English) high-yield short notes covering the provided topics without irrelevant filler.
- [ ] **Step 2: Implement `generateLessonMCQs`**
  - Call Gemini to generate 5 exam-standard 4-option MCQs with Tamil & English questions, correct answer index, and explanations.
- [ ] **Step 3: Implement `publishSyllabusTransaction` with Option A (Safe Merge)**
  - Open PostgreSQL transaction (`BEGIN`).
  - Upsert parent unit into `syllabus_units` by `(exam_id, unit_number)`.
  - For each lesson, query existing `syllabus_lessons` by `(unit_id, standard_number, lesson_number)`. If exists, update metadata; if not, insert new lesson.
  - Insert topics into `syllabus_topics`.
  - If notes generated, insert/update into `study_notes`.
  - If MCQs generated, insert into `questions`.
  - `COMMIT` transaction or `ROLLBACK` on error.
- [ ] **Step 4: Verify backend compiles**
  - Run `npm run build --prefix backend`.

---

### Task 3: Backend API Controller & Express Routes

**Files:**
- Create: `backend/src/routes/aiSyllabusImportRoutes.ts`
- Modify: `backend/src/server.ts:40-90`

**Interfaces:**
- Produces HTTP Endpoints:
  - `POST /api/study-management/ai-import/analyze`
  - `POST /api/study-management/ai-import/match`
  - `POST /api/study-management/ai-import/generate-notes`
  - `POST /api/study-management/ai-import/generate-mcqs`
  - `POST /api/study-management/ai-import/publish`

- [ ] **Step 1: Create `backend/src/routes/aiSyllabusImportRoutes.ts`**
  - Connect all 5 endpoints to `AISyllabusEngineService` with proper authentication (`requireAuth`) and error handling.
- [ ] **Step 2: Mount routes in `backend/src/server.ts`**
  - Add `app.use('/api/study-management/ai-import', aiSyllabusImportRoutes);`
- [ ] **Step 3: Verify backend compiles and test endpoints**
  - Run `npm run build --prefix backend`.
  - Verify routes respond properly with curl/node test.

---

### Task 4: Frontend Wizard: Phase A (Setup) & Phase B (Alignment) (Steps 01–09)

**Files:**
- Create: `src/components/admin/ai-syllabus/types.ts`
- Create: `src/components/admin/ai-syllabus/PhaseASetup.tsx`
- Create: `src/components/admin/ai-syllabus/PhaseBAlignment.tsx`
- Create: `src/components/admin/ai-syllabus/AiSyllabusWizard.css`

**Interfaces:**
- Produces:
  - `PhaseASetup`: Inputs for Group selection, Syllabus paste/upload, and Textbook repository selector.
  - `PhaseBAlignment`: Single Parent Unit tree view with 6th–12th standard tabs, lesson drag/reorder, and topic verification table.

- [ ] **Step 1: Create shared types in `src/components/admin/ai-syllabus/types.ts`**
  - Mirror backend draft interfaces and wizard state types.
- [ ] **Step 2: Implement `PhaseASetup.tsx`**
  - Group selector (Group 1, 2, 2A, 4).
  - Textarea for official syllabus paste + PDF file selector with client-side text extractor.
  - Available textbooks grid pulling from `/api/study-management/tree` or `/api/textbooks` with standard checkboxes (6th–12th).
- [ ] **Step 3: Implement `PhaseBAlignment.tsx`**
  - Displays Single Parent Unit container with tabs for Standard 6 to 12.
  - Lists matched lessons under each standard with editable lesson title, number, and topic tags.
  - Topic verification tool allowing inline add, remove, and edit of syllabus topics.
- [ ] **Step 4: Verify frontend compiles**
  - Run `npm run build` and ensure 0 TypeScript errors.

---

### Task 5: Frontend Wizard: Phase C (Content) & Phase D (Publish) (Steps 10–12)

**Files:**
- Create: `src/components/admin/ai-syllabus/PhaseCContent.tsx`
- Create: `src/components/admin/ai-syllabus/PhaseDPublish.tsx`

**Interfaces:**
- Produces:
  - `PhaseCContent`: On-demand note & MCQ generation drawers with progress bar and bilingual preview.
  - `PhaseDPublish`: Complete hierarchical summary tree with count badges (Units, Standards, Lessons, Topics, Notes, MCQs) and one-click Publish button.

- [ ] **Step 1: Implement `PhaseCContent.tsx`**
  - Lesson list with "Generate Notes" and "Generate MCQs" buttons.
  - Drawer showing rendered Markdown for Tamil & English study notes.
  - Preview card for generated MCQs with answer key and explanation.
- [ ] **Step 2: Implement `PhaseDPublish.tsx`**
  - Full tree preview displaying: Single Parent Unit ➔ Standards (6–12) ➔ Lessons ➔ Topics.
  - Visual summary card (e.g. "1 Parent Unit, 7 Standards, 24 Lessons, 98 Topics, 12 Notes, 60 MCQs").
  - Publish confirmation button with progress spinner.
- [ ] **Step 3: Verify frontend compiles**
  - Run `npm run build`.

---

### Task 6: Wizard Modal Assembly, Auto-Save & Integration

**Files:**
- Create: `src/components/admin/ai-syllabus/AiSyllabusImportWizard.tsx`
- Modify: `src/components/admin/StudyMaterialsManagement.tsx:2910-2970`

**Interfaces:**
- Integrates `AiSyllabusImportWizard` into `StudyMaterialsManagement.tsx` triggered by `setAiImportModalOpen(true)`.

- [ ] **Step 1: Implement `AiSyllabusImportWizard.tsx`**
  - 4-phase stepper navigation header (1. Setup ➔ 2. Alignment ➔ 3. Content ➔ 4. Publish).
  - Auto-save state to `sessionStorage` on step changes so refresh does not discard data.
  - "Reset All" option to clear draft session.
- [ ] **Step 2: Mount `AiSyllabusImportWizard` in `StudyMaterialsManagement.tsx`**
  - Replace the placeholder modal markup with `<AiSyllabusImportWizard isOpen={aiImportModalOpen} onClose={() => setAiImportModalOpen(false)} onPublished={() => { setAiImportModalOpen(false); fetchTree(); }} />`.
- [ ] **Step 3: End-to-end verification**
  - Run full frontend build: `npm run build` (must exit 0).
  - Run full backend build: `npm run build --prefix backend` (must exit 0).
  - Verify database counts remain untouched.
- [ ] **Step 4: Final commit of all changes**
