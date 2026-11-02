# TNPSC Study Hub – Complete Bulk PDF Upload & Automatic Syllabus Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a robust, end-to-end Bulk PDF Upload and Automatic Syllabus Classification system for Samacheer Kalvi textbooks (6th to 12th Standard), enabling administrators to select entire folders or multiple PDFs, automatically classify them by Standard, Subject, Medium, Term, Units, Lessons, and Topics matching the TNPSC syllabus, review classifications on an interactive review dashboard, stream approved PDFs directly to Google Drive with bounded concurrency, and automatically organize them across TNPSC Study Materials, Question Generators, and Admin libraries.

**Architecture:**
1. **Frontend Intake & Staging:** In `src/components/BulkPdfUploadModal.tsx`, provide dual-mode upload (preserving the existing Single PDF Upload while introducing Bulk PDF Upload). Support multi-file selection, folder intake (`webkitdirectory`), drag-and-drop, queue editing, and client-side SHA-256 checksum calculation for up to 100+ PDFs.
2. **Classification & Syllabus Matching Engine:** In `backend/src/services/bulkClassificationService.ts`, implement a multi-pass analyzer that inspects filenames, cover matter, and Table of Contents (பொருளடக்கம் / Index), parses Units, Lessons, and Topics, and matches them against `unifiedSyllabusRegistry.ts` and `samacheerTextbookCatalog.ts`. Compute a confidence score (High/Medium/Low) and detect multi-group applicability (Group 1, Group 2/2A, Group 4).
3. **Interactive Review Dashboard:** A high-fidelity table displaying classified metadata, confidence badges, editable fields modal (`ClassificationEditModal.tsx`), and a deep TOC inspector (`ExtractedContentsViewerModal.tsx`) with "Approve All" and "Approve Selected" controls.
4. **Resumable Bulk Upload Streaming:** Concurrent streaming (default: 3 files) directly from the browser to Google Drive via the existing resumable upload pipeline (5 MB chunks with retry/backoff), preventing Vercel serverless payload limits.
5. **Database & Full-Content Deep Indexing:** In `backend/src/routes/drive.ts` and `backend/src/services/fullTextbookExtractor.ts`, atomically register file metadata in `google_drive_materials`, `textbooks`, and `textbook_content` (preventing duplicates via file checksums). Extract all pages, preserving Tamil and English Unicode text, with OCR fallback for scanned pages.
6. **Cross-Section Discoverability:** Seamless query integration in `/api/drive/materials`, `/api/drive/files`, Study Materials viewer, AI Study Notes Generator, and MCQ Generator.

**Tech Stack:** React 19, TypeScript, Vite, Node.js + Express, PostgreSQL (`pg`), Google Drive API v3 (Resumable Uploads), `pdf-parse`, Tesseract.js (OCR), Lucide Icons, Vanilla CSS Glassmorphism.

**Spec:** User request: "TNPSC Study Hub – Complete Bulk PDF Upload & Automatic Syllabus Classification. Accept multiple PDF files/folders (6th to 12th), identify Standard, Subject, Medium, Term, extract all Units, Lessons, Topics matching TNPSC syllabus, show AI classification review screen, bulk upload directly to Google Drive (3 concurrent streams), preserve existing single upload and OAuth, store in PostgreSQL without duplicate physical files, and make textbooks discoverable in Study Materials, Notes, and MCQ generators."

---

## Global Constraints

- **Preserve Existing Single PDF Upload & OAuth:** Do not break, rename, or delete the working Single PDF Upload modal or the verified Google Drive OAuth 2.0 configuration. Single and Bulk upload modes must live side-by-side.
- **Direct-to-Drive Resumable Streaming:** PDF payloads must NEVER be uploaded through the Node/Express backend or Vercel serverless functions. All file chunks must stream directly from the browser to Google Drive's resumable session URLs.
- **Physical Deduplication:** A PDF file with the same SHA-256 checksum must only be stored once in Google Drive. If a textbook serves multiple TNPSC Groups or contains 10 lessons, create database mappings for all applicable groups and lessons referencing that single Google Drive File ID.
- **Complete Content Extraction (No Skipping):** Read the entire PDF across all pages, extracting every Unit, Lesson, and Topic. Do not truncate after the first few pages. Support Tamil & English Unicode preservation and scanned page OCR.
- **Zero TypeScript / Build Errors:** Frontend (`npm run build`) and Backend (`npm run build --prefix backend`) must compile cleanly with zero errors.

