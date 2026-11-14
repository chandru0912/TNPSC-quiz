# Technical Design Document: AI Syllabus Import Engine (12-Step Architecture)

- **Date:** 2026-11-07
- **Project:** TNPSC Study Hub
- **Module:** Admin Panel → Study Materials Management → AI Syllabus Import
- **Status:** Approved (Ready for Implementation Planning)

---

## 1. Intent and The Why

The TNPSC (Tamil Nadu Public Service Commission) exams (Group 1, 2, 2A, 4) require aspirants to prepare General Studies and language papers using Tamil Nadu State Board (Samacheer Kalvi) textbooks across Standards 6th through 12th. 

Currently, syllabus structuring and textbook chapter mapping is manual and labor-intensive. When done previously, legacy AI tools created duplicate parent units per standard (e.g. *Unit I: General Science (6th)*, *Unit I: General Science (7th)*) rather than nesting all standards inside a single canonical parent container. Furthermore, textbook PDFs were being re-uploaded redundantly instead of reusing the 72 textbooks already present in the database.

**The Purpose of this Engine:**
Provide an automated, 12-step guided pipeline that ingests official TNPSC syllabi (PDF or pasted text), aligns matching textbook chapters from existing Samacheer Kalvi PDFs (6th to 12th), nests them under a Single Parent Unit container, generates syllabus-focused bilingual study notes and MCQs, and atomically commits the entire hierarchy to PostgreSQL with full administrative review.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. **12-Step Structured Lifecycle**: Implement the full 12-step pipeline:
   `01. Group Selection` ➔ `02. Official Syllabus Input` ➔ `03. Textbook PDF Input` ➔ `04. Syllabus Analysis` ➔ `05. Textbook Matching` ➔ `06. Standard Mapping` ➔ `07. Unit Mapping` ➔ `08. Lesson Mapping` ➔ `09. Topic Verification` ➔ `10. Study Notes Generation` ➔ `11. MCQ Generation` ➔ `12. Review & Publish`.
2. **Single Parent Unit Architecture**: Each TNPSC syllabus unit (e.g. *Unit I: General Science*, *Unit II: Current Events*) exists as exactly **ONE** parent container. Standards 6th, 7th, 8th, 9th, 10th, 11th, and 12th are nested strictly inside this parent unit.
3. **Reuse Existing Textbook Repository**: Connect directly to `google_drive_materials` (72 verified textbooks with pre-extracted TOC data). Never create duplicate PDF storage or require re-uploading.
4. **Bilingual Notes & High-Yield MCQs**: Produce structured, noise-free study notes (Tamil & English) and exam-standard MCQs with explanations, tied directly to syllabus topics.
5. **Atomic Database Publication**: Use PostgreSQL database transactions (`BEGIN ... COMMIT`) to write units, lessons, topics, notes, and questions in one safe, un-fragmented operation.

### Non-Goals
- Real-time OCR of scanned handwriting (all inputs are official digital syllabus PDFs/text and state board textbook PDFs).
- Modifying student mock test or dashboard UI components.
- Automated web scraping of external syllabus websites.

### Anti-Goals
- **Never create multiple parent unit boxes for different standards** (e.g., *Unit I (6th)*, *Unit I (7th)*).
- **Never duplicate PDF files** on the server or in storage.
- **Never publish unverified AI content directly to the database** without an explicit admin review and approval checkpoint.
- **Never wipe out existing unrelated units** when importing a specific subject or unit.

---

## 3. Approaches Considered & Selected

| Approach | Description | Trade-offs | Decision |
| :--- | :--- | :--- | :--- |
| **Approach 1: Checkpoint-Guided Multi-Stage Wizard** | 4-stage UI wizard grouping the 12 steps with clear checkpoints: Phase A (Input & Extraction), Phase B (Textbook Alignment), Phase C (Notes & MCQs), Phase D (Review & Publish). | Requires multi-stage state management, but prevents bad chapter matches from polluting notes/MCQs, avoids token waste, and eliminates browser timeouts. | **SELECTED (User Approved)** |
| **Approach 2: Asynchronous Background Pipeline with Final Review** | Admin provides inputs (01–03) and backend executes 04–11 asynchronously, outputting to a single final review screen. | Simple upfront, but errors in early chapter matching silently propagate into bad notes and MCQs before the admin ever sees them. | Rejected |
| **Approach 3: Autonomous Stepper with Live Auto-Advance** | Linear 12-step stepper where every single step runs and auto-advances unless paused. | High cognitive friction; watching 12 individual steps cycle is slow and tedious for admins. | Rejected |

---

## 4. Architectural Specifications: The 12-Step Implementation

```
TNPSC Examination (e.g. Group 1 / Group 2 / Group 4)
  └── Single Parent Unit (e.g. Unit I – General Science)
       ├── 6th Standard (Term 1, 2, 3) ➔ Lessons ➔ Topics
       ├── 7th Standard (Term 1, 2, 3) ➔ Lessons ➔ Topics
       ├── 8th Standard ➔ Lessons ➔ Topics
       ├── 9th Standard ➔ Lessons ➔ Topics
       ├── 10th Standard ➔ Lessons ➔ Topics
       ├── 11th Standard (Vol 1, 2) ➔ Lessons ➔ Topics
       └── 12th Standard (Vol 1, 2) ➔ Lessons ➔ Topics
```

