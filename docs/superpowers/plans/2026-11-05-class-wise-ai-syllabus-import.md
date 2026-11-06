# Class-wise AI Syllabus Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Upgrade the AI Syllabus Import module with **Standard Selection (Classes 6th to 12th)**, **dynamic class-wise Unit generation**, **strict Samacheer Kalvi hierarchical extraction** (Class → Subject → Term → Unit → Lesson → Topic), **class-wise expandable review & selective import**, and **resilient timeouts/error handling**.

---

## 1. Architecture & Data Flow

```mermaid
flowchart TD
    A["Admin Input: PDF Upload or Text Paste"] --> B["Select Standard: All (6-12) or Individual Class"]
    B --> C["AISyllabusImportService.analyzeSyllabus"]
    C --> D{"Detection Method"}
    D -->|AI Provider (Gemini/Claude)| E["Structured Class-wise Extraction with 10s Timeout"]
    D -->|Timeout or Offline Fallback| F["Authoritative Structural Multi-Standard Parser"]
    E --> G["Normalized ExtractedUnitDraft[] with standard_number (6-12)"]
    F --> G
    G --> H["Frontend Review Portal: Class-wise Sections (6th..12th)"]
    H --> I["Selective Checkboxes & In-line Editing"]
    I --> J["publishApprovedSyllabus to PostgreSQL"]
    J --> K["syllabus_units (with standard_number)"]
    J --> L["syllabus_lessons (with standard_number & term)"]
    J --> M["syllabus_topics (with lesson_id & order)"]
```

---

## 2. File Modifications

1. `backend/src/services/aiSyllabusImportService.ts`:
   - Extend `ExtractedUnitDraft` to include `standard_number: number` (6 to 12) and `term?: string`.
   - Update `analyzeSyllabus` to accept `standard?: number | 'all'`.
   - Enhance AI system prompt to detect and output separate units per class (6th to 12th) with dynamic unit counts (e.g., Class 6: 1..7, Class 10: 1..5).
   - Enhance `parseSyllabusStructurally` to detect class headings (`Class 6`, `Standard 7`, `SSLC`, `HSC`, etc.) and dynamically create units and lessons grouped per class.
   - Update `publishApprovedSyllabus` to include `standard_number` in `syllabus_units` query, insert, and update statements.

2. `backend/src/routes/studyMaterialsManagementRoutes.ts`:
   - Pass `standard` parameter from request body in `/ai-syllabus/upload` and `/ai-syllabus/analyze-text` to `AISyllabusImportService.analyzeSyllabus`.

3. `src/components/admin/StudyMaterialsManagement.tsx`:
   - Add `aiImportStandard` state (`'all' | number`, default `'all'`).
   - Add Standard Selection dropdown in the Upload/Paste step (supporting All 6–12 or individual classes).
   - In the Review step: Add class-wise filter tabs/sections (`All`, `Class 6`, `Class 7`, `Class 8`, `Class 9`, `Class 10`, `Class 11`, `Class 12`) with counts.
   - Show class badges on units and display dynamic unit counts per class.
   - Preserve and send `standard_number` per unit during publish.

4. `src/components/admin/StudyMaterialsManagement.css`:
   - Add styles for `.smm-ai-class-tabs`, `.smm-ai-class-tab`, `.smm-ai-class-badge`, `.smm-ai-std-select`.

---

## 3. Implementation Tasks

- [ ] **Task 1: Backend Type & Parsing Upgrade (`aiSyllabusImportService.ts`)**
  - Add `standard_number: number` and `term?: string` to `ExtractedUnitDraft`.
  - Add `standard?: number | 'all'` to `analyzeSyllabus` parameters.
  - Upgrade AI prompt for class-wise unit generation with dynamic unit counts.
  - Upgrade `parseSyllabusStructurally` with multi-standard class detection and segmentation.
  - Upgrade `publishApprovedSyllabus` to insert and query `standard_number` in `syllabus_units`.

- [ ] **Task 2: API Route Updates (`studyMaterialsManagementRoutes.ts`)**
  - Extract `standard` from `req.body` and forward to `AISyllabusImportService.analyzeSyllabus`.

- [ ] **Task 3: Frontend Standard Selection & Class-wise Review (`StudyMaterialsManagement.tsx` & `.css`)**
  - Add Standard Selection control in the Import Modal.
  - Add Class Tabs in the Review step to view units grouped by Standard (6th to 12th).
  - Update inline inputs and publish handlers.

- [ ] **Task 4: Compilation & Full Verification**
  - Compile backend: `npm --prefix backend run build`.
  - Compile frontend: `npm run build`.
  - Run verification script covering:
    - Text paste with multi-class content (Class 6, 7, 10).
    - Single class selection (Class 8).
    - Database commit to `syllabus_units`, `syllabus_lessons`, `syllabus_topics`.