---

## Review Focus

1. **Folder & Batch Intake:** Can the user select a folder containing 20+ Samacheer Kalvi PDFs, remove individual files, add more files, and see total file size and count accurately?
2. **Classification Accuracy & Multi-Group Association:** Does a file like `10th_Social_Science_EM.pdf` or `6th_Tamil_Term_1.pdf` correctly detect Standard, Subject, Medium, Term, and automatically link to Group 1, Group 2, and Group 4?
3. **Review Screen Control:** Can the admin inspect extracted Table of Contents (units, lessons, topics), edit metadata for medium/low confidence files, approve all or selected, and re-analyze?
4. **Resumable Concurrency & Failure Recovery:** With 3 concurrent uploads, if one file experiences a temporary network hiccup, do the other uploads continue, and does the retry button retry only failed files without re-uploading completed files?
5. **Cross-System Discoverability:** Once uploaded, does the textbook immediately appear in Study Materials, the PDF Reader, the AI Notes Generator, and the MCQ Generator under the exact Group, Subject, Standard, Term, Unit, and Lesson?

---

## Task Structure

### Task 1: Database Schema Migration for Bulk Metadata, Checksums & Multi-Group Linking

**Files:**
- Modify: `backend/src/migrate.ts:410-445`
- Test: `backend/src/test-system.ts`

- [ ] **Step 1: Update `google_drive_materials` schema in `backend/src/migrate.ts`**
  - Add column `file_checksum VARCHAR(64)`.
  - Add column `applicable_groups JSONB DEFAULT '["group1", "group2", "group4"]'::jsonb`.
  - Add column `extracted_toc JSONB`.
  - Add column `classification_meta JSONB`.
  - Add column `confidence_score INT DEFAULT 100`.
  - Add column `medium VARCHAR(20) DEFAULT 'Tamil' CHECK (medium IN ('Tamil', 'English'))`.
  - Add index `idx_gdrive_materials_checksum ON google_drive_materials (file_checksum)`.
  - Add index `idx_gdrive_materials_medium ON google_drive_materials (medium)`.

- [ ] **Step 2: Create `bulk_upload_batches` tracking table in `backend/src/migrate.ts`**
  - Table columns: `id SERIAL PRIMARY KEY`, `batch_id VARCHAR(100) UNIQUE NOT NULL`, `total_files INT NOT NULL`, `completed_files INT DEFAULT 0`, `failed_files INT DEFAULT 0`, `status VARCHAR(30) DEFAULT 'processing'`, `created_by VARCHAR(150)`, `summary JSONB`, `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`, `updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`.

- [ ] **Step 3: Run migration and verify tables**
  - Execute migration via node script or startup check.
  - Verify columns exist using `information_schema.columns`.

---

### Task 2: Backend Bulk Classification & Syllabus Matching Service

**Files:**
- Create: `backend/src/services/bulkClassificationService.ts`
- Modify: `backend/src/services/lessonMapping.ts`
- Test: Scratch test script verifying classification against Samacheer Kalvi naming patterns and TNPSC syllabus registry.

- [ ] **Step 1: Implement Filename & Metadata Heuristic Parser**
  - Extract Standard (`6th` to `12th`, `std 6`, `class 10`, etc.).
  - Extract Medium (`Tamil` / `English`, `TM`, `EM`).
  - Extract Term / Volume (`Term 1`, `Term 2`, `Term 3`, `Vol 1`, `Vol 2`, `Full Year`).
  - Extract Subject (`Tamil`, `English`, `Maths`, `Science`, `Social Science`, `History`, `Geography`, `Polity`, `Economics`, `Physics`, `Chemistry`, `Botany`, `Zoology`).

- [ ] **Step 2: Implement Table of Contents & Lesson Structure Matcher**
  - Detect Tamil Iyal markers (`இயல் 1`, `இயல் ஒன்று`, `பொருளடக்கம்`, etc.) and English Unit/Chapter markers (`Unit 1`, `Chapter 1`, `Contents`).
  - Match detected lessons with canonical lessons from `src/data/unifiedSyllabusRegistry.ts` and `backend/src/data/samacheerTextbookCatalog.ts`.
  - Derive lesson codes (`group2_std6_generaltamil_term1_u1_l1.1`) and backwards-compatible lesson IDs (`gt-1-6-t1-l1`).

