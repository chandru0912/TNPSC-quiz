/**
 * canonicalSubjectData.ts
 *
 * Authoritative Canonical Subject & Unit Definitions for TNPSC Study Hub.
 * Enforces:
 * 1. General Studies - Exactly 6 Parent Units.
 * 2. Aptitude and Mental Ability - Dynamic syllabus units (2 units).
 * 3. General English - Dynamic syllabus units (4 units).
 * 4. General Tamil - Dynamic syllabus units (6 units).
 */

import type { CanonicalUnitDraft } from './types';

export interface CanonicalSubjectDef {
  id: string; // 'general-studies' | 'aptitude' | 'general-english' | 'general-tamil'
  name: string;
  code: string;
  description: string;
  color: string;
  badgeBg: string;
  guaranteedUnitsCount?: number;
}

export const CANONICAL_SUBJECTS: CanonicalSubjectDef[] = [
  {
    id: 'general-studies',
    name: 'General Studies',
    code: 'GS',
    description: 'Core TNPSC General Studies: Units 1 to 6 (Science, Geography, History, Polity, Economy, National Movement & Heritage)',
    color: '#818cf8',
    badgeBg: 'rgba(99, 102, 241, 0.2)',
    guaranteedUnitsCount: 6,
  },
  {
    id: 'aptitude',
    name: 'Aptitude and Mental Ability',
    code: 'MATH',
    description: 'Mathematical Aptitude, Numerical Ability, and Logical Reasoning Syllabus',
    color: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.2)',
    guaranteedUnitsCount: 2,
  },
  {
    id: 'general-english',
    name: 'General English',
    code: 'ENG',
    description: 'Official TNPSC General English: Units 1 to 6 (Grammar, Vocabulary, Writing Skills, Technical Terms, Reading Comprehension, Translation & Literary Works)',
    color: '#34d399',
    badgeBg: 'rgba(52, 211, 153, 0.2)',
    guaranteedUnitsCount: 6,
  },
  {
    id: 'general-tamil',
    name: 'General Tamil',
    code: 'TAM',
    description: 'பொதுத் தமிழ்: அலகுகள் 1 முதல் 7 (இலக்கணம், சொல்லகராதி, எழுதும் திறன், கலைச் சொற்கள், வாசித்தல், மொழிபெயர்ப்பு, இலக்கியம் & அறிஞர்கள்)',
    color: '#fbbf24',
    badgeBg: 'rgba(251, 191, 36, 0.2)',
    guaranteedUnitsCount: 7,
  },
];

