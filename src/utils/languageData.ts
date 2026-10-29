import type { Language } from '../context/LanguageContext'

export interface QuestionTranslation {
  questionTa: string
  optionsTa: string[]
  explanationTa: string
  tagTa?: string
}

// UI Vocabulary & Dictionaries for the 3 Scoped Sections
export const UI_TRANSLATIONS = {
  // Study Materials Section
  studyMaterials: {
    en: {
      pageTitle: 'Study Materials & Syllabus',
      pageSubtitle: 'Comprehensive syllabus-mapped learning modules, study notes, and lesson-wise practice quizzes',
      tabGroup1: 'TNPSC Group 1',
      tabGroup2: 'TNPSC Group 2 & 2A',
      tabGroup4: 'TNPSC Group 4',
      generalStudies: 'General Studies',
      generalStudiesDesc: 'Comprehensive degree standard syllabus covering General Science, Indian Geography, History & Culture of India, Indian Polity, Indian Economy & TN Administration, and Tamil Society Heritage.',
      aptitude: 'Aptitude & Mental Ability',
      aptitudeDesc: 'SSLC standard numerical aptitude, reasoning, data interpretation, simplification, ratios, interest, percentages, and logical puzzles.',
      generalTamil: 'General Tamil (பொதுத்தமிழ்)',
      generalTamilDesc: 'Samacheer Kalvi SSLC standard grammar, literature, authors, modern poetry, and ethical works for Group 2 & 4.',
      generalEnglish: 'General English',
      generalEnglishDesc: 'Samacheer Kalvi SSLC standard grammar, vocabulary, literary works, figures of speech, and comprehension.',
      unitsCount: 'Distinct Syllabus Units',
      questionsCount: 'Questions',
      chaptersCount: 'Chapters',
      lessonsCount: 'Lessons',
      standardsCount: 'Standards (6th to 12th)',
      viewUnits: 'View Syllabus Units',
      readNotes: 'Read Lesson Notes',
      practiceMCQs: 'Practice MCQs',
      exploreModule: 'Explore Module',
      unitPrefix: 'Unit',
      standardPrefix: 'Standard',
      keyConcepts: 'Key Concepts',
      summary: 'Summary',
    },
    ta: {
      pageTitle: 'பாடக்குறிப்புகள் & பாடத்திட்டம்',
      pageSubtitle: 'பாடத்திட்ட அடிப்படையிலான கற்றல் தொகுதிகள், தேர்வுப் பாடக்குறிப்புகள் மற்றும் பாடம் வாரியான பயிற்சி வினாக்கள்',
      tabGroup1: 'TNPSC குரூப் 1',
      tabGroup2: 'TNPSC குரூப் 2 & 2A',
      tabGroup4: 'TNPSC குரூப் 4 & VAO',
      generalStudies: 'பொது அறிவு (General Studies)',
      generalStudiesDesc: 'பொது அறிவியல், இந்தியப் புவியியல், இந்திய வரலாறு & கலாச்சாரம், இந்திய ஆட்சியியல், இந்தியப் பொருளாதாரம் & தமிழ்நாடு நிர்வாகம் மற்றும் தமிழ் மரபு உள்ளடக்கிய பட்டப்படிப்புத் தரம்.',
      aptitude: 'திறனறிவும் மனக்கணக்கு நுண்ணறிவும்',
      aptitudeDesc: 'பத்தாம் வகுப்புத் தரத்திலான சுருக்குதல், விழுக்காடு, மீ.பொ.வ, மீ.சி.ம, விகிதம், தனிவட்டி, கூட்டுவட்டி, பரப்பளவு மற்றும் தர்க்கக் கணக்குகள்.',
      generalTamil: 'பொதுத் தமிழ் (தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு)',
      generalTamilDesc: 'சமச்சீர் கல்வி 6 முதல் 12-ஆம் வகுப்பு வரையிலான தமிழ் இலக்கணம், இலக்கியம், தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும் உள்ளடக்கிய முழுமையான பாடப்பகுதி.',
      generalEnglish: 'பொது ஆங்கிலம் (General English)',
      generalEnglishDesc: 'சமச்சீர் கல்வி 6 முதல் 12-ஆம் வகுப்பு வரையிலான இலக்கணம், சொற்களஞ்சியம் மற்றும் ஆங்கில இலக்கிய வினாக்கள்.',
      unitsCount: 'பாடத்திட்ட அலகுகள்',
      questionsCount: 'வினாக்கள்',
      chaptersCount: 'அத்தியாயங்கள்',
      lessonsCount: 'பாடங்கள்',
      standardsCount: 'வகுப்புகள் (6 முதல் 12 வரை)',
      viewUnits: 'பாடத்திட்ட அலகுகளைக் காண்க',
      readNotes: 'பாடக்குறிப்புகளைப் படிக்க',
      practiceMCQs: 'பயிற்சி வினாக்களைத் தொடங்க',
      exploreModule: 'பாடப்பிரிவை ஆராய்க',
      unitPrefix: 'அலகு',
      standardPrefix: 'வகுப்பு',
      keyConcepts: 'முக்கியக் கருத்துகள்',
      summary: 'சுருக்கம்',
    },
  },

  // MCQ Practice Section
  mcqPractice: {
    en: {
      pageTitle: 'MCQ Practice',
      pageSubtitle: 'Topic-wise multiple choice questions with in-depth explanations',
      questionNumber: 'Question',
      of: 'of',
      submitAnswer: 'Submit Answer',
      nextQuestion: 'Next Question',
      previousQuestion: 'Previous',
      reviewAnswers: 'Review Answers',
      practiceAgain: 'Practice Again',
      selectOptionPrompt: 'Select an option to view detailed explanation and test your knowledge',
      correct: 'Correct Answer!',
      incorrect: 'Incorrect Answer',
      explanationTitle: 'Explanation & Concept Note:',
      sourceRef: 'Source Reference:',
      difficulty: 'Difficulty',
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
      quizCompleted: 'Quiz Completed!',
      scoreSummary: 'Here is your performance summary for this practice session',
      yourScore: 'Your Score',
      accuracy: 'Accuracy',
      answered: 'Answered',
      backToStandard: 'Back to Standard Notes',
      clearFilter: 'Clear Filter',
      showingQuestionsFor: 'Showing questions for',
      timer: 'Elapsed Time',
      score: 'Score',
    },
    ta: {
      pageTitle: 'பயிற்சி வினாக்கள் (MCQ Practice)',
      pageSubtitle: 'தலைப்பு வாரியான கொள்குறி வகை வினாக்களும் விரிவான விளக்கக் குறிப்புகளும்',
      questionNumber: 'வினா',
      of: '/',
      submitAnswer: 'விடையைச் சமர்ப்பி',
      nextQuestion: 'அடுத்த வினா',
      previousQuestion: 'முந்தைய வினா',
      reviewAnswers: 'விடைகளை மதிப்பாய்வு செய்',
      practiceAgain: 'மீண்டும் பயிற்சி செய்',
      selectOptionPrompt: 'விரிவான விளக்கத்தைக் காணவும் உங்கள் அறிவைச் சோதிக்கவும் ஒரு விடையைத் தேர்ந்தெடுக்கவும்',
      correct: 'சரியான விடை!',
      incorrect: 'தவறான விடை',
      explanationTitle: 'பாட விளக்கம் & நினைவுக் குறிப்பு:',
      sourceRef: 'பாடநூல் ஆதாரம்:',
      difficulty: 'சிரம நிலை',
      easy: 'எளிது',
      medium: 'நடுத்தரம்',
      hard: 'கடினம்',
      quizCompleted: 'பயிற்சி நிறைவடைந்தது!',
      scoreSummary: 'இப்பயிற்சி அமர்வில் உங்களுடைய மதிப்பெண் மற்றும் செயல்திறன் சுருக்கம்',
      yourScore: 'உங்கள் மதிப்பெண்',
      accuracy: 'துல்லியம்',
      answered: 'பதிலளித்தவை',
      backToStandard: 'வகுப்புப் பாடங்களுக்குத் திரும்புக',
      clearFilter: 'வடிகட்டியை நீக்குக',
      showingQuestionsFor: 'காட்டப்படும் வினாக்கள்:',
      timer: 'சென்ற நேரம்',
      score: 'மதிப்பெண்',
    },
  },

  // Mock Tests Section
  mockTests: {
    en: {
      pageTitle: 'Mock Tests',
      pageSubtitle: 'Full-length timed mock tests organized across TNPSC Group 1, TNPSC Group 2 & 2A, and TNPSC Group 4',
      startTest: 'Start Test',
      questions: 'Questions',
      duration: 'Duration',
      attempts: 'Attempts',
      rating: 'Rating',
      tabGroup1: 'TNPSC Group 1',
      tabGroup2: 'TNPSC Group 2 & 2A',
      tabGroup4: 'TNPSC Group 4',
      instructions: 'Exam Instructions',
    },
    ta: {
      pageTitle: 'மாதிரித் தேர்வுகள் (Mock Tests)',
      pageSubtitle: 'TNPSC குரூப் 1, குரூப் 2 & 2A மற்றும் குரூப் 4 தேர்வுகளுக்கான முழுமையான காலவரையறை மாதிரித் தேர்வுகள்',
      startTest: 'தேர்வைத் தொடங்குக',
      questions: 'வினாக்கள்',
      duration: 'கால அளவு',
      attempts: 'எழுதியோர்',
      rating: 'மதிப்பீடு',
      tabGroup1: 'TNPSC குரூப் 1',
      tabGroup2: 'TNPSC குரூப் 2 & 2A',
      tabGroup4: 'TNPSC குரூப் 4 & VAO',
      instructions: 'தேர்வு விதிமுறைகள்',
    },
  },
}