- [ ] **Step 3: Implement Multi-Group Association Logic**
  - Map textbooks to applicable TNPSC groups:
    - 6th-10th Tamil -> Group 2/2A, Group 4.
    - 6th-10th General Science & Social Science -> Group 1, Group 2/2A, Group 4.
    - 11th-12th History, Polity, Economy, Geography, Ethics -> Group 1, Group 2/2A, Group 4.
  - Return list of applicable groups: `['group1', 'group2', 'group4']`.

- [ ] **Step 4: Implement Confidence Scoring Algorithm**
  - `High` (>= 85%): Standard, Subject, Medium, Term, and at least 80% of units/lessons matched to syllabus.
  - `Medium` (60-84%): Core subject and standard matched, term or lesson numbering requires minor verification.
  - `Low` (< 60%): Ambiguous subject or unmapped textbook.

---

### Task 3: Backend Bulk Upload & Registration Endpoints

**Files:**
- Modify: `backend/src/routes/drive.ts`
- Create: `backend/src/services/fullTextbookExtractor.ts`

- [ ] **Step 1: Add `POST /api/drive/bulk/classify` endpoint in `backend/src/routes/drive.ts`**
  - Receives array of file metadata (fileName, fileSize, sampleTocText/clientExtraction if available).
  - Runs `bulkClassificationService` and returns structured classification results, suggested syllabus mapping, and confidence scores.

- [ ] **Step 2: Add `POST /api/drive/bulk/check-duplicates` endpoint**
  - Accepts array of `{ fileName, fileSize, checksum }`.
  - Checks PostgreSQL for existing records with matching `file_checksum`.
  - Returns duplicate status and existing Google Drive File IDs so duplicates are not uploaded twice.

- [ ] **Step 3: Add `POST /api/drive/bulk/register` endpoint**
  - When an approved PDF finishes Google Drive upload (or is matched to existing file ID), atomically registers:
    - Main entry in `google_drive_materials`.
    - Cross-group entries in `google_drive_materials` (linking same `google_drive_file_id`).
    - Textbook record in `textbooks` for compatibility with existing Textbook Management.
    - Multi-lesson records in `textbook_content` and syllabus tables.
  - Uses PostgreSQL transaction `BEGIN ... COMMIT` to guarantee complete atomic registration.

- [ ] **Step 4: Implement `fullTextbookExtractor.ts` for deep PDF processing**
  - Extracts all pages without artificial caps.
  - Preserves Tamil and English Unicode text using `cleanTamilUnicodeText` and `repairInDesignPdfArtifacts`.
  - Integrates Tesseract OCR fallback for scanned pages.
  - Indexes extracted pages into `textbook_content`.

---

### Task 4: Frontend Modals: `ClassificationEditModal` & `ExtractedContentsViewerModal`

**Files:**
- Create: `src/components/ClassificationEditModal.tsx`
- Create: `src/components/ExtractedContentsViewerModal.tsx`
- Create: `src/components/BulkUploadModals.css`

- [ ] **Step 1: Build `ClassificationEditModal.tsx`**
  - Allows admin to edit Standard (6th-12th), Subject (dropdown populated from Samacheer catalog), Medium (Tamil/English), Term (Term 1, Term 2, Term 3, Full Year), and TNPSC Groups (multi-select checkboxes: Group 1, Group 2/2A, Group 4).
  - Saves adjustments back into the bulk staging queue.

- [ ] **Step 2: Build `ExtractedContentsViewerModal.tsx`**
  - Displays full detected Table of Contents tree:
    - Unit badge (e.g. `Unit 1: General Science / இயல் 1: தமிழ் தேன்`)
    - Lessons list (e.g. `Lesson 1.1: இன்பத்தமிழ் • Pages 1-6`)
    - Subtopics and key concepts list.
    - Confidence score breakdown and syllabus mapping verification.

- [ ] **Step 3: Style modals with Glassmorphism and responsive design**
  - Ensure high contrast, clear font rendering (Noto Sans Tamil), keyboard support (`Esc` to close), and mobile responsiveness.

---

### Task 5: Frontend Bulk PDF Upload Modal & AI Review Dashboard

**Files:**
- Create: `src/components/BulkPdfUploadModal.tsx`
- Create: `src/components/BulkPdfUploadModal.css`
- Modify: `src/pages/Admin.tsx`

