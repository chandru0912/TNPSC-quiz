# Bilingual Tamil / English Language Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a fully working Tamil / English language switch strictly restricted to Study Materials, MCQ Questions, and Mock Test sections, delivering 100% deep bilingual localization of questions, options, explanations, and study notes while preserving language preference across sessions.

**Architecture:** A lightweight React `LanguageContext` (`src/context/LanguageContext.tsx`) manages `'en' | 'ta'` state with `localStorage` persistence under `'tnpsc_language_pref'`. A scoped glassmorphism switch component (`src/components/LanguageSwitch.tsx`) renders conditionally only on `/materials*`, `/practice*`, and `/mock-tests*` routes (in the Navbar header and in-section toolbars). A high-fidelity bilingual translation & normalization engine (`src/utils/languageData.ts`) transforms dynamic MCQ questions, answer options, rationale explanations, syllabus metadata, and study notes cards between Tamil and English.

**Tech Stack:** React 19, TypeScript, Framer Motion, Lucide Icons, Vite, LocalStorage API, Vanilla CSS with Glassmorphism tokens.

**Spec:** User prompt: "Implement a fully working Tamil / English language switch only for these three sections: Study Materials, MCQ Questions, Mock Test. When Tamil is selected, show all content in Tamil. When English is selected, show all content in English. This must apply to actual questions, answer options, explanations, and study content, not only button labels. Preserve this language preference across those sections."

## Global Constraints

- **Scope Restriction:** The Tamil/English switch must ONLY appear in or affect the three specified sections: Study Materials (`/materials*`), MCQ Questions (`/practice*`), and Mock Test (`/mock-tests*`). Do NOT render the language switch on Home, Dashboard, Admin, or Auth pages.
- **Deep Translation Requirement:** Question text, all 4 answer options, detailed explanations, syllabus units, lesson titles, and study notes must translate fully into fluent, textbook-grade Tamil when Tamil is selected, and into English when English is selected. Button-only translation is strictly prohibited.
- **Persistence Requirement:** The user's language choice must be remembered across route transitions and page refreshes between the three sections using `localStorage` key `'tnpsc_language_pref'`.
- **Zero Build/Type Errors:** Must pass `npm run build` (`tsc -b && vite build`) with zero TypeScript or styling warnings.

## Review Focus

1. **Question Translation Fidelity:** Does switching to Tamil translate question stems, technical options (e.g. physics laws, polity articles, historical treaties), and explanation paragraphs into authentic Tamil?
2. **Persistence Across Sections:** If a user selects 'தமிழ்' on Study Materials, does navigating to MCQ Practice or Mock Tests keep 'தமிழ்' active without resetting to English?
3. **Route Scoping Verification:** Does the language toggle disappear when navigating to Home (`/`), Dashboard (`/dashboard`), or Admin (`/admin`), and reappear on the three target sections?
4. **Interactive State Preservation:** Does toggling language during an active MCQ practice session preserve the user's current question index, selected answer, and answered score?
5. **Study Notes Deck Depth:** In the slide reader modal (`Group1UnitClass.tsx`), do the slide titles, concept bullet points, key highlights, and fact boxes render completely in Tamil when Tamil is selected?

---

### Task 1: Create Reactive `LanguageContext` and Scoped `LanguageSwitch` Component

**Files:**
- Create: `src/context/LanguageContext.tsx`
- Create: `src/components/LanguageSwitch.tsx`
- Create: `src/components/LanguageSwitch.css`
- Modify: `src/App.tsx:32-55`
- Modify: `src/components/Navbar.tsx:75-115`
- Modify: `src/components/Navbar.css:260-310`

- [ ] **Step 1: Write `src/context/LanguageContext.tsx`**
  - Define `Language = 'en' | 'ta'`.
  - Check `localStorage.getItem('tnpsc_language_pref')` on mount with fallback to `'en'`.
  - Expose `{ language, setLanguage, toggleLanguage, isTamil, isScopedSection }`.
  - Detect whether current location pathname matches `/materials`, `/practice`, or `/mock-tests`.
  - Provide safe setter that syncs `localStorage` and updates document `lang` attribute.

- [ ] **Step 2: Create `src/components/LanguageSwitch.tsx` and `.css`**
  - Implement a sleek glassmorphism segmented toggle (`English | தமிழ்`) with a glowing pill indicator and Lucide `Languages` icon.
  - Return `null` if not within the three designated sections (unless forced via props for section headers).
  - Include keyboard accessibility (`role="radiogroup"`, `aria-checked`).

- [ ] **Step 3: Wrap `App.tsx` with `LanguageProvider`**
  - Import `LanguageProvider` in `src/App.tsx` and place it inside `Router` to give all routes access to language state.