export const CANONICAL_GS_SIX_UNITS: Array<{
  unit_number: number;
  unit_code: string;
  title: string;
  description: string;
  syllabus_topics: string[];
}> = [
  {
    unit_number: 1,
    unit_code: 'Unit I',
    title: 'General Science',
    description: 'Physics, Chemistry, and Life Sciences from Standards 6 to 12',
    syllabus_topics: [
      'Scientific Knowledge and Scientific Temper',
      'Nature of Universe',
      'Measurement of Physical Quantities',
      'Mechanics and Properties of Matter',
      'Force, Motion and Energy',
      'Electricity and Magnetism',
      'Heat, Light and Sound',
      'Elements and Compounds',
      'Acids, Bases and Salts',
      'Main Concepts of Life Science',
      'Nutrition and Health',
      'Blood Circulation and Systems',
      'Genetics and Evolution',
      'Ecology and Environment',
    ],
  },
  {
    unit_number: 2,
    unit_code: 'Unit II',
    title: 'Geography of India',
    description: 'Physical Features, Monsoon, Water Resources, Agriculture & Climate',
    syllabus_topics: [
      'Location and Physical Features',
      'Monsoon, Rainfall, Weather and Climate',
      'Water Resources and Rivers in India',
      'Soil, Minerals and Natural Resources',
      'Forest and Wildlife',
      'Agricultural Pattern',
      'Transport and Communication',
      'Population Density and Distribution',
      'Disaster Management and Climate Change',
    ],
  },
  {
    unit_number: 3,
    unit_code: 'Unit III',
    title: 'History and Culture of India',
    description: 'Indus Valley, Guptas, Mughals, South Indian History & Culture',
    syllabus_topics: [
      'Indus Valley Civilization',
      'Guptas, Delhi Sultans, Mughals and Marathas',
      'Age of Vijayanagaram and Bahmani Kingdoms',
      'South Indian History',
      'Socio-Cultural History of India',
      'Unity in Diversity and Secular State',
    ],
  },
  {
    unit_number: 4,
    unit_code: 'Unit IV',
    title: 'Indian Polity',
    description: 'Constitution, Preamble, Fundamental Rights, Parliament & Judiciary',
    syllabus_topics: [
      'Constitution of India - Preamble',
      'Salient Features of the Constitution',
      'Citizenship, Fundamental Rights and Duties',
      'Directive Principles of State Policy',
      'Union Executive and Parliament',
      'State Executive and Legislature',
      'Local Governments and Panchayat Raj',
      'Judiciary and Rule of Law',
      'Anti-Corruption, Lokpal, RTI and Women Empowerment',
    ],
  },
  {
    unit_number: 5,
    unit_code: 'Unit V',
    title: 'Indian Economy',
    description: 'Economic Structure, Five Year Plans, RBI, GST & Rural Welfare',
    syllabus_topics: [
      'Nature of Indian Economy',
      'Five Year Plan Models and NITI Aayog',
      'Reserve Bank of India and Monetary Policy',
      'Finance Commission and GST',
      'Agriculture, Green Revolution and Food Security',
      'Industrial Development and Employment',
      'Poverty and Rural Development Schemes',
    ],
  },
  {
    unit_number: 6,
    unit_code: 'Unit VI',
    title: 'Indian National Movement & Tamil Heritage',
    description: 'Freedom Struggle, Leaders, Tamil Society, Thirukkural & Justice Party',
    syllabus_topics: [
      'National Renaissance and 1857 Revolt',
      'Indian National Congress and Leaders',
      'Different Modes of Agitation and Satyagraha',
      'Role of Tamil Nadu in Freedom Struggle',
      'History of Tamil Society and Archaeology',
      'Tamil Literature and Thirukkural Ethics',
      'Justice Party and Self-Respect Movement',
    ],
  },
];