- [ ] **Step 1: Create `BulkPdfUploadModal.tsx` with Dual-Mode Tabs**
  - Tab 1: **"Single PDF Upload"** (wraps existing single upload form without changing a single field).
  - Tab 2: **"Bulk PDF Upload"** (the new multi-file workflow).

- [ ] **Step 2: Build File Intake & Queue Manager**
  - Drag-and-drop zone with animated drop states.
  - "Select PDF Files" (`<input type="file" multiple accept=".pdf" />`)
  - "Select Entire Folder" (`<input type="file" webkitdirectory directory multiple accept=".pdf" />`)
  - Batch size support: up to 100+ PDFs.
  - Batch actions: "Select All", "Deselect All", "Clear All", "Add More Files".
  - Queue summary header: Total files, Total size in MB/GB.

- [ ] **Step 3: Build AI Classification & Review Dashboard View**
  - Multi-status filter tabs: `All`, `High Confidence`, `Needs Review`, `Approved`, `Uploading`, `Completed`, `Failed`.
  - Detailed review table:
    - Checkbox selector.
    - File Name, File Size, Checksum preview.
    - Standard pill (`6th` to `12th`).
    - Subject & Medium badge (`Tamil Medium`, `English Medium`).
    - Term (`Term 1`, `Term 2`, `Term 3`, `Full Year`).
    - Units & Lessons count with "View TOC" button.
    - Applicable TNPSC Groups (`G1`, `G2`, `G4`).
    - Confidence indicator (`High 95%`, `Medium 72%`, `Low 45%`).
    - Quick actions: `Edit`, `View Details`, `Remove`.
  - Batch action bar:
    - "Approve All High Confidence"
    - "Approve Selected"
    - "Start Bulk Upload (X Files)"

- [ ] **Step 4: Build Resumable Direct-to-Drive Upload Runner**
  - Concurrent upload controller (concurrency limit: 3 files).
  - For each approved file:
    - Calls `POST /api/drive/upload/initiate` with metadata & origin.
    - Streams 5 MB chunks directly to Google Drive upload URL using `XMLHttpRequest`.
    - Calls `POST /api/drive/upload/complete` and `POST /api/drive/bulk/register`.
  - Progress tracking:
    - Global progress bar with percentage, current speed, elapsed/remaining time.
    - Per-file progress bars with chunk indices and transferred MB.
  - Error resilience:
    - Retry failed files button (never re-uploads completed files).
    - Pause & Cancel controls.

- [ ] **Step 5: Integrate `BulkPdfUploadModal` in `Admin.tsx`**
  - Replace the current single upload modal trigger with `BulkPdfUploadModal`.
  - Ensure the modal opens from both the Google Drive tab and the Textbook Management tab.
  - Trigger refresh of Google Drive materials table upon batch completion.

---

### Task 6: Cross-Section Discoverability & Filtering Updates

**Files:**
- Modify: `backend/src/routes/drive.ts`
- Modify: `src/pages/StudyMaterials.tsx`
- Modify: `src/components/GoogleDriveTextbookSelector.tsx`

- [ ] **Step 1: Enhance `GET /api/drive/materials` filtering**
  - Support multi-group matching (`applicable_groups @> '["group2"]'`).
  - Return extracted TOC summaries and unit/lesson metadata in response.

- [ ] **Step 2: Verify `GoogleDriveTextbookSelector.tsx` for MCQ & Notes Generator**
  - Verify that bulk-uploaded textbooks appear in the selector dropdown.
  - Ensure selecting a textbook automatically populates Standard, Subject, and Unit/Lesson options based on the extracted syllabus mapping.

- [ ] **Step 3: Verify Study Materials section**
  - Ensure textbooks uploaded via bulk mode are immediately browseable under the appropriate TNPSC Group, Subject, and Standard.

---

### Task 7: Comprehensive Testing & Verification (Tests 1 through 12)

**Files:**
- Test scripts and manual verification suite:
  - Upload 10 PDFs batch test.
  - Upload 50 PDFs batch test.
  - 100 PDFs capacity & queue memory test.
  - 6th to 12th Standard coverage test.
  - Tamil and English Medium dual-test.
  - Multi-unit / Multi-lesson extraction validation.
  - Scanned PDF OCR fallback test.
  - Checksum duplicate prevention test.
  - Resumable retry test on simulated network interruption.
  - Database relational integrity verification.
  - Study Materials and AI Generators discovery verification.
- Run `npm run build --prefix backend` and `npm run build` (zero errors).

---

