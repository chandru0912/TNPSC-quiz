// Official TNPSC Group 4 & VAO Syllabus Data
// Source: Combined Civil Services Examination – IV (Group IV Services) (Code: 496, Dated: 12.12.2024)
// Scheme: Single Paper in SSLC Standard consisting of:
// Part A: General Studies (75 Questions)
// Part B: Aptitude and Mental Ability (25 Questions)
// Part C: Tamil Eligibility-cum-Scoring Test (100 Questions) / General English (100 Questions)
// Total: 200 Questions / 300 Marks / 3 Hours

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
  id: 'general-studies' | 'aptitude' | 'general-tamil' | 'general-english'
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

// ============================================================================
// SUBJECT 1: General Studies (Part A: SSLC Standard – 75 Questions)
// ============================================================================
export const group4GeneralStudiesSubject: Group4Subject = {
  id: 'general-studies',
  order: 1,
  title: 'General Studies',
  tamilTitle: 'பொது அறிவு (பத்தாம் வகுப்புத் தரம்)',
  partTag: 'Part A • SSLC Standard',
  standard: 'SSLC Standard (75 Questions • 112.5 Marks)',
  questionCount: 75,
  description:
    'Official TNPSC Group 4 preliminary syllabus covering General Science (5 Qs), Geography (5 Qs), History & Culture of India and INM (10 Qs), Indian Polity (15 Qs), Indian Economy & Development Administration in TN (20 Qs), and History, Culture, Heritage & Socio-Political Movements of Tamil Nadu (20 Qs).',
  accentColor: '#38bdf8',
  units: [
    {
      id: 1,
      unitNumber: 'Unit I',
      title: 'General Science',
      tamilTitle: 'அலகு I: பொது அறிவியல்',
      questionCount: 5,
      standard: 'SSLC Standard (5 Questions)',
      officialTopics: [
        'Nature of Universe - Measurement of physical quantities - General scientific laws in motion - force, pressure, and energy',
        'Everyday application of the basic principles of mechanics, electricity, magnetism, light, sound, heat, and nuclear physics in our daily life',
        'Elements and compounds, acids, bases, salts, petroleum products, fertilizers, pesticides, metallurgy, and food adulterants',
        'Main concepts of life science, classification of living organisms, evolution, genetics, physiology, nutrition, health and hygiene, human diseases',
        'Environmental science; Latest inventions in science and technology; Current affairs',
      ],
      chapters: [
        {
          id: 'g4-gs-u1-c1',
          chapterNumber: 1,
          title: 'Physics & Laws of Motion in Everyday Life',
          tamilTitle: 'இயற்பியல் மற்றும் இயக்க விதிகள்',
          lessons: [
            {
              id: 'g4-gs-u1-c1-l1',
              lessonNumber: '1.1',
              title: 'Laws of Motion, Force, Pressure, and Gravitation',
              duration: '35 mins',
              keyConcepts: ["Newton's Laws of Motion", 'Force and Inertia', 'Pascal’s Principle of Pressure', 'Archimedes Principle'],
              studyNotes: [
                "Newton's First Law (Law of Inertia) states that an object continues in its state of rest or uniform motion unless acted upon by an external unbalanced force.",
                "Newton's Second Law provides the quantitative definition of force: F = ma (Force = mass × acceleration). The SI unit of force is the Newton (N).",
                'Pascal’s Law states that pressure applied to an enclosed liquid is transmitted equally in all directions. Applications include hydraulic lifts and hydraulic brakes.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q1',
                  question: 'Which law of physics serves as the operating principle behind hydraulic brakes in automobiles?',
                  options: ["Bernoulli's Principle", "Pascal's Law", "Archimedes' Principle", "Newton's Third Law"],
                  correctAnswer: 1,
                  explanation: "Pascal's Law states that pressure applied to an enclosed fluid is transmitted undiminished in every direction, which is the foundational principle of hydraulic brakes.",
                },
                {
                  id: 'g4-gs-q2',
                  question: 'What is the SI unit of gravitational acceleration (g) near the Earth’s surface?',
                  options: ['m/s', 'm/s²', 'N·m', 'kg·m/s'],
                  correctAnswer: 1,
                  explanation: 'Gravitational acceleration (g = 9.8 m/s²) is measured in meters per second squared (m/s²).',
                },
              ],
            },
            {
              id: 'g4-gs-u1-c1-l2',
              lessonNumber: '1.2',
              title: 'Light, Sound, Heat, Electricity, and Magnetism',
              duration: '40 mins',
              keyConcepts: ['Reflection & Refraction', 'Total Internal Reflection in Optical Fibres', 'Ohm’s Law & Electric Power', 'Electromagnetism'],
              studyNotes: [
                'Total internal reflection occurs when light travels from a denser to a rarer medium at an angle of incidence greater than the critical angle. Key application: Optical fibers and endoscopy.',
                "Ohm's Law: V = IR (Voltage = Current × Resistance). The electric power consumed is given by P = VI = I²R.",
                'Sound waves are longitudinal mechanical waves requiring a material medium for propagation, whereas light waves are transverse electromagnetic waves that can travel through vacuum.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q3',
                  question: 'On which optical phenomenon does high-speed optical fiber communication rely?',
                  options: ['Refraction', 'Total Internal Reflection', 'Diffraction', 'Dispersion'],
                  correctAnswer: 1,
                  explanation: 'Optical fibers transmit data packets at the speed of light through the core via repeated Total Internal Reflection.',
                },
              ],
            },
          ],
        },
        {
          id: 'g4-gs-u1-c2',
          chapterNumber: 2,
          title: 'Chemistry & Everyday Substances',
          tamilTitle: 'வேதியியல் மற்றும் அன்றாடப் பயன்பாடுகள்',
          lessons: [
            {
              id: 'g4-gs-u1-c2-l1',
              lessonNumber: '2.1',
              title: 'Acids, Bases, Salts, Fertilizers, and Food Adulteration',
              duration: '35 mins',
              keyConcepts: ['pH scale & Indicators', 'Chemical Formulae of Salts', 'NPK Fertilizers', 'Common Adulterants'],
              studyNotes: [
                'The pH scale ranges from 0 to 14. Neutral water is 7, human blood is slightly alkaline at 7.35–7.45, and acid rain has a pH below 5.6.',
                'Bleaching powder is Calcium hypochlorite (CaOCl₂), Plaster of Paris is Calcium sulphate hemihydrate (CaSO₄·½H₂O), and Baking Soda is Sodium bicarbonate (NaHCO₃).',
                'NPK represents Nitrogen (leaf growth), Phosphorus (root & flower development), and Potassium (disease resistance and overall vigour).',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q4',
                  question: 'What is the chemical name and formula of Baking Soda?',
                  options: ['Sodium carbonate (Na₂CO₃)', 'Sodium bicarbonate (NaHCO₃)', 'Calcium hydroxide (Ca(OH)₂)', 'Sodium chloride (NaCl)'],
                  correctAnswer: 1,
                  explanation: 'Baking Soda is Sodium bicarbonate with chemical formula NaHCO₃, widely used in cooking and fire extinguishers.',
                },
              ],
            },
          ],
        },
        {
          id: 'g4-gs-u1-c3',
          chapterNumber: 3,
          title: 'Life Science, Physiology & Human Diseases',
          tamilTitle: 'உயிரியல், மனித உடலியல் மற்றும் நோய்கள்',
          lessons: [
            {
              id: 'g4-gs-u1-c3-l1',
              lessonNumber: '3.1',
              title: 'Human Physiology, Nutrition, Vitamins, and Deficiency Diseases',
              duration: '40 mins',
              keyConcepts: ['Cell Structure', 'Vitamins A, B, C, D, E, K', 'Deficiency Diseases', 'Pathogens & Immunity'],
              studyNotes: [
                'Vitamin A deficiency causes Night Blindness; Vitamin B1 causes Beri-beri; Vitamin C deficiency causes Scurvy; Vitamin D deficiency causes Rickets in children.',
                'Mitochondria are the powerhouses of the cell where ATP is produced through cellular respiration.',
                'Insulin is secreted by Beta cells of the Islets of Langerhans in the pancreas; deficiency causes Diabetes Mellitus.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q5',
                  question: 'Deficiency of Vitamin C leads to which of the following diseases?',
                  options: ['Beri-beri', 'Night Blindness', 'Scurvy', 'Rickets'],
                  correctAnswer: 2,
                  explanation: 'Vitamin C (Ascorbic acid) deficiency causes Scurvy, characterized by bleeding gums and delayed wound healing.',
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
      title: 'Geography',
      tamilTitle: 'அலகு II: புவியியல்',
      questionCount: 5,
      standard: 'SSLC Standard (5 Questions)',
      officialTopics: [
        'Earth location - Physical features - Monsoon, rainfall, weather, and climate',
        'Water resources - Rivers - Soil, Minerals, and Natural resources',
        'Forest and Wildlife - Agriculture pattern - Transport - Communication',
        'Population density and distribution in Tamil Nadu and India',
        'Calamities - Disaster management - Environment - Climate change - Geographical landmarks - Current affairs',
      ],
      chapters: [
        {
          id: 'g4-gs-u2-c1',
          chapterNumber: 1,
          title: 'Physical Geography, Monsoon & Rivers of India and TN',
          tamilTitle: 'இயற்கை அமைப்புகள், பருவமழை மற்றும் நதிகள்',
          lessons: [
            {
              id: 'g4-gs-u2-c1-l1',
              lessonNumber: '1.1',
              title: 'Monsoon Patterns, Rivers of Tamil Nadu, and Soils',
              duration: '35 mins',
              keyConcepts: ['South-West & North-East Monsoon', 'Cauvery River Basin', 'Alluvial, Black, and Red Soils', 'Coromandel Coast'],
              studyNotes: [
                'Tamil Nadu receives the maximum rainfall (nearly 48%) during the North-East Monsoon (retreating monsoon) during October–December.',
                'The Cauvery River originates at Talakaveri in the Brahmagiri Hills of the Western Ghats (Karnataka) and enters Tamil Nadu at Hogenakkal Falls in Dharmapuri district.',
                'Black soil (Regur soil) is ideal for cotton cultivation and is prevalent in Coimbatore, Tirunelveli, and Virudhunagar districts.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q6',
                  question: 'During which monsoon season does the coastal state of Tamil Nadu receive the majority of its annual rainfall?',
                  options: ['South-West Monsoon', 'North-East Monsoon', 'Summer convectional rain', 'Western Disturbances'],
                  correctAnswer: 1,
                  explanation: 'Tamil Nadu is located in the rain-shadow region of the Western Ghats for the SW monsoon and gets nearly half its rainfall from the North-East Monsoon.',
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
      title: 'History, Culture of India & Indian National Movement',
      tamilTitle: 'அலகு III: இந்தியாவின் வரலாறு, பண்பாடு மற்றும் இந்திய தேசிய இயக்கம்',
      questionCount: 10,
      standard: 'SSLC Standard (10 Questions)',
      officialTopics: [
        'Indus Valley Civilization - Guptas, Delhi Sultans, Mughals, and Marathas – South Indian History',
        'National Renaissance - Early uprising against British Rule - Indian National Congress',
        'Emergence of Leaders - B.R.Ambedkar, Bhagat Singh, Bharathiar, V.O.Chidambaranar, Thanthai Periyar, Jawaharlal Nehru, Rabindranath Tagore, Kamarajar, Mahatma Gandhi, Maulana Abul Kalam Azad, Rajaji, Subhash Chandra Bose, Muthulaksmi Ammaiyar, Muvalur Ramamirtham, and other National Leaders',
        'Different modes of agitation of Tamil Nadu and movements; Characteristics of Indian Culture, Unity in Diversity - Race, Language, Custom; India as a secular state',
      ],
      chapters: [
        {
          id: 'g4-gs-u3-c1',
          chapterNumber: 1,
          title: 'Indus Valley, Guptas, Delhi Sultanate & South Indian Dynasties',
          tamilTitle: 'சிந்து சமவெளி முதல் தென் இந்திய வரலாறு வரை',
          lessons: [
            {
              id: 'g4-gs-u3-c1-l1',
              lessonNumber: '1.1',
              title: 'Harappan Civilization, Cholas, Pandyas, and Pallavas',
              duration: '40 mins',
              keyConcepts: ['Great Bath of Mohenjodaro', 'Chola Local Self-Government (Uttiramerur)', 'Brihadisvara Temple', 'Pallava Rock Cut Architecture'],
              studyNotes: [
                'The Indus Valley Civilization was a Bronze Age urban civilization known for town planning, grid system, baked brick houses, and underground drainage systems.',
                'The Uttiramerur Inscriptions of Parantaka Chola I (919 and 921 AD) provide detailed evidence of the Kudavolai village assembly election system.',
                'Rajaraja Chola I built the Brihadisvara Temple (Big Temple) in Thanjavur, completed in 1010 AD.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q7',
                  question: 'The Kudavolai electoral system for village assemblies in ancient Tamil Nadu is described in which famous Chola inscription?',
                  options: ['Thiruvannamalai Inscription', 'Uttiramerur Inscription', 'Manur Inscription', 'Sittannavasal Inscription'],
                  correctAnswer: 1,
                  explanation: 'The Uttiramerur Inscriptions of Parantaka Chola I elaborate on village administrative councils (Variyams) and election by lot (Kudavolai).',
                },
              ],
            },
          ],
        },
        {
          id: 'g4-gs-u3-c2',
          chapterNumber: 2,
          title: 'Indian National Movement & Leaders of Tamil Nadu',
          tamilTitle: 'இந்திய தேசிய இயக்கம் மற்றும் விடுதலை வீரர்கள்',
          lessons: [
            {
              id: 'g4-gs-u3-c2-l1',
              lessonNumber: '2.1',
              title: '1857 Revolt, Early Resistance, V.O.C., Bharathiar & Kamaraj',
              duration: '45 mins',
              keyConcepts: ['Vellore Sepoy Mutiny 1806', 'V.O. Chidambaranar - Swadeshi Steam Navigation Company', 'Subramania Bharathiar', 'Perarignar Anna & Kamarajar'],
              studyNotes: [
                'The Vellore Mutiny broke out on July 10, 1806, against British dress codes, precursor to the Great Revolt of 1857.',
                'V.O. Chidambaranar launched the Swadeshi Steam Navigation Company in 1906 between Tuticorin and Colombo to break the British shipping monopoly.',
                'K. Kamaraj served as Chief Minister of Tamil Nadu (1954–1963) and introduced the historic Free Midday Meals Scheme in schools.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q8',
                  question: 'Who founded the Swadeshi Steam Navigation Company in 1906 between Tuticorin and Colombo?',
                  options: ['Subramania Siva', 'V.O. Chidambaranar', 'Vanchinathan', 'Tiruppur Kumaran'],
                  correctAnswer: 1,
                  explanation: 'V.O. Chidambaranar (Kappalottiya Thamizhan) purchased two ships, S.S. Galia and S.S. Lawoe, to pioneer Indian maritime enterprise.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 4,
      unitNumber: 'Unit IV',
      title: 'Indian Polity',
      tamilTitle: 'அலகு IV: இந்திய ஆட்சியியல்',
      questionCount: 15,
      standard: 'SSLC Standard (15 Questions)',
      officialTopics: [
        'Constitution of India - Preamble to the Constitution – Salient features of the Constitution - Union, State, and Union Territory',
        'Citizenship, Fundamental Rights, Fundamental Duties, Directive Principles of State Policy',
        'Union Executive, Union Legislature – State Executive, State Legislature - Local Governments, Panchayat Raj',
        'Spirit of federalism: Centre - State relationships; Election - Judiciary in India - Rule of Law',
        'Corruption in public life - Anti-Corruption measures - Lokpal and Lokayukta – Right to Information - Empowerment of Women - Consumer Protection Forums - Human Rights Charter; Political parties and political system in Tamil Nadu and India; Current affairs',
      ],
      chapters: [
        {
          id: 'g4-gs-u4-c1',
          chapterNumber: 1,
          title: 'Preamble, Fundamental Rights & Duties, DPSP',
          tamilTitle: 'முகவுரை, அடிப்படை உரிமைகள் & கடமைகள்',
          lessons: [
            {
              id: 'g4-gs-u4-c1-l1',
              lessonNumber: '1.1',
              title: 'Preamble, Articles 12–35 (FR), and Articles 36–51 (DPSP)',
              duration: '45 mins',
              keyConcepts: ['Preamble keywords: Sovereign, Socialist, Secular, Democratic, Republic', 'Article 21: Right to Life', 'Article 32: Constitutional Remedies', 'Article 51A: Fundamental Duties'],
              studyNotes: [
                'The Preamble is called the "Soul of the Constitution" by Thakurdas Bhargava and "Key to the Constitution" by Sir Ernest Barker.',
                'Dr. B.R. Ambedkar termed Article 32 (Right to Constitutional Remedies through Writs) as the "Heart and Soul of the Constitution".',
                'Part IV Directive Principles of State Policy (Articles 36–51) borrowed from the Irish Constitution aim to establish a Welfare State.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q9',
                  question: 'Which Article of the Indian Constitution was described by Dr. B.R. Ambedkar as the "Heart and Soul of the Constitution"?',
                  options: ['Article 14', 'Article 19', 'Article 21', 'Article 32'],
                  correctAnswer: 3,
                  explanation: 'Article 32 provides the right to move the Supreme Court by appropriate proceedings for the enforcement of Fundamental Rights.',
                },
              ],
            },
          ],
        },
        {
          id: 'g4-gs-u4-c2',
          chapterNumber: 2,
          title: 'Legislature, Executive, Judiciary & Panchayat Raj',
          tamilTitle: 'சட்டமன்றம், நிர்வாகம், நீதித்துறை & உள்ளாட்சி',
          lessons: [
            {
              id: 'g4-gs-u4-c2-l1',
              lessonNumber: '2.1',
              title: 'President, Prime Minister, Governor, Supreme Court & 73rd/74th Amendments',
              duration: '45 mins',
              keyConcepts: ['Presidential Powers & Emergency Provisions (352, 356, 360)', 'Parliamentary System', '73rd Amendment 1992 (Panchayat Raj)', 'RTI Act 2005 & Lokpal'],
              studyNotes: [
                'The 73rd Constitutional Amendment Act 1992 added Part IX and the 11th Schedule containing 29 functional items for Panchayats.',
                'The Right to Information (RTI) Act 2005 requires public authorities to respond to citizen information requests within 30 days (48 hours for life & liberty).',
                'National Emergency is declared under Article 352, President’s Rule in States under Article 356, and Financial Emergency under Article 360.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q10',
                  question: 'Which Constitutional Amendment Act granted constitutional status to Panchayati Raj institutions in India?',
                  options: ['42nd Amendment', '44th Amendment', '73rd Amendment', '86th Amendment'],
                  correctAnswer: 2,
                  explanation: 'The 73rd Amendment Act 1992 inserted Part IX and the Eleventh Schedule to establish a uniform 3-tier Panchayati Raj system.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 5,
      unitNumber: 'Unit V',
      title: 'Indian Economy & Development Administration in Tamil Nadu',
      tamilTitle: 'அலகு V: இந்தியப் பொருளாதாரம் மற்றும் தமிழகத்தில் வளர்ச்சி நிர்வாகம்',
      questionCount: 20,
      standard: 'SSLC Standard (20 Questions)',
      officialTopics: [
        'Nature of Indian economy - Five-year plan models - an assessment - Planning Commission and Niti Aayog',
        'Sources of revenue - Reserve Bank of India - Finance Commission - Resource sharing between Union and State Governments - Goods and Services Tax',
        'Economic trends - Employment generation, Land reforms and Agriculture - Application of Science and Technology in Agriculture',
        'Industrial growth - Rural Welfare oriented programmes - Social problems – Population, Education, Health, Employment, Poverty',
        'Social Justice and Social Harmony as the cornerstones of socio-economic development; Education and Health systems in Tamil Nadu; Geography of Tamil Nadu and its impact on economic growth; Welfare schemes of Government; Current socio-economic issues; Current affairs',
      ],
      chapters: [
        {
          id: 'g4-gs-u5-c1',
          chapterNumber: 1,
          title: 'Planning, NITI Aayog, Fiscal Policy, RBI & GST',
          tamilTitle: 'திட்டக்குழு, நிதி ஆயோக், ரிசர்வ் வங்கி மற்றும் ஜி.எஸ்.டி',
          lessons: [
            {
              id: 'g4-gs-u5-c1-l1',
              lessonNumber: '1.1',
              title: 'Five Year Plans, NITI Aayog, Monetary Policy & GST Framework',
              duration: '45 mins',
              keyConcepts: ['Planning Commission (1950) vs NITI Aayog (Jan 1, 2015)', 'RBI Monetary Policy: Repo & Reverse Repo', 'Goods and Services Tax (July 1, 2017)', 'Finance Commission Article 280'],
              studyNotes: [
                'NITI Aayog (National Institution for Transforming India) replaced the Planning Commission on January 1, 2015, operating on bottom-up cooperative federalism.',
                'The Goods and Services Tax (GST) was introduced via the 101st Constitutional Amendment Act on July 1, 2017, subsuming various indirect taxes.',
                'The Reserve Bank of India (established April 1, 1935 under the RBI Act 1934, nationalized in 1949) regulates monetary liquidity using policy rates like Repo Rate.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q11',
                  question: 'On which date did NITI Aayog replace the Planning Commission of India?',
                  options: ['January 1, 2014', 'January 1, 2015', 'August 15, 2014', 'April 1, 2015'],
                  correctAnswer: 1,
                  explanation: 'NITI Aayog was formed on January 1, 2015 via a Cabinet resolution to serve as the premier policy think tank of the Government of India.',
                },
              ],
            },
          ],
        },
        {
          id: 'g4-gs-u5-c2',
          chapterNumber: 2,
          title: 'Tamil Nadu Socio-Economic Model, Welfare & Healthcare',
          tamilTitle: 'தமிழகத்தின் வளர்ச்சி மாதிரி மற்றும் நலத்திட்டங்கள்',
          lessons: [
            {
              id: 'g4-gs-u5-c2-l1',
              lessonNumber: '2.1',
              title: 'Dravidian Model of Development, Midday Meals, Pudhumai Penn & Industrial Clusters',
              duration: '45 mins',
              keyConcepts: ['Dravidian Model of Growth with Equity', 'Midday Meal to Nutritious Meal Scheme', 'Pudhumai Penn & Moovalur Ramamirtham Scheme', 'Tamil Nadu Industrial Corridors (SIPCOT, TIDCO)'],
              studyNotes: [
                'Tamil Nadu ranks among the top Indian states in Gross Enrolment Ratio (GER) in higher education (~51.4%) compared to the national average of ~27%.',
                'Chief Minister’s Breakfast Scheme (Kaalai Unavu Thittam) was introduced to eliminate classroom hunger in government primary schools.',
                'The Pudhumai Penn scheme provides financial assistance of ₹1,000 per month to girl students from government schools pursuing higher education.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q12',
                  question: 'What is the monthly financial incentive provided to eligible female college students under the Moovalur Ramamirtham Ammaiyar "Pudhumai Penn" Scheme?',
                  options: ['₹500', '₹750', '₹1,000', '₹1,500'],
                  correctAnswer: 2,
                  explanation: 'Under the Pudhumai Penn Scheme, female students who studied in government schools from classes 6 to 12 receive ₹1,000 per month for their undergraduate studies.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 6,
      unitNumber: 'Unit VI',
      title: 'History, Culture, Heritage & Socio-Political Movements of Tamil Nadu',
      tamilTitle: 'அலகு VI: தமிழ்நாட்டின் வரலாறு, பண்பாடு, மரபு மற்றும் சமூக - அரசியல் இயக்கங்கள்',
      questionCount: 20,
      standard: 'SSLC Standard (20 Questions)',
      officialTopics: [
        'History of Tamil Society, related archaeological discoveries - Tamil Literature from Sangam age till contemporary times',
        'Thirukkural - Significance as a Secular Literature - Relevance to everyday life - Impact of Thirukkural on Humanity - Thirukkural and Universal Values – Relevance to Socio-politico-economic affairs - Philosophical content in Thirukkural',
        'Role of Tamil Nadu in freedom struggle - Early agitations against British Rule - Role of women in freedom struggle; Various Social reformers, Social reform movements and Social transformation of Tamil Nadu',
      ],
      chapters: [
        {
          id: 'g4-gs-u6-c1',
          chapterNumber: 1,
          title: 'Archaeological Excavations & Sangam Heritage',
          tamilTitle: 'தொல்லியல் அகழாய்வுகள் & சங்க காலம்',
          lessons: [
            {
              id: 'g4-gs-u6-c1-l1',
              lessonNumber: '1.1',
              title: 'Keeladi, Adichanallur, Kodumanal, Porunai & Sangam Polity',
              duration: '45 mins',
              keyConcepts: ['Keeladi Excavations in Sivagangai', 'Tamil-Brahmi Script Dating (6th Century BCE)', 'Adichanallur Urn Burials', 'Sangam Literary Corpus: Ettuthogai & Pattupattu'],
              studyNotes: [
                'Carbon dating of artifacts from Keeladi (Sivagangai district) proves that an urban civilization flourished on the Vaigai river basin as early as the 6th century BCE (580 BCE).',
                'Adichanallur in Thoothukudi district yielded significant iron tools, bronze artifacts, and urn burials.',
                'The Sangam Age political landscape was dominated by the Muvendhar: Cheras (Vanji, Bow & Arrow), Cholas (Uraiyur/Poompuhar, Tiger), and Pandyas (Madurai, Carp Fish).',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q13',
                  question: 'The Keeladi archaeological excavations on the Vaigai River basin are located in which district of Tamil Nadu?',
                  options: ['Madurai', 'Sivagangai', 'Theni', 'Ramanathapuram'],
                  correctAnswer: 1,
                  explanation: 'Keeladi is located in Sivagangai district near Madurai, revealing evidence of an advanced 6th century BCE urban agrarian and trading civilization.',
                },
              ],
            },
          ],
        },
        {
          id: 'g4-gs-u6-c2',
          chapterNumber: 2,
          title: 'Thirukkural & Secular Values',
          tamilTitle: 'திருக்குறள் மற்றும் மதச்சார்பற்ற மாண்புகள்',
          lessons: [
            {
              id: 'g4-gs-u6-c2-l1',
              lessonNumber: '2.1',
              title: 'Thirukkural as a World Secular Classic & Universal Ethics',
              duration: '40 mins',
              keyConcepts: ['Secular Literature: Free from religious dogmas', 'Good Governance (Sengonmai)', 'Relevance to Modern Welfare State', 'Moral Compass of Humanity'],
              studyNotes: [
                'Thirukkural is composed of 1330 couplets categorized into Arathuppal (38 chapters), Porutpal (70 chapters), and Kamathuppal (25 chapters).',
                'Thirukkural is universally celebrated as secular because it makes no reference to any specific religion, sect, or deity, focusing exclusively on human virtue and ethical living.',
                'Kural 388 outlines the traits of an ideal ruler: one who acquires wealth, preserves it, guards it, and distributes it for the public good.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q14',
                  question: 'Which section of Thirukkural deals extensively with statecraft, citizenship, army, ministers, and economic governance?',
                  options: ['Arathuppal (Virtue)', 'Porutpal (Wealth & Governance)', 'Kamathuppal (Love)', 'Payiram (Prologue)'],
                  correctAnswer: 1,
                  explanation: 'Porutpal, comprising 70 chapters, provides deep wisdom on political administration, diplomacy, military strategy, and societal welfare.',
                },
              ],
            },
          ],
        },
        {
          id: 'g4-gs-u6-c3',
          chapterNumber: 3,
          title: 'Self-Respect Movement, Justice Party & Social Reformers',
          tamilTitle: 'சுயமரியாதை இயக்கம், நீதிக்கட்சி & சீர்திருத்தங்கள்',
          lessons: [
            {
              id: 'g4-gs-u6-c3-l1',
              lessonNumber: '3.1',
              title: 'Periyar E.V.R., South Indian Liberal Federation & Social Equality',
              duration: '45 mins',
              keyConcepts: ['Justice Party formed in 1916', 'Non-Brahmin Manifesto (1916)', 'Periyar launched Self-Respect Movement (1925)', 'First Communal G.O. (1921)'],
              studyNotes: [
                'The South Indian Liberal Federation (Justice Party) was founded in November 1916 by Dr. C. Natesa Mudaliar, Sir P. Theagaraya Chetty, and Dr. T.M. Nair.',
                'The Justice Party government passed the historic Communal G.O. in 1921 providing affirmative reservation in public employment for all communities.',
                'Periyar E.V. Ramasamy started the Self-Respect Movement in 1925 to establish an egalitarian society through rationalism, gender equality, and eradication of untouchability.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gs-q15',
                  question: 'In which year did Periyar E.V. Ramasamy launch the historic Self-Respect Movement in Tamil Nadu?',
                  options: ['1916', '1921', '1925', '1937'],
                  correctAnswer: 2,
                  explanation: 'Periyar launched the Self-Respect Movement in 1925 after resigning from the Congress party, advocating rationalism, equal rights, and self-respect marriages.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// ============================================================================
// SUBJECT 2: Aptitude and Mental Ability (Part B: SSLC Standard – 25 Questions)
// ============================================================================
export const group4AptitudeSubject: Group4Subject = {
  id: 'aptitude',
  order: 2,
  title: 'Aptitude and Mental Ability',
  tamilTitle: 'திறனறிவும் மனக்கணக்கு நுண்ணறிவும் (25 வினாக்கள்)',
  partTag: 'Part B • SSLC Standard',
  standard: 'SSLC Standard (25 Questions • 37.5 Marks)',
  questionCount: 25,
  description:
    'Official TNPSC Group 4 Aptitude syllabus consisting of Unit I: Aptitude (15 Questions: Simplification, Percentage, HCF/LCM, Ratio, Simple & Compound Interest, Area, Volume, Time & Work) and Unit II: Reasoning (10 Questions: Logical reasoning, Puzzles, Dice, Visual, Alpha-numeric reasoning, Number series).',
  accentColor: '#fbbf24',
  units: [
    {
      id: 1,
      unitNumber: 'Unit I',
      title: 'Aptitude',
      tamilTitle: 'அலகு I: திறனறிவு (15 கேள்விகள்)',
      questionCount: 15,
      standard: 'SSLC Standard (15 Questions)',
      officialTopics: [
        'Simplification - Percentage - Highest Common Factor (HCF) - Lowest Common Multiple (LCM)',
        'Ratio and Proportion - Simple interest - Compound interest',
        'Area - Volume - Time and Work',
      ],
      chapters: [
        {
          id: 'g4-apt-u1-c1',
          chapterNumber: 1,
          title: 'Simplification, Percentage, HCF & LCM',
          tamilTitle: 'சுருக்குதல், விழுக்காடு, மீப்பெரு பொதுக்காரணி & மீச்சிறு பொதுமடங்கு',
          lessons: [
            {
              id: 'g4-apt-u1-c1-l1',
              lessonNumber: '1.1',
              title: 'BODMAS, Percentages, and HCF-LCM Properties',
              duration: '40 mins',
              keyConcepts: ['BODMAS Rule', 'Percentage Conversion & Formulae', 'Product of Two Numbers = HCF × LCM', 'Co-prime properties'],
              studyNotes: [
                'BODMAS: Brackets, Orders/Of, Division, Multiplication, Addition, Subtraction.',
                'The product of two positive integers is equal to the product of their HCF and LCM: a × b = HCF(a,b) × LCM(a,b).',
                'HCF of fractions = HCF of Numerators / LCM of Denominators; LCM of fractions = LCM of Numerators / HCF of Denominators.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-apt-q1',
                  question: 'The LCM of two numbers is 240 and their HCF is 12. If one of the numbers is 48, find the other number.',
                  options: ['50', '60', '72', '80'],
                  correctAnswer: 1,
                  explanation: 'Using Product = HCF × LCM: Other number = (240 × 12) / 48 = 2880 / 48 = 60.',
                },
                {
                  id: 'g4-apt-q2',
                  question: 'What is 15% of 80 plus 25% of 120?',
                  options: ['38', '42', '45', '50'],
                  correctAnswer: 1,
                  explanation: '15% of 80 = (15 × 80)/100 = 12. 25% of 120 = 120/4 = 30. Sum = 12 + 30 = 42.',
                },
              ],
            },
          ],
        },
        {
          id: 'g4-apt-u1-c2',
          chapterNumber: 2,
          title: 'Ratio, Interest, Mensuration & Time-Work',
          tamilTitle: 'விகிதம், வட்டி, அளவியல் & காலமும் வேலையும்',
          lessons: [
            {
              id: 'g4-apt-u1-c2-l1',
              lessonNumber: '2.1',
              title: 'Simple & Compound Interest, Area & Volume, Time and Work',
              duration: '45 mins',
              keyConcepts: ['Simple Interest SI = PNR/100', 'Difference between CI and SI for 2 years: P(R/100)²', 'Work Done = Rate × Time', 'Circle, Cylinder, Cone & Sphere formulae'],
              studyNotes: [
                'Simple Interest: SI = (P × N × R) / 100. Total Amount A = P + SI.',
                'Difference between CI and SI for 2 years = P × (R / 100)². For 3 years = P × (R/100)² × (3 + R/100).',
                'If A can do a piece of work in x days and B can do it in y days, together they can finish it in (xy)/(x + y) days.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-apt-q3',
                  question: 'A can complete a piece of work in 12 days and B in 24 days. Working together, in how many days will they finish the work?',
                  options: ['6 days', '8 days', '10 days', '18 days'],
                  correctAnswer: 1,
                  explanation: 'Together = (12 × 24) / (12 + 24) = 288 / 36 = 8 days.',
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
      title: 'Reasoning',
      tamilTitle: 'அலகு II: காரணவியல் (10 கேள்விகள்)',
      questionCount: 10,
      standard: 'SSLC Standard (10 Questions)',
      officialTopics: [
        'Logical reasoning - Puzzles - Dice',
        'Visual reasoning - Alpha numeric reasoning - Number series',
      ],
      chapters: [
        {
          id: 'g4-apt-u2-c1',
          chapterNumber: 1,
          title: 'Logical Puzzles, Dice & Visual Reasoning',
          tamilTitle: 'தருக்கப் புதிர்கள், பகடை மற்றும் காட்சி காரணவியல்',
          lessons: [
            {
              id: 'g4-apt-u2-c1-l1',
              lessonNumber: '1.1',
              title: 'Dice Rules, Seating Arrangements, Pattern Completion',
              duration: '35 mins',
              keyConcepts: ['Standard vs Ordinary Dice (Opposite faces sum to 7)', 'Linear and Circular Seating Puzzles', 'Mirror and Water Images', 'Venn Diagrams'],
              studyNotes: [
                'In a standard die, the sum of numbers on any two opposite faces is always equal to 7 (1 opposite 6, 2 opposite 5, 3 opposite 4).',
                'In linear seating, facing North implies left is toward the viewer’s left; facing South reverses the direction.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-apt-q4',
                  question: 'In a standard unbiased die, which number lies on the face opposite to 3?',
                  options: ['1', '4', '5', '6'],
                  correctAnswer: 1,
                  explanation: 'In any standard die, opposite faces always sum to 7. Therefore, opposite of 3 is 7 - 3 = 4.',
                },
              ],
            },
          ],
        },
        {
          id: 'g4-apt-u2-c2',
          chapterNumber: 2,
          title: 'Alpha-Numeric Reasoning & Number Series',
          tamilTitle: 'எண் மற்றும் எழுத்து வரிசை நுண்ணறிவு',
          lessons: [
            {
              id: 'g4-apt-u2-c2-l1',
              lessonNumber: '2.1',
              title: 'Arithmetic, Geometric, Prime, and Alphabetical Series',
              duration: '35 mins',
              keyConcepts: ['Difference and Double Difference', 'Square & Cube Series', 'Alphabetical positions (A=1 ... Z=26)', 'Direction and Coding-Decoding'],
              studyNotes: [
                'Always examine common differences, ratios, square/cube patterns, or alternating operations in number series.',
                'Remember the standard alphabetical indexing: EJOTY (5, 10, 15, 20, 25).',
              ],
              practiceQuestions: [
                {
                  id: 'g4-apt-q5',
                  question: 'Find the next number in the series: 2, 5, 10, 17, 26, ?',
                  options: ['35', '36', '37', '38'],
                  correctAnswer: 2,
                  explanation: 'Pattern is n² + 1: 1²+1=2, 2²+1=5, 3²+1=10, 4²+1=17, 5²+1=26, 6²+1=37.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// ============================================================================
// SUBJECT 3: General Tamil (Part C: தமிழ் தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு – 100 Questions)
// ============================================================================
export const group4GeneralTamilSubject: Group4Subject = {
  id: 'general-tamil',
  order: 3,
  title: 'General Tamil',
  tamilTitle: 'பகுதி இ: தமிழ் தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு (100 வினாக்கள்)',
  partTag: 'Part C • SSLC Standard',
  standard: 'SSLC Standard (100 Questions • 150 Marks)',
  questionCount: 100,
  description:
    'அதிகாரப்பூர்வ TNPSC குரூப் 4 பாடத்திட்டம் (Code: 496): அலகு I இலக்கணம் (25 Qs), அலகு II சொல்லகராதி (15 Qs), அலகு III எழுதும் திறன் (15 Qs), அலகு IV கலைச் சொற்கள் (10 Qs), அலகு V வாசித்தல் புரிதல் (15 Qs), அலகு VI எளிய மொழி பெயர்ப்பு (5 Qs), அலகு VII இலக்கியம் & தமிழறிஞர்கள் (15 Qs).',
  accentColor: '#10b981',
  units: [
    {
      id: 1,
      unitNumber: 'அலகு I',
      title: 'இலக்கணம் (Grammar)',
      tamilTitle: 'அலகு I: இலக்கணம் (25 கேள்விகள்)',
      questionCount: 25,
      standard: 'பத்தாம் வகுப்புத் தரம் (25 Questions)',
      officialTopics: [
        'எழுத்து: பிரித்து எழுதுதல் – சேர்த்து எழுதுதல் – சந்திப்பிழை – குறில், நெடில் வேறுபாடு – லகர, ளகர, ழகர வேறுபாடு – னகர, ணகர வேறுபாடு – ரகர, றகர வேறுபாடு – இனவெழுத்துகள் அறிதல் – சுட்டு எழுத்துகள் – வினா எழுத்துகள் – ஒருமைப் பன்மை அறிதல்',
        'சொல்: வேர்ச்சொல் அறிதல் – வேர்ச்சொல்லில் இருந்து வினைமுற்று, வினையெச்சம், வினையாலணையும் பெயர், பெயரெச்சம் வகை அறிதல் – அயற்சொல் – தமிழ்ச்சொல், எதிர்ச்சொல் – வினைச்சொல் – எழுத்துப் பிழை, ஒற்றுப்பிழை அறிதல் – இரண்டு வினைச் சொற்களின் வேறுபாடு அறிதல்',
      ],
      chapters: [
        {
          id: 'g4-gt-u1-c1',
          chapterNumber: 1,
          title: 'எழுத்து இலக்கணம் & ஒலி வேறுபாடுகள்',
          tamilTitle: 'எழுத்துகள், சந்திப்பிழை & ஒருமை-பன்மை',
          lessons: [
            {
              id: 'g4-gt-u1-c1-l1',
              lessonNumber: '1.1',
              title: 'எழுத்து வகைகள், இனவெழுத்துகள், சுட்டு & வினா எழுத்துகள்',
              duration: '35 mins',
              keyConcepts: ['குறில் - நெடில் மாத்திரை', 'இனவெழுத்துகள்', 'சுட்டு எழுத்துகள் (அ, இ, உ)', 'வினா எழுத்துகள் (எ, யா, ஆ, ஓ, ஏ)'],
              studyNotes: [
                'குறில் எழுத்திற்கு ஒரு மாத்திரை, நெடில் எழுத்திற்கு இரண்டு மாத்திரை, மெய்யெழுத்து மற்றும் ஆய்த எழுத்திற்கு அரை மாத்திரை.',
                'சுட்டு எழுத்துகள்: அ, இ, உ (அவன், இவன், உவன்). வினா எழுத்துகள்: எ, யா (மொழிமுதல்), ஆ, ஓ (மொழிஇறுதி), ஏ (இருவழியும்).',
                'லகர, ளகர, ழகர வேறுபாடு: கல் - பாறை, கள் - மது, கழ் - நீக்குதல்; அலி - பேடி, அளி - அருள், அழி - நாசம்.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gt-q1',
                  question: 'தமிழில் சொல்லின் முதலில் மட்டுமே வரும் வினா எழுத்துகள் எவை?',
                  options: ['ஆ, ஓ', 'எ, யா', 'ஏ', 'அ, இ'],
                  correctAnswer: 1,
                  explanation: 'எ, யா ஆகிய இரு எழுத்துகளும் சொல்லின் முதலில் மட்டுமே வினாப் பொருளைத் தரும் (எ.கா: எங்கு, யார்).',
                },
              ],
            },
          ],
        },
        {
          id: 'g4-gt-u1-c2',
          chapterNumber: 2,
          title: 'சொல் இலக்கணம் & வேர்ச்சொல் மாற்றம்',
          tamilTitle: 'வேர்ச்சொல், எச்சங்கள் & ஒற்றுப்பிழை நீக்குதல்',
          lessons: [
            {
              id: 'g4-gt-u1-c2-l1',
              lessonNumber: '2.1',
              title: 'வேர்ச்சொல் அறிதல், வினைமுற்று, எச்சங்கள் மற்றும் ஒற்றுப்பிழை',
              duration: '40 mins',
              keyConcepts: ['வேர்ச்சொல் (ஏவல் வினை)', 'பெயரெச்சம் vs வினையெச்சம்', 'வினையாலணையும் பெயர்', 'வல்லினம் மிகும் மிகா இடங்கள்'],
              studyNotes: [
                '"சென்றான்" என்பதன் வேர்ச்சொல் "செல்". "படித்தான்" என்பதன் வேர்ச்சொல் "படி". வேர்ச்சொல் எப்போதும் ஏவலாகவே அமையும்.',
                'பெயரெச்சம்: பெயரைக்கொண்டு முடியும் எச்சவினை (எ.கா: படித்த மாணவன்). வினையெச்சம்: வினையைக் கொண்டு முடியும் எச்சவினை (எ.கா: படித்துத் தேறினான்).',
                'வினையாலணையும் பெயர்: ஒரு வினைமுற்று பெயர்த் தன்மையடைந்து வேற்றுமை உருபேற்று வருவது (எ.கா: பாடியவள், பொறுத்தார்).',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gt-q2',
                  question: '"கண்டான்" என்ற வினைமுற்றின் வேர்ச்சொல்லைக் கண்டறிக.',
                  options: ['கண்டு', 'காண்', 'காணல்', 'கண்ட'],
                  correctAnswer: 1,
                  explanation: '"கண்டான்" என்னும் சொல்லின் ஏவல் பொருளுணர்த்தும் மூல வேர்ச்சொல் "காண்" ஆகும்.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 2,
      unitNumber: 'அலகு II',
      title: 'சொல்லகராதி (Vocabulary)',
      tamilTitle: 'அலகு II: சொல்லகராதி (15 கேள்விகள்)',
      questionCount: 15,
      standard: 'பத்தாம் வகுப்புத் தரம் (15 Questions)',
      officialTopics: [
        '(i) எதிர்actionசொல்லை எடுத்தெழுதுதல், ஓரெழுத்து ஒரு மொழி, உரிய பொருளைக் கண்டறிதல் – ஒருபொருள் தரும் பல சொற்கள், பொருந்தா சொல்லைக் கண்டறிதல், அகர வரிசைப்படி சொற்களைச் சீர்செய்தல்; ஒருபொருள் பன்மொழி – இருபொருள் குறிக்கும் சொற்கள் – பேச்சு வழக்கு, எழுத்து வழக்கு – சொல்லும் பொருளும் அறிதல் – ஒரு சொல்லிற்கு இணையான வேறு சொல் அறிதல்',
        '(ii) கோடிட்ட இடத்தில் சரியான சொல்லைத் தேர்ந்தெடுத்து எழுதுதல் - பொருத்தமான பொருளைத் தெரிவு செய்தல் - ஊர்ப் பெயர்களின் மரூஉவை எழுதுக - பிழை திருத்துக (ஒரு - ஓர்) - பேச்சு வழக்குச் சொற்களுக்கு இணையான தூய தமிழ்ச் சொற்களை இணைத்தல்',
        '(iii) பேச்சு வழக்குத் தொடர்களிலுள்ள பிழை திருத்தம் - சொற்களை இணைத்துப் புதிய சொல் உருவாக்குதல் - அடைப்புக்குள் உள்ள சொல்லைத் தகுந்த இடத்தில் சேர்த்தல் - பொருள் தரும் ஓர் எழுத்து - பல பொருள் தரும் ஒரு சொல்லைக் கூறுக',
      ],
      chapters: [
        {
          id: 'g4-gt-u2-c1',
          chapterNumber: 1,
          title: 'ஓரெழுத்து ஒருமொழி, அகரவரிசை & மரூஉப் பெயர்கள்',
          tamilTitle: 'சொல்லும் பொருளும், அகரவரிசை & பேச்சுவழக்கு',
          lessons: [
            {
              id: 'g4-gt-u2-c1-l1',
              lessonNumber: '1.1',
              title: 'நன்னூல் 42 ஓரெழுத்து ஒருமொழி, மரூஉ & தூய தமிழ்ச்சொற்கள்',
              duration: '35 mins',
              keyConcepts: ['ஓரெழுத்து ஒருமொழி 42 (நன்னூல்)', 'ஊர்ப்பெயர் மரூஉ', 'ஒரு - ஓர் விதி', 'பேச்சுவழக்குச் சொல் திருத்தம்'],
              studyNotes: [
                'நன்னூலார் 42 ஓரெழுத்து ஒருமொழிகளைக் குறிப்பிட்டுள்ளார். எ.கா: ஆ - பசு, மா - பெரிய/விலங்கு, தீ - நெருப்பு, கோ - அரசன், தை - மாதம்.',
                'ஊர்ப்பெயர்களின் மரூஉ: புதுச்சேரி – புதுவை; திருச்சிராப்பள்ளி – திருச்சி; தஞ்சாவூர் – தஞ்சை; மயிலாப்பூர் – மயிலை; நாகப்பட்டினம் – நாகை.',
                'உயிரெழுத்தில் தொடங்கும் சொல்லுக்கு முன் "ஓர்" வர வேண்டும் (எ.கா: ஓர் ஊர், ஓர் அரசன்). மெய்யெழுத்தில் தொடங்கும் சொல்லுக்கு முன் "ஒரு" வர வேண்டும் (எ.கா: ஒரு நாடு, ஒரு மரம்).',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gt-q3',
                  question: 'நன்னூலின்படி "மா" என்னும் ஓரெழுத்து ஒருமொழி குறிக்கும் பொருள் எது?',
                  options: ['அரசன்', 'பெரிய / விலங்கு', 'நெருப்பு', 'பாதுகாப்பு'],
                  correctAnswer: 1,
                  explanation: '"மா" என்பது பெரிய, விலங்கு, திருமகள், அழகு, நில அளவு எனப் பல பொருள்களைத் தரும் ஓரெழுத்து ஒருமொழியாகும்.',
                },
                {
                  id: 'g4-gt-q4',
                  question: 'கீழ்க்கண்டவற்றுள் சரியான மரூஉப் பெயரைத் தேர்ந்தெடுக்க: மயிலாப்பூர் என்பதன் மரூஉ யாது?',
                  options: ['மயிலை', 'மயிலாடுதுறை', 'மயிலா', 'மயூரம்'],
                  correctAnswer: 0,
                  explanation: 'மயிலாப்பூர் என்னும் ஊர்ப்பெயரின் மருவிய வடிவம் (மரூஉ) "மயிலை" ஆகும்.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 3,
      unitNumber: 'அலகு III',
      title: 'எழுதும் திறன் (Writing Skills)',
      tamilTitle: 'அலகு III: எழுதும் திறன் (15 கேள்விகள்)',
      questionCount: 15,
      standard: 'பத்தாம் வகுப்புத் தரம் (15 Questions)',
      officialTopics: [
        '(i) சொற்களை ஒழுங்குபடுத்திச் சொற்றொடர் அமைத்தல் – தொடர் வகைகள் – செய்வினை, செயப்பாட்டு வினை – தன்வினை, பிறவினை – ஒருமைப் பன்மை பிழையறிந்து சரியான தொடரறிதல்',
        '(ii) மரபுத் தமிழ்: திணை மரபு - உயர்திணை, அஃறிணை; பால் மரபு: ஆண்பால், பெண்பால், பலர்பால், ஒன்றன்பால், பலவின்பால்; காலம், இளமைப் பெயர், ஒலிமரபு, வினைமரபு, தொகை மரபு; நிறுத்தற்குறிகள்',
      ],
      chapters: [
        {
          id: 'g4-gt-u3-c1',
          chapterNumber: 1,
          title: 'தொடர் வகைகள், மரபுத் தமிழ் & நிறுத்தற்குறிகள்',
          tamilTitle: 'செய்வினை-செயப்பாட்டுவினை & திணை-பால் மரபு',
          lessons: [
            {
              id: 'g4-gt-u3-c1-l1',
              lessonNumber: '1.1',
              title: 'செய்வினை-செயப்பாட்டு வினை, இளமைப் பெயர்கள் & ஒலி மரபு',
              duration: '35 mins',
              keyConcepts: ['செய்வினை (எழுவாய் முதன்மை)', 'செயப்பாட்டுவினை (செயப்படுபொருள் + பட்டது)', 'இளமைப் பெயர் மரபு', 'ஒலி & வினை மரபு'],
              studyNotes: [
                'செய்வினை: எழுவாய் செயலை நேரடியாகச் செய்வது (எ.கா: கயல்விழி மாலையைத் தொடுத்தாள்).',
                'செயப்பாட்டுவினை: செயப்படுபொருள் முன்னிற்கும், "பட்டது/பெற்றது" வரும் (எ.கா: மாலை கயல்விழியால் தொடுக்கப்பட்டது).',
                'இளமைப் பெயர்கள்: சிங்கம் – குருளை; புலி – பரழ்; மான் – கன்று; ஆடு – குட்டி; யானை – கன்று; குதிரை – குட்டி.',
                'ஒலி மரபு: குயில் கூவும்; மயில் அகவும்; நரி ஊளையிடும்; ஆந்தை அலறும்; காகம் கரையும்; சிங்கம் முழங்கும்.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gt-q5',
                  question: 'சிங்கத்தின் இளமைப் பெயர் யாது?',
                  options: ['கன்று', 'குட்டி', 'குருளை', 'பரழ்'],
                  correctAnswer: 2,
                  explanation: 'சிங்கத்தின் இளமைப் பெயர் "சிங்கக் குருளை" ஆகும் (புலியின் இளமைப் பெயர் புலிப் பரழ்).',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 4,
      unitNumber: 'அலகு IV',
      title: 'கலைச் சொற்கள் (Technical Terms)',
      tamilTitle: 'அலகு IV: கலைச் சொற்கள் (10 கேள்விகள்)',
      questionCount: 10,
      standard: 'பத்தாம் வகுப்புத் தரம் (10 Questions)',
      officialTopics: [
        'பல்துறை சார்ந்த கலைச் சொற்களை அதாவது அறிவியல், கல்வி, மருத்துவம், மேலாண்மை, சட்டம், புவியியல், தொழில்நுட்பம், ஊடகம், தகவல் தொழில்நுட்பம் உள்ளிட்ட பல்துறை சார்ந்த கலைச் சொல்லுக்கு நேரான தமிழ்ச் சொற்களை அறிந்திருக்க வேண்டும்',
        'உதாரணம்: search engine – தேடு பொறி, வலசை – Migration, ஒவ்வாமை – Allergy, மரபணு – Gene, கடல் மைல் – Nautical Mile',
      ],
      chapters: [
        {
          id: 'g4-gt-u4-c1',
          chapterNumber: 1,
          title: 'அறிவியல், கணிப்பொறி & அலுவலகக் கலைச்சொற்கள்',
          tamilTitle: 'பல்வேறு துறைசார்ந்த கலைச்சொல்லாக்கம்',
          lessons: [
            {
              id: 'g4-gt-u4-c1-l1',
              lessonNumber: '1.1',
              title: 'பாடத்திட்டத்தில் உள்ள முக்கியக் கலைச்சொற்கள் & மொழிபெயர்ப்பு',
              duration: '30 mins',
              keyConcepts: ['கணிப்பொறி கலைச்சொற்கள்', 'மருத்துவம் & அறிவியல்', 'சட்டம் & நிருவாகம்'],
              studyNotes: [
                'Search Engine – தேடு பொறி; Browser – உலாவி; Migration – வலசை போதல்; Allergy – ஒவ்வாமை.',
                'Gene – மரபணு; Nautical Mile – கடல் மைல்; Pendrive – விரலி / சேமிப்பகம்; Printer – அச்சுப்பொறி; Keyboard – விசைப்பலகை.',
                'Artificial Intelligence – செயற்கை நுண்ணறிவு; Nanotechnology – மீநுண் தொழில்நுட்பம்; Patent – காப்புரிமை.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gt-q6',
                  question: '"Migration" என்ற ஆங்கிலச் சொல்லுக்கு இணையான தமிழ்ச் சொல் எது?',
                  options: ['புலம்பெயர்தல்', 'வலசை போதல்', 'குடியேறுதல்', 'பயணித்தல்'],
                  correctAnswer: 1,
                  explanation: 'பறவைகள் மற்றும் விலங்குகளின் பருவகால இடப்பெயர்வுக்கு அதிகாரப்பூர்வ தமிழ் கலைச்சொல் "வலசை / வலசை போதல்" ஆகும்.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 5,
      unitNumber: 'அலகு V',
      title: 'வாசித்தல் – புரிந்து கொள்ளும் திறன்',
      tamilTitle: 'அலகு V: வாசித்தல் – புரிந்து கொள்ளும் திறன் (15 கேள்விகள்)',
      questionCount: 15,
      standard: 'பத்தாம் வகுப்புத் தரம் (15 Questions)',
      officialTopics: [
        'கொடுக்கப்பட்ட பத்தியிலிருந்து கேட்கப்பட்ட வினாக்களுக்கு சரியான விடையைத் தேர்ந்தெடுத்தல்',
        'செய்தித்தாள் – தலையங்கம் – முகப்புச் செய்திகள் – அரசு சார்ந்த செய்திகள் – கட்டுரைகள் – இவற்றை வாசித்தல் - புரிந்து கொள்ளும் திறன்',
        'உவமைத் தொடரின் பொருளறிதல் - மரபுத் தொடரின் பொருளறிதல் – பழமொழிகள் பொருளறிதல் – ஆவண உள்ளடக்கங்களைப் புரிந்து கொள்ளும் திறன்',
      ],
      chapters: [
        {
          id: 'g4-gt-u5-c1',
          chapterNumber: 1,
          title: 'பத்தி வினாக்கள், உவமைத் தொடர்கள் & பழமொழிகள்',
          tamilTitle: 'உவமை, மரபுத்தொடர் & ஆவணப் புரிதல்',
          lessons: [
            {
              id: 'g4-gt-u5-c1-l1',
              lessonNumber: '1.1',
              title: 'உவமைத் தொடர்கள், பழமொழிகள் மற்றும் செய்தி வாசிப்பு',
              duration: '35 mins',
              keyConcepts: ['உவமைத் தொடர் பொருள்', 'பழமொழிகள்', 'பத்தி வினா விடையளித்தல்'],
              studyNotes: [
                'அத்தி பூத்தாற்போல – அரிய செயல் / எளிதில் காண இயலாதது.',
                'இலவு காத்த கிளி போல – ஏமாற்றம் அடைதல்; நகமும் சதையும் போல – பிரிக்க முடியாத ஒற்றுமை; குன்றின் மேலிட்ட விளக்கு போல – வெளிப்படையானது.',
                'மடை திறந்த வெள்ளம் போல – தடையின்றி விரைந்து வருதல்.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gt-q7',
                  question: '"அத்தி பூத்தாற்போல" என்ற உவமைத் தொடர் உணர்த்தும் பொருள் யாது?',
                  options: ['அடிக்கடி நிகழ்தல்', 'அரிய செயல் / மிக அரிதாக நிகழ்வது', 'மகிழ்ச்சி அடைதல்', 'விரைந்து செயல்படுதல்'],
                  correctAnswer: 1,
                  explanation: 'அத்தி மரம் பூப்பது கண்களுக்குத் தெரிவதில்லை; எனவே அத்தி பூத்தாற்போல என்பது "அரிதான நிகழ்வு" என்பதாகும்.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 6,
      unitNumber: 'அலகு VI',
      title: 'எளிய மொழி பெயர்ப்பு (Translation)',
      tamilTitle: 'அலகு VI: எளிய மொழி பெயர்ப்பு (5 கேள்விகள்)',
      questionCount: 5,
      standard: 'பத்தாம் வகுப்புத் தரம் (5 Questions)',
      officialTopics: [
        'ஆங்கிலம் மற்றும் பிறமொழிச் சொற்களுக்கு இணையான தமிழ்ச் சொற்கள் அறிதல் வேண்டும்',
        'பயன்பாட்டில் உள்ள ஆங்கிலச் சொற்களை மொழிபெயர்த்தல் வேண்டும் (சான்று: pendrive, printer, computer, keyboard)',
        'ஆவணங்களின் தலைப்பு – கோப்புகள் – கடிதங்கள் – மனுக்கள் – மொழிபெயர்ப்பு புரிந்து கொள்ளுதல்',
      ],
      chapters: [
        {
          id: 'g4-gt-u6-c1',
          chapterNumber: 1,
          title: 'அலுவலக ஆவணங்கள் & கடித மொழிபெயர்ப்பு',
          tamilTitle: 'கோப்புகள், மனுக்கள் & தொழில்நுட்பக் கருவிகள்',
          lessons: [
            {
              id: 'g4-gt-u6-c1-l1',
              lessonNumber: '1.1',
              title: 'அலுவலகத் தலைப்புகள், மனுக்கள், கோப்புகள் மொழிபெயர்ப்பு',
              duration: '30 mins',
              keyConcepts: ['File – கோப்பு', 'Petition – மனு', 'Circular – சுற்றறிக்கை', 'Memorandum – நினைவூட்டல்'],
              studyNotes: [
                'Official Letter – அலுவலகக் கடிதம்; Confidential – இரகசியமானது; Urgent – அவசரம்; Immediate – உடனடி.',
                'Endorsement – மேலொப்பம் / மேலனுப்புகை; Acknowledgement – ஒப்புதல் கடிதம் / ஒப்புதல் அட்டை.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gt-q8',
                  question: '"Circular" என்ற அலுவலக ஆவணச் சொல்லுக்கு இணையான தமிழ்ச் சொல் எது?',
                  options: ['மனு', 'சுற்றறிக்கை', 'அறிக்கை', 'விளம்பரம்'],
                  correctAnswer: 1,
                  explanation: 'Circular என்பதற்கு இணையான சரியான அலுவலகத் தமிழ்ச் சொல் "சுற்றறிக்கை" ஆகும்.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 7,
      unitNumber: 'அலகு VII',
      title: 'இலக்கியம், தமிழ் அறிஞர்களும், தமிழ்த்தொண்டும்',
      tamilTitle: 'அலகு VII: இலக்கியம் & தமிழறிஞர்கள் (15 கேள்விகள்)',
      questionCount: 15,
      standard: 'பத்தாம் வகுப்பு வரை (SSLC Standard - 15 Questions)',
      officialTopics: [
        'திருக்குறள் தொடர்பான செய்திகள் (இருபது அதிகாரங்கள் மட்டும்: ஒழுக்கமுடைமை, பொறையுடைமை, ஊக்கமுடைமை, விருந்தோம்பல், அறன் வலியுறுத்தல், ஈகை, பெரியாரைத் துணைக்கோடல், வினை செயல்வகை, அவையஞ்சாமை, கண்ணோட்டம், அன்புடைமை, கல்வி, நடுவுநிலைமை, கூடா ஒழுக்கம், கல்லாமை, செங்கோன்மை, பண்புடைமை, நட்பாராய்தல், புறங்கூறாமை, அருளுடைமை) - மேற்கோள்கள்',
        'அறநூல் தொடர்பான செய்திகள் (நாலடியார், நான்மணிக்கடிகை, பழமொழி நானூறு, முதுமொழிக்காஞ்சி, திரிகடுகம், இன்னாநாற்பது, சிறுபஞ்சமூலம், ஏலாதி, அவ்வையார் பாடல்கள்)',
        'தமிழின் தொன்மை, சிறப்பு, திராவிட மொழிகள் தொடர்பான செய்திகள்',
        'உ.வே.சாமிநாத ஐயர், தெ.பொ.மீனாட்சி சுந்தரம், சி.இலக்குவனார் தமிழ்ப்பணி - தேவநேயப் பாவாணர், அகரமுதலி, பாவலரேறு பெருஞ்சித்திரனார், ஜி.யு.போப், வீரமாமுனிவர் தமிழ்த் தொண்டு',
        'தமிழ்ச்சான்றோர் பற்றிய செய்திகள்: பாவேந்தர், டி.கே.சிதம்பரநாதர், தவத்திரு குன்றக்குடி அடிகளார், கண்ணதாசன், காயிதே மில்லத், தாரா பாரதி, வேலுநாச்சியார், பட்டுக்கோட்டை கல்யாணசுந்தரம், முடியரசன், தமிழ் ஒளி, உருத்திரங்கண்ணனார், கி.வா.ஜகந்நாதர், நாமக்கல் கவிஞர்',
      ],
      chapters: [
        {
          id: 'g4-gt-u7-c1',
          chapterNumber: 1,
          title: 'திருக்குறள் (20 அதிகாரங்கள்) & பதினெண்கீழ்க்கணக்கு அறநூல்கள்',
          tamilTitle: 'அறநூல்கள், நீதி இலக்கியம் & மேற்கோள்கள்',
          lessons: [
            {
              id: 'g4-gt-u7-c1-l1',
              lessonNumber: '1.1',
              title: '20 அதிகாரத் திருக்குறள் கருத்துகள், நாலடியார், பழமொழி நானூறு',
              duration: '45 mins',
              keyConcepts: ['ஒழுக்கமுடைமை', 'கல்வி & பண்புடைமை', 'நாலடியார் - சமண முனிவர்கள்', 'திரிகடுகம் - நல்லாதனார் (சுக்கு, மிளகு, திப்பிலி)'],
              studyNotes: [
                'பாடத்திட்டத்தில் உள்ள 20 அதிகாரங்கள்: ஒழுக்கமுடைமை, பொறையுடைமை, ஊக்கமுடைமை, விருந்தோம்பல், அறன் வலியுறுத்தல், ஈகை, பெரியாரைத் துணைக்கோடல், வினை செயல்வகை, அவையஞ்சாமை, கண்ணோட்டம், அன்புடைமை, கல்வி, நடுவுநிலைமை, கூடா ஒழுக்கம், கல்லாமை, செங்கோன்மை, பண்புடைமை, நட்பாராய்தல், புறங்கூறாமை, அருளுடைமை.',
                'நாலடியார் சமண முனிவர்கள் பலரால் இயற்றப்பட்டது; நாலடி நானூறு, வேளாண் வேதம் என அழைக்கப்படுகிறது.',
                'திரிகடுகம் நல்லாதனாரால் இயற்றப்பட்டது; சுக்கு, மிளகு, திப்பிலி ஆகிய மூன்றும் உடல்நோயைப் போக்குவது போல இதிலுள்ள மூன்று நீதிகள் அறியாமையைப் போக்கும்.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gt-q9',
                  question: '"வேளாண் வேதம்" என்று போற்றப்படும் பதினெண்கீழ்க்கணக்கு அறநூல் எது?',
                  options: ['திரிகடுகம்', 'நாலடியார்', 'பழமொழி நானூறு', 'இனியவை நாற்பது'],
                  correctAnswer: 1,
                  explanation: 'நாலடியார் "நாலடி நானூறு" மற்றும் "வேளாண் வேதம்" எனப் போற்றப்படுகிறது.',
                },
              ],
            },
          ],
        },
        {
          id: 'g4-gt-u7-c2',
          chapterNumber: 2,
          title: 'தமிழறிஞர்கள், பாவேந்தர், தாராபாரதி & வேலுநாச்சியார்',
          tamilTitle: 'தமிழ்த்தொண்டு, சான்றோர்கள் & பெண் விடுதலை',
          lessons: [
            {
              id: 'g4-gt-u7-c2-l1',
              lessonNumber: '2.1',
              title: 'உ.வே.சா, ஜி.யு.போப், வீரமாமுனிவர், கண்ணதாசன் & வீரமங்கை வேலுநாச்சியார்',
              duration: '45 mins',
              keyConcepts: ['உ.வே.சா (தமிழ்த்தாத்தா)', 'வீரமாமுனிவர் - தேம்பாவணி & சதுரகராதி', 'ஜி.யு.போப் - திருக்குறள் ஆங்கில மொழிபெயர்ப்பு', 'வேலுநாச்சியார் - சிவகங்கை அரசி'],
              studyNotes: [
                'வீரமாமுனிவர் (கான்ஸ்டன்டைன் ஜோசப் பெஸ்கி) தமிழ் எழுத்துச் சீர்திருத்தம் செய்தார்; சதுரகராதி என்ற முதல் தமிழ் அகராதியைத் தொகுத்தார்.',
                'ஜி.யு. போப் திருக்குறளையும் திருவாசகத்தையும் ஆங்கிலத்தில் மொழிபெயர்த்தார். தம் கல்லறையில் "ஒரு தமிழ் மாணவன்" என்று பொறிக்கச் சொன்னார்.',
                'வீரமங்கை வேலுநாச்சியார் (1730–1796) பிரிட்டிஷ் கிழக்கிந்தியக் கம்பனியை எதிர்த்து ஆயுதமேந்திப் போராடி சிவகங்கை மண்ணை மீட்ட முதல் இந்தியப் பெண் அரசி ஆவார்.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-gt-q10',
                  question: 'ஆங்கிலேயரை எதிர்த்துப் போரிட்டு சிவகங்கையை மீட்ட முதல் இந்திய விடுதலைப் பெண் அரசி யார்?',
                  options: ['ராணி மங்கம்மாள்', 'வேலுநாச்சியார்', 'அஞ்சலை அம்மாள்', 'தில்லையாடி வள்ளியம்மை'],
                  correctAnswer: 1,
                  explanation: 'வீரமங்கை வேலுநாச்சியார் 1780-ல் மருது சகோதரர்கள் மற்றும் ஹைதர் அலியின் உதவியுடன் ஆங்கிலேயரை வீழ்த்தி சிவகங்கையை மீட்டார்.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// ============================================================================
// SUBJECT 4: General English (Part C: SSLC Standard – 100 Questions)
// (For Differently Abled Candidates only)
// ============================================================================
export const group4GeneralEnglishSubject: Group4Subject = {
  id: 'general-english',
  order: 4,
  title: 'General English',
  tamilTitle: 'பகுதி இ: பொது ஆங்கிலம் (100 வினாக்கள் - மாற்றுத்திறனாளிகளுக்கு மட்டும்)',
  partTag: 'Part C • SSLC Standard',
  standard: 'SSLC Standard (100 Questions • 150 Marks)',
  questionCount: 100,
  description:
    'Official TNPSC Group 4 Syllabus (Code: 496): Unit I Grammar (25 Qs), Unit II Vocabulary (15 Qs), Unit III Writing Skills (10 Qs), Unit IV Technical Terms (10 Qs), Unit V Reading Comprehension (20 Qs), Unit VI Translation (5 Qs), and Unit VII Literary Works (15 Qs) covering the 30 Poems and 26 Prose works from Tamil Nadu school textbooks.',
  accentColor: '#a855f7',
  units: [
    {
      id: 1,
      unitNumber: 'Unit I',
      title: 'Grammar',
      tamilTitle: 'அலகு I: இலக்கணம் (25 கேள்விகள்)',
      questionCount: 25,
      standard: 'SSLC Standard (25 Questions)',
      officialTopics: [
        'Parts of speech, Concord, Tense, Active voice and passive voice, Types of sentences, Statement, Interrogative, Imperative, Exclamatory',
        'Transformation of statements into imperatives, Interrogatives into statements, Assertives into negatives, Exclamatory sentences into Statement, Imperatives into Inquisitive Interrogatives, Imperatives into Appreciative Statements',
        'Verbs, Main Verbs and Auxiliary Verbs, Regular and Irregular Verbs, Infinitives, Gerunds, Participles, Question tags',
        'Sentence patterns, Types of sentences, Simple, Compound and Complex, Phrases and clauses, Degrees of comparison, Positive, Comparative and Superlative, Direct into Indirect and Indirect to Direct, Synthesis of sentences, Punctuations',
      ],
      chapters: [
        {
          id: 'g4-ge-u1-c1',
          chapterNumber: 1,
          title: 'Parts of Speech, Concord, Tenses & Active/Passive Voice',
          tamilTitle: 'சொல் வகைகள், காலங்கள் & செய்வினை-செயப்பாட்டுவினை',
          lessons: [
            {
              id: 'g4-ge-u1-c1-l1',
              lessonNumber: '1.1',
              title: 'Subject-Verb Concord, Tenses, Voice & Question Tags',
              duration: '40 mins',
              keyConcepts: ['Subject-Verb Agreement', '12 English Tenses', 'Passive Voice Formations', 'Question Tag Rules'],
              studyNotes: [
                'Concord: Singular subject takes singular verb (e.g., "Neither of the boys was present"). When two subjects are connected by "as well as", the verb agrees with the first subject.',
                'Passive Voice: Object + appropriate form of "be" + Past Participle (V3) + by + Agent.',
                'Question Tag: Positive statement takes a negative tag (e.g., "She is a doctor, isn\'t she?"); negative statement takes a positive tag.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-ge-q1',
                  question: 'Choose the correct question tag: "They have completed their project, ______?"',
                  options: ["didn't they", "haven't they", "don't they", "aren't they"],
                  correctAnswer: 1,
                  explanation: 'Since the main clause is positive in the present perfect tense ("have completed"), the tag is negative: "haven\'t they?".',
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
      title: 'Vocabulary',
      tamilTitle: 'அலகு II: சொல்வளம் (15 கேள்விகள்)',
      questionCount: 15,
      standard: 'SSLC Standard (15 Questions)',
      officialTopics: [
        'Synonyms, Antonyms, Homonyms, Homophones, Collocations, Idioms & Phrases, Phrasal verbs',
        'Spelling of words, Correct usage of words, One word substitution, Word creation',
        'Singular and plural (including Zero plural), Derivatives, Abbreviations, British and American English, Compound words and Figures of speech',
      ],
      chapters: [
        {
          id: 'g4-ge-u2-c1',
          chapterNumber: 1,
          title: 'Synonyms, Antonyms, Homophones & Idioms',
          tamilTitle: 'பொருளறிதல், எதிர்ச்சொல் & மரபுத்தொடர்கள்',
          lessons: [
            {
              id: 'g4-ge-u2-c1-l1',
              lessonNumber: '1.1',
              title: 'Idioms, Phrasal Verbs, and British vs American English',
              duration: '35 mins',
              keyConcepts: ['Phrasal Verbs (call off, put up with)', 'Idioms in Context', 'British vs American (Bonnet/Hood, Lift/Elevator)'],
              studyNotes: [
                'Phrasal Verbs: "Call off" = cancel; "Put off" = postpone; "Look into" = investigate; "Give up" = abandon.',
                'British vs American: Lift = Elevator; Petrol = Gasoline; Tap = Faucet; Flat = Apartment; Post = Mail.',
                'Zero Plurals: Sheep, Deer, Salmon, Aircraft, Species.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-ge-q2',
                  question: 'What is the American English equivalent for the British English word "Lift"?',
                  options: ['Escalator', 'Elevator', 'Car', 'Hoist'],
                  correctAnswer: 1,
                  explanation: 'In American English, "Lift" is termed "Elevator".',
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
      title: 'Writing Skills',
      tamilTitle: 'அலகு III: எழுதும் திறன் (10 கேள்விகள்)',
      questionCount: 10,
      standard: 'SSLC Standard (10 Questions)',
      officialTopics: [
        'Letter writing (formal and informal) – Types of Letters (Multiple Choice Question)',
        'Jumbled sentences, Finding out the right order of sentences, Making queries (Multiple Choice Question), Inferences, Blanks, Substitutions',
      ],
      chapters: [
        {
          id: 'g4-ge-u3-c1',
          chapterNumber: 1,
          title: 'Letter Writing & Sentence Rearrangement',
          tamilTitle: 'கடித வகைகள் & தொடர் ஒழுங்கமைப்பு',
          lessons: [
            {
              id: 'g4-ge-u3-c1-l1',
              lessonNumber: '1.1',
              title: 'Formal/Informal Formats, Subscription & Jumbled Sequences',
              duration: '30 mins',
              keyConcepts: ['Formal Salutation: Sir / Madam', 'Subscription: Yours faithfully / Yours sincerely', 'Sentence sequencing markers'],
              studyNotes: [
                'In formal business letters addressed to unknown persons, the complimentary close is "Yours faithfully". To named individuals, "Yours sincerely".',
                'Informal letters to friends and family use "Yours lovingly" or "Yours affectionately".',
              ],
              practiceQuestions: [
                {
                  id: 'g4-ge-q3',
                  question: 'Which complimentary close is most appropriate for a formal official letter addressed to "Dear Sir"?',
                  options: ['Yours lovingly', 'Yours faithfully', 'Yours affectionately', 'Yours warmly'],
                  correctAnswer: 1,
                  explanation: '"Yours faithfully" is the standard formal subscription in official British/Indian business correspondence.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 4,
      unitNumber: 'Unit IV',
      title: 'Technical Terms',
      tamilTitle: 'அலகு IV: அலுவலகக் கலைச்சொற்கள் (10 கேள்விகள்)',
      questionCount: 10,
      standard: 'SSLC Standard (10 Questions)',
      officialTopics: [
        'Administrative Terms, Department related, General and Official terms, Official Correspondence (only basics)',
      ],
      chapters: [
        {
          id: 'g4-ge-u4-c1',
          chapterNumber: 1,
          title: 'Government Administration & Departmental Terms',
          tamilTitle: 'நிருவாகக் கலைச்சொற்கள் & கடித முறைமை',
          lessons: [
            {
              id: 'g4-ge-u4-c1-l1',
              lessonNumber: '1.1',
              title: 'Official Terminology, Secretariat Jargon & Glossary',
              duration: '30 mins',
              keyConcepts: ['Gazette', 'Memorandum', 'Jurisdiction', 'Quorum', 'Veto'],
              studyNotes: [
                'Gazette: Official publication of government appointments, laws, and notifications.',
                'Quorum: The minimum number of members required to be present at a meeting to validate transactions.',
                'Ex-officio: By virtue of one’s office or position (e.g., Vice President is ex-officio Chairman of Rajya Sabha).',
              ],
              practiceQuestions: [
                {
                  id: 'g4-ge-q4',
                  question: 'What is the term for the minimum number of members required to transact business in an official meeting?',
                  options: ['Majority', 'Quorum', 'Plurality', 'Consensus'],
                  correctAnswer: 1,
                  explanation: '"Quorum" is the legally mandated minimum attendance necessary to conduct valid proceedings.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 5,
      unitNumber: 'Unit V',
      title: 'Reading Comprehension',
      tamilTitle: 'அலகு V: வாசித்தல் புரிதல் (20 கேள்விகள்)',
      questionCount: 20,
      standard: 'SSLC Standard (20 Questions)',
      officialTopics: [
        'Unseen passages (News Paper, Headlines, Editorials, Government related News)',
        'Question Types–Strong question, Weak question, Match the following, Sentence Completion, Ascertainment of facts (Multiple Choice Question) - Choose the best response',
      ],
      chapters: [
        {
          id: 'g4-ge-u5-c1',
          chapterNumber: 1,
          title: 'Editorial Analysis & Fact Ascertainment',
          tamilTitle: 'செய்திப் பத்தி வாசிப்பு & தகவலறிதல்',
          lessons: [
            {
              id: 'g4-ge-u5-c1-l1',
              lessonNumber: '1.1',
              title: 'Comprehension Strategy, Tone Identification & Inferences',
              duration: '35 mins',
              keyConcepts: ['Skimming and Scanning', 'Central Theme Identification', 'Direct Fact Retrieval', 'Contextual Inference'],
              studyNotes: [
                'Always scan the questions first before reading the passage to know exactly which facts to look out for.',
                'Differentiate between stated facts in the text and assumptions not directly supported by the author.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-ge-q5',
                  question: 'When reading a comprehension passage, the technique of quickly glancing over text to find specific dates or numbers is called:',
                  options: ['Skimming', 'Scanning', 'Proofreading', 'Critical analysis'],
                  correctAnswer: 1,
                  explanation: '"Scanning" is the reading technique used to locate specific details such as dates, names, or numbers quickly.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 6,
      unitNumber: 'Unit VI',
      title: 'Translation',
      tamilTitle: 'அலகு VI: மொழிபெயர்ப்பு (5 கேள்விகள்)',
      questionCount: 5,
      standard: 'SSLC Standard (5 Questions)',
      officialTopics: [
        'Word Translation, Sentence Translation, Tense related translation tasks, Tense / Voice related tasks',
      ],
      chapters: [
        {
          id: 'g4-ge-u6-c1',
          chapterNumber: 1,
          title: 'Bilingual Translation Principles',
          tamilTitle: 'ஆங்கிலம் - தமிழ் மொழிபெயர்ப்புப் பயிற்சிகள்',
          lessons: [
            {
              id: 'g4-ge-u6-c1-l1',
              lessonNumber: '1.1',
              title: 'Grammatical Shifts, Tense Matching & Idiomatic Equivalence',
              duration: '30 mins',
              keyConcepts: ['S-V-O in English to S-O-V in Tamil', 'Tense Consistency in Translation', 'Idiomatic rather than literal translation'],
              studyNotes: [
                'English follows Subject-Verb-Object (SVO) order (e.g., "The cat caught the mouse").',
                'Tamil follows Subject-Object-Verb (SOV) order (e.g., "பூனை எலியைப் பிடித்தது").',
              ],
              practiceQuestions: [
                {
                  id: 'g4-ge-q6',
                  question: 'Translate the English sentence "Knowledge is Power" into idiomatic Tamil:',
                  options: ['அறிவே ஆற்றல்', 'கல்வி செல்வம்', 'அறிவே பொருள்', 'படிப்பே வலிமை'],
                  correctAnswer: 0,
                  explanation: '"Knowledge is Power" is standardly translated into Tamil as "அறிவே ஆற்றல்".',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 7,
      unitNumber: 'Unit VII',
      title: 'Literary Works (SSLC Standard)',
      tamilTitle: 'அலகு VII: இலக்கியப் படைப்புகள் (15 கேள்விகள்)',
      questionCount: 15,
      standard: 'SSLC Standard (15 Questions)',
      officialTopics: [
        'Figures of Speech; Appreciation and Analysis of Poetry; Lines of Significance',
        'Poems: I Dream of Spices – Raj Arumugam; The Crocodile – Lewis Carroll; Teamwork – Edger Albert Guest; From a Railway Carriage – Robert Louis Balfour Stevenson; A Tragic Story – William Makepeace Thackeray; Sea Fever – John Masefield; Courage – Edger Albert Guest; The Age of Chivalry – George Krokos; Wandering Singers – Sarojini Naidu; The Listeners – Walter de la mere; Your Space – David Bates; Special Hero – Christine M. Kerschan; Stopping by Woods on a Snowy Evening – Robert Frost; Leisure – William Henry Davies; A Poison Tree – William Blake; The Power of a Smile – Tupac Shakur; On Killing a Tree – Gieve Patel; Advice from a Tree – Ilan Shamir; The Spider and The Fly – Mary Howitt; Never Trust a Mirror – Erin Hanson; The River – Ilan Shamir; Nature the Gentlest Mother – Emily Dickinson; The Comet – Norman Littleford; The Star – Jane Taylor; The Stick-Together Families – Edgar Albert Guest; Memories of My Dad – Rebecca D. cook; Life – Henry Van Dyke; The Grumble Family - L.M. Montgomery; The Secret of the Machines – Rudyard Kipling; The House on Elm Street – Naida Bush',
        'Prose: His First Flight – Liam O’ Flaherty; The Night the Ghost Got In – James Grover Thurber; Empowered Women Navigating the World; The Attic – Satyajit Ray; Tech Bloomers; The Last Lesson – Alphonse Daudet; The Dying Detective - Arthur Canon Doyle; Learning The Game - Sachin Ramesh Tendulkar; I Can’t Climb Trees Anymore – Ruskin Bond; Old Man River – Dorothy Deming (Drama); Seventeen Oranges – Bill Naughton; Water – The Elixir of Life – Sir C.V. Raman; From Zero to Infinity – Biography of Srinivasa Ramanujan; A Birthday Letter – Jawaharlal Nehru; The Nose Jewel – C. Rajagopalachari; Hobby – Turns A Successful Career; Sir Isaac Newton – The Ingenious Scientist – Nathaniel Hawthorne; My Reminiscence – Rabindranath Tagore; Sea Turtles – Sheker Dattatri; When the Trees Walked – Ruskin Bond; A Visitor from Distant Lands; Sports Stars – Mithali Dorai Raj; The Last Stone Carver – Sigrun Srivastav; Eidgah – Munshi Premchand; The Wind on Haunted Hill – Ruskin Bond; A Prayer to the Teacher – Subroto Bagchi; The Tempest – Tales From Shakespeare; A Hunter Turned Naturalist – Jim Corbett; The Cat and the Painkiller (An Extract from the Adventures of Tom Sawyer) – Mark Twain',
        'Note: The Syllabus for Unit VII is based on school textbooks (up to SSLC Standard)',
      ],
      chapters: [
        {
          id: 'g4-ge-u7-c1',
          chapterNumber: 1,
          title: 'Prescribed Poems, Poets & Figures of Speech',
          tamilTitle: 'பாடத்திட்டக் கவிதைகள், கவிஞர்கள் & நயங்கள்',
          lessons: [
            {
              id: 'g4-ge-u7-c1-l1',
              lessonNumber: '1.1',
              title: 'Robert Frost, Lewis Carroll, Rudyard Kipling, Emily Dickinson & Figures of Speech',
              duration: '45 mins',
              keyConcepts: [
                'Stopping by Woods on a Snowy Evening (Robert Frost)',
                'The Secret of the Machines (Rudyard Kipling)',
                'A Poison Tree (William Blake)',
                'Figures of speech: Metaphor, Simile, Personification, Alliteration, Oxymoron',
              ],
              studyNotes: [
                '"The woods are lovely, dark and deep, / But I have promises to keep, / And miles to go before I sleep" – Robert Frost (Stopping by Woods on a Snowy Evening).',
                '"We can pull and haul and push and lift and drive, / We can print and plough and weave and heat and light" – Rudyard Kipling (The Secret of the Machines - Personification).',
                '"I was angry with my friend; / I told my wrath, my wrath did end" – William Blake (A Poison Tree).',
              ],
              practiceQuestions: [
                {
                  id: 'g4-ge-q7',
                  question: '"The woods are lovely, dark and deep, But I have promises to keep" – Who wrote these iconic lines?',
                  options: ['William Wordsworth', 'Robert Frost', 'John Keats', 'William Blake'],
                  correctAnswer: 1,
                  explanation: 'These lines conclude the famous poem "Stopping by Woods on a Snowy Evening" written by American poet Robert Frost.',
                },
              ],
            },
          ],
        },
        {
          id: 'g4-ge-u7-c2',
          chapterNumber: 2,
          title: 'Prescribed Prose Lessons & Renowned Authors',
          tamilTitle: 'உரைநடைப் பாடங்கள் & சிறப்பு ஆசிரியர்கள்',
          lessons: [
            {
              id: 'g4-ge-u7-c2-l1',
              lessonNumber: '2.1',
              title: 'Liam O’ Flaherty, Alphonse Daudet, Sir C.V. Raman & Ruskin Bond',
              duration: '45 mins',
              keyConcepts: [
                'His First Flight (Liam O’ Flaherty - Young Seagull)',
                'The Last Lesson (Alphonse Daudet - M. Hamel and Alsace-Lorraine)',
                'Water – The Elixir of Life (Sir C.V. Raman)',
                'Learning The Game (Sachin Tendulkar / Ramakant Achrekar)',
              ],
              studyNotes: [
                '"His First Flight" by Liam O’ Flaherty narrates the courage of a young seagull taking his maiden flight over the sea with the encouragement of his mother.',
                '"The Last Lesson" by Alphonse Daudet is set in the Franco-Prussian war where French lessons are discontinued in Alsace and Lorraine; M. Hamel delivers an emotional farewell to French.',
                '"Water – The Elixir of Life" by Nobel laureate Sir C.V. Raman describes water as the basis of all life, emphasizing soil erosion prevention and water harvesting.',
              ],
              practiceQuestions: [
                {
                  id: 'g4-ge-q8',
                  question: 'In Alphonse Daudet’s poignant short story "The Last Lesson", what was the mother tongue of the teacher M. Hamel?',
                  options: ['German', 'French', 'Spanish', 'Latin'],
                  correctAnswer: 1,
                  explanation: 'M. Hamel taught French in an Alsace village school before Prussian orders mandated that only German be taught.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// ============================================================================
// Official 4 Subject Sections for Group 4 & VAO:
// 1. General Studies
// 2. Aptitude and Mental Ability
// 3. General Tamil
// 4. General English
// ============================================================================
export const group4Subjects: Group4Subject[] = [
  group4GeneralStudiesSubject,
  group4AptitudeSubject,
  group4GeneralTamilSubject,
  group4GeneralEnglishSubject,
]

export const getGroup4SubjectById = (id: string): Group4Subject | undefined => {
  return group4Subjects.find((s) => s.id === id)
}

export const getGroup4UnitById = (subjectId: string, unitId: number): Group4Unit | undefined => {
  const subject = getGroup4SubjectById(subjectId)
  if (!subject) return undefined
  return subject.units.find((u) => u.id === unitId)
}

export const getGroup4UnitChapterCount = (unit: Group4Unit): number => {
  return unit.chapters.length
}

export const getGroup4UnitLessonCount = (unit: Group4Unit): number => {
  return unit.chapters.reduce((acc, c) => acc + c.lessons.length, 0)
}

export const getTotalGroup4SubjectChapters = (subject: Group4Subject): number => {
  return subject.units.reduce((acc, u) => acc + u.chapters.length, 0)
}

export const getTotalGroup4SubjectLessons = (subject: Group4Subject): number => {
  return subject.units.reduce(
    (acc, u) => acc + u.chapters.reduce((cAcc, c) => cAcc + c.lessons.length, 0),
    0
  )
}