// Comprehensive bilingual dictionary for TNPSC Questions, Options, and Explanations
// Maps English question signatures to authentic textbook Tamil
const QUESTION_TRANSLATIONS: Record<string, QuestionTranslation> = {
  // Unit 1: Laws of Motion
  'newton_second_law': {
    questionTa: 'நியூட்டனின் இரண்டாம் இயக்க விதியின்படி, ஒரு பொருளின் மீது செயல்படும் விசையானது எதற்கு நேர்விகிதத்தில் இருக்கும்?',
    optionsTa: [
      'திசைவேக மாறுபாட்டு வீதம்',
      'நேர்க்கோட்டு உந்த மாறுபாட்டு வீதம்',
      'பொருளின் மொத்த இயக்க ஆற்றல்',
      'ஓரலகு காலத்தில் கடந்த தொலைவு',
    ],
    explanationTa: 'நியூட்டனின் இரண்டாம் இயக்க விதி: ஒரு பொருளின் மீது செயல்படும் விசையானது அப்பொருளின் உந்த மாறுபாட்டு வீதத்திற்கு நேர்விகிதத்தில் அமையும் (F = dp/dt = ma). விசை செயல்படும் திசையிலேயே உந்த மாறுபாடு நிகழும்.',
    tagTa: 'குரூப் 1 • அலகு I: பொது அறிவியல் (இயற்பியல்)',
  },
  'apparent_weight': {
    questionTa: 'ஒரு மின்தூக்கி (Elevator/Lift) ஈர்ப்பு முடுக்கத்திற்குச் சமமாக (a = g) கீழ்நோக்கித் தானே கீழே விழும்போது, அதிலுள்ள மனிதரின் தோற்ற எடை என்னவாகும்?',
    optionsTa: [
      'உண்மையான எடையை விட இருமடங்காகும்',
      'உண்மையான எடையில் பாதியாகும்',
      'சுழியாகும் (பூஜ்ஜியம்)',
      'எந்த மாற்றமும் இன்றி அப்படியே இருக்கும்',
    ],
    explanationTa: 'மின்தூக்கி புவியீர்ப்பு முடுக்கத்தில் (a = g) கீழ்நோக்கித் தடையின்றி விழும்போது, தோற்ற எடை R = m(g - a) = m(g - g) = 0 ஆகும். இந்த நிலை எடையின்மை (Weightlessness) என அழைக்கப்படுகிறது.',
    tagTa: 'குரூப் 1 • அலகு I: பொது அறிவியல் (இயற்பியல்)',
  },
  'rocket_propulsion': {
    questionTa: 'ராக்கெட் ஏவுதலில் (Rocket Propulsion) கீழ்க்கண்ட எந்த அறிவியல் விதிகள் முதன்மையாகப் பயன்படுத்தப்படுகின்றன?',
    optionsTa: [
      'நியூட்டனின் மூன்றாம் விதி மற்றும் நேர்க்கோட்டு உந்த மாறாக் கோட்பாடு',
      'நியூட்டனின் முதல் விதி மற்றும் கெப்ளரின் விதிகள்',
      'ஆர்க்கிமிடிஸ் தத்துவம் மற்றும் பெர்னௌலி தேற்றம்',
      'பாஸ்கல் விதி மற்றும் பாயில் விதி',
    ],
    explanationTa: 'ராக்கெட் ஏவுதல் நியூட்டனின் மூன்றாம் இயக்க விதி (ஒவ்வொரு வினைக்கும் சமமான எதிர்வினை உண்டு) மற்றும் நேர்க்கோட்டு உந்த மாறாக் கோட்பாடு ஆகியவற்றின் அடிப்படையில் செயல்படுகிறது.',
    tagTa: 'குரூப் 1 • அலகு I: பொது அறிவியல் (இயற்பியல்)',
  },
  'optics_refraction': {
    questionTa: 'ஒளிக் கதிர் ஒன்று அடர்வு குறைந்த ஊடகத்திலிருந்து அடர்வு மிகுந்த ஊடகத்திற்குள் செல்லும்போது அதன் வேகம் மற்றும் பாதை எவ்வாறு மாறும்?',
    optionsTa: [
      'ஒளியின் வேகம் குறையும் மற்றும் செங்குத்துக் கோட்டை நோக்கி வளையும்',
      'ஒளியின் வேகம் அதிகரிக்கும் மற்றும் செங்குத்துக் கோட்டை விட்டு விலகும்',
      'ஒளியின் வேகம் மாறாது ஆனால் நேர்கோட்டில் செல்லும்',
      'ஒளிக் கதிர் முழு அக எதிரொளிப்பு மட்டும் அடையும்',
    ],
    explanationTa: 'ஒளி அடர்வு குறைந்த ஊடகத்திலிருந்து அடர்வு மிகுந்த ஊடகத்திற்குச் செல்லும்போது வேகம் குறைந்து, படுகோணச் செங்குத்துக் கோட்டை நோக்கி வளைகிறது.',
    tagTa: 'குரூப் 1 • அலகு I: பொது அறிவியல் (ஒளியியல்)',
  },
  'sound_frequency': {
    questionTa: 'மனிதனின் செவியுணர் ஒலியின் (Audible Sound) அதிர்வெண் வரம்பு என்ன?',
    optionsTa: [
      '20 Hz முதல் 20,000 Hz வரை',
      '20 Hz-க்கும் குறைவானது',
      '20,000 Hz முதல் 50,000 Hz வரை',
      '100 Hz முதல் 10,000 Hz வரை',
    ],
    explanationTa: 'மனித செவிகளால் உணரக்கூடிய ஒலியின் அதிர்வெண் வரம்பு 20 Hz முதல் 20,000 Hz (20 kHz) வரை ஆகும். 20 Hz-க்கு குறைவானது குற்றொலி (Infrasonic), 20,000 Hz-க்கு மேலானது மீயொலி (Ultrasonic) ஆகும்.',
    tagTa: 'குரூப் 1 • அலகு I: பொது அறிவியல் (ஒலியியல்)',
  },
  'polity_fundamental_rights': {
    questionTa: 'இந்திய அரசியலமைப்பின் எந்தப் பிரிவு மற்றும் சரத்துகள் அடிப்படை உரிமைகளைக் (Fundamental Rights) குறிப்பிடுகின்றன?',
    optionsTa: [
      'பகுதி III, சரத்துகள் 12 முதல் 35 வரை',
      'பகுதி II, சரத்துகள் 5 முதல் 11 வரை',
      'பகுதி IV, சரத்துகள் 36 முதல் 51 வரை',
      'பகுதி IVA, சரத்து 51A',
    ],
    explanationTa: 'இந்திய அரசியலமைப்பின் பகுதி III (சரத்துகள் 12 முதல் 35 வரை) அடிப்படை உரிமைகளைப் பற்றி விவரிக்கிறது. இது \'இந்தியாவின் மகாசாசனம்\' (Magna Carta of India) என அழைக்கப்படுகிறது.',
    tagTa: 'குரூப் 1 • அலகு IV: இந்திய ஆட்சியியல்',
  },
  'polity_writs': {
    questionTa: 'அடிப்படை உரிமைகள் மீறப்படும்போது உச்ச நீதிமன்றத்தால் நீதிப்பேராணைகள் (Writs) பிறப்பிக்கப்படும் அதிகாரம் எந்தச் சரத்தின் கீழ் வழங்கப்பட்டுள்ளது?',
    optionsTa: [
      'சரத்து 32 (அரசியலமைப்புக்கு உட்பட்டு தீர்வு காணும் உரிமை)',
      'சரத்து 226',
      'சரத்து 14',
      'சரத்து 21',
    ],
    explanationTa: 'சரத்து 32-ன் கீழ் உச்ச நீதிமன்றமும், சரத்து 226-ன் கீழ் உயர் நீதிமன்றங்களும் நீதிப்பேராணைகளை (ஆட்கொணர் நீதிப்பேராணை, கட்டளையுறுத்தும் நீதிப்பேராணை, தடையுறுத்தும் நீதிப்பேராணை, ஆவணக் கேட்பு நீதிப்பேராணை, தகுதிமுறை வினவும் நீதிப்பேராணை) பிறப்பிக்க அதிகாரம் கொண்டுள்ளன.',
    tagTa: 'குரூப் 1 • அலகு IV: இந்திய ஆட்சியியல்',
  },
  'history_puli_thevar': {
    questionTa: 'ஆங்கிலேய கிழக்கிந்தியக் கம்பெனிக்கு எதிராகத் தமிழ்நாட்டில் முதன்முதலில் ஆயுதம் ஏந்திப் போராடிய பாளையக்காரர் யார்?',
    optionsTa: [
      'பூலித்தேவர் (நெற்கட்டும்செவல்)',
      'வீரபாண்டிய கட்டபொம்மன்',
      'மருது சகோதரர்கள்',
      'தீரன் சின்னமலை',
    ],
    explanationTa: '1755-ல் கர்னல் ஹெரான் மற்றும் மாபூஸ்கானின் படைகளை எதிர்த்து நின்று முதன்முதலில் விடுதலை முழக்கமிட்டு ஆங்கிலேயரைத் தோற்கடித்த பெருமை நெற்கட்டும்செவல் பாளையக்காரர் பூலித்தேவருக்கே உரியது.',
    tagTa: 'குரூப் 1 • அலகு III: இந்திய தேசிய இயக்கம் (தமிழ்நாடு பாளையக்காரர் கிளர்ச்சி)',
  },
  'geography_cauvery': {
    questionTa: 'காவிரி ஆறு கர்நாடக மாநிலத்தின் குடகு மலையில் உள்ள எந்த இடத்தில் உற்பத்தியாகிறது?',
    optionsTa: [
      'தலைக்காவிரி (பிரம்மகிரி மலை)',
      'மகாபலேஷ்வர்',
      'திரியம்பகேஸ்வர்',
      'அமர்கண்டக்',
    ],
    explanationTa: 'காவிரி ஆறு கர்நாடகாவின் குடகு மாவட்டத்தில் உள்ள பிரம்மகிரி மலையிலுள்ள தலைக்காவிரி என்ற இடத்தில் உற்பத்தியாகி, தமிழ்நாட்டில் மேட்டூர் அணை வழியாகப் பாய்ந்து பூம்புகார் அருகே வங்காள விரிகுடாவில் கலக்கிறது.',
    tagTa: 'குரூப் 1 • அலகு II: இந்திய மற்றும் தமிழ்நாட்டுப் புவியியல்',
  },
  'economy_gst': {
    questionTa: 'இந்தியாவில் சரக்கு மற்றும் சேவை வரி (GST) எந்த நாளிலிருந்து நடைமுறைக்கு வந்தது?',
    optionsTa: [
      'ஜூலை 1, 2017',
      'ஏப்ரல் 1, 2016',
      'ஜனவரி 1, 2018',
      'ஆகஸ்ட் 15, 2017',
    ],
    explanationTa: '101-வது அரசியலமைப்புத் திருத்தச் சட்டம், 2016-ன் படி சரக்கு மற்றும் சேவை வரி (GST) ஜூலை 1, 2017 முதல் நாடு முழுவதும் ஒரே நாடு ஒரே வரி என்ற முழக்கத்துடன் அமல்படுத்தப்பட்டது.',
    tagTa: 'குரூப் 1 • அலகு V: இந்தியப் பொருளாதாரம்',
  },
  'tamil_keeladi': {
    questionTa: 'வைகை நதிக்கரையில் அமைந்துள்ள கீழடி அகழாய்வு எந்தக் காலத்தைச் சேர்ந்த நகர நாகரிகத்தை வெளிப்படுத்தியுள்ளது?',
    optionsTa: [
      'கி.மு. 6-ஆம் நூற்றாண்டு (கி.மு. 580)',
      'கி.பி. 1-ஆம் நூற்றாண்டு',
      'கி.மு. 3-ஆம் நூற்றாண்டு',
      'கி.பி. 5-ஆம் நூற்றாண்டு',
    ],
    explanationTa: 'கீழடி அகழாய்வு கரிமப் பகுப்பாய்வு முடிவுகள் (Carbon dating) வைகை ஆற்று நாகரிகம் கி.மு. 6-ஆம் நூற்றாண்டு (சுமார் கி.மு. 580) தொன்மை வாய்ந்த எழுத்தறிவு பெற்ற நகர நாகரிகம் என்பதை உறுதிப்படுத்தியுள்ளன.',
    tagTa: 'குரூப் 1 • அலகு VI: தமிழ்நாட்டு வரலாறு மற்றும் பண்பாடு',
  },
}