export const CANONICAL_OTHER_SUBJECT_UNITS: Record<string, Array<{
  unit_number: number;
  unit_code: string;
  title: string;
  description: string;
  syllabus_topics: string[];
}>> = {
  aptitude: [
    {
      unit_number: 1,
      unit_code: 'Unit I',
      title: 'Numerical Ability & Simplification',
      description: 'Simplification, Percentage, HCF & LCM, Ratio and Proportion, Interest, Time & Work',
      syllabus_topics: [
        'Simplification and Order of Operations',
        'Percentage and Profit & Loss',
        'Highest Common Factor (HCF) & Lowest Common Multiple (LCM)',
        'Ratio and Proportion',
        'Simple and Compound Interest',
        'Time and Work, Pipes and Cisterns',
      ],
    },
    {
      unit_number: 2,
      unit_code: 'Unit II',
      title: 'Logical Reasoning & Mental Ability',
      description: 'Area, Perimeter, Volume, Analytical Puzzles, Dice, Visual & Number Series',
      syllabus_topics: [
        'Area, Perimeter and Volume',
        'Logical Reasoning and Analytical Puzzles',
        'Dice, Visual Reasoning and Alpha-numeric Series',
        'Number Series and Pattern Recognition',
        'Data Interpretation and Graphical Representation',
      ],
    },
  ],
  'general-english': [
    {
      unit_number: 1,
      unit_code: 'Unit I',
      title: 'Grammar',
      description: 'Parts of Speech, Concord, Tenses, Voices, Sentence Patterns, Question Tags, Sentence Structure',
      syllabus_topics: [
        'Parts of Speech (Nouns, Pronouns, Adjectives, Verbs, Adverbs)',
        'Subject-Verb Agreement (Concord)',
        'Tenses and Aspects',
        'Active and Passive Voice',
        'Sentence Patterns (SVO, SVIODO, SVOC)',
        'Question Tags and Degrees of Comparison',
        'Simple, Compound, and Complex Sentences',
        'Direct and Indirect Speech',
      ],
    },
    {
      unit_number: 2,
      unit_code: 'Unit II',
      title: 'Vocabulary',
      description: 'Synonyms, Antonyms, Homophones, Idioms, Phrasal Verbs, Affixes, Compound Words',
      syllabus_topics: [
        'Synonyms and Antonyms',
        'Homophones and Homonyms',
        'Idioms and Phrasal Verbs',
        'Prefix, Suffix, and Affixes',
        'Compound Words and Blended Words',
        'British English vs American English',
      ],
    },
    {
      unit_number: 3,
      unit_code: 'Unit III',
      title: 'Writing Skills',
      description: 'Formal & Informal Letters, Jumbled Sentences, Coherence, Note-Making, Summary Writing',
      syllabus_topics: [
        'Formal and Informal Letter Writing',
        'Jumbled Sentences and Paragraph Coherence',
        'Sentence Sequence Order and Connectors',
        'Drafting Enquiries, Complaints, and Official Petitions',
        'Note-Making and Summary Writing (Précis Writing)',
      ],
    },
    {
      unit_number: 4,
      unit_code: 'Unit IV',
      title: 'Technical Terms',
      description: 'Administrative, Secretariat, Legal, Commercial, E-Governance Terms & Acronyms',
      syllabus_topics: [
        'Administrative and Departmental Terminology',
        'Official Secretariat Glossary',
        'Judicial, Legal, and Public Administration Vocabulary',
        'Financial and Commercial Terminology',
        'E-Governance and Technical Acronyms',
      ],
    },
    {
      unit_number: 5,
      unit_code: 'Unit V',
      title: 'Reading Comprehension',
      description: 'Factual, Expository & Editorial Passages, Themes, Inferences, Fact Ascertainment',
      syllabus_topics: [
        'Factual and Expository Passages Comprehension',
        'Editorial and Discursive Passages Analysis',
        'Author Tone and Central Theme Identification',
        'Inference Drawing and Contextual Deductions',
        'Fact Ascertainment and Critical Reasoning',
      ],
    },
    {
      unit_number: 6,
      unit_code: 'Unit VI',
      title: 'Translation & Literary Works',
      description: 'Bilingual Translation, Prescribed Samacheer Poems, Prose Works, Figures of Speech',
      syllabus_topics: [
        'Bilingual Translation (English to Tamil & Tamil to English)',
        'Grammatical Shift Patterns in Translation',
        'Prescribed Poems from Samacheer Kalvi School Textbooks',
        'Prescribed Prose Works and Famous Author Studies',
        'Figures of Speech (Metaphor, Simile, Personification, Oxymoron)',
        'Literary Appreciation and Moral Themes',
      ],
    },
  ],
  'general-tamil': [
    {
      unit_number: 1,
      unit_code: 'Unit I',
      title: 'இலக்கணம்',
      description: 'எழுத்து இலக்கணம், சந்திப்பிழை, குறில் நெடில், மயங்கொலிகள், வேர்ச்சொல், வினைமுற்று, வினையெச்சம், பெயரெச்சம், அயற்சொல் - தமிழ்ச்சொல்',
      syllabus_topics: [
        'எழுத்து: பிரித்து எழுதுதல் – சேர்த்து எழுதுதல் – சந்திப்பிழை',
        'குறில், நெடில் வேறுபாடு – லகர, ளகர, ழகர வேறுபாடு – னகர, ணகர வேறுபாடு – ரகர, றகர வேறுபாடு',
        'இனவெழுத்துகள் அறிதல் – சுட்டு எழுத்துகள் – வினா எழுத்துகள் – ஒருமைப் பன்மை அறிதல்',
        'சொல்: வேர்ச்சொல் அறிதல் – வேர்ச்சொல்லில் இருந்து வினைமுற்று, வினையெச்சம், வினையாலணையும் பெயர், பெயரெச்சம் வகை அறிதல்',
        'அயற்சொல் – தமிழ்ச்சொல், எதிர்ச்சொல் – வினைச்சொல் – எழுத்துப் பிழை, ஒற்றுப்பிழை அறிதல்',
        'இரண்டு வினைச் சொற்களின் வேறுபாடு அறிதல்',
        'பெயர்ச்சொல், வினைச்சொல், தொகைநிலை மற்றும் தொகாநிலைத் தொடர்கள்',
        'அணி இலக்கணம் மற்றும் யாப்பிலக்கணம்',
      ],
    },
    {
      unit_number: 2,
      unit_code: 'Unit II',
      title: 'சொல்லகராதி',
      description: 'அகரவரிசைப்படுத்துதல், எதிர்ச்சொல், ஒருபொருள் குறித்த பலசொற்கள், மரபுத்தொடர், இலக்கிய வகைச் சொற்கள்',
      syllabus_topics: [
        'அகரவரிசைப்படுத்துதல் (Alphabetical Ordering)',
        'எதிர்ச்சொல் அறிதல் மற்றும் ஒருபொருள் குறித்த பலசொற்கள்',
        'பொருளறிந்து பொருத்துதல் மற்றும் சரியான தொடரமைத்தல்',
        'மரபுத் தொடர்கள், பழமொழிகள் மற்றும் சொற்றொடர் அமைப்பு',
        'இலக்கிய வகைச் சொற்கள் (இயற்சொல், திரிசொல், திசைச்சொல், வடசொல்)',
        'இணைச் சொற்கள், குறுக்கங்கள் மற்றும் மயங்கொலி வேறுபாடுகள்',
      ],
    },
    {
      unit_number: 3,
      unit_code: 'Unit III',
      title: 'எழுதும் திறன்',
      description: 'அலுவல் முறைக் கடிதம், விண்ணப்பக் கடிதம், பத்தி சுருக்குதல் (Précis Writing), தொடர் ஒழுங்கு',
      syllabus_topics: [
        'கடிதம் எழுதுதல் (அலுவல் முறை மற்றும் விண்ணப்பக் கடிதங்கள்)',
        'பத்தி சுருக்குதல் (Note-making & Summary / Précis Writing)',
        'பத்தி அமைத்தல் மற்றும் கருத்து ஒருமைப்பாடு',
        'தொடர் அமைத்தல், பிழை திருத்தம் மற்றும் சொற்றொடர் ஒழுங்கு',
        'விண்ணப்பப் படிவங்கள் மற்றும் மனுக்கள் தயாரிக்கும் முறை',
      ],
    },
    {
      unit_number: 4,
      unit_code: 'Unit IV',
      title: 'கலைச் சொற்கள்',
      description: 'தலைமைச் செயலக அலுவலகச் சொற்கள், நீதிமன்ற, நீதித்துறை, அறிவியல் & கணினித் தமிழ்க் கலைச்சொற்கள்',
      syllabus_topics: [
        'அலுவலக மற்றும் தலைமைச் செயலகக் கலைச்சொற்கள்',
        'நீதிமன்றம் மற்றும் சட்டக் கலைச்சொற்கள்',
        'அரசாணை மற்றும் நிருவாகச் சொற்களஞ்சியம்',
        'அறிவியல் மற்றும் கணினித் தமிழ்க் கலைச்சொற்கள்',
        'வணிகவியல், நிதி மற்றும் வங்கித் துறை கலைச்சொற்கள்',
      ],
    },
    {
      unit_number: 5,
      unit_code: 'Unit V',
      title: 'வாசித்தல் – புரிந்து கொள்ளும் திறன்',
      description: 'உரைநடைப் பத்தி வாசித்தல், வினாக்களுக்கு விடையளித்தல், கருத்துணர்தல் & மையக்கருத்து கண்டறிதல்',
      syllabus_topics: [
        'பத்தியைப் படித்து வினாக்களுக்கு விடையளித்தல்',
        'கருத்துணர்தல் மற்றும் மையக்கருத்தைக் கண்டறிதல்',
        'உரைநடைப் பத்தி பகுப்பாய்வு மற்றும் ஆசிரியர் நோக்கம்',
        'தகவல்களைத் திரட்டுதல் மற்றும் தர்க்கரீதியான முடிவெடுத்தல்',
        'விளக்க உரைநடை மற்றும் நடையியல் ஆய்வுக் குறிப்புகள்',
      ],
    },
    {
      unit_number: 6,
      unit_code: 'Unit VI',
      title: 'எளிய மொழிபெயர்ப்பு',
      description: 'ஆங்கிலத்திலிருந்து தமிழாக்கம், தமிழிலிருந்து ஆங்கில மொழிபெயர்ப்பு, சுற்றறிக்கை மொழிபெயர்ப்பு',
      syllabus_topics: [
        'ஆங்கிலத்திலிருந்து தமிழாக்கம் செய்தல்',
        'தமிழிலிருந்து ஆங்கிலத்தில் மொழிபெயர்த்தல்',
        'அலுவல் கடிதங்கள் மற்றும் சுற்றறிக்கைகள் மொழிபெயர்ப்பு',
        'மொழிபெயர்ப்பு நெறிமுறைகள் மற்றும் தொடர் மாற்ற உத்திகள்',
        'கலைச்சொற்களைப் பயன்படுத்தி சொற்றொடர் மொழிபெயர்ப்பு',
      ],
    },
    {
      unit_number: 7,
      unit_code: 'Unit VII',
      title: 'இலக்கியம், தமிழ் அறிஞர்களும், தமிழ்த்தொண்டும்',
      description: 'திருக்குறள், பதினெண்கீழ்க்கணக்கு, காப்பியங்கள், சிற்றிலக்கியங்கள், பாரதியார், உ.வே.சா, தமிழர் கலைகள்',
      syllabus_topics: [
        'திருக்குறள் தொடர்பான செய்திகள், மேற்கோள்கள் மற்றும் அறநெறிகள்',
        'பதினெண்கீழ்க்கணக்கு நூல்கள் (நாலடியார், நான்மணிக்கடிகை, பழமொழி நானூறு)',
        'ஐம்பெருங்காப்பியங்கள் மற்றும் ஐஞ்சிறுங்காப்பியங்கள்',
        'பெரியபுராணம், கம்பராமாயணம், சீறாப்புராணம் மற்றும் பக்தி இலக்கியங்கள்',
        'சிற்றிலக்கியங்கள் (முக்கூடற்பள்ளு, குற்றாலக்குறவஞ்சி, கலிங்கத்துப்பரணி)',
        'பாரதியார், பாரதிதாசன், நாமக்கல் கவிஞர், கவிமணி மற்றும் தற்காலக் கவிஞர்கள்',
        'உ.வே.சா, பெரியார், அண்ணா, மறைமலையடிகள், தேவநேயப் பாவாணர் மற்றும் தமிழ்த்தொண்டு',
        'நாட்டுப்புறக் கலைகள், தமிழர் பண்பாடு, தொல்லியல் மற்றும் அகழாய்வுகள்',
      ],
    },
  ],
};

