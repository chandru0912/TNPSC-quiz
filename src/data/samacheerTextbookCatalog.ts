/**
 * samacheerTextbookCatalog.ts
 *
 * Authoritative, centralized catalogue of Tamil Nadu State Board (Samacheer Kalvi)
 * textbooks for Classes 6 through 12.
 * 
 * Used for:
 * 1. Dynamic cascading dropdowns in Admin Textbook Management Upload modal.
 * 2. Automatic Samacheer Kalvi textbook naming formula.
 * 3. Exact standard-wise subject availability (High School 6–10 vs Higher Secondary 11–12).
 * 4. Dynamic term/volume structure (Trimester Terms 1–3 for 6–9, Full Year for 10, Volumes 1–2 for 11–12).
 */

export type TnpscGroupId = 'group1' | 'group2' | 'group4';
export type TextbookMedium = 'Tamil' | 'English';
export type StandardId = '6th' | '7th' | '8th' | '9th' | '10th' | '11th' | '12th';

export interface CatalogSubject {
  id: string;
  name: string;
  tamilName: string;
  allowedMediums: TextbookMedium[];
  allowedTerms: string[];
  defaultTerm: string;
  defaultMedium: TextbookMedium;
}

export interface StandardCatalogEntry {
  standard: StandardId;
  standardNumber: number;
  label: string;
  tamilLabel: string;
  subjects: CatalogSubject[];
}

export const TNPSC_GROUPS_LIST: { id: TnpscGroupId; label: string; badge: string }[] = [
  { id: 'group1', label: 'TNPSC Group 1 (Combined Civil Services I)', badge: 'Group 1' },
  { id: 'group2', label: 'TNPSC Group 2 / 2A (Combined Civil Services II)', badge: 'Group 2/2A' },
  { id: 'group4', label: 'TNPSC Group 4 & VAO', badge: 'Group 4' },
];

export const STANDARDS_LIST: { id: StandardId; number: number; label: string; shortLabel: string }[] = [
  { id: '6th', number: 6, label: '6th Standard (Class 6)', shortLabel: '6th' },
  { id: '7th', number: 7, label: '7th Standard (Class 7)', shortLabel: '7th' },
  { id: '8th', number: 8, label: '8th Standard (Class 8)', shortLabel: '8th' },
  { id: '9th', number: 9, label: '9th Standard (Class 9)', shortLabel: '9th' },
  { id: '10th', number: 10, label: '10th Standard (Class 10 - SSLC)', shortLabel: '10th' },
  { id: '11th', number: 11, label: '11th Standard (Class 11 - Higher Secondary +1)', shortLabel: '11th' },
  { id: '12th', number: 12, label: '12th Standard (Class 12 - Higher Secondary +2)', shortLabel: '12th' },
];

// High School Subjects (Classes 6 to 9) - Trimester structure
const HIGH_SCHOOL_SUBJECTS_TRIMESTER: CatalogSubject[] = [
  {
    id: 'tamil',
    name: 'Tamil',
    tamilName: 'தமிழ்',
    allowedMediums: ['Tamil'],
    allowedTerms: ['Term 1', 'Term 2', 'Term 3', 'Full Year'],
    defaultTerm: 'Term 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'english',
    name: 'English',
    tamilName: 'ஆங்கிலம்',
    allowedMediums: ['English'],
    allowedTerms: ['Term 1', 'Term 2', 'Term 3', 'Full Year'],
    defaultTerm: 'Term 1',
    defaultMedium: 'English',
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    tamilName: 'கணிதம்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Term 1', 'Term 2', 'Term 3', 'Full Year'],
    defaultTerm: 'Term 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'science',
    name: 'Science',
    tamilName: 'அறிவியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Term 1', 'Term 2', 'Term 3', 'Full Year'],
    defaultTerm: 'Term 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'social-science',
    name: 'Social Science',
    tamilName: 'சமூக அறிவியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Term 1', 'Term 2', 'Term 3', 'Full Year'],
    defaultTerm: 'Term 1',
    defaultMedium: 'Tamil',
  },
];