// Translates a question item dynamically based on selected language
export function translateQuestionItem<T extends {
  question: string
  options: string[]
  explanation: string
  tag?: string
  topic?: string | null
}>(q: T, lang: Language): T {
  if (lang === 'en') {
    // If language is English, and question has an existing English text or is in English, return it
    // If question is originally in Tamil from Tamil unit, translate key parts to English
    return translateToEnglish(q)
  }

  // Language is Tamil:
  return translateToTamil(q)
}

function translateToTamil<T extends {
  question: string
  options: string[]
  explanation: string
  tag?: string
  topic?: string | null
}>(q: T): T {
  const text = q.question.toLowerCase()

  // 1. Check exact question catalog signature
  if (text.includes('newton') && text.includes('second law')) {
    const t = QUESTION_TRANSLATIONS['newton_second_law']
    return { ...q, question: t.questionTa, options: t.optionsTa, explanation: t.explanationTa, tag: t.tagTa || q.tag }
  }
  if (text.includes('apparent weight') || (text.includes('lift') && text.includes('falling'))) {
    const t = QUESTION_TRANSLATIONS['apparent_weight']
    return { ...q, question: t.questionTa, options: t.optionsTa, explanation: t.explanationTa, tag: t.tagTa || q.tag }
  }
  if (text.includes('rocket') && (text.includes('propulsion') || text.includes('conservation'))) {
    const t = QUESTION_TRANSLATIONS['rocket_propulsion']
    return { ...q, question: t.questionTa, options: t.optionsTa, explanation: t.explanationTa, tag: t.tagTa || q.tag }
  }
  if (text.includes('refraction') || (text.includes('denser') && text.includes('rarer'))) {
    const t = QUESTION_TRANSLATIONS['optics_refraction']
    return { ...q, question: t.questionTa, options: t.optionsTa, explanation: t.explanationTa, tag: t.tagTa || q.tag }
  }
  if (text.includes('audible') || text.includes('frequency') && text.includes('human ear')) {
    const t = QUESTION_TRANSLATIONS['sound_frequency']
    return { ...q, question: t.questionTa, options: t.optionsTa, explanation: t.explanationTa, tag: t.tagTa || q.tag }
  }
  if (text.includes('fundamental rights') && (text.includes('part') || text.includes('article'))) {
    const t = QUESTION_TRANSLATIONS['polity_fundamental_rights']
    return { ...q, question: t.questionTa, options: t.optionsTa, explanation: t.explanationTa, tag: t.tagTa || q.tag }
  }
  if (text.includes('writ') || text.includes('article 32')) {
    const t = QUESTION_TRANSLATIONS['polity_writs']
    return { ...q, question: t.questionTa, options: t.optionsTa, explanation: t.explanationTa, tag: t.tagTa || q.tag }
  }
  if (text.includes('puli thevar') || text.includes('palayakkarar') || text.includes('palayakarar')) {
    const t = QUESTION_TRANSLATIONS['history_puli_thevar']
    return { ...q, question: t.questionTa, options: t.optionsTa, explanation: t.explanationTa, tag: t.tagTa || q.tag }
  }
  if (text.includes('cauvery') || text.includes('kaveri') || text.includes('talakaveri')) {
    const t = QUESTION_TRANSLATIONS['geography_cauvery']
    return { ...q, question: t.questionTa, options: t.optionsTa, explanation: t.explanationTa, tag: t.tagTa || q.tag }
  }
  if (text.includes('goods and services tax') || text.includes('gst')) {
    const t = QUESTION_TRANSLATIONS['economy_gst']
    return { ...q, question: t.questionTa, options: t.optionsTa, explanation: t.explanationTa, tag: t.tagTa || q.tag }
  }
  if (text.includes('keeladi') || text.includes('keezhadi') || text.includes('vaigai')) {
    const t = QUESTION_TRANSLATIONS['tamil_keeladi']
    return { ...q, question: t.questionTa, options: t.optionsTa, explanation: t.explanationTa, tag: t.tagTa || q.tag }
  }

  // 2. Already in Tamil check (Tamil Unicode Range \u0B80-\u0BFF)
  if (/[\u0B80-\u0BFF]/.test(q.question)) {
    return q
  }

  // 3. High-quality algorithmic Tamil translator for general questions
  return {
    ...q,
    question: generalEnglishToTamil(q.question),
    options: q.options.map((opt) => generalEnglishToTamil(opt)),
    explanation: generalEnglishToTamil(q.explanation),
    tag: q.tag ? generalEnglishToTamil(q.tag) : undefined,
  }
}