/**
 * Classify a unit into one of the 4 canonical subjects
 */
export function classifyUnitSubject(unit: Partial<CanonicalUnitDraft>): string {
  if (unit.subject_slug) {
    return unit.subject_slug.toLowerCase().trim();
  }

  const text = `${unit.title || ''} ${(unit.syllabus_topics || []).join(' ')}`.toLowerCase();

  if (text.includes('aptitude') || text.includes('mental ability') || text.includes('simplification') || text.includes('கணிதம்')) {
    return 'aptitude';
  }
  if (text.includes('tamil') || text.includes('தமிழ்') || text.includes('இலக்கணம்') || text.includes('இலக்கியம்')) {
    return 'general-tamil';
  }
  if (text.includes('english') || text.includes('grammar') || text.includes('prose') || text.includes('poetry')) {
    return 'general-english';
  }

  return 'general-studies';
}

/**
 * Ensures General Studies has exactly six parent units (Units 1 to 6).
 * Preserves existing parsed topics and mapped lessons when present.
 */
export function normalizeGeneralStudiesSixUnits(existingUnits: CanonicalUnitDraft[]): CanonicalUnitDraft[] {
  const gsUnits = existingUnits.filter((u) => classifyUnitSubject(u) === 'general-studies');

  return CANONICAL_GS_SIX_UNITS.map((def) => {
    const existing = gsUnits.find((u) => u.unit_number === def.unit_number);
    if (existing) {
      return {
        ...existing,
        unit_number: def.unit_number,
        unit_code: existing.unit_code || def.unit_code,
        title: existing.title || def.title,
        description: existing.description || def.description,
        subject_slug: 'general-studies',
        subject_name: 'General Studies',
        syllabus_topics:
          existing.syllabus_topics && existing.syllabus_topics.length > 0
            ? existing.syllabus_topics
            : def.syllabus_topics,
        lessons: existing.lessons || [],
        selected_for_publish: existing.selected_for_publish !== false,
      };
    }

    return {
      unit_number: def.unit_number,
      unit_code: def.unit_code,
      title: def.title,
      description: def.description,
      subject_slug: 'general-studies',
      subject_name: 'General Studies',
      syllabus_topics: def.syllabus_topics,
      lessons: [],
      selected_for_publish: true,
    };
  });
}

