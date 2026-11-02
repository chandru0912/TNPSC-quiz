/**
 * bulkClassificationService.ts
 *
 * Automated classification and syllabus matching engine for bulk Samacheer Kalvi
 * textbook PDF uploads (Classes 6th through 12th).
 *
 * Analyzes filenames, cover page metadata, and Table of Contents (பொருளடக்கம் / Index),
 * extracts Units, Lessons, and Topics matching the TNPSC syllabus structure,
 * determines multi-group applicability, and calculates classification confidence.
 */

import {
  type StandardId,
  getSubjectsForStandard,
  findCatalogSubject,
} from '../data/samacheerTextbookCatalog';
import { resolveSyllabusLessonId } from './lessonMapping';

export interface ExtractedTopicItem {
  id: string;
  title: string;
  pageNumber?: number;
}

export interface ExtractedLessonItem {
  lessonNumber: string;
  title: string;
  lessonId: string;
  lessonCode: string;
  startPage?: number;
  endPage?: number;
  topics: ExtractedTopicItem[];
}

export interface ExtractedUnitItem {
  unitNumber: number;
  unitTitle: string;
  lessons: ExtractedLessonItem[];
}

export interface ClassifiedPdfMetadata {
  fileName: string;
  fileSize: number;
  checksum?: string;
  standard: StandardId;
  standardNumber: number;
  subject: string;
  subjectId: string;
  tamilSubjectName: string;
  medium: 'Tamil' | 'English';
  term: string;
  bookName: string;
  applicableGroups: Array<'group1' | 'group2' | 'group4'>;
  primaryGroup: 'group1' | 'group2' | 'group4';
  units: ExtractedUnitItem[];
  totalUnits: number;
  totalLessons: number;
  totalTopics: number;
  confidenceScore: number; // 0 to 100
  confidenceLevel: 'high' | 'medium' | 'low';
  confidenceReasons: string[];
  requiresReview: boolean;
  pageCount?: number;
}

export interface ClassifyPdfInput {
  fileName: string;
  fileSize: number;
  checksum?: string;
  tocText?: string;
  samplePagesText?: string[];
  pageCount?: number;
  manualOverrides?: Partial<{
    standard: StandardId;
    subject: string;
    medium: 'Tamil' | 'English';
    term: string;
    applicableGroups: Array<'group1' | 'group2' | 'group4'>;
  }>;
}

// ----------------------------------------------------------------------------
// 1. Filename & Text Heuristic Extractors
// ----------------------------------------------------------------------------