- [ ] **Step 4: Integrate `LanguageSwitch` in `Navbar.tsx`**
  - Render `<LanguageSwitch variant="navbar" />` in `Navbar.tsx` inside `.nav-actions` right before Login/Admin buttons.
  - Verify it renders ONLY on `/materials*`, `/practice*`, and `/mock-tests*`.

- [ ] **Step 5: Verify build**
  - Run `npm run build` and ensure TypeScript compiles cleanly.

---

### Task 2: Build Comprehensive Bilingual Translation & Localization Engine

**Files:**
- Create: `src/utils/languageData.ts`
- Create: `src/data/bilingualStudyNotes.ts`
- Modify: `src/data/studyNotesData.ts:25-110`

- [ ] **Step 1: Build UI & Section Dictionaries in `src/utils/languageData.ts`**
  - Create dictionary mappings for Study Materials (tabs, unit titles, chapter titles, standards, breadcrumbs).
  - Create dictionary mappings for MCQ Questions (controls, difficulty, timer, score, review, filter tags, source references).
  - Create dictionary mappings for Mock Tests (test titles, durations, attempts, rating, start test buttons).

- [ ] **Step 2: Build MCQ Question Bilingual Transformer (`translateQuestionItem`)**
  - Implement `translateQuestionItem(q: QuestionItem, lang: Language): QuestionItem`.
  - Provide authentic Tamil translations for all standard TNPSC questions (Science, Geography, History/INM, Polity, Economy, Tamil Heritage, Aptitude).
  - Provide English translations for Tamil questions (e.g. from `group2TamilData.ts` and `generalTamilComprehensiveData.ts`).
  - Translate question text, all 4 options, explanation, tag, and topic.
  - Guarantee option index order and `correctAnswer` integrity remain 100% matched across languages.

- [ ] **Step 3: Build Bilingual Study Notes Generator in `src/data/bilingualStudyNotes.ts`**
  - Provide full Tamil versions of note slides, exam roles, high-yield tips, formulas/acts, and key concept highlights for Samacheer Kalvi units.
  - Integrate with `getLessonNotes` in `studyNotesData.ts` so `activeDeck` automatically respects the active `language`.

- [ ] **Step 4: Verify build**
  - Run `npm run build` to confirm zero lint or compilation errors.

---

### Task 3: Implement Deep Bilingual Localization in MCQ Questions (`MCQPractice.tsx`)

**Files:**
- Modify: `src/pages/MCQPractice.tsx:1-120`
- Modify: `src/pages/MCQPractice.tsx:220-350`
- Modify: `src/pages/MCQPractice.tsx:450-650`
- Modify: `src/pages/MCQPractice.css:80-140`

- [ ] **Step 1: Connect `MCQPractice.tsx` to `useLanguage`**
  - Import `useLanguage` hook and access `language`, `isTamil`, and `setLanguage`.
  - Add in-page section header `<LanguageSwitch variant="section" />` next to group filters so students can switch languages with 1 click right above the question card.

- [ ] **Step 2: Localize Active Question, Options, and Explanation**
  - Wrap `questionItem` with `translateQuestionItem(questionItem, language)`.
  - Ensure that when the language toggles:
    - `questionItem.question` renders in Tamil/English.
    - `questionItem.options[i]` renders in Tamil/English.
    - `questionItem.explanation` renders in Tamil/English.
    - `questionItem.tag` and `topic` render in Tamil/English.
    - Selected answer state (`selectedAnswer`) and score are strictly preserved.

- [ ] **Step 3: Localize Quiz Controls, Badges, and Results View**
  - Translate "Question X of Y" ("வினா X / Y"), "Submit Answer" ("விடையைச் சமர்ப்பி"), "Next Question" ("அடுத்த வினா"), "Previous" ("முந்தையது"), "Review Answers" ("விடைகளை மதிப்பாய்வு செய்"), "Practice Again" ("மீண்டும் பயிற்சி செய்க").
  - Translate result modal / review panel ("Quiz Completed!" -> "பயிற்சி நிறைவடைந்தது!", "Your Score" -> "உங்கள் மதிப்பெண்", "Accuracy" -> "துல்லியம்").

- [ ] **Step 4: Verify in dev build**
  - Run `npm run build` to verify clean compilation.

---

### Task 4: Implement Deep Bilingual Localization in Mock Tests (`MockTests.tsx`)

**Files:**
- Modify: `src/pages/MockTests.tsx:1-90`
- Modify: `src/pages/MockTests.tsx:140-260`
- Modify: `src/pages/MockTests.css:25-80`

- [ ] **Step 1: Connect `MockTests.tsx` to `useLanguage`**
  - Import `useLanguage` hook and access `language`, `isTamil`, `setLanguage`.
  - Add in-page `<LanguageSwitch variant="section" />` in the mock test header.