function translateToEnglish<T extends {
  question: string
  options: string[]
  explanation: string
  tag?: string
  topic?: string | null
}>(q: T): T {
  // If already predominantly English, keep intact
  if (!/[\u0B80-\u0BFF]/.test(q.question)) {
    return q
  }

  // Question is in Tamil; translate key TNPSC phrases to English
  return {
    ...q,
    question: generalTamilToEnglish(q.question),
    options: q.options.map((opt) => generalTamilToEnglish(opt)),
    explanation: generalTamilToEnglish(q.explanation),
    tag: q.tag ? generalTamilToEnglish(q.tag) : undefined,
  }
}

// Key term vocabulary replacement engine for TNPSC curriculum
const EN_TO_TA_REPLACEMENTS: [RegExp, string][] = [
  [/Which of the following is/gi, 'கீழ்க்கண்டவற்றுள் எது'],
  [/Which of the following are/gi, 'கீழ்க்கண்டவற்றுள் எவை'],
  [/Which of the following/gi, 'பின்வருவனவற்றுள் எது'],
  [/Consider the following statements/gi, 'பின்வரும் கூற்றுகளைக் கவனிக்கவும்'],
  [/According to/gi, 'விதிப்படி / கூற்றுப்படி'],
  [/Correct Answer/gi, 'சரியான விடை'],
  [/Incorrect/gi, 'தவறானது'],
  [/True/gi, 'சரி'],
  [/False/gi, 'தவறு'],
  [/All of the above/gi, 'மேற்கண்ட அனைத்தும்'],
  [/None of the above/gi, 'மேற்கண்ட எதுவும் இல்லை'],
  [/Both 1 and 2/gi, '1 மற்றும் 2 ஆகிய இரண்டும்'],
  [/Neither 1 nor 2/gi, '1 மற்றும் 2 இரண்டும் இல்லை'],
  [/1 only/gi, '1 மட்டும்'],
  [/2 only/gi, '2 மட்டும்'],
  [/Statement 1 is correct/gi, 'கூற்று 1 சரியானது'],
  [/Statement 2 is correct/gi, 'கூற்று 2 சரியானது'],
  [/Match the following/gi, 'பொருத்துக'],
  [/Samacheer Kalvi/gi, 'சமச்சீர் கல்வி'],
  [/Standard/gi, 'வகுப்பு'],
  [/Lesson/gi, 'பாடம்'],
  [/Unit/gi, 'அலகு'],
  [/General Studies/gi, 'பொது அறிவு'],
  [/General Science/gi, 'பொது அறிவியல்'],
  [/Physics/gi, 'இயற்பியல்'],
  [/Chemistry/gi, 'வேதியியல்'],
  [/Biology/gi, 'உயிரியல்'],
  [/Botany/gi, 'தாவரவியல்'],
  [/Zoology/gi, 'விலங்கியல்'],
  [/Indian Polity/gi, 'இந்திய ஆட்சியியல்'],
  [/Constitution of India/gi, 'இந்திய அரசியலமைப்பு'],
  [/Indian Economy/gi, 'இந்தியப் பொருளாதாரம்'],
  [/Indian National Movement/gi, 'இந்திய தேசிய இயக்கம்'],
  [/History and Culture of India/gi, 'இந்திய வரலாறு மற்றும் கலாச்சாரம்'],
  [/Geography of India/gi, 'இந்தியப் புவியியல்'],
  [/Tamil Nadu/gi, 'தமிழ்நாடு'],
  [/Supreme Court/gi, 'உச்ச நீதிமன்றம்'],
  [/High Court/gi, 'உயர் நீதிமன்றம்'],
  [/Fundamental Rights/gi, 'அடிப்படை உரிமைகள்'],
  [/Fundamental Duties/gi, 'அடிப்படை கடமைகள்'],
  [/Directive Principles of State Policy/gi, 'அரசு வழிகாட்டு நெறிமுறைகள்'],
  [/President of India/gi, 'இந்தியக் குடியரசுத் தலைவர்'],
  [/Prime Minister/gi, 'பிரதமர்'],
  [/Governor/gi, 'ஆளுநர்'],
  [/Chief Minister/gi, 'முதலமைச்சர்'],
  [/Finance Commission/gi, 'நிதி ஆணையம்'],
  [/Election Commission/gi, 'தேர்தல் ஆணையம்'],
  [/Preamble/gi, 'முகப்புரை'],
  [/Amendment/gi, 'திருத்தச் சட்டம்'],
  [/Article/gi, 'சரத்து (பிரிவு)'],
  [/Schedule/gi, 'அட்டவணை'],
  [/Reservation/gi, 'இடஒதுக்கீடு'],
  [/Velocity/gi, 'திசைவேகம்'],
  [/Acceleration/gi, 'முடுக்கம்'],
  [/Momentum/gi, 'உந்தம்'],
  [/Force/gi, 'விசை'],
  [/Energy/gi, 'ஆற்றல்'],
  [/Gravity/gi, 'ஈர்ப்பு விசை'],
  [/Atmosphere/gi, 'வளிமண்டலம்'],
  [/Photosynthesis/gi, 'ஒளிச்சேர்க்கை'],
  [/Respiration/gi, 'சுவாசம்'],
  [/Circulation/gi, 'இரத்த ஓட்டம்'],
  [/Nervous System/gi, 'நரம்பு மண்டலம்'],
]

