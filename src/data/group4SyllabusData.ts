// Official TNPSC Group 4 & VAO Syllabus Data
// Source: Combined Civil Services Examination – IV (Group IV Services) (Code: 496, Dated: 12.12.2024)
// Scheme: Single Paper in SSLC Standard consisting of:
// Part A: General Studies (75 Questions)
// Part B: Aptitude and Mental Ability (25 Questions)
// Part C: Tamil Eligibility-cum-Scoring Test (100 Questions) / General English (100 Questions)
// Total: 200 Questions / 300 Marks / 3 Hours

import { group4GeneralTamilUnits } from './generalTamilComprehensiveData'

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
  partTag: 'Part A • SSLC Standard',
  standard: 'SSLC Standard (75 Questions • 112.5 Marks)',
  questionCount: 75,
  description:
    'Official TNPSC Group 4 preliminary syllabus covering General Science (5 Qs), Geography (5 Qs), History & Culture of India and INM (10 Qs), Indian Polity (15 Qs), Indian Economy & Development Administration in TN (20 Qs), and History, Culture, Heritage & Socio-Political Movements of Tamil Nadu (20 Qs).',
  accentColor: '#38bdf8',
  units: [
    {
      id: 1,
      unitNumber: 'Unit 1',
      title: 'General Science',
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
      unitNumber: 'Unit 2',
      title: 'Geography',
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
      unitNumber: 'Unit 3',
      title: 'History, Culture of India & Indian National Movement',
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
      unitNumber: 'Unit 4',
      title: 'Indian Polity',
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
      unitNumber: 'Unit 5',
      title: 'Indian Economy & Development Administration in Tamil Nadu',
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
      unitNumber: 'Unit 6',
      title: 'History, Culture, Heritage & Socio-Political Movements of Tamil Nadu',
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
  partTag: 'Part B • SSLC Standard',
  standard: 'SSLC Standard (25 Questions • 37.5 Marks)',
  questionCount: 25,
  description:
    'Official TNPSC Group 4 Aptitude syllabus consisting of Unit I: Aptitude (15 Questions: Simplification, Percentage, HCF/LCM, Ratio, Simple & Compound Interest, Area, Volume, Time & Work) and Unit II: Reasoning (10 Questions: Logical reasoning, Puzzles, Dice, Visual, Alpha-numeric reasoning, Number series).',
  accentColor: '#fbbf24',
  units: [
    {
      id: 1,
      unitNumber: 'Unit 1',
      title: 'Aptitude',
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
      unitNumber: 'Unit 2',
      title: 'Reasoning',
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
  units: group4GeneralTamilUnits,
}

// ============================================================================
// SUBJECT 4: General English (Part C: SSLC Standard – 100 Questions)
// (For Differently Abled Candidates only)
// ============================================================================
export const group4GeneralEnglishSubject: Group4Subject = {
  id: 'general-english',
  order: 4,
  title: 'General English',
  partTag: 'Part C • SSLC Standard',
  standard: 'SSLC Standard (100 Questions • 150 Marks)',
  questionCount: 100,
  description:
    'Official TNPSC Group 4 Syllabus (Code: 496): Unit I Grammar (25 Qs), Unit II Vocabulary (15 Qs), Unit III Writing Skills (10 Qs), Unit IV Technical Terms (10 Qs), Unit V Reading Comprehension (20 Qs), Unit VI Translation (5 Qs), and Unit VII Literary Works (15 Qs) covering the 30 Poems and 26 Prose works from Tamil Nadu school textbooks.',
  accentColor: '#a855f7',
  units: [
    {
      id: 1,
      unitNumber: 'Unit 1',
      title: 'Grammar',
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
      unitNumber: 'Unit 2',
      title: 'Vocabulary',
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
      unitNumber: 'Unit 3',
      title: 'Writing Skills',
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
      unitNumber: 'Unit 4',
      title: 'Technical Terms',
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
      unitNumber: 'Unit 5',
      title: 'Reading Comprehension',
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
      unitNumber: 'Unit 6',
      title: 'Translation',
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
      unitNumber: 'Unit 7',
      title: 'Literary Works (SSLC Standard)',
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