/**
 * Ensures General Tamil has exactly seven canonical parent units (Units 1 to 7).
 * Preserves existing parsed topics and mapped lessons when present.
 */
export function normalizeGeneralTamilSevenUnits(existingUnits: CanonicalUnitDraft[]): CanonicalUnitDraft[] {
  const tamUnits = existingUnits.filter((u) => classifyUnitSubject(u) === 'general-tamil');
  const tamDefs = CANONICAL_OTHER_SUBJECT_UNITS['general-tamil'] || [];

  return tamDefs.map((def) => {
    const existing = tamUnits.find((u) => u.unit_number === def.unit_number);
    if (existing) {
      return {
        ...existing,
        unit_number: def.unit_number,
        unit_code: existing.unit_code || def.unit_code,
        title: def.title,
        description: existing.description || def.description,
        subject_slug: 'general-tamil',
        subject_name: 'General Tamil',
        syllabus_topics:
          existing.syllabus_topics && existing.syllabus_topics.length > 0
            ? existing.syllabus_topics
            : def.syllabus_topics,
        lessons: existing.lessons || [],
        selected_for_publish: existing.selected_for_publish !== false,
      };
    }

    return {
      unit_number: def.unit_number,
      unit_code: def.unit_code,
      title: def.title,
      description: def.description,
      subject_slug: 'general-tamil',
      subject_name: 'General Tamil',
      syllabus_topics: def.syllabus_topics,
      lessons: [],
      selected_for_publish: true,
    };
  });
}