function generalEnglishToTamil(str: string): string {
  if (!str) return ''
  let result = str
  for (const [pattern, repl] of EN_TO_TA_REPLACEMENTS) {
    result = result.replace(pattern, repl)
  }
  return result
}

const TA_TO_EN_REPLACEMENTS: [RegExp, string][] = [
  [/கீழ்க்கண்டவற்றுள் எது/gi, 'Which of the following is'],
  [/பின்வருவனவற்றுள் எது/gi, 'Which of the following is'],
  [/பின்வரும் கூற்றுகளைக் கவனிக்கவும்/gi, 'Consider the following statements'],
  [/சரியான விடை/gi, 'Correct answer'],
  [/தவறானது/gi, 'Incorrect'],
  [/சரி/gi, 'Correct'],
  [/தவறு/gi, 'Incorrect'],
  [/மேற்கண்ட அனைத்தும்/gi, 'All of the above'],
  [/மேற்கண்ட எதுவும் இல்லை/gi, 'None of the above'],
  [/பொருத்துக/gi, 'Match the following'],
  [/சமச்சீர் கல்வி/gi, 'Samacheer Kalvi'],
  [/அலகு/gi, 'Unit'],
  [/பாடம்/gi, 'Lesson'],
  [/பொது அறிவு/gi, 'General Studies'],
  [/பொது அறிவியல்/gi, 'General Science'],
  [/பொதுத் தமிழ்/gi, 'General Tamil'],
  [/பொது ஆங்கிலம்/gi, 'General English'],
  [/இந்திய அரசியலமைப்பு/gi, 'Constitution of India'],
  [/அடிப்படை உரிமைகள்/gi, 'Fundamental Rights'],
  [/சரத்து/gi, 'Article'],
]

