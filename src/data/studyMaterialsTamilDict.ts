/**
 * Instant Educational Tamil Dictionary & Pattern Translator for TNPSC Study Materials.
 * Provides 0ms translation for static Study Materials headings, TNPSC Groups, Subjects,
 * Standards, Units, Chapters, Lessons, and UI controls without hitting any AI API.
 */

export const STUDY_MATERIALS_TA_DICT: Record<string, string> = {
  // Main Headings & Subtitles
  'Study Materials & Syllabus': 'பாடக்குறிப்புகள் & பாடத்திட்டம்',
  'Study Materials &': 'பாடக்குறிப்புகள் &',
  'Study Materials': 'பாடக்குறிப்புகள்',
  'Syllabus': 'பாடத்திட்டம்',
  'Comprehensive syllabus-mapped learning modules, study notes, and lesson-wise practice quizzes':
    'பாடத்திட்டத்தின் அடிப்படையில் வடிவமைக்கப்பட்ட கற்றல் தொகுதிகள், பாடக்குறிப்புகள் மற்றும் பாடவாரியான பயிற்சி வினாக்கள்',
  'Home': 'முகப்பு',
  'Back to All Categories': 'அனைத்து பிரிவுகளுக்கும் திரும்பு',
  'Back to Study Materials': 'பாடக்குறிப்புகளுக்கு திரும்பு',
  'Back to Lessons': 'பாடங்களுக்கு திரும்பு',
  'Back to Units': 'அலகுகளுக்கு திரும்பு',
  'Back': 'திரும்பு',

  // TNPSC Groups
  'TNPSC Group 1': 'TNPSC குரூப் 1',
  'TNPSC Group 2 & 2A': 'TNPSC குரூப் 2 & 2A',
  'TNPSC Group 2, 2A': 'TNPSC குரூப் 2, 2A',
  'TNPSC Group 4': 'TNPSC குரூப் 4',
  'TNPSC Group 4 & VAO': 'TNPSC குரூப் 4 & VAO',
  'TNPSC Group 1 Preliminary Examination': 'TNPSC குரூப் 1 முதல்நிலைத் தேர்வு',
  'TNPSC Group 1 General Studies': 'TNPSC குரூப் 1 பொது அறிவு',
  'TNPSC Group 1 Aptitude & Mental Ability': 'TNPSC குரூப் 1 திறனறிவும் மனக்கணக்கு நுண்ணறிவும்',
  'TNPSC Group 2 & 2A Preliminary Examination': 'TNPSC குரூப் 2 & 2A முதல்நிலைத் தேர்வு',
  'TNPSC Group 4 Preliminary Examination': 'TNPSC குரூப் 4 தேர்வு',

  // Subjects
  'General Studies': 'பொது அறிவு',
  'Part A: General Studies': 'பகுதி A: பொது அறிவு',
  'Part A • Degree Standard': 'பகுதி A • பட்டப்படிப்பு தரம்',
  'Part B • SSLC Standard': 'பகுதி B • பத்தாம் வகுப்பு தரம்',
  'Aptitude & Mental Ability': 'திறனறிவும் மனக்கணக்கு நுண்ணறிவும்',
  'Aptitude and Mental Ability': 'திறனறிவும் மனக்கணக்கு நுண்ணறிவும்',
  'General Tamil': 'பொதுத் தமிழ்',
  'General English': 'பொது ஆங்கிலம்',
  'Degree Standard': 'பட்டப்படிப்பு தரம்',
  'SSLC Standard': 'பத்தாம் வகுப்பு தரம்',
  'Mathematics / Aptitude (Samacheer Kalvi)': 'கணிதம் / திறனறிவு (சமச்சீர் கல்வி)',

  // Subject Descriptions
  'Comprehensive degree standard syllabus covering General Science, Indian Geography, History & Culture of India, Indian Polity, Indian Economy & TN Administration, and Tamil Society Heritage.':
    'பொது அறிவியல், இந்தியப் புவியியல், இந்திய வரலாறு மற்றும் பண்பாடு, இந்திய ஆட்சியியல், இந்தியப் பொருளாதாரம் மற்றும் தமிழ்நாடு நிர்வாகம், தமிழ் சமுதாய மரபு ஆகியவற்றை உள்ளடக்கிய விரிவான பட்டப்படிப்புத் தரப் பாடத்திட்டம்.',
  'Authoritative syllabus structure from the official TNPSC notification. Explore all 6 distinct curated Units, master core chapters, and track lesson-wise progress.':
    'அதிகாரப்பூர்வ TNPSC அறிவிக்கையின் அடிப்படையில் உருவாக்கப்பட்ட பாடத்திட்ட அமைப்பு. அனைத்து 6 அலகுகளையும் ஆராய்ந்து, முக்கிய அத்தியாயங்களைக் கற்று, பாடவாரியான முன்னேற்றத்தைக் கண்காணிக்கவும்.',

  // Stats, Labels & Actions
  'Distinct Syllabus Units': 'தனித்த பாடத்திட்ட அலகுகள்',
  'Units': 'அலகுகள்',
  'Units:': 'அலகுகள்:',
  'Chapters': 'அத்தியாயங்கள்',
  'Chapters:': 'அத்தியாயங்கள்:',
  'Lessons': 'பாடங்கள்',
  'Lessons:': 'பாடங்கள்:',
  'Questions': 'கேள்விகள்',
  'Question Bank': 'வினா வங்கி',
  'Topics': 'தலைப்புகள்',
  'Subtopics:': 'துணைத் தலைப்புகள்:',
  'Explore Syllabus & Units': 'பாடத்திட்டம் & அலகுகளைப் பார்க்க',
  'Explore Units': 'அலகுகளைப் பார்க்க',
  'View Lessons': 'பாடங்களைப் பார்க்க',
  'Open Study Notes': 'பாடக்குறிப்புகளைத் திற',
  'Study Notes': 'பாடக்குறிப்புகள்',
  'Comprehensive Study Notes': 'முழுமையான பாடக் குறிப்புகள்',
  'Short Notes': 'சுருக்கக் குறிப்புகள்',
  'Full Notes': 'முழுப் பாடக் குறிப்புகள்',
  '⚡ Short Notes': '⚡ சுருக்கக் குறிப்புகள்',
  '📖 Full Notes': '📖 முழுப் பாடக் குறிப்புகள்',
  'Official PDF': 'அதிகாரப்பூர்வ PDF',
  'Print': 'அச்சிடு',
  'Top': 'மேலே',
  'Retry': 'மீண்டும் முயற்சி',
  'Practice Lesson MCQs': 'பாட MCQ பயிற்சி',
  'Lesson Practice Questions': 'பாடப் பயிற்சி வினாக்கள்',
  'Loading Study Notes...': 'பாடக்குறிப்புகள் ஏற்றப்படுகின்றன...',
  'Retrieving official Samacheer Kalvi complete syllabus study notes.':
    'அதிகாரப்பூர்வ சமச்சீர் கல்வி முழுப் பாடத்திட்டக் குறிப்புகள் பெறப்படுகின்றன.',
  'No Study Notes Available': 'பாடக்குறிப்புகள் இல்லை',
  'Failed to Load Study Notes': 'பாடக்குறிப்புகளை ஏற்ற முடியவில்லை',
  'Available': 'கிடைக்கும்',
  'Start Learning': 'கற்கத் தொடங்கு',
  'Read Notes': 'குறிப்புகளைப் படி',
  'Practice MCQs': 'MCQ பயிற்சி',

  // Standards
  '6th Standard': '6-ஆம் வகுப்பு',
  '7th Standard': '7-ஆம் வகுப்பு',
  '8th Standard': '8-ஆம் வகுப்பு',
  '9th Standard': '9-ஆம் வகுப்பு',
  '10th Standard': '10-ஆம் வகுப்பு',
  '11th Standard': '11-ஆம் வகுப்பு',
  '12th Standard': '12-ஆம் வகுப்பு',
  'Samacheer Kalvi': 'சமச்சீர் கல்வி',
  'Samacheer Kalvi Textbooks': 'சமச்சீர் கல்வி பாடப்புத்தகங்கள்',
  'School Materials': 'பள்ளிப் பாடப்புத்தகங்கள்',
  'All': 'அனைத்தும்',
  'Term 1': 'பருவம் 1',
  'Term 2': 'பருவம் 2',
  'Term 3': 'பருவம் 3',
  'Full Year': 'முழு ஆண்டு',
};