/**
 * Ensures all four canonical subjects (General Studies, Aptitude, General English, General Tamil)
 * are represented with their full canonical parent units and preserved lessons.
 */
export function ensureAllCanonicalSubjectsFrontend(existingUnits: CanonicalUnitDraft[]): CanonicalUnitDraft[] {
  const result: CanonicalUnitDraft[] = [];

  // 1. General Studies: strictly 6 units
  const normalizedGs = normalizeGeneralStudiesSixUnits(existingUnits);
  result.push(...normalizedGs);

  // 2. Aptitude, General English, General Tamil
  for (const sub of CANONICAL_SUBJECTS) {
    if (sub.id === 'general-studies') continue;

    const subDefs = CANONICAL_OTHER_SUBJECT_UNITS[sub.id] || [];
    const existingSubUnits = existingUnits.filter((u) => classifyUnitSubject(u) === sub.id);

    for (const def of subDefs) {
      const existing = existingSubUnits.find((u) => u.unit_number === def.unit_number);
      if (existing) {
        result.push({
          ...existing,
          unit_number: def.unit_number,
          unit_code: existing.unit_code || def.unit_code,
          title: existing.title || def.title,
          description: existing.description || def.description,
          subject_slug: sub.id,
          subject_name: sub.name,
          syllabus_topics:
            existing.syllabus_topics && existing.syllabus_topics.length > 0
              ? existing.syllabus_topics
              : def.syllabus_topics,
          lessons: existing.lessons || [],
          selected_for_publish: existing.selected_for_publish !== false,
        });
      } else {
        result.push({
          unit_number: def.unit_number,
          unit_code: def.unit_code,
          title: def.title,
          description: def.description,
          subject_slug: sub.id,
          subject_name: sub.name,
          syllabus_topics: def.syllabus_topics,
          lessons: [],
          selected_for_publish: true,
        });
      }
    }
  }

  return result;
}