// Class 10 Subjects (Strictly Full Year)
const CLASS_10_SUBJECTS: CatalogSubject[] = [
  {
    id: 'tamil',
    name: 'Tamil',
    tamilName: 'தமிழ்',
    allowedMediums: ['Tamil'],
    allowedTerms: ['Full Year'],
    defaultTerm: 'Full Year',
    defaultMedium: 'Tamil',
  },
  {
    id: 'english',
    name: 'English',
    tamilName: 'ஆங்கிலம்',
    allowedMediums: ['English'],
    allowedTerms: ['Full Year'],
    defaultTerm: 'Full Year',
    defaultMedium: 'English',
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    tamilName: 'கணிதம்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Full Year'],
    defaultTerm: 'Full Year',
    defaultMedium: 'Tamil',
  },
  {
    id: 'science',
    name: 'Science',
    tamilName: 'அறிவியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Full Year'],
    defaultTerm: 'Full Year',
    defaultMedium: 'Tamil',
  },
  {
    id: 'social-science',
    name: 'Social Science',
    tamilName: 'சமூக அறிவியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Full Year'],
    defaultTerm: 'Full Year',
    defaultMedium: 'Tamil',
  },
];

// Higher Secondary Subjects (Classes 11 and 12) - Volumes 1 & 2 where applicable
const HIGHER_SECONDARY_SUBJECTS: CatalogSubject[] = [
  {
    id: 'tamil',
    name: 'Tamil',
    tamilName: 'பொதுத் தமிழ்',
    allowedMediums: ['Tamil'],
    allowedTerms: ['Full Year'],
    defaultTerm: 'Full Year',
    defaultMedium: 'Tamil',
  },
  {
    id: 'english',
    name: 'English',
    tamilName: 'ஆங்கிலம்',
    allowedMediums: ['English'],
    allowedTerms: ['Full Year'],
    defaultTerm: 'Full Year',
    defaultMedium: 'English',
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    tamilName: 'கணிதம்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'physics',
    name: 'Physics',
    tamilName: 'இயற்பியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    tamilName: 'வேதியியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'biology',
    name: 'Biology',
    tamilName: 'உயிரியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'botany',
    name: 'Botany',
    tamilName: 'தாவரவியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'zoology',
    name: 'Zoology',
    tamilName: 'விலங்கியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'computer-science',
    name: 'Computer Science',
    tamilName: 'கணினி அறிவியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'computer-applications',
    name: 'Computer Applications',
    tamilName: 'கணினி பயன்பாடுகள்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'commerce',
    name: 'Commerce',
    tamilName: 'வணிகவியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'accountancy',
    name: 'Accountancy',
    tamilName: 'கணக்குப்பதிவியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'economics',
    name: 'Economics',
    tamilName: 'பொருளியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'history',
    name: 'History',
    tamilName: 'வரலாறு',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'geography',
    name: 'Geography',
    tamilName: 'புவியியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'political-science',
    name: 'Political Science',
    tamilName: 'அரசியல் அறிவியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
  {
    id: 'ethics-indian-culture',
    name: 'Ethics and Indian Culture',
    tamilName: 'அறவியலும் இந்தியப் பண்பாடும்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Full Year'],
    defaultTerm: 'Full Year',
    defaultMedium: 'Tamil',
  },
  {
    id: 'business-mathematics',
    name: 'Business Mathematics and Statistics',
    tamilName: 'வணிகக் கணிதம் மற்றும் புள்ளியியல்',
    allowedMediums: ['Tamil', 'English'],
    allowedTerms: ['Volume 1', 'Volume 2', 'Full Year'],
    defaultTerm: 'Volume 1',
    defaultMedium: 'Tamil',
  },
];