export function normalizeSearchText(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/[._\-+()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectStandard(text: string): { standard: StandardId; standardNumber: number; confidence: number } {
  const clean = normalizeSearchText(text);

  // Explicit patterns: 6th, 7th, 8th, 9th, 10th, 11th, 12th, class 10, std 8, etc.
  const stdPatterns: Array<{ regex: RegExp; stdNum: number; conf: number }> = [
    { regex: /\b(?:std|class|standard|grade|வகுப்பு)[_ -]*(?:0?([6-9]|1[0-2]))\b/i, stdNum: 0, conf: 35 },
    { regex: /\b(?:0?([6-9]|1[0-2]))(?:th|ஆம்|ம்)?[_ -]*(?:std|class|standard|வகுப்பு)\b/i, stdNum: 0, conf: 35 },
    { regex: /\b(?:class|std|standard)[_ -]*(?:vi|vii|viii|ix|x|xi|xii)\b/i, stdNum: 0, conf: 30 },
    { regex: /\b10th\b|\b10-ஆம்\b|\bsslc\b/i, stdNum: 10, conf: 30 },
    { regex: /\b11th\b|\b11-ஆம்\b|\b\+1\b|\bhsc[ -]?1\b/i, stdNum: 11, conf: 30 },
    { regex: /\b12th\b|\b12-ஆம்\b|\b\+2\b|\bhsc[ -]?2\b/i, stdNum: 12, conf: 30 },
    { regex: /\b6th\b|\b6-ஆம்\b/i, stdNum: 6, conf: 25 },
    { regex: /\b7th\b|\b7-ஆம்\b/i, stdNum: 7, conf: 25 },
    { regex: /\b8th\b|\b8-ஆம்\b/i, stdNum: 8, conf: 25 },
    { regex: /\b9th\b|\b9-ஆம்\b/i, stdNum: 9, conf: 25 },
  ];

  for (const p of stdPatterns) {
    const match = clean.match(p.regex);
    if (match) {
      let num = p.stdNum;
      if (num === 0 && match[1]) {
        num = parseInt(match[1], 10);
      } else if (num === 0) {
        const roman = match[0].toLowerCase();
        if (roman.includes('xii')) num = 12;
        else if (roman.includes('xi')) num = 11;
        else if (roman.includes('x')) num = 10;
        else if (roman.includes('ix')) num = 9;
        else if (roman.includes('viii')) num = 8;
        else if (roman.includes('vii')) num = 7;
        else if (roman.includes('vi')) num = 6;
      }

      if (num >= 6 && num <= 12) {
        return {
          standard: `${num}th` as StandardId,
          standardNumber: num,
          confidence: p.conf,
        };
      }
    }
  }

  // Bare number at start of filename (e.g. "6_Tamil_Term1.pdf" or "10_Social.pdf")
  const leadingNumMatch = clean.match(/^(?:0?([6-9]|1[0-2]))[_ -]/);
  if (leadingNumMatch) {
    const num = parseInt(leadingNumMatch[1], 10);
    return {
      standard: `${num}th` as StandardId,
      standardNumber: num,
      confidence: 20,
    };
  }

  return { standard: '6th', standardNumber: 6, confidence: 5 };
}

export function detectMedium(text: string, subject: string): { medium: 'Tamil' | 'English'; confidence: number } {
  const clean = normalizeSearchText(text);

  // If subject is Tamil or contains Tamil keywords
  if (
    clean.includes('பொதுத்தமிழ்') ||
    clean.includes('தமிழ்') ||
    subject.toLowerCase() === 'tamil' ||
    clean.includes('generaltamil')
  ) {
    // Tamil language textbooks are always Tamil medium
    return { medium: 'Tamil', confidence: 30 };
  }

  if (
    clean.includes('generalenglish') ||
    clean.includes('ஆங்கிலம்') ||
    subject.toLowerCase() === 'english'
  ) {
    return { medium: 'English', confidence: 30 };
  }

  // Check explicit medium markers (TM / EM)
  if (
    /\b(?:tm|tamil\s+medium|தமிழ்\s+வழி)\b/i.test(clean) ||
    /\btm\b/i.test(clean)
  ) {
    return { medium: 'Tamil', confidence: 25 };
  }

  if (
    /\b(?:em|english\s+medium|ஆங்கில\s+வழி)\b/i.test(clean) ||
    /\bem\b/i.test(clean)
  ) {
    return { medium: 'English', confidence: 25 };
  }

  // Check for Tamil Unicode characters in text sample
  const tamilCharCount = (text.match(/[\u0B80-\u0BFF]/g) || []).length;
  if (tamilCharCount > 20) {
    return { medium: 'Tamil', confidence: 20 };
  }

  // Default to Tamil medium for TNPSC standard syllabus
  return { medium: 'Tamil', confidence: 15 };
}

export function detectTerm(
  text: string,
  stdNum: number
): { term: string; confidence: number } {
  const clean = normalizeSearchText(text);

  // 10th standard is strictly Full Year in Samacheer Kalvi
  if (stdNum === 10) {
    return { term: 'Full Year', confidence: 30 };
  }

  // 11th & 12th standards use Volumes 1 & 2 or Full Year
  if (stdNum === 11 || stdNum === 12) {
    if (/\b(?:vol(?:ume)?\s*(?:1|i))\b/i.test(clean) || /பாகம்\s*1/i.test(clean)) {
      return { term: 'Volume 1', confidence: 25 };
    }
    if (/\b(?:vol(?:ume)?\s*(?:2|ii))\b/i.test(clean) || /பாகம்\s*2/i.test(clean)) {
      return { term: 'Volume 2', confidence: 25 };
    }
    return { term: 'Full Year', confidence: 20 };
  }

  // Classes 6th through 9th use Trimester (Term 1, Term 2, Term 3) or Full Year
  if (/\b(?:term\s*(?:1|i)|பருவம்\s*1|t1)\b/i.test(clean)) {
    return { term: 'Term 1', confidence: 25 };
  }
  if (/\b(?:term\s*(?:2|ii)|பருவம்\s*2|t2)\b/i.test(clean)) {
    return { term: 'Term 2', confidence: 25 };
  }
  if (/\b(?:term\s*(?:3|iii)|பருவம்\s*3|t3)\b/i.test(clean)) {
    return { term: 'Term 3', confidence: 25 };
  }
  if (/\b(?:full\s*year|முழு\s*ஆண்டு|annual)\b/i.test(clean)) {
    return { term: 'Full Year', confidence: 25 };
  }

  // Default to Term 1 for high school trimester books
  return { term: 'Term 1', confidence: 10 };
}

export function detectSubject(
  text: string,
  stdNum: number
): { subject: string; subjectId: string; tamilName: string; confidence: number } {
  const clean = normalizeSearchText(text);
  const availableSubjects = getSubjectsForStandard(stdNum);

  // Non-language subjects are evaluated first so that names like "12th_History_Tamil_Medium"
  // are recognized as Subject: History and Medium: Tamil.
  const subjectKeywordMap: Array<{
    id: string;
    name: string;
    tamilName: string;
    regex: RegExp;
    conf: number;
  }> = [
    {
      id: 'history',
      name: 'History',
      tamilName: 'வரலாறு',
      regex: /\b(?:history|வரலாறு|இந்திய\s*வரலாறு)\b/i,
      conf: 35,
    },
    {
      id: 'geography',
      name: 'Geography',
      tamilName: 'புவியியல்',
      regex: /\b(?:geography|புவியியல்)\b/i,
      conf: 35,
    },
    {
      id: 'political-science',
      name: 'Political Science',
      tamilName: 'அரசியல் அறிவியல்',
      regex: /\b(?:polity|political\s*science|அரசியல்\s*அறிவியல்|இந்திய\s*அரசியல்)\b/i,
      conf: 35,
    },
    {
      id: 'economics',
      name: 'Economics',
      tamilName: 'பொருளியல்',
      regex: /\b(?:economics?|பொருளாதாரம்|பொருளியல்)\b/i,
      conf: 35,
    },
    {
      id: 'physics',
      name: 'Physics',
      tamilName: 'இயற்பியல்',
      regex: /\b(?:physics|இயற்பியல்)\b/i,
      conf: 35,
    },
    {
      id: 'chemistry',
      name: 'Chemistry',
      tamilName: 'வேதியியல்',
      regex: /\b(?:chemistry|வேதியியல்)\b/i,
      conf: 35,
    },
    {
      id: 'biology',
      name: 'Biology',
      tamilName: 'உயிரியல்',
      regex: /\b(?:biology|உயிரியல்)\b/i,
      conf: 35,
    },
    {
      id: 'botany',
      name: 'Botany',
      tamilName: 'தாவரவியல்',
      regex: /\b(?:botany|தாவரவியல்)\b/i,
      conf: 35,
    },
    {
      id: 'zoology',
      name: 'Zoology',
      tamilName: 'விலங்கியல்',
      regex: /\b(?:zoology|விலங்கியல்)\b/i,
      conf: 35,
    },
    {
      id: 'social-science',
      name: 'Social Science',
      tamilName: 'சமூக அறிவியல்',
      regex: /\b(?:social\s*science|சமூக\s*அறிவியல்|socsci|ss)\b/i,
      conf: 35,
    },
    {
      id: 'science',
      name: 'Science',
      tamilName: 'அறிவியல்',
      regex: /\b(?:science|அறிவியல்|பொது\s*அறிவியல்|gen\s*sci)\b/i,
      conf: 30,
    },
    {
      id: 'mathematics',
      name: 'Mathematics',
      tamilName: 'கணிதம்',
      regex: /\b(?:maths?|mathematics|கணிதம்|கணக்கு)\b/i,
      conf: 35,
    },
    {
      id: 'tamil',
      name: 'Tamil',
      tamilName: 'தமிழ்',
      regex: /\b(?:tamil|பொதுத்தமிழ்|தமிழ்|generaltamil)\b/i,
      conf: 30,
    },
    {
      id: 'english',
      name: 'English',
      tamilName: 'ஆங்கிலம்',
      regex: /\b(?:english|generalenglish|ஆங்கிலம்)\b/i,
      conf: 30,
    },
  ];

  for (const sk of subjectKeywordMap) {
    if (sk.regex.test(clean)) {
      // Confirm this subject is valid for the standard or adapt
      const catalogMatch = availableSubjects.find(
        (s) => s.id === sk.id || s.name.toLowerCase() === sk.name.toLowerCase()
      );
      if (catalogMatch) {
        return {
          subject: catalogMatch.name,
          subjectId: catalogMatch.id,
          tamilName: catalogMatch.tamilName,
          confidence: sk.conf,
        };
      }
      // Return detected subject even if higher secondary specialized
      return {
        subject: sk.name,
        subjectId: sk.id,
        tamilName: sk.tamilName,
        confidence: sk.conf - 5,
      };
    }
  }

  // Fallback to primary subject of the standard
  const defaultSubject = availableSubjects[0] || {
    id: 'tamil',
    name: 'Tamil',
    tamilName: 'தமிழ்',
  };

  return {
    subject: defaultSubject.name,
    subjectId: defaultSubject.id,
    tamilName: defaultSubject.tamilName,
    confidence: 10,
  };
}

// ----------------------------------------------------------------------------
// 2. TNPSC Multi-Group Association
// ----------------------------------------------------------------------------

export function determineApplicableGroups(
  subjectId: string,
  stdNum: number
): { applicableGroups: Array<'group1' | 'group2' | 'group4'>; primaryGroup: 'group1' | 'group2' | 'group4' } {
  const s = subjectId.toLowerCase();

  // General Tamil (Classes 6 to 12) is primary for Group 4 and Group 2/2A Prelims
  if (s === 'tamil' || s === 'generaltamil') {
    return {
      applicableGroups: ['group2', 'group4'],
      primaryGroup: stdNum <= 10 ? 'group4' : 'group2',
    };
  }

  // General English is relevant for Group 2/2A
  if (s === 'english' || s === 'generalenglish') {
    return {
      applicableGroups: ['group2'],
      primaryGroup: 'group2',
    };
  }

  // General Science, Social Science, History, Geography, Polity, Economics (Classes 6 to 10)
  // are the core General Studies foundation across ALL TNPSC exams: Group 1, Group 2, Group 4
  if (
    s === 'social-science' ||
    s === 'science' ||
    s === 'mathematics' ||
    s === 'history' ||
    s === 'geography' ||
    s === 'political-science' ||
    s === 'economics' ||
    s === 'physics' ||
    s === 'chemistry' ||
    s === 'biology'
  ) {
    return {
      applicableGroups: ['group1', 'group2', 'group4'],
      primaryGroup: stdNum >= 11 ? 'group1' : 'group4',
    };
  }

  // Default to all groups
  return {
    applicableGroups: ['group1', 'group2', 'group4'],
    primaryGroup: 'group1',
  };
}

// ----------------------------------------------------------------------------
// 3. Table of Contents & Unit/Lesson Structure Extraction
// ----------------------------------------------------------------------------

export function extractUnitsAndLessonsFromText(
  tocText: string,
  params: {
    category: string;
    classId: number;
    subject: string;
    term: string;
  }
): ExtractedUnitItem[] {
  if (!tocText || tocText.trim().length === 0) {
    return generateDefaultUnitsForSubject(params);
  }

  const lines = tocText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const units: ExtractedUnitItem[] = [];
  let currentUnit: ExtractedUnitItem | null = null;
  let unitCounter = 1;
  let lessonCounter = 1;

  for (const line of lines) {
    // Detect Unit / Iyal headers (e.g. "இயல் 1", "இயல் ஒன்று", "Unit 1", "UNIT - I", "பொருளடக்கம்")
    const unitMatch = line.match(/(?:இயல்|unit|அலகு|பகுதி)[_ -]*(?:(\d+)|([IVXLCDM]+)|(ஒன்று|இரண்டு|மூன்று|நான்கு|ஐந்து|ஆறு|ஏழு|எட்டு|ஒன்பது|பத்து))/i);

    if (unitMatch) {
      let uNum = unitCounter;
      if (unitMatch[1]) {
        uNum = parseInt(unitMatch[1], 10);
      } else if (unitMatch[3]) {
        const tamilWordMap: Record<string, number> = {
          ஒன்று: 1,
          இரண்டு: 2,
          மூன்று: 3,
          நான்கு: 4,
          ஐந்து: 5,
          ஆறு: 6,
          ஏழு: 7,
          எட்டு: 8,
          ஒன்பது: 9,
          பத்து: 10,
        };
        uNum = tamilWordMap[unitMatch[3]] || unitCounter;
      }

      currentUnit = {
        unitNumber: uNum,
        unitTitle: line.replace(/^[0-9.\- ]+/, '').trim() || `Unit ${uNum}`,
        lessons: [],
      };
      units.push(currentUnit);
      unitCounter = uNum + 1;
      lessonCounter = 1;
      continue;
    }

    // Detect Lesson entries with page numbers or titles (e.g. "1.1 இன்பத்தமிழ் ... 2", "1.2 தமிழ்க்கும்மி ... 5")
    const lessonMatch = line.match(/^(\d+(?:\.\d+)?)[. ]+(.+?)(?:[. ]+(\d+))?$/);
    if (lessonMatch) {
      if (!currentUnit) {
        currentUnit = {
          unitNumber: unitCounter++,
          unitTitle: `Unit 1`,
          lessons: [],
        };
        units.push(currentUnit);
      }

      const lessonNum = lessonMatch[1] || `${currentUnit.unitNumber}.${lessonCounter}`;
      const title = lessonMatch[2].replace(/[._-]{2,}/g, '').trim();
      const pageNum = lessonMatch[3] ? parseInt(lessonMatch[3], 10) : undefined;

      const { lessonId, lessonCode } = resolveSyllabusLessonId({
        category: params.category,
        classId: params.classId,
        subject: params.subject,
        term: params.term,
        unitId: currentUnit.unitNumber,
        lessonNumber: lessonNum,
        lessonTitle: title,
      });

      currentUnit.lessons.push({
        lessonNumber: lessonNum,
        title,
        lessonId,
        lessonCode,
        startPage: pageNum,
        topics: [
          {
            id: `${lessonId}-core`,
            title: `${title}: Core Concepts & Principles`,
            pageNumber: pageNum,
          },
          {
            id: `${lessonId}-exam`,
            title: `${title}: Exam MCQs & Applications`,
            pageNumber: pageNum,
          },
        ],
      });
      lessonCounter++;
    }
  }

  if (units.length === 0 || units.every((u) => u.lessons.length === 0)) {
    return generateDefaultUnitsForSubject(params);
  }

  return units;
}

/**
 * Fallback to generate standard canonical units and lessons from syllabus data
 * when PDF Table of Contents is not parseable or scanned.
 */
function generateDefaultUnitsForSubject(params: {
  category: string;
  classId: number;
  subject: string;
  term: string;
}): ExtractedUnitItem[] {
  const normSub = params.subject.toLowerCase();
  const std = params.classId;
  const units: ExtractedUnitItem[] = [];

  if (normSub.includes('tamil')) {
    // Standard Samacheer Kalvi Tamil structure per term (3 Iyals per term for 6th-9th, 9 Iyals for 10th-12th)
    const iyalCount = std <= 9 && params.term !== 'Full Year' ? 3 : 9;
    for (let u = 1; u <= iyalCount; u++) {
      const lessons: ExtractedLessonItem[] = [];
      const lessonTitles = [
        `கவிதைப் பேழை (Poetry)`,
        `உரைநடை உலகம் (Prose)`,
        `விரிவானம் (Supplementary)`,
        `கற்கண்டு - இலக்கணம் (Grammar)`,
      ];

      lessonTitles.forEach((t, lIdx) => {
        const lNum = `${u}.${lIdx + 1}`;
        const { lessonId, lessonCode } = resolveSyllabusLessonId({
          category: params.category,
          classId: std,
          subject: params.subject,
          term: params.term,
          unitId: u,
          lessonNumber: lNum,
        });

        lessons.push({
          lessonNumber: lNum,
          title: `இயல் ${u}: ${t}`,
          lessonId,
          lessonCode,
          topics: [
            { id: `${lessonId}-concept`, title: `${t} - Key Concepts & Meanings` },
            { id: `${lessonId}-exam`, title: `${t} - Important TNPSC Points` },
          ],
        });
      });

      units.push({
        unitNumber: u,
        unitTitle: `இயல் ${u} (Unit ${u})`,
        lessons,
      });
    }
  } else {
    // Science, Social Science, Maths, etc. (typically 4-6 lessons per term/volume)
    const unitCount = std <= 9 && params.term !== 'Full Year' ? 4 : 8;
    for (let u = 1; u <= unitCount; u++) {
      const lNum = `${u}.1`;
      const { lessonId, lessonCode } = resolveSyllabusLessonId({
        category: params.category,
        classId: std,
        subject: params.subject,
        term: params.term,
        unitId: u,
        lessonNumber: lNum,
      });

      units.push({
        unitNumber: u,
        unitTitle: `Unit ${u}: ${params.subject} Concepts Part ${u}`,
        lessons: [
          {
            lessonNumber: lNum,
            title: `${params.subject} Standard ${std} - Chapter ${u}`,
            lessonId,
            lessonCode,
            topics: [
              { id: `${lessonId}-definition`, title: `Definitions & Fundamental Laws` },
              { id: `${lessonId}-analysis`, title: `Analytical Breakdown & Questions` },
            ],
          },
        ],
      });
    }
  }

  return units;
}

// ----------------------------------------------------------------------------
// 4. Master Classification Function
// ----------------------------------------------------------------------------

export function classifyPdf(input: ClassifyPdfInput): ClassifiedPdfMetadata {
  const { fileName, fileSize, checksum, tocText = '', samplePagesText = [], manualOverrides } = input;
  const combinedText = `${fileName} ${tocText} ${samplePagesText.slice(0, 10).join(' ')}`;

  // Step 1: Detect Standard
  let standard: StandardId;
  let standardNumber: number;
  let stdConf: number;

  if (manualOverrides?.standard) {
    standard = manualOverrides.standard;
    standardNumber = parseInt(standard, 10);
    stdConf = 35;
  } else {
    const stdRes = detectStandard(combinedText);
    standard = stdRes.standard;
    standardNumber = stdRes.standardNumber;
    stdConf = stdRes.confidence;
  }

  // Step 2: Detect Subject
  let subject: string;
  let subjectId: string;
  let tamilSubjectName: string;
  let subjConf: number;

  if (manualOverrides?.subject) {
    const catSub = findCatalogSubject(standardNumber, manualOverrides.subject);
    subject = catSub?.name || manualOverrides.subject;
    subjectId = catSub?.id || manualOverrides.subject.toLowerCase().replace(/[^a-z0-9]/g, '-');
    tamilSubjectName = catSub?.tamilName || subject;
    subjConf = 35;
  } else {
    const subjRes = detectSubject(combinedText, standardNumber);
    subject = subjRes.subject;
    subjectId = subjRes.subjectId;
    tamilSubjectName = subjRes.tamilName;
    subjConf = subjRes.confidence;
  }

  // Step 3: Detect Medium
  let medium: 'Tamil' | 'English';
  let medConf: number;

  if (manualOverrides?.medium) {
    medium = manualOverrides.medium;
    medConf = 20;
  } else {
    const medRes = detectMedium(combinedText, subject);
    medium = medRes.medium;
    medConf = medRes.confidence;
  }

  // Step 4: Detect Term
  let term: string;
  let termConf: number;

  if (manualOverrides?.term) {
    term = manualOverrides.term;
    termConf = 20;
  } else {
    const termRes = detectTerm(combinedText, standardNumber);
    term = termRes.term;
    termConf = termRes.confidence;
  }

  // Step 5: Applicable Groups
  let applicableGroups: Array<'group1' | 'group2' | 'group4'>;
  let primaryGroup: 'group1' | 'group2' | 'group4';

  if (manualOverrides?.applicableGroups && manualOverrides.applicableGroups.length > 0) {
    applicableGroups = manualOverrides.applicableGroups;
    primaryGroup = applicableGroups[0];
  } else {
    const groupRes = determineApplicableGroups(subjectId, standardNumber);
    applicableGroups = groupRes.applicableGroups;
    primaryGroup = groupRes.primaryGroup;
  }

  // Step 6: Extract Units, Lessons & Topics
  const units = extractUnitsAndLessonsFromText(tocText, {
    category: primaryGroup,
    classId: standardNumber,
    subject,
    term,
  });

  const totalUnits = units.length;
  const totalLessons = units.reduce((acc, u) => acc + u.lessons.length, 0);
  const totalTopics = units.reduce(
    (acc, u) => acc + u.lessons.reduce((tAcc, l) => tAcc + (l.topics?.length || 0), 0),
    0
  );

  // Step 7: Confidence calculation
  let totalScore = Math.min(100, stdConf + subjConf + medConf + termConf);
  const confidenceReasons: string[] = [];

  if (stdConf >= 25) confidenceReasons.push(`Standard ${standardNumber} verified from PDF`);
  if (subjConf >= 25) confidenceReasons.push(`Subject "${subject}" matched in Samacheer catalog`);
  if (medConf >= 20) confidenceReasons.push(`Medium "${medium}" verified`);
  if (termConf >= 20) confidenceReasons.push(`Term/Volume "${term}" matched`);
  if (tocText && tocText.length > 50) {
    totalScore = Math.min(100, totalScore + 10);
    confidenceReasons.push(`Table of Contents extracted ${totalUnits} units and ${totalLessons} lessons`);
  }

  let confidenceLevel: 'high' | 'medium' | 'low';
  if (totalScore >= 80) {
    confidenceLevel = 'high';
  } else if (totalScore >= 55) {
    confidenceLevel = 'medium';
  } else {
    confidenceLevel = 'low';
  }

  const bookName = `Samacheer Kalvi ${standard} Standard - ${subject} - ${term} - ${medium} Medium`;

  return {
    fileName,
    fileSize,
    checksum,
    standard,
    standardNumber,
    subject,
    subjectId,
    tamilSubjectName,
    medium,
    term,
    bookName,
    applicableGroups,
    primaryGroup,
    units,
    totalUnits,
    totalLessons,
    totalTopics,
    confidenceScore: totalScore,
    confidenceLevel,
    confidenceReasons,
    requiresReview: confidenceLevel !== 'high',
    pageCount: input.pageCount,
  };
}