/**
 * Translates common dynamic Study Materials label patterns instantly (0ms)
 * without requiring an AI API call.
 */
export function translateCommonStudyPattern(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  // Exact dictionary hit
  if (STUDY_MATERIALS_TA_DICT[trimmed]) {
    return STUDY_MATERIALS_TA_DICT[trimmed];
  }

  // "Unit 1" / "UNIT I" / "Unit 1:"
  const unitNumMatch = trimmed.match(/^Unit\s+(\d+|[IVX]+)(:?)$/i);
  if (unitNumMatch) {
    return `அலகு ${unitNumMatch[1]}${unitNumMatch[2]}`;
  }

  // "Chapter 1"
  const chapterMatch = trimmed.match(/^Chapter\s+(\d+)(:?)$/i);
  if (chapterMatch) {
    return `அத்தியாயம் ${chapterMatch[1]}${chapterMatch[2]}`;
  }

  // "Lesson 1.1"
  const lessonMatch = trimmed.match(/^Lesson\s+([\d.]+)(:?)$/i);
  if (lessonMatch) {
    return `பாடம் ${lessonMatch[1]}${lessonMatch[2]}`;
  }

  // "Topic 3"
  const topicMatch = trimmed.match(/^Topic\s+(\d+)(:?)$/i);
  if (topicMatch) {
    return `தலைப்பு ${topicMatch[1]}${topicMatch[2]}`;
  }

  // "Class 6th Standard Textbook Lessons"
  const stdLessonsMatch = trimmed.match(/^Class\s+(\d+)(?:st|nd|rd|th)?\s+Standard\s+Textbook\s+Lessons$/i);
  if (stdLessonsMatch) {
    return `${stdLessonsMatch[1]}-ஆம் வகுப்பு பாடப்புத்தகப் பாடங்கள்`;
  }

  // "6th Standard" / "Class 6"
  const stdMatch = trimmed.match(/^(?:Class\s+)?(\d+)(?:st|nd|rd|th)?\s+Standard$/i);
  if (stdMatch) {
    return `${stdMatch[1]}-ஆம் வகுப்பு`;
  }

  // "175 Questions" / "20 MCQs"
  const qCountMatch = trimmed.match(/^(\d+)\s+Questions$/i);
  if (qCountMatch) {
    return `${qCountMatch[1]} கேள்விகள்`;
  }

  // "12 Rows"
  const rowsMatch = trimmed.match(/^(\d+)\s+Rows$/i);
  if (rowsMatch) {
    return `${rowsMatch[1]} வரிசைகள்`;
  }

  // "Syllabus Code: 497"
  const codeMatch = trimmed.match(/^Syllabus\s+Code:\s*(.+)$/i);
  if (codeMatch) {
    return `பாடத்திட்டக் குறியீடு: ${codeMatch[1]}`;
  }

  return null;
}
