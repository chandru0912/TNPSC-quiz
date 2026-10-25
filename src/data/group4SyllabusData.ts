// Official TNPSC Group 4 & VAO Syllabus Data
// Source: TNPSC Combined Civil Services Examination - IV (Group-IV Services & VAO)
// Scheme of Examination: Single Paper (SSLC Standard - 200 Questions / 300 Marks / 3 Hours)
// Part A: General Tamil (பொதுத்தமிழ்) - 100 Questions (150 Marks)
// Part B: General Studies (பொது அறிவு) - 75 Questions (112.5 Marks)
// Part C: Aptitude and Mental Ability (திறனறிவு) - 25 Questions (37.5 Marks)
// Special Modules: Village Administration & Revenue Functions (VAO Special)

export interface Group4MCQ {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}

export interface Group4Lesson {
  id: string
  lessonNumber: string
  title: string
  tamilTitle?: string
  duration: string
  keyConcepts: string[]
  studyNotes: string[]
  practiceQuestions: Group4MCQ[]
}

export interface Group4Chapter {
  id: string
  chapterNumber: number
  title: string
  tamilTitle?: string
  lessons: Group4Lesson[]
}

export interface Group4Unit {
  id: number
  unitNumber: string
  title: string
  tamilTitle?: string
  questionCount: number
  standard: string
  officialTopics: string[]
  chapters: Group4Chapter[]
}

export interface Group4Subject {
  id: 'general-tamil' | 'general-studies' | 'aptitude' | 'vao-special'
  order: number
  title: string
  tamilTitle?: string
  partTag: string
  standard: string
  questionCount: number
  description: string
  accentColor: string
  units: Group4Unit[]
}