- [ ] **Step 2: Localize Mock Test Catalog Data**
  - Define bilingual mock test metadata:
    - Titles: "TNPSC Group 1 Prelims Full Mock Test 1" <-> "TNPSC குரூப் 1 முதல்நிலை முழு மாதிரித் தேர்வு 1"
    - Subtitles & Descriptions: translated into authentic Tamil.
    - Difficulty badges: "Hard" <-> "கடினம்", "Medium" <-> "நடுத்தரம்", "Easy" <-> "எளிது".
    - Stat badges: "Questions" <-> "வினாக்கள்", "Attempts" <-> "முயற்சிகள்", "min" <-> "நிமிடங்கள்".
    - Buttons: "Start Test" <-> "தேர்வைத் தொடங்குக".

- [ ] **Step 3: Verify navigation to `/practice` with active language preserved**
  - Ensure clicking "Start Test" preserves the user's language selection seamlessly into the MCQ engine.

- [ ] **Step 4: Verify build**
  - Run `npm run build` to confirm zero errors.

---

### Task 5: Implement Deep Bilingual Localization in Study Materials (`StudyMaterials.tsx` & `Group1UnitClass.tsx`)

**Files:**
- Modify: `src/pages/StudyMaterials.tsx:1-120`
- Modify: `src/pages/StudyMaterials.tsx:125-250`
- Modify: `src/pages/Group1UnitClass.tsx:1-130`
- Modify: `src/pages/Group1UnitClass.tsx:320-450`
- Modify: `src/pages/StudyMaterials.css:60-120`

- [ ] **Step 1: Connect `StudyMaterials.tsx` to `useLanguage`**
  - Add in-page `<LanguageSwitch variant="section" />` to the Study Materials header.
  - Translate section header: "Study Materials & Syllabus" <-> "பாடக்குறிப்புகள் & பாடத்திட்டம்", subtitle, and category tabs ("TNPSC Group 1" <-> "TNPSC குரூப் 1", "Group 2 & 2A" <-> "குரூப் 2 & 2A", "Group 4" <-> "குரூப் 4 & VAO").

- [ ] **Step 2: Localize Unit Cards & Descriptions in `StudyMaterials.tsx`**
  - For Group 1, Group 2, and Group 4 cards:
    - Display Tamil unit titles (e.g. "அலகு 1: பொது அறிவியல்", "அலகு 2: இந்தியாவின் புவியியல்", "அலகு 3: இந்திய வரலாறு & இந்திய தேசிய இயக்கம்", "அலகு 4: இந்திய ஆட்சியியல்", "அலகு 5: இந்தியப் பொருளாதாரம் & தமிழக வளர்ச்சி நிர்வாகம்", "அலகு 6: தமிழ்நாட்டின் வரலாறு, பண்பாடு & மரபு", "பகுதி ஆ: பொதுத்தமிழ்", "பகுதி இ: பொது ஆங்கிலம்").
    - Display localized syllabus scope summaries and metrics ("175 வினாக்கள்", "28 அத்தியாயங்கள்", "109 பாடங்கள்").

- [ ] **Step 3: Localize Study Notes Reader Modal in `Group1UnitClass.tsx`**
  - Pass `language` to `getLessonNotes(...)`.
  - When Tamil is active:
    - Slide titles render in Tamil ("பாட மேலோட்டம் & தேர்வுக் குறிப்புகள்", "பாடத்திட்ட மையக் கருத்துகள்", "தேர்வு நுணுக்கங்கள் & வழிகாட்டல்", "முக்கிய சட்டங்கள் & சூத்திரங்கள்").
    - Paragraphs, bullet points, key highlights, and fact boxes render in Tamil.
    - Navigation buttons render as "அடுத்த தாள்", "முந்தைய தாள்", "முடிந்தது".

- [ ] **Step 4: Verify build**
  - Run `npm run build` and ensure complete compilation.

---

### Task 6: Cross-Section Integration Verification & Quality Gates

**Files:**
- Verify: `src/App.tsx`
- Verify: `src/pages/StudyMaterials.tsx`
- Verify: `src/pages/MCQPractice.tsx`
- Verify: `src/pages/MockTests.tsx`
- Verify: `src/pages/Home.tsx`
- Verify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Verify Scope Isolation**
  - Confirm Language Switch is visible on `/materials`, `/practice`, `/mock-tests`.
  - Confirm Language Switch is NOT visible on `/`, `/dashboard`, `/admin`, `/login`.

- [ ] **Step 2: Verify Cross-Section State Persistence**
  - Select 'தமிழ்' on `/materials`.
  - Navigate to `/practice`: verify language is 'தமிழ்' and questions/options/explanations are in Tamil.
  - Navigate to `/mock-tests`: verify language is 'தமிழ்' and mock tests are in Tamil.
  - Switch to 'English' on `/mock-tests`.
  - Navigate to `/practice` and `/materials`: verify language is 'English'.

- [ ] **Step 3: Run Full Production Build**
  - Execute `npm run build`.
  - Ensure zero TypeScript errors, zero CSS errors, and verified bundle generation.