### Phase 1: Setup & Extraction (Steps 01–04)
- **Step 01: TNPSC Group Selection**: Admin selects target exam: Group 1, Group 2, Group 2A, or Group 4. Loads canonical subjects (General Studies, General Tamil, General English).
- **Step 02: Official Syllabus Input**: 
  - Option A: Paste official syllabus text directly.
  - Option B: Upload official TNPSC syllabus PDF (handled via client-side/in-memory text extraction).
- **Step 03: Textbook PDF Input**: Automatically populates available Samacheer Kalvi textbooks from `google_drive_materials` filtered by standard (6th to 12th) and subject. Admin can toggle which standards to include.
- **Step 04: Syllabus Analysis**: Backend Gemini service parses syllabus into structured JSON containing:
  - Canonical Unit Numbers (`unit_number`: 1, 2, 3...)
  - Unit Code (`Unit I`, `Unit II`...)
  - Official Unit Title (`General Science`, `Geography of India`...)
  - Subunits & Syllabus Keyphrases.

### Phase 2: Alignment & Hierarchy Structuring (Steps 05–09)
- **Step 05: Textbook Matching**: Backend semantic matching correlates syllabus topics against textbook tables of contents (`extracted_toc`) in `google_drive_materials`.
- **Step 06: Standard Mapping**: Groups matched lessons strictly under their respective standard buckets (Class 6, 7, 8, 9, 10, 11, 12).
- **Step 07: Unit Mapping**: Links all mapped standards under the **Single Parent Unit container**.
- **Step 08: Lesson Mapping**: Attaches textbook metadata (Lesson Number, Lesson Title, Term, Volume, Textbook Reference ID) to each lesson.
- **Step 09: Topic Verification**: Admin review table/tree. Allows adding, editing, reordering, or deleting mapped lessons and topics before generating notes and MCQs.

### Phase 3: Content Synthesis (Steps 10–11)
- **Step 10: Study Notes Generation**:
  - Generates concise, high-retention study notes.
  - Bilingual format: Tamil & English summaries.
  - Strictly grounded in textbook content; excludes unrelated trivia, page headers, or repeated text.
  - *Builder Call:* Execution is batchable/on-demand per lesson with progress feedback to eliminate HTTP timeout risks.
- **Step 11: MCQ Generation**:
  - Generates 5–10 syllabus-aligned MCQs per lesson.
  - Includes 4 distinct options, correct answer key, syllabus reference tag, and bilingual explanation.

### Phase 4: Review & Transactional Publish (Step 12)
- **Step 12: Review & Publish**:
  - Full hierarchical tree preview showing: Unit ➔ Standards ➔ Lessons ➔ Topics ➔ Notes Badge ➔ MCQs Badge.
  - Admin clicks **"Approve & Publish to Database"**.
  - Backend executes a single PostgreSQL transaction:
    1. Upsert into `syllabus_units` (preserves existing ID if matched by exam_id + unit_number).
    2. **Safe Non-Destructive Merge (Option A)**: Retains all existing lessons, topics, and notes under the unit; appends newly discovered standards/lessons and updates metadata without deleting existing database records.
    3. Insert/update `syllabus_topics` linked to `lesson_id`.
    4. Insert generated notes into `study_notes`.
    5. Insert generated questions into `questions`.
  - Dispatches `dynamicSyllabusService.notifySyllabusChanged` to immediately update frontend views without page reload.

---

## 5. Technical Stack & API Contracts

### Backend Services & Routes
- **`backend/src/services/aiSyllabusEngineService.ts`**:
  - `analyzeSyllabus(input: { examId: string, text?: string, pdfBuffer?: Buffer })`: Parses raw syllabus into canonical units.
  - `matchTextbooks(units: CanonicalUnit[], selectedTextbookIds: number[])`: Maps 6th–12th textbook chapters from `extracted_toc` under parent units.
  - `generateLessonNotes(lessonId: string, textbookRef: string, topics: string[])`: Synthesizes bilingual notes.
  - `generateLessonMCQs(lessonId: string, topics: string[])`: Generates exam-standard MCQs.
  - `publishSyllabusTransaction(payload: PublishPayload)`: Atomic database commit.
- **`backend/src/routes/aiSyllabusImportRoutes.ts`**:
  - `POST /api/study-management/ai-import/analyze`
  - `POST /api/study-management/ai-import/match`
  - `POST /api/study-management/ai-import/generate-notes`
  - `POST /api/study-management/ai-import/generate-mcqs`
  - `POST /api/study-management/ai-import/publish`

### Frontend Architecture
- **`src/components/admin/ai-syllabus/AiSyllabusImportWizard.tsx`**:
  - Step progress bar displaying 4 stages / 12 steps.
  - Phase A view: Group selector, syllabus text/PDF input, repository textbook selector.
  - Phase B view: Standard-wise lesson matcher with Single Parent Unit tree view.
  - Phase C view: Notes & MCQ preview drawers.
  - Phase D view: Final approval review with publish confirmation modal.
  - *Builder Call:* Session auto-save in `sessionStorage` so browser refresh does not discard parsed trees.

---

## 6. Constraints & Guarantees
1. **Preservation**: All existing 51 units, 1,725 lessons, 6,002 topics, 592 study notes, and 72 textbooks remain untouched.
2. **Reversibility**: Draft data is maintained in component memory/session until the admin explicitly hits "Approve & Publish".
3. **Performance**: Large LLM operations (e.g. note/MCQ generation) are chunked on-demand per unit or lesson rather than running as a blocking monolithic call.