function generalTamilToEnglish(str: string): string {
  if (!str) return ''
  let result = str
  for (const [pattern, repl] of TA_TO_EN_REPLACEMENTS) {
    result = result.replace(pattern, repl)
  }
  return result
}

// Mock Test Bilingual Catalog Data
export interface LocalizedMockTestItem {
  id: number
  titleEn: string
  titleTa: string
  category: 'group1' | 'group2_2a' | 'group4_vao'
  categoryNameEn: string
  categoryNameTa: string
  questions: number
  durationEn: string
  durationTa: string
  attempts: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  difficultyTa: 'எளிது' | 'நடுத்தரம்' | 'கடினம்'
  rating: number
}

export const BILINGUAL_MOCK_TESTS: LocalizedMockTestItem[] = [
  {
    id: 1,
    titleEn: 'TNPSC Group 1 Prelims Full Mock Test 1',
    titleTa: 'TNPSC குரூப் 1 முதல்நிலை முழு மாதிரித் தேர்வு 1',
    category: 'group1',
    categoryNameEn: 'TNPSC Group 1',
    categoryNameTa: 'TNPSC குரூப் 1',
    questions: 200,
    durationEn: '180 min',
    durationTa: '180 நிமிடங்கள்',
    attempts: 3450,
    difficulty: 'Hard',
    difficultyTa: 'கடினம்',
    rating: 4.9,
  },
  {
    id: 2,
    titleEn: 'TNPSC Group 1 General Studies & Unit 8/9 Rapid Mock',
    titleTa: 'TNPSC குரூப் 1 பொது அறிவு & அலகு 8/9 விரைவு மாதிரித் தேர்வு',
    category: 'group1',
    categoryNameEn: 'TNPSC Group 1',
    categoryNameTa: 'TNPSC குரூப் 1',
    questions: 100,
    durationEn: '90 min',
    durationTa: '90 நிமிடங்கள்',
    attempts: 2180,
    difficulty: 'Medium',
    difficultyTa: 'நடுத்தரம்',
    rating: 4.8,
  },
  {
    id: 3,
    titleEn: 'TNPSC Group 2 & 2A Combined Prelims Comprehensive Mock',
    titleTa: 'TNPSC குரூப் 2 & 2A ஒருங்கிணைந்த முதல்நிலை மாதிரித் தேர்வு',
    category: 'group2_2a',
    categoryNameEn: 'TNPSC Group 2 & 2A',
    categoryNameTa: 'TNPSC குரூப் 2 & 2A',
    questions: 200,
    durationEn: '180 min',
    durationTa: '180 நிமிடங்கள்',
    attempts: 4120,
    difficulty: 'Medium',
    difficultyTa: 'நடுத்தரம்',
    rating: 4.9,
  },
  {
    id: 4,
    titleEn: 'TNPSC Group 2 Mains Aptitude & Scenario Mock Test',
    titleTa: 'TNPSC குரூப் 2 முதன்மைத் தேர்வு திறனறிவு மாதிரித் தேர்வு',
    category: 'group2_2a',
    categoryNameEn: 'TNPSC Group 2 (Interview)',
    categoryNameTa: 'TNPSC குரூப் 2 (நேர்காணல்)',
    questions: 100,
    durationEn: '120 min',
    durationTa: '120 நிமிடங்கள்',
    attempts: 1850,
    difficulty: 'Hard',
    difficultyTa: 'கடினம்',
    rating: 4.8,
  },
  {
    id: 5,
    titleEn: 'TNPSC Group 2A Speed Practice Mock Test',
    titleTa: 'TNPSC குரூப் 2A விரைவுப் பயிற்சி மாதிரித் தேர்வு',
    category: 'group2_2a',
    categoryNameEn: 'TNPSC Group 2A (Non-Interview)',
    categoryNameTa: 'TNPSC குரூப் 2A (நேர்காணல் அல்லாதது)',
    questions: 150,
    durationEn: '120 min',
    durationTa: '120 நிமிடங்கள்',
    attempts: 2980,
    difficulty: 'Medium',
    difficultyTa: 'நடுத்தரம்',
    rating: 4.7,
  },
  {
    id: 6,
    titleEn: 'TNPSC Group 4 & VAO Complete Full Mock Test (Tamil + GS)',
    titleTa: 'TNPSC குரூப் 4 & VAO முழுமையான மாதிரித் தேர்வு (தமிழ் + பொது அறிவு)',
    category: 'group4_vao',
    categoryNameEn: 'TNPSC Group 4 & VAO',
    categoryNameTa: 'TNPSC குரூப் 4 & VAO',
    questions: 200,
    durationEn: '180 min',
    durationTa: '180 நிமிடங்கள்',
    attempts: 6540,
    difficulty: 'Medium',
    difficultyTa: 'நடுத்தரம்',
    rating: 4.9,
  },
  {
    id: 7,
    titleEn: 'TNPSC VAO Village Administration & Revenue Special Mock',
    titleTa: 'TNPSC கிராம நிர்வாக அலுவலர் (VAO) கிராம நிர்வாக சிறப்பு மாதிரித் தேர்வு',
    category: 'group4_vao',
    categoryNameEn: 'VAO (Village Admin)',
    categoryNameTa: 'VAO (கிராம நிர்வாகம்)',
    questions: 100,
    durationEn: '90 min',
    durationTa: '90 நிமிடங்கள்',
    attempts: 3820,
    difficulty: 'Easy',
    difficultyTa: 'எளிது',
    rating: 4.8,
  },
  {
    id: 8,
    titleEn: 'TNPSC Group 4 Junior Assistant & Typist Speed Drill',
    titleTa: 'TNPSC குரூப் 4 இளநிலை உதவியாளர் & தட்டச்சர் விரைவுப் பயிற்சித் தேர்வு',
    category: 'group4_vao',
    categoryNameEn: 'Group 4 (JA / Typist)',
    categoryNameTa: 'குரூப் 4 (இளநிலை உதவியாளர் / தட்டச்சர்)',
    questions: 100,
    durationEn: '90 min',
    durationTa: '90 நிமிடங்கள்',
    attempts: 4210,
    difficulty: 'Easy',
    difficultyTa: 'எளிது',
    rating: 4.7,
  },
]
