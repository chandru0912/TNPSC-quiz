// Interactive Study Notes Data Generator for TNPSC Group 1 Lessons
// Provides slide-by-slide structured study notes for Samacheer Kalvi mapped lessons

export interface NoteSlide {
  title: string
  subtitle?: string
  badge: string
  content: {
    heading: string
    paragraphs: string[]
    bulletPoints?: string[]
    keyHighlights?: { label: string; text: string }[]
    factBox?: string
  }
}

export interface LessonNotesDeck {
  lessonId: string
  lessonTitle: string
  unitNumber: string
  unitTitle: string
  classTitle: string
  term?: string
  subjectName: string
  slides: NoteSlide[]
}

// Generate structured 4-slide interactive notes for any lesson
export const getLessonNotes = (
  unitId: number,
  _classId: number,
  unitNumber: string,
  unitTitle: string,
  classTitle: string,
  subjectName: string,
  lesson: {
    id: string
    lessonNumber: string
    title: string
    term?: string
    description?: string
    keyConcepts?: string[]
    studyNotes?: string[]
  }
): LessonNotesDeck => {
  const termText = lesson.term ? ` (${lesson.term})` : ''

  // Unit-specific contextual insights
  const unitFocusMap: Record<number, { examRole: string; highYieldTips: string[]; formulaOrAct: string }> = {
    1: {
      examRole: 'Evaluates empirical scientific reasoning, everyday applications, and direct formulas from Samacheer Kalvi textbooks.',
      highYieldTips: [
        'SI units, dimensional formulas, and conversions are repeatedly asked in Prelims.',
        'Focus on daily life applications (e.g. why lenses cure eye defects, why bleaching powder acts as disinfectant).',
        'Endocrine gland secretions, disease pathogens (viral vs bacterial), and recent ISRO missions are high-frequency areas.',
      ],
      formulaOrAct: 'Universal Gravitation: F = G(m1*m2)/r² | Ohm’s Law: V = I*R | Lens Formula: 1/f = 1/v - 1/u',
    },
    2: {
      examRole: 'Focuses on Indian physical geography, Southwest vs Northeast monsoons, multi-purpose river valley projects, and Tamil Nadu natural resources.',
      highYieldTips: [
        'Pay special attention to river origins, tributaries, and states traversed (especially Cauvery, Godavari, Krishna).',
        'Know the exact rainfall distribution patterns and agro-climatic zones in Tamil Nadu.',
        'Mineral belts (Chota Nagpur, Neyveli Lignite, Salem Magnesite) are staple match-the-following questions.',
      ],
      formulaOrAct: 'Standard Meridian of India: 82°30’ E (Mirzapur, UP) | Total Coastline: 7,516.6 km',
    },
    3: {
      examRole: 'Carries substantial weightage testing chronological sequence, peasant & tribal uprisings, Indian National Congress sessions, and freedom struggle leaders.',
      highYieldTips: [
        'Memorize INC session years, locations, and presidents (notably 1887 Madras, 1907 Surat, 1916 Lucknow, 1929 Lahore).',
        'Thoroughly study early rebellions in Tamil Nadu: Puli Thevar (1755), Velu Nachiyar (1780), Kattabomman (1799), Marudhu Brothers (1801), and Vellore Mutiny (1806).',
        'Understand the ideological contrasts and collaborations among Gandhi, Ambedkar, Subash Bose, and Periyar.',
      ],
      formulaOrAct: '1801 Tiruchirappalli Proclamation | 1858 Queen Victoria Proclamation | 1930 Vedaranyam Salt March',
    },
    4: {
      examRole: 'Heavyweight section where accuracy determines cutoff qualification. Tests exact Articles, Constitutional Amendments, and Landmark Supreme Court judgments.',
      highYieldTips: [
        'Master Articles 12 to 51A (Fundamental Rights, Directive Principles, and Fundamental Duties) word-for-word.',
        'Understand Centre-State legislative, administrative, and financial relations and commissions (Sarkaria, Punchhi, Rajamannar).',
        'Review anti-corruption statutory institutions: Lokpal, Lokayukta, CVC, and Right to Information Act 2005.',
      ],
      formulaOrAct: 'Article 32 & 226 (Writs) | 73rd & 74th CAA (1992) | 42nd CAA (1976 - Mini Constitution)',
    },
    5: {
      examRole: 'Highest single weightage combining macro Indian economy, fiscal federalism, and the socio-economic development administration of Tamil Nadu.',
      highYieldTips: [
        'Tamil Nadu’s performance in GSDP, Human Development Index (IMR, MMR, GER), and industrial clusters is asked every year.',
        'Study RBI monetary policy quantitative and qualitative tools (Repo, Reverse Repo, CRR, SLR).',
        'Know the rationale, history, and constitutional protection of Tamil Nadu’s 69% reservation policy under the 9th Schedule.',
      ],
      formulaOrAct: 'Article 280 (Finance Commission) | Article 279A (GST Council) | TN Act 45 of 1994 (69% Reservation)',
    },
    6: {
      examRole: 'Dedicated to Tamil society, Keezhadi archaeological discoveries, Thirukkural universal values, Justice Party, and Dravidian movement.',
      highYieldTips: [
        'Thirukkural questions test secular values, political philosophy (Iraimaatchi, Amaichu), and social ethics (Virundhombal, Ozhukkamudaimai).',
        'Memorize archaeological excavation findings: Keeladi (Vaigai urban civilization, 580 BCE), Kodumanal, Adichanallur, Porunthal.',
        'Review all reforms of the Justice Party ministries (1920–1937), Self-Respect Movement (1925), and Anna’s 1967 governance landmarks.',
      ],
      formulaOrAct: 'Keezhadi Vaigai Civilization (6th Century BCE) | Communal G.O. (1921 & 1928) | Self-Respect Marriages Act 1967',
    },
  }

  // Subject-aware contextual defaults for General Tamil, Aptitude, and General English
  const isTamil = subjectName.includes('தமிழ்') || subjectName.includes('Tamil') || unitTitle.includes('இலக்கணம்') || unitTitle.includes('இலக்கியம்')
  const isAptitude = subjectName.includes('Aptitude') || subjectName.includes('Mental Ability') || subjectName.includes('கணிதம்')
  const isEnglish = subjectName.includes('English')

  let unitMeta = unitFocusMap[unitId]
  if (isTamil) {
    unitMeta = {
      examRole: 'தமிழ்நாடு அரசுப் பணியாளர் தேர்வாணையம் (TNPSC) பத்தாம் வகுப்புத் தரம் (SSLC Standard) அடிப்படையில் கேட்கும் 100 வினாக்களுக்குரிய அதிகாரப்பூர்வ பாடநூல் பகுதி.',
      highYieldTips: [
        'செய்யுள் ஆசிரியர்கள், இயற்பெயர், சிறப்புப் பெயர்கள், ஊர் மற்றும் அவர்கள் இயற்றிய நூல்களைத் தெளிவாக நினைவில் கொள்ளவும்.',
        'நன்னூல் இலக்கண விதிகள், மாத்திரை அளவுகள், வேற்றுமை உருபுகள், சந்திப்பிழை மற்றும் ஒற்றுப்பிழையின்றி எழுதும் முறைகளில் கூடுதல் கவனம் தேவை.',
        'திருக்குறள் 20 அதிகாரங்கள் மற்றும் பதினெண்கீழ்க்கணக்கு அறநூல்களின் மேற்கோள்கள் திரும்பத் திரும்பக் கேட்கப்படும் முதன்மைப் பகுதியாகும்.',
      ],
      formulaOrAct: 'திருக்குறள் 1330 குறள்கள் | நன்னூல் 42 ஓரெழுத்து ஒருமொழிகள் | தொல்காப்பியம் 3 அதிகாரங்கள்',
    }
  } else if (isAptitude) {
    unitMeta = {
      examRole: 'Tests quantitative aptitude, mathematical shortcuts, mental ability, and logical reasoning (25 Questions in Prelims).',
      highYieldTips: [
        'Master HCF & LCM fundamental relation: HCF(a, b) × LCM(a, b) = a × b.',
        'Use percentage-to-fraction equivalents (e.g. 12.5% = 1/8, 16.66% = 1/6) for fast Compound Interest and Profit & Loss calculations.',
        'Time & Work: If A completes work in x days and B in y days, together they take (x*y)/(x+y) days.',
      ],
      formulaOrAct: 'SI = (P*N*R)/100 | CI = P(1 + R/100)^N - P | Ratio: a*d = b*c',
    }
  } else if (isEnglish) {
    unitMeta = {
      examRole: 'Evaluates grammar accuracy, concord, voice transformations, and analysis of prescribed SSLC poems and prose (100 Questions).',
      highYieldTips: [
        'Master Subject-Verb Concord rules (e.g. compound subjects joined by "along with", "as well as", "together with").',
        'Study figures of speech: Metaphor, Simile, Personification, Alliteration, Oxymoron in prescribed school poems.',
        'Know authors and central themes of prescribed poems ("Life" by Henry Van Dyke, "The Secret of the Machines" by Kipling) and prose.',
      ],
      formulaOrAct: 'Active to Passive: S + V + O -> O + be + V3 + by + S | Question Tag rules',
    }
  } else if (!unitMeta) {
    unitMeta = unitFocusMap[1]
  }

  const hasLessonNotes = Array.isArray(lesson.studyNotes) && lesson.studyNotes.length > 0
  const hasKeyConcepts = Array.isArray(lesson.keyConcepts) && lesson.keyConcepts.length > 0

  const slides: NoteSlide[] = [
    // Slide 1: Syllabus Scope & Context
    {
      title: 'Syllabus Alignment & Overview',
      subtitle: `${unitNumber}: ${unitTitle} • ${classTitle}${termText}`,
      badge: 'Slide 1: Overview',
      content: {
        heading: `Lesson ${lesson.lessonNumber}: ${lesson.title}`,
        paragraphs: [
          `This lesson forms a core syllabus topic under ${unitNumber} (${unitTitle}), directly sourced from the Tamil Nadu State Board (Samacheer Kalvi) ${classTitle} ${subjectName} curriculum.`,
          lesson.description || `Comprehensive study of fundamental principles, definitions, and objective examination areas aligned with TNPSC standards.`,
        ],
        bulletPoints: [
          `Board Curriculum: Samacheer Kalvi (${classTitle}${termText})`,
          `Subject Category: ${subjectName}`,
          `Exam Relevance: Direct conceptual and objective multiple-choice question source for TNPSC Examinations (Group 1, 2/2A, 4 & VAO).`,
        ],
        factBox: `Exam Significance: ${unitMeta.examRole}`,
      },
    },

    // Slide 2: Core Concepts & Principles
    {
      title: 'Core Concepts & Theoretical Framework',
      subtitle: 'Key Definitions & Systematic Breakdown',
      badge: 'Slide 2: Core Theory',
      content: {
        heading: 'Key Conceptual Foundations',
        paragraphs: hasLessonNotes
          ? [lesson.studyNotes![0], ...(lesson.studyNotes!.length > 1 ? [lesson.studyNotes![1]] : [])]
          : [
              `To master "${lesson.title}", candidates must focus on understanding concepts functionally rather than relying on rote memorization. The TNPSC syllabus emphasizes conceptual clarity and practical applications.`,
              `Study the standard classifications, historical chronologies, grammar rules, or administrative flows presented in the official textbook chapters.`,
            ],
        keyHighlights: hasKeyConcepts
          ? lesson.keyConcepts!.slice(0, 3).map((kc, i) => ({
              label: `Concept §${i + 1}`,
              text: kc,
            }))
          : [
              {
                label: 'Primary Concept',
                text: `Detailed understanding of the fundamental principles underlying ${lesson.title}.`,
              },
              {
                label: 'Methodology',
                text: 'Systematic analysis of textbook classifications, terminologies, and real-world linkages.',
              },
              {
                label: 'Tamil Nadu Relevance',
                text: 'State-specific examples, geographic distributions, or historical landmarks related to this chapter.',
              },
            ],
        factBox: `Key Formulation / Rule: ${unitMeta.formulaOrAct}`,
      },
    },

    // Slide 3: High-Yield Exam Pointers
    {
      title: 'High-Yield Exam Pointers & TNPSC Factoids',
      subtitle: 'Repeated Question Patterns & Memory Triggers',
      badge: 'Slide 3: Exam Pointers',
      content: {
        heading: 'High-Frequency Exam Takeaways',
        paragraphs: [
          `TNPSC Preliminary questions in ${unitTitle} frequently test candidate depth on the following specific textbook facts, tables, and box items ("Do You Know? / தெரியுமா?"):`,
          ...(hasLessonNotes && lesson.studyNotes!.length > 2 ? [lesson.studyNotes![2]] : []),
        ],
        bulletPoints: unitMeta.highYieldTips,
        keyHighlights: [
          {
            label: 'Trap Avoidance',
            text: 'Carefully read question stems with keywords like "INCORRECT", "EXCEPT", "NOT TRUE", or chronological ordering.',
          },
          {
            label: 'Assertion & Reason',
            text: 'Ensure you can validate both statements independently before evaluating if Reason (R) is the correct explanation of Assertion (A).',
          },
        ],
        factBox: `Pro Tip: Review the summary tables and end-of-chapter glossary in your ${classTitle} textbook before attempting practice tests.`,
      },
    },

    // Slide 4: Quick Revision & Action Checkpoint
    {
      title: 'Quick Revision Summary & Self-Check',
      subtitle: 'Consolidate Knowledge & Test Your Speed',
      badge: 'Slide 4: Self-Check',
      content: {
        heading: 'Chapter Recapitulation',
        paragraphs: [
          `You have reviewed the key conceptual framework for "${lesson.title}". Consolidate your memory retention with these three quick recall checks:`,
        ],
        bulletPoints: [
          `Can you define the core terminology of ${lesson.title} in your own words?`,
          `Are you familiar with the key dates, articles, formulas, grammar rules, or classifications in this chapter?`,
          `Can you distinguish this topic from closely related themes in the TNPSC syllabus?`,
        ],
        factBox: 'Next Step: Transition directly from reading to active retrieval practice by solving targeted MCQs for this lesson!',
      },
    },
  ]

  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    unitNumber,
    unitTitle,
    classTitle,
    term: lesson.term,
    subjectName,
    slides,
  }
}