export const SAMACHEER_CATALOG: Record<StandardId, StandardCatalogEntry> = {
  '6th': {
    standard: '6th',
    standardNumber: 6,
    label: '6th Standard',
    tamilLabel: '6-ஆம் வகுப்பு',
    subjects: HIGH_SCHOOL_SUBJECTS_TRIMESTER,
  },
  '7th': {
    standard: '7th',
    standardNumber: 7,
    label: '7th Standard',
    tamilLabel: '7-ஆம் வகுப்பு',
    subjects: HIGH_SCHOOL_SUBJECTS_TRIMESTER,
  },
  '8th': {
    standard: '8th',
    standardNumber: 8,
    label: '8th Standard',
    tamilLabel: '8-ஆம் வகுப்பு',
    subjects: HIGH_SCHOOL_SUBJECTS_TRIMESTER,
  },
  '9th': {
    standard: '9th',
    standardNumber: 9,
    label: '9th Standard',
    tamilLabel: '9-ஆம் வகுப்பு',
    subjects: HIGH_SCHOOL_SUBJECTS_TRIMESTER,
  },
  '10th': {
    standard: '10th',
    standardNumber: 10,
    label: '10th Standard',
    tamilLabel: '10-ஆம் வகுப்பு',
    subjects: CLASS_10_SUBJECTS,
  },
  '11th': {
    standard: '11th',
    standardNumber: 11,
    label: '11th Standard',
    tamilLabel: '11-ஆம் வகுப்பு',
    subjects: HIGHER_SECONDARY_SUBJECTS,
  },
  '12th': {
    standard: '12th',
    standardNumber: 12,
    label: '12th Standard',
    tamilLabel: '12-ஆம் வகுப்பு',
    subjects: HIGHER_SECONDARY_SUBJECTS,
  },
};

/**
 * Normalizes standard string (e.g. "6", 6, "6th", "Class 6") into StandardId ("6th")
 */
export function normalizeStandardId(std: any): StandardId {
  const match = String(std || '').match(/(\d{1,2})/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 6 && num <= 12) {
      return `${num}th` as StandardId;
    }
  }
  return '6th';
}

/**
 * Returns subjects for the specified standard.
 */
export function getSubjectsForStandard(std: string | number): CatalogSubject[] {
  const stdId = normalizeStandardId(std);
  return SAMACHEER_CATALOG[stdId]?.subjects || HIGH_SCHOOL_SUBJECTS_TRIMESTER;
}

/**
 * Returns a specific subject entry for a given standard and subject name or id.
 */
export function findCatalogSubject(std: string | number, subjectNameOrId: string): CatalogSubject | undefined {
  const subjects = getSubjectsForStandard(std);
  const clean = String(subjectNameOrId || '').trim().toLowerCase();
  return subjects.find(
    (s) => s.id.toLowerCase() === clean || s.name.toLowerCase() === clean || s.tamilName.toLowerCase() === clean
  );
}

/**
 * Returns allowed mediums for a given standard and subject.
 */
export function getAllowedMediums(std: string | number, subjectNameOrId: string): TextbookMedium[] {
  const sub = findCatalogSubject(std, subjectNameOrId);
  return sub?.allowedMediums || ['Tamil', 'English'];
}

/**
 * Returns allowed terms for a given standard and subject.
 */
export function getAllowedTerms(std: string | number, subjectNameOrId: string): string[] {
  const sub = findCatalogSubject(std, subjectNameOrId);
  if (sub?.allowedTerms) return sub.allowedTerms;

  const stdId = normalizeStandardId(std);
  if (stdId === '10th') return ['Full Year'];
  if (stdId === '11th' || stdId === '12th') return ['Volume 1', 'Volume 2', 'Full Year'];
  return ['Term 1', 'Term 2', 'Term 3', 'Full Year'];
}

/**
 * Generates the authoritative Samacheer Kalvi textbook name.
 * 
 * Formula:
 * Samacheer Kalvi {Standard} Standard - {Subject} - {Term} - {Medium} Medium
 * 
 * Example:
 * Samacheer Kalvi 6th Standard - Tamil - Term 1 - Tamil Medium
 */
export function generateSamacheerBookName(spec: {
  standard: string | number;
  subject: string;
  medium: string;
  term: string;
}): string {
  const stdId = normalizeStandardId(spec.standard);
  const subj = String(spec.subject || 'Tamil').trim();
  const trm = String(spec.term || 'Term 1').trim();
  const med = String(spec.medium || 'Tamil').trim().toLowerCase() === 'tamil' ? 'Tamil Medium' : 'English Medium';

  return `Samacheer Kalvi ${stdId} Standard - ${subj} - ${trm} - ${med}`;
}