// -------------------------------------------------------------
// SUBJECT 1: General Tamil (பகுதி அ: பொதுத்தமிழ் - 100 வினாக்கள்)
// -------------------------------------------------------------
const group4GeneralTamilSubject: Group4Subject = {
  id: 'general-tamil',
  order: 1,
  title: 'General Tamil',
  tamilTitle: 'பொதுத் தமிழ் (கட்டாய மொழித் தேர்வு)',
  partTag: 'பகுதி அ • பத்தாம் வகுப்புத் தரம்',
  standard: 'SSLC Standard (பத்தாம் வகுப்புத் தரம்)',
  questionCount: 100,
  description:
    '100 வினாக்கள் / 150 மதிப்பெண்கள் கொண்ட கட்டாயத் தமிழ் மொழித் தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு: பகுதி-அ (இலக்கணம்), பகுதி-ஆ (இலக்கியம்), மற்றும் பகுதி-இ (தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும்).',
  accentColor: '#10b981',
  units: [
    {
      id: 1,
      unitNumber: 'பகுதி-அ',
      title: 'இலக்கணம் (Grammar)',
      tamilTitle: 'பகுதி அ: தமிழ் இலக்கணம்',
      questionCount: 35,
      standard: 'பத்தாம் வகுப்புத் தரம்',
      officialTopics: [
        'பொருத்துதல்: பொருத்தமான பொருளைத் தேர்வு செய்தல், புகழ் பெற்ற நூல் நூலாசிரியர்',
        'பிரித்தெழுதுக, சேர்த்தெழுதுக, எதிர்ச்சொல்லை எடுத்தெழுதுதல், பொருந்தாச் சொல்லைக் கண்டறிதல்',
        'பிழை திருத்தம்: சந்திப்பிழை நீக்குதல், ஒருமை பன்மை பிழைகள், மரபுப் பிழைகள், வழுவுச் சொற்களை நீக்குதல்',
        'வேர்ச்சொல்லைத் தேர்வு செய்தல், வேர்ச்சொல்லிலிருந்து வினைமுற்று, வினையெச்சம், பெயரெச்சம் உருவாக்குதல்',
        'அகர வரிசைப்படி சொற்களைச் சீர்செய்தல், சொல் ஒழுங்குபடுத்தி சொற்றொடராக்குதல்',
      ],
      chapters: [
        {
          id: 'g4-gt-c1',
          chapterNumber: 1,
          title: 'சொல், எழுத்து மற்றும் பிழை நீக்கம்',
          tamilTitle: 'இலக்கண விதிகள் மற்றும் பிழை திருத்தம்',
          lessons: [
            {
              id: 'g4-gt-c1-l1',
              lessonNumber: '1.1',
              title: 'வேர்ச்சொல், சந்திப்பிழை & ஒருமை-பன்மை விதிகள்',
              duration: '35 நிமிடங்கள்',
              keyConcepts: ['வேர்ச்சொல் அறிதல்', 'வல்லினம் மிகும் மிகா இடங்கள்', 'ஒருமை பன்மை வழுவமைதி', 'அகரவரிசை'],
              studyNotes: [
                'வேர்ச்சொல் என்பது ஒரு சொல்லின் அடிச்சொல் அல்லது ஏவல் வினையாக நிற்கும். எ.கா: "சென்றான்" என்பதன் வேர்ச்சொல் "செல்"; "வாழ்க" என்பதன் வேர்ச்சொல் "வாழ்".',
                'வல்லினம் மிகும் இடங்கள்: அந்த, இந்த என்னும் சுட்டுத் திரிபுகளின் பின்னும், எந்த என்னும் வினாத்திரிபின் பின்னும் வல்லினம் மிகும். (எ.கா: அந்தப் பையன், இந்தச் சிலை, எந்தக் கல்லூரி).',
                'ஒருமை-பன்மை: அஃறிணை ஒருமைக்கு "அது/வந்தது", பன்மைக்கு "அவை/வந்தன" என முடிதல் வேண்டும். (எ.கா: "குதிரைகள் ஓடின", "குதிரை ஓடியது").',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gt-q1',
                  question: '"நடந்தான்" என்னும் சொல்லின் வேர்ச்சொல் யாது?',
                  options: ['நட', 'நடந்து', 'நடக்க', 'நடத்தல்'],
                  correctAnswer: 0,
                  explanation: '"நடந்தான்" என்னும் வினைமுற்றின் ஏவல் வினையான மூல அடிச்சொல் "நட" ஆகும்.',
                },
                {
                  id: 'g4-gt-q2',
                  question: 'வல்லினம் மிகா இடங்களுள் சரியானது எது?',
                  options: ['அந்த, இந்த சுட்டுத் திரிபுகளுக்குப் பின்', 'வினைத்தொகையில்', 'இரண்டாம் வேற்றுமை உருபு வெளிப்படும் இடத்தில்', 'ஈறுகெட்ட எதிர்மறைப் பெயரெச்சத்தில்'],
                  correctAnswer: 1,
                  explanation: 'வினைத்தொகையில் வல்லினம் ஒருபோதும் மிகாது. எ.கா: ஊறுகாய், குடித்தண்ணீர், அலைகடல்.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 2,
      unitNumber: 'பகுதி-ஆ',
      title: 'இலக்கியம் (Tamil Literature)',
      tamilTitle: 'பகுதி ஆ: தமிழ் இலக்கியம்',
      questionCount: 35,
      standard: 'பத்தாம் வகுப்புத் தரம்',
      officialTopics: [
        'திருக்குறள் தொடர்பான செய்திகள், மேற்கோள்கள், 19 அதிகாரங்கள்',
        'அறநூல்கள்: நாலடியார், நான்மணிக்கடிகை, பழமொழி நானூறு, முதுமொழிக்காஞ்சி, திரிகடுகம், இன்னா நாற்பது, இனியவை நாற்பது, சிறுபஞ்சமூலம், ஏலாதி',
        'பத்துப்பாட்டு, எட்டுத்தொகை (சங்க இலக்கியங்கள்), சிலப்பதிகாரம், மணிமேகலை (ஐம்பெருங்காப்பியங்கள்)',
        'பெரியபுராணம், கம்பராமாயணம், திருவிளையாடற் புராணம், தேம்பாவணி, சீறாப்புராணம்',
      ],
      chapters: [
        {
          id: 'g4-gt-c2',
          chapterNumber: 2,
          title: 'திருக்குறள், பதினெண்கீழ்க்கணக்கு & காப்பியங்கள்',
          tamilTitle: 'சங்க இலக்கியம் முதல் காப்பியங்கள் வரை',
          lessons: [
            {
              id: 'g4-gt-c2-l1',
              lessonNumber: '2.1',
              title: 'திருக்குறள் அறநெறிகள், கம்பராமாயணம் & சிலப்பதிகாரம்',
              duration: '40 நிமிடங்கள்',
              keyConcepts: ['திருக்குறள் சிறப்புகள்', 'சிலப்பதிகாரம் - முத்தமிழ்க் காப்பியம்', 'கம்பராமாயணம் 6 காண்டங்கள்', 'நாலடியார்'],
              studyNotes: [
                'திருக்குறள் முப்பால் (அறத்துப்பால், பொருட்பால், காமத்துப்பால்) பகுப்பைக் கொண்டது. 133 அதிகாரங்களும் 1330 குறட்பாக்களும் கொண்ட உலகப் பொதுமறை.',
                'சிலப்பதிகாரம் இளங்கோவடிகளால் இயற்றப்பட்ட முதல் தமிழ்க் காப்பியம்; குடிமக்கள் காப்பியம், நாடகக் காப்பியம், முத்தமிழ்க் காப்பியம் எனப் போற்றப்படுகிறது.',
                'கம்பராமாயணம் ஆறு காண்டங்களைக் கொண்டது: பால காண்டம், அயோத்தியா காண்டம், ஆரணிய காண்டம், கிட்கிந்தா காண்டம், சுந்தர காண்டம், யுத்த காண்டம்.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gt-q3',
                  question: '"அரசியல் பிழைத்தோர்க்கு அறங்கூற்றாவதூஉம், உரைசால் பத்தினியை உயர்ந்தோர் ஏத்தலும்" - இவ்வரிகள் இடம்பெற்ற நூல் எது?',
                  options: ['மணிமேகலை', 'சிலப்பதிகாரம்', 'சீவக சிந்தாமணி', 'குண்டலகேசி'],
                  correctAnswer: 1,
                  explanation: 'இவை இளங்கோவடிகள் அருளிய சிலப்பதிகாரத்தின் பதிகத்தில் அமைந்துள்ள புகழ்பெற்ற மூன்று முக்கிய நீதிகளுள் தலையாயவையாகும்.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 3,
      unitNumber: 'பகுதி-இ',
      title: 'தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும்',
      tamilTitle: 'பகுதி இ: தமிழ்ச் சான்றோர்கள் & சமூகத் தொண்டு',
      questionCount: 30,
      standard: 'பத்தாம் வகுப்புத் தரம்',
      officialTopics: [
        'பாரதியார், பாரதிதாசன், நாமக்கல் கவிஞர், கவிமணி தேசிக விநாயகம் பிள்ளை தொடர்பான செய்திகள்',
        'உ.வே.சாமிநாதையர், தெ.பொ.மீனாட்சிசுந்தரம், சி.இலக்குவனார் தமிழ்ப்பணி',
        'தேவநேயப் பாவாணர், ஜி.யு.போப், வீரமாமுனிவர் தமிழ்த்தொண்டு',
        'தந்தை பெரியார், பேரறிஞர் அண்ணா, முத்துராமலிங்கத் தேவர், காமராசர், அம்பேத்கர் சமுதாயத் தொண்டு',
        'விடுதலைப் போராட்டத்தில் தமிழகப் பெண்கள்: வேலுநாச்சியார், அஞ்சலை அம்மாள், தில்லையாடி வள்ளியம்மை',
      ],
      chapters: [
        {
          id: 'g4-gt-c3',
          chapterNumber: 3,
          title: 'தமிழறிஞர்கள், விடுதலை வீரர்கள் & தமிழ்ப் பெண்மணிகள்',
          tamilTitle: 'சான்றோர்களின் இலக்கியம் மற்றும் விடுதலைப் பங்களிப்பு',
          lessons: [
            {
              id: 'g4-gt-c3-l1',
              lessonNumber: '3.1',
              title: 'பாரதியார், பாவேந்தர், உ.வே.சா & வீரமங்கை வேலுநாச்சியார்',
              duration: '40 நிமிடங்கள்',
              keyConcepts: ['பாரதியார் - முண்டாசுக்கவிஞர்', 'பாரதிதாசன் - புரட்சிக்கவிஞர்', 'உ.வே.சா - தமிழ்த்தாத்தா', 'வேலுநாச்சியார் - சிவகங்கை வீராங்கனை'],
              studyNotes: [
                'மகாகவி சுப்பிரமணிய பாரதியார் "பாட்டுக்கொரு புலவன் பாரதி" எனப் போற்றப்பட்டவர்; இந்தியா, விஜயா முதலிய இதழ்களை நடத்திய தேசியக் கவிஞர்.',
                'பாரதிதாசன் (சுப்புரத்தினம்) பாரதியார் மீது கொண்ட பற்றினால் தம் பெயரைப் பாரதிதாசன் என மாற்றிக் கொண்டார். குடும்ப விளக்கு, பாண்டியன் பரிசு, அழகின் சிரிப்பு முதலிய நூல்களைப் படைத்த புரட்சிக்கவிஞர்.',
                'உ.வே.சாமிநாதையர் ஓலைச்சுவடிகளைத் தேடி அலைந்து மணிமேகலை, சிலப்பதிகாரம், புறநானூறு முதலிய நூல்களை அச்சேற்றிப் பதிப்பித்த "தமிழ்த்தாத்தா" ஆவார்.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gt-q4',
                  question: '"தமிழுக்கும் அமுதென்று பேர் - அந்தத் தமிழ் இன்பத் தமிழ் எங்கள் உயிருக்கு நேர்" என்று பாடிய கவிஞர் யார்?',
                  options: ['பாரதியார்', 'பாரதிதாசன்', 'நாமக்கல் கவிஞர்', 'வாணிதாசன்'],
                  correctAnswer: 1,
                  explanation: 'இக்கவிதை வரிகள் புரட்சிக் கவிஞர் பாரதிதாசனால் இயற்றப்பட்டதாகும்.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// -------------------------------------------------------------
// SUBJECT 2: General Studies (பகுதி ஆ: பொது அறிவு - 75 வினாக்கள்)
// -------------------------------------------------------------
const group4GeneralStudiesSubject: Group4Subject = {
  id: 'general-studies',
  order: 2,
  title: 'General Studies Foundation',
  tamilTitle: 'பொது அறிவு (பத்தாம் வகுப்புத் தரம்)',
  partTag: 'பகுதி ஆ • பத்தாம் வகுப்புத் தரம்',
  standard: 'SSLC Standard (75 Questions • 112.5 Marks)',
  questionCount: 75,
  description:
    'General Science, Current Events, Geography of India & TN, History & Culture of India & TN, Indian Polity, Indian Economy, and Indian National Movement based on 6th to 10th Samacheer Kalvi textbooks.',
  accentColor: '#38bdf8',
  units: [
    {
      id: 1,
      unitNumber: 'Unit I',
      title: 'General Science & Environment',
      tamilTitle: 'அலகு I: பொது அறிவியல் மற்றும் சுற்றுச்சூழல்',
      questionCount: 15,
      standard: 'SSLC Standard',
      officialTopics: [
        'Nature of Universe, General Scientific Laws, Mechanics, Motion, Force and Energy',
        'Heat, Light, Sound, Electricity and Magnetism in everyday life',
        'Elements and Compounds, Acids, Bases and Salts, Fertilizers, Pesticides',
        'Main concepts of Life Science, Nutrition and Dietetics, Human Diseases and Hygiene',
      ],
      chapters: [
        {
          id: 'g4-gs-c1',
          chapterNumber: 1,
          title: 'Physical & Life Sciences Fundamentals',
          tamilTitle: 'இயற்பியல் மற்றும் உயிரியல் அடிப்படைகள்',
          lessons: [
            {
              id: 'g4-gs-c1-l1',
              lessonNumber: '1.1',
              title: 'Laws of Motion, Electricity, Acids-Bases & Human Health',
              duration: '35 mins',
              keyConcepts: ['Newton\'s 3 Laws', 'Ohm\'s Law (V=IR)', 'pH of Blood (7.4)', 'Deficiency Diseases'],
              studyNotes: [
                'Newton\'s first law explains inertia (resistance to change in state of motion). Second law gives Force F = m * a. Third law: to every action there is an equal and opposite reaction.',
                'Electric current is the flow of electric charge measured in Amperes (A). Ohm’s law establishes V = I * R.',
                'Acids taste sour and have pH < 7 (vinegar contains acetic acid, lemon contains citric acid). Pure water has neutral pH = 7.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q1',
                  question: 'What is the SI unit of electric current?',
                  options: ['Volt', 'Ampere', 'Ohm', 'Watt'],
                  correctAnswer: 1,
                  explanation: 'Electric current is measured in Amperes (A), named after André-Marie Ampère.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 2,
      unitNumber: 'Unit II',
      title: 'History, Polity & Indian National Movement',
      tamilTitle: 'அலகு II: வரலாறு, ஆட்சியியல் மற்றும் தேசிய இயக்கம்',
      questionCount: 35,
      standard: 'SSLC Standard',
      officialTopics: [
        'Indus Valley Civilization, Sangam Age, Chola & Pandya Empires, Vijayanagar, Mughals',
        'Constitution of India, Preamble, Fundamental Rights, Duties, Parliament, Panchayat Raj',
        'Early Uprisings against British rule (Poligars, Vellore Mutiny 1806), 1857 Revolt',
        'Indian National Congress, Role of Tamil Nadu leaders: VOC, Bharathi, Rajaji, Kamarajar',
      ],
      chapters: [
        {
          id: 'g4-gs-c2',
          chapterNumber: 2,
          title: 'Indian Constitution, Freedom Movement & Tamil Nadu Role',
          tamilTitle: 'இந்திய அரசியலமைப்பு மற்றும் விடுதலைப் போராட்டம்',
          lessons: [
            {
              id: 'g4-gs-c2-l1',
              lessonNumber: '2.1',
              title: 'Constitution Basics, 1806 Vellore Revolt & Swadeshi Movement',
              duration: '40 mins',
              keyConcepts: ['Dr. B.R. Ambedkar - Drafting Committee Chairman', 'Preamble', 'Vellore Mutiny (10 July 1806)', 'V.O. Chidambaranar Swadeshi Steam Navigation'],
              studyNotes: [
                'The Constitution of India was adopted on 26 November 1949 and came into force on 26 January 1950. Dr. B.R. Ambedkar chaired the Drafting Committee.',
                'The Vellore Mutiny broke out on 10 July 1806 against new military turban and caste-mark regulations, serving as an early precursor to the 1857 Great Revolt.',
                'V.O. Chidambaranar established the Swadeshi Steam Navigation Company in 1906 between Tuticorin and Colombo to break the British shipping monopoly.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q2',
                  question: 'In which year did the historic Vellore Sepoy Mutiny take place in Tamil Nadu?',
                  options: ['1801', '1806', '1857', '1885'],
                  correctAnswer: 1,
                  explanation: 'The Vellore Mutiny erupted on 10 July 1806 at Vellore Fort against oppressive British dress and turban codes.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 3,
      unitNumber: 'Unit III',
      title: 'Geography, Economy & TN Welfare Schemes',
      tamilTitle: 'அலகு III: புவியியல், பொருளாதாரம் மற்றும் தமிழக நலத்திட்டங்கள்',
      questionCount: 25,
      standard: 'SSLC Standard',
      officialTopics: [
        'Earth and Universe, Solar System, Monsoons, Rainfall, Rivers of India and Tamil Nadu',
        'Soils, Forests, Wildlife, Agriculture, Mineral Resources, Transport and Communication',
        'Nature of Indian Economy, Five-Year Plans, NITI Aayog, GST, Employment, Poverty',
        'Social Welfare Schemes of Tamil Nadu Government, Education, Health, and Public Distribution System',
      ],
      chapters: [
        {
          id: 'g4-gs-c3',
          chapterNumber: 3,
          title: 'Geography of Tamil Nadu & Inclusive Economic Growth',
          tamilTitle: 'தமிழ்நாடு புவியியல் மற்றும் பொருளாதாரத் திட்டங்கள்',
          lessons: [
            {
              id: 'g4-gs-c3-l1',
              lessonNumber: '3.1',
              title: 'Cauvery River, North-East Monsoon, NITI Aayog & Universal PDS',
              duration: '35 mins',
              keyConcepts: ['River Cauvery & Mettur Dam', 'North-East Monsoon (Oct-Dec)', 'NITI Aayog (2015)', 'Universal PDS & Noon Meal Programme'],
              studyNotes: [
                'River Cauvery originates at Talakaveri in the Western Ghats (Karnataka) and enters Tamil Nadu at Hogenakkal, feeding the Stanley Reservoir (Mettur Dam).',
                'Tamil Nadu is among the only states implementing a Universal Public Distribution System (PDS) providing subsidized foodgrains to all ration cardholders.',
                'The pioneering Noon Meal Scheme initiated by Kamarajar and later upgraded into the Nutritious Meal Scheme by MGR drastically improved school retention rates.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q3',
                  question: 'The Stanley Reservoir in Salem district of Tamil Nadu is built across which river?',
                  options: ['Vaigai', 'Cauvery', 'Bhavani', 'Thamirabarani'],
                  correctAnswer: 1,
                  explanation: 'The Stanley Reservoir, commonly known as Mettur Dam, is constructed across the Cauvery River in Salem district.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// -------------------------------------------------------------
// SUBJECT 3: Aptitude & Mental Ability (பகுதி இ: திறனறிவு - 25 வினாக்கள்)
// -------------------------------------------------------------
const group4AptitudeSubject: Group4Subject = {
  id: 'aptitude',
  order: 3,
  title: 'Aptitude & Mental Ability',
  tamilTitle: 'திறனறிவும் மனக்கணக்கு நுண்ணறிவும்',
  partTag: 'பகுதி இ • பத்தாம் வகுப்புத் தரம்',
  standard: 'SSLC Standard (25 Questions • 37.5 Marks)',
  questionCount: 25,
  description:
    'Quantitative Aptitude & Logical Reasoning: Simplification, Percentage, HCF & LCM, Ratio, Simple Interest, Compound Interest, Area, Volume, Time & Work, Puzzles, Dice, and Visual Reasoning.',
  accentColor: '#fbbf24',
  units: [
    {
      id: 1,
      unitNumber: 'Unit I',
      title: 'Quantitative Aptitude',
      tamilTitle: 'அலகு I: கணிதத் திறனறிவு',
      questionCount: 15,
      standard: 'SSLC Standard',
      officialTopics: [
        'Simplification, Percentage, Highest Common Factor (HCF), Lowest Common Multiple (LCM)',
        'Ratio and Proportion, Simple Interest, Compound Interest, Area, Volume, Time and Work',
      ],
      chapters: [
        {
          id: 'g4-apt-c1',
          chapterNumber: 1,
          title: 'Arithmetic Operations & Commercial Mathematics',
          tamilTitle: 'அடிப்படை கணிதம் மற்றும் வணிகக் கணக்கியல்',
          lessons: [
            {
              id: 'g4-apt-c1-l1',
              lessonNumber: '1.1',
              title: 'Simplification, HCF/LCM, Simple Interest & Unitary Work',
              duration: '35 mins',
              keyConcepts: ['BODMAS priority', 'HCF x LCM = Product of Numbers', 'SI = P*N*R / 100', 'Work = Rate x Time'],
              studyNotes: [
                'BODMAS: Brackets first, then Orders, Division, Multiplication, Addition, and Subtraction.',
                'The product of two positive integers is equal to the product of their HCF and LCM: A * B = HCF(A, B) * LCM(A, B).',
                'Simple Interest formula: SI = (P * N * R) / 100, where P = Principal, N = Number of years, R = Annual interest rate.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-apt-q1',
                  question: 'Find the Simple Interest on Rs. 5,000 for 2 years at an annual interest rate of 10%:',
                  options: ['Rs. 500', 'Rs. 1,000', 'Rs. 1,200', 'Rs. 1,500'],
                  correctAnswer: 1,
                  explanation: 'SI = (P * N * R) / 100 = (5000 * 2 * 10) / 100 = 100,000 / 100 = Rs. 1,000.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 2,
      unitNumber: 'Unit II',
      title: 'Mental Ability & Logical Reasoning',
      tamilTitle: 'அலகு II: தருக்கக் காரணவியல் & நுண்ணறிவு',
      questionCount: 10,
      standard: 'SSLC Standard',
      officialTopics: [
        'Logical Reasoning, Puzzles, Dice, Visual Reasoning, Alpha Numeric Reasoning, Number Series',
      ],
      chapters: [
        {
          id: 'g4-apt-c2',
          chapterNumber: 2,
          title: 'Logical Reasoning, Number Series & Dice',
          tamilTitle: 'தருக்கக் காரணவியல் மற்றும் எண் வரிசை',
          lessons: [
            {
              id: 'g4-apt-c2-l1',
              lessonNumber: '2.1',
              title: 'Missing Number Series, Letter Coding & Dice Face Analysis',
              duration: '30 mins',
              keyConcepts: ['Arithmetic & Geometric progressions', 'Standard Dice Opposite Faces Sum = 7', 'Alphabet Coding Patterns'],
              studyNotes: [
                'In standard playing dice, opposite numbers always sum up to 7: 1 opposite 6, 2 opposite 5, 3 opposite 4.',
                'Number series strategies involve analyzing prime numbers, differences between consecutive terms, square numbers (n^2), and cube patterns (n^3).',
              ],
              practiceQuestions: [
                {
                  id: 'g4-apt-q2',
                  question: 'Complete the sequence: 3, 7, 15, 31, 63, ___',
                  options: ['95', '127', '129', '144'],
                  correctAnswer: 1,
                  explanation: 'Each term follows the pattern (previous term * 2) + 1: (63 * 2) + 1 = 126 + 1 = 127.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// -------------------------------------------------------------
// SUBJECT 4: Village Administration & Special Services (VAO Special)
// -------------------------------------------------------------
const group4VAOSubject: Group4Subject = {
  id: 'vao-special',
  order: 4,
  title: 'Village Administration & Office Procedures',
  tamilTitle: 'கிராம நிருவாகம் & அரசு அலுவலக நடைமுறைகள் (VAO & JA சிறப்பு)',
  partTag: 'VAO & இளநிலை உதவியாளர் சிறப்புத் தொகுதி',
  standard: 'Official Tamil Nadu Revenue & Secretariat Manual',
  questionCount: 20,
  description:
    'Dedicated module for VAO and Junior Assistant candidates: Duties of Village Administrative Officer, Jamabandi, Land Records (Patta, Chitta, Adangal), FMB sketch, RTI Act 2005, and Government Order (G.O.) filing procedures.',
  accentColor: '#a855f7',
  units: [
    {
      id: 1,
      unitNumber: 'Unit I',
      title: 'Village Administration & Revenue Records',
      tamilTitle: 'அலகு I: கிராம நிருவாகம் மற்றும் நில ஆவணங்கள்',
      questionCount: 10,
      standard: 'Tamil Nadu Revenue Board Standing Orders (BSO)',
      officialTopics: [
        'Role and Duties of Village Administrative Officer (VAO) under Revenue Department',
        'Village Accounts: Adangal (Account No. 2), Chitta, Record of Rights, Patta Pass Book',
        'Jamabandi: Annual inspection of village accounts by Revenue Divisional Officer (RDO)',
        'Land Classification: Nanjai (wetland), Punjai (dryland), Poramboke, Tharisu',
      ],
      chapters: [
        {
          id: 'g4-vao-c1',
          chapterNumber: 1,
          title: 'VAO Duties, Land Accounts & Jamabandi',
          tamilTitle: 'கிராமக் கணக்குகள் மற்றும் வருவாய்த் துறை நடைமுறைகள்',
          lessons: [
            {
              id: 'g4-vao-c1-l1',
              lessonNumber: '1.1',
              title: 'Village Accounts, Chitta, Adangal & Vital Statistics Registration',
              duration: '35 mins',
              keyConcepts: [
                'VAO: Primary Revenue Representative in Village',
                'Village Account No. 2 (Adangal - Crop cultivation register)',
                'Chitta: Land ownership ledger',
                'Birth and Death Registration (within 21 days)',
              ],
              studyNotes: [
                'The Village Administrative Officer (VAO) is the head of the village revenue administration, responsible for maintaining 24 village accounts, collecting land revenue, and reporting vital statistics.',
                'Village Account No. 2 (Adangal) records crop cultivation details, water sources, and soil classification for every survey sub-division in the village.',
                'Births and deaths occurring in the village jurisdiction must be reported and registered with the VAO within 21 days from the date of occurrence without fine.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-vao-q1',
                  question: 'Which village account maintained by the Village Administrative Officer details crop cultivation and land harvest data?',
                  options: ['Account No. 1', 'Account No. 2 (Adangal)', 'Account No. 3', 'Account No. 10 (Chitta)'],
                  correctAnswer: 1,
                  explanation: 'Village Account No. 2, known as Adangal, contains the detailed record of crop cultivation and harvest information for all survey numbers.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 2,
      unitNumber: 'Unit II',
      title: 'Secretariat Procedures & Official Drafting',
      tamilTitle: 'அலகு II: தலைமைச் செயலக அலுவலக நடைமுறைகள்',
      questionCount: 10,
      standard: 'Tamil Nadu Secretariat Manual & General Administration',
      officialTopics: [
        'Office Procedures: Inward/Outward register, Personal Register (PR), Call Book',
        'Government Orders (G.O.), Government Letters, Office Memorandum (O.M.), Endorsement',
        'Right to Information (RTI) Act 2005: Public Information Officer, Appeal period (30 days)',
        'Citizen Charter and e-Seva Governance initiatives of Tamil Nadu Government',
      ],
      chapters: [
        {
          id: 'g4-vao-c2',
          chapterNumber: 2,
          title: 'Office File Tracking, RTI 2005 & Citizen Charter',
          tamilTitle: 'கோப்பு மேலாண்மை மற்றும் தகவல் அறியும் உரிமைச் சட்டம்',
          lessons: [
            {
              id: 'g4-vao-c2-l1',
              lessonNumber: '2.1',
              title: 'Personal Register, Government Orders (G.O.) & RTI Filing Rules',
              duration: '35 mins',
              keyConcepts: [
                'Personal Register (PR) maintained by Junior Assistant',
                'G.O. Ms. (Manuscript) vs G.O. Rt. (Routine)',
                'RTI Act Section 6(1) & 30-day response mandate',
                'Tamil Nadu e-Governance Agency (TNeGA)',
              ],
              studyNotes: [
                'Every assistant/clerk in government offices maintains a Personal Register (PR) to record the receipt, processing stages, and final disposal of official communications.',
                'Under the RTI Act 2005, the Public Information Officer (PIO) must furnish information requested under Section 6(1) within 30 days of receiving the application (or within 48 hours if related to life and liberty).',
                'Government Orders (G.O.) are formal executive orders issued in the name of the Governor of Tamil Nadu, classified as G.O. Ms (policy decisions) or G.O. Rt (routine sanctions).',
              ],
              practiceQuestions: [
                {
                  id: 'g4-vao-q2',
                  question: 'Under the Right to Information Act 2005, within how many days must a Public Information Officer (PIO) provide requested information in normal cases?',
                  options: ['15 days', '30 days', '45 days', '60 days'],
                  correctAnswer: 1,
                  explanation: 'Under Section 7(1) of the RTI Act 2005, the PIO is required to provide the information within 30 days of receiving the request.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// -------------------------------------------------------------
// The 4 official Subject Sections for Group 4 & VAO:
// 1. General Tamil
// 2. General Studies Foundation
// 3. Aptitude & Mental Ability
// 4. Village Administration & Office Procedures
// -------------------------------------------------------------
export const group4Subjects: Group4Subject[] = [
  group4GeneralTamilSubject,
  group4GeneralStudiesSubject,
  group4AptitudeSubject,
  group4VAOSubject,
]

export const getGroup4SubjectById = (id: string): Group4Subject | undefined => {
  return group4Subjects.find((s) => s.id === id)
}

export const getTotalGroup4Questions = (): number => {
  return group4Subjects.reduce((acc, s) => acc + s.questionCount, 0)
}
