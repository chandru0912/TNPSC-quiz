import fs from 'fs';
import path from 'path';
import pool from '../db';
import { stagedQuestions } from '../data/stagedQuestionsBatch';
import { stagedQuestionsPart2 } from '../data/stagedQuestionsBatchPart2';
import { stagedQuestionsPart3 } from '../data/stagedQuestionsBatchPart3';
import { stagedQuestionsPart4 } from '../data/stagedQuestionsBatchPart4';
import { stagedQuestionsPart5 } from '../data/stagedQuestionsBatchPart5';

// Additional verified curriculum questions to reach comprehensive 160-question batch
const additionalQuestions = [
  // --- UNIT 1: Science (Physics & Chemistry & Biology) ---
  {
    category: 'group1',
    unitId: 1,
    classId: 9,
    subject: 'Physics',
    lessonTitle: 'Motion',
    topic: 'Equations of Motion',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit I: General Science (Physics)',
    question: 'Which of the following is the correct second equation of uniformly accelerated motion relating displacement (s), initial velocity (u), acceleration (a), and time (t)?',
    options: ['v = u + at', 's = ut + ½at²', 'v² = u² + 2as', 's = vt - ½at²'],
    correctAnswer: 1,
    explanation: 'The second equation of motion for uniform acceleration is s = ut + ½at², derived from the velocity-time relationship.',
    sourceReference: 'Samacheer Kalvi Class 9 Science, Term 1, Lesson 2: Motion, Section 2.5',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 1,
    classId: 9,
    subject: 'Physics',
    lessonTitle: 'Fluids',
    topic: 'Pascal’s Law & Hydraulic Lift',
    difficulty: 'Medium',
    tag: 'Group 1 • Unit I: General Science (Physics)',
    question: 'Pascal’s Principle, which states that pressure applied to an enclosed liquid is transmitted undiminished in all directions, is the operating principle of:',
    options: ['Lactometer', 'Hydraulic Brake and Hydraulic Lift', 'Barometer', 'Venturimeter'],
    correctAnswer: 1,
    explanation: 'Hydraulic brakes, hydraulic presses, and hydraulic lifts work on Pascal’s Law: pressure exerted at any point of an enclosed liquid is transmitted equally in all directions.',
    sourceReference: 'Samacheer Kalvi Class 9 Science, Term 1, Lesson 3: Fluids, Section 3.4',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 1,
    classId: 9,
    subject: 'Physics',
    lessonTitle: 'Electric Charge and Electric Current',
    topic: 'Electric Potential & Ohm’s Law',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit I: General Science (Physics)',
    question: 'What is the SI unit of electric potential difference (voltage)?',
    options: ['Ampere', 'Volt', 'Ohm', 'Coulomb'],
    correctAnswer: 1,
    explanation: 'The SI unit of electric potential difference is the Volt (V), named after Alessandro Volta. One volt is equal to one joule per coulomb (1 V = 1 J/C).',
    sourceReference: 'Samacheer Kalvi Class 9 Science, Term 2, Lesson 4: Electric Current, Section 4.2',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 1,
    classId: 9,
    subject: 'Physics',
    lessonTitle: 'Magnetism and Electromagnetism',
    topic: 'Fleming’s Left Hand Rule & Electric Motor',
    difficulty: 'Medium',
    tag: 'Group 1 • Unit I: General Science (Physics)',
    question: 'In Fleming’s Left Hand Rule used to determine the direction of force on a current-carrying conductor in a magnetic field, the middle finger points in the direction of:',
    options: ['Magnetic field', 'Direction of current', 'Direction of force (motion)', 'Direction of induced EMF'],
    correctAnswer: 1,
    explanation: 'In Fleming’s Left Hand Rule: the thumb represents Force/Motion, the forefinger represents the Magnetic Field, and the middle finger represents the Current.',
    sourceReference: 'Samacheer Kalvi Class 9 Science, Term 2, Lesson 5: Magnetism, Section 5.5',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 1,
    classId: 9,
    subject: 'Chemistry',
    lessonTitle: 'Periodic Classification of Elements',
    topic: 'Mendeleev & Modern Periodic Law',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit I: General Science (Chemistry)',
    question: 'Henry Moseley proposed the Modern Periodic Law in 1913, stating that physical and chemical properties of elements are periodic functions of their:',
    options: ['Atomic mass', 'Atomic number (number of protons)', 'Mass number', 'Valency'],
    correctAnswer: 1,
    explanation: 'Modern Periodic Law states that properties of elements are periodic functions of their atomic numbers (Z), replacing Mendeleev’s atomic mass basis.',
    sourceReference: 'Samacheer Kalvi Class 9 Science, Lesson 12: Periodic Classification, Section 12.2',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 1,
    classId: 9,
    subject: 'Chemistry',
    lessonTitle: 'Acids, Bases and Salts',
    topic: 'Universal Indicators & Common Acids',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit I: General Science (Chemistry)',
    question: 'Which natural organic acid is predominantly present in citrus fruits such as lemons and oranges?',
    options: ['Acetic acid', 'Citric acid', 'Lactic acid', 'Tartaric acid'],
    correctAnswer: 1,
    explanation: 'Lemons and oranges contain citric acid; vinegar contains acetic acid, curd contains lactic acid, and tamarind contains tartaric acid.',
    sourceReference: 'Samacheer Kalvi Class 9 Science, Lesson 14: Acids, Bases and Salts, Section 14.1',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 1,
    classId: 9,
    subject: 'Biology',
    lessonTitle: 'Cell Biology',
    topic: 'Cell Organelles & Mitochondria',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit I: General Science (Biology)',
    question: 'Which organelle is designated as the "Powerhouse of the Cell" because it synthesizes ATP through cellular respiration?',
    options: ['Golgi apparatus', 'Mitochondria', 'Endoplasmic reticulum', 'Lysosome'],
    correctAnswer: 1,
    explanation: 'Mitochondria produce cellular energy in the form of Adenosine Triphosphate (ATP) via the Krebs cycle and oxidative phosphorylation.',
    sourceReference: 'Samacheer Kalvi Class 9 Science, Lesson 18: Cell Biology, Section 18.3',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 1,
    classId: 9,
    subject: 'Biology',
    lessonTitle: 'Nutrition and Health',
    topic: 'Vitamins & Deficiency Diseases',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit I: General Science (Biology)',
    question: 'Deficiency of Vitamin C (Ascorbic acid) in the human diet leads to which clinical deficiency disease?',
    options: ['Beriberi', 'Scurvy (bleeding gums)', 'Rickets', 'Pellagra'],
    correctAnswer: 1,
    explanation: 'Deficiency of Vitamin C causes Scurvy, characterized by spongy and bleeding gums, delayed wound healing, and skin haemorrhages.',
    sourceReference: 'Samacheer Kalvi Class 9 Science, Lesson 21: Nutrition and Health, Section 21.4',
    status: 'staging'
  },

  // --- UNIT 2: GEOGRAPHY OF INDIA & TAMIL NADU ---
  {
    category: 'group1',
    unitId: 2,
    classId: 9,
    subject: 'Geography',
    lessonTitle: 'Lithosphere – I Endogenetic Processes',
    topic: 'Plate Tectonics & Earthquakes',
    difficulty: 'Medium',
    tag: 'Group 1 • Unit II: Geography of India',
    question: 'The point on the Earth’s surface vertically directly above the underground focus (hypocentre) of an earthquake is termed as the:',
    options: ['Seismic Centre', 'Epicentre', 'Fault Line', 'Seismograph'],
    correctAnswer: 1,
    explanation: 'The hypocentre (focus) is the point of origin inside the earth, and the point on the surface directly above it is called the Epicentre.',
    sourceReference: 'Samacheer Kalvi Class 9 Social Science, Geography Lesson 1, Section 1.3',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 2,
    classId: 9,
    subject: 'Geography',
    lessonTitle: 'Atmosphere',
    topic: 'Atmospheric Layers & Ozone Layer',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit II: Geography of India',
    question: 'In which layer of the Earth’s atmosphere is the protective Ozone layer (O3) primarily concentrated?',
    options: ['Troposphere', 'Stratosphere', 'Mesosphere', 'Thermosphere'],
    correctAnswer: 1,
    explanation: 'The ozone layer is concentrated in the Stratosphere between 15 km and 35 km altitude, absorbing harmful ultraviolet (UV) solar radiation.',
    sourceReference: 'Samacheer Kalvi Class 9 Social Science, Geography Lesson 3, Section 3.2',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 2,
    classId: 10,
    subject: 'Geography',
    lessonTitle: 'India: Location, Relief and Drainage',
    topic: 'Standard Meridian of India (82°30′ E)',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit II: Geography of India',
    question: 'The Indian Standard Meridian (82°30′ E longitude) passes through which city near Prayagraj (Allahabad)?',
    options: ['Mirzapur', 'Varanasi', 'Kanpur', 'Patna'],
    correctAnswer: 0,
    explanation: 'Indian Standard Time (IST) is calculated based on the 82°30′ E longitude passing through Mirzapur near Prayagraj, which is UTC + 5:30 hours ahead of GMT.',
    sourceReference: 'Samacheer Kalvi Class 10 Social Science, Geography Lesson 1, Section 1.1',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 2,
    classId: 10,
    subject: 'Geography',
    lessonTitle: 'India: Population, Transport, Communication & Trade',
    topic: 'National Highways & Golden Quadrilateral',
    difficulty: 'Medium',
    tag: 'Group 1 • Unit II: Geography of India',
    question: 'The Golden Quadrilateral highway project with a total length of 5,846 km connects which four major metropolitan cities of India?',
    options: [
      'Delhi, Mumbai, Chennai, Kolkata',
      'Delhi, Bengaluru, Hyderabad, Kolkata',
      'Mumbai, Pune, Bengaluru, Chennai',
      'Ahmedabad, Mumbai, Chennai, Visakhapatnam'
    ],
    correctAnswer: 0,
    explanation: 'The Golden Quadrilateral super-highway connects the 4 mega cities: Delhi, Mumbai, Chennai, and Kolkata, managed by NHAI.',
    sourceReference: 'Samacheer Kalvi Class 10 Social Science, Geography Lesson 5, Section 5.2',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 2,
    classId: 10,
    subject: 'Geography',
    lessonTitle: 'Physical Geography of Tamil Nadu',
    topic: 'Wildlife Sanctuaries & Biosphere Reserves of TN',
    difficulty: 'Medium',
    tag: 'Group 1 • Unit II: Geography of India (Tamil Nadu)',
    question: 'Which was the first declared Biosphere Reserve in India (established in 1986), spanning parts of Tamil Nadu, Kerala, and Karnataka?',
    options: ['Gulf of Mannar', 'Nilgiri Biosphere Reserve', 'Agasthyamalai', 'Sundarbans'],
    correctAnswer: 1,
    explanation: 'The Nilgiri Biosphere Reserve was established in 1986 as India’s first biosphere reserve, encompassing Mudumalai, Mukurthi, Wayanad, and Bandipur.',
    sourceReference: 'Samacheer Kalvi Class 10 Social Science, Geography Lesson 6, Section 6.7',
    status: 'staging'
  },

  // --- UNIT 3: HISTORY & INDIAN NATIONAL MOVEMENT ---
  {
    category: 'group1',
    unitId: 3,
    classId: 8,
    subject: 'History',
    lessonTitle: 'People Revolt: Poligar Rebellion & 1806 Vellore Mutiny',
    topic: 'Queen Velu Nachiyar of Sivagangai',
    difficulty: 'Medium',
    tag: 'Group 1 • Unit III: History of Tamil Nadu',
    question: 'Who was the trusted commander of Queen Velu Nachiyar’s women army wing (Udaiyal) who executed a suicide bombing attack on the British ammunition depot at Sivagangai?',
    options: ['Kuyili', 'Nachiar', 'Anjalai Ammal', 'Rani Mangammal'],
    correctAnswer: 0,
    explanation: 'Kuyili drenched herself in oil, set herself ablaze, and leapt into the British ammunition storehouse, destroying British munitions in 1780.',
    sourceReference: 'Samacheer Kalvi Class 8 Social Science, Term 1, History Lesson 4, Section 4.2',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 3,
    classId: 10,
    subject: 'History',
    lessonTitle: 'Anti-Colonial Movements and Birth of Nationalism',
    topic: 'Formation of Indian National Congress 1885',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit III: Indian National Movement',
    question: 'Who presided over the historic first session of the Indian National Congress held at Bombay in December 1885?',
    options: ['Allan Octavian Hume', 'W.C. Bonnerjee', 'Dadabhai Naoroji', 'Badruddin Tyabji'],
    correctAnswer: 1,
    explanation: 'Womesh Chandra Bonnerjee was elected president of the inaugural session of the Indian National Congress held at Gokuldas Tejpal Sanskrit College in Bombay.',
    sourceReference: 'Samacheer Kalvi Class 10 Social Science, History Lesson 7, Section 7.3',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 3,
    classId: 10,
    subject: 'History',
    lessonTitle: 'Anti-Colonial Movements and Birth of Nationalism',
    topic: 'Drain of Wealth Theory',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit III: Indian National Movement',
    question: 'Which prominent early nationalist leader formulated the "Drain of Wealth" theory in his pioneering book "Poverty and Un-British Rule in India"?',
    options: ['Gopal Krishna Gokhale', 'Dadabhai Naoroji', 'R.C. Dutt', 'M.G. Ranade'],
    correctAnswer: 1,
    explanation: 'Dadabhai Naoroji (the Grand Old Man of India) exposed how British rule drained millions of pounds of Indian wealth annually to Britain without economic return.',
    sourceReference: 'Samacheer Kalvi Class 10 Social Science, History Lesson 7, Section 7.4',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 3,
    classId: 10,
    subject: 'History',
    lessonTitle: 'Gandhian Era of Freedom Struggle',
    topic: 'Jallianwala Bagh Massacre 1919',
    difficulty: 'Medium',
    tag: 'Group 1 • Unit III: Indian National Movement',
    question: 'In protest against the horrific Jallianwala Bagh massacre on 13 April 1919, who renounced his British Knighthood?',
    options: ['Mahatma Gandhi', 'Rabindranath Tagore', 'Subhas Chandra Bose', 'Sir Syed Ahmad Khan'],
    correctAnswer: 1,
    explanation: 'Rabindranath Tagore renounced his British Knighthood in May 1919 with a stirring letter to the Viceroy expressing condemnation of the Amritsar massacre.',
    sourceReference: 'Samacheer Kalvi Class 10 Social Science, History Lesson 8, Section 8.2',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 3,
    classId: 10,
    subject: 'History',
    lessonTitle: 'Freedom Struggle in Tamil Nadu',
    topic: 'Subramania Siva & V.O. Chidambaranar',
    difficulty: 'Medium',
    tag: 'Group 1 • Unit III: Freedom Struggle in Tamil Nadu',
    question: 'Which patriotic nationalist leader established the "Bharat Ashram" at Papparapatti in Dharmapuri district to train youth for freedom struggle?',
    options: ['Subramania Bharati', 'Subramania Siva', 'V.V.S. Iyer', 'Tiruppur Kumaran'],
    correctAnswer: 1,
    explanation: 'Subramania Siva established the Bharat Matha temple and Bharat Ashram at Papparapatti in Dharmapuri district to instill patriotic devotion among the youth.',
    sourceReference: 'Samacheer Kalvi Class 10 Social Science, History Lesson 9, Section 9.2',
    status: 'staging'
  },

  // --- UNIT 4: INDIAN POLITY ---
  {
    category: 'group1',
    unitId: 4,
    classId: 10,
    subject: 'Polity',
    lessonTitle: 'Indian Constitution: Preamble, Rights & DPSP',
    topic: 'Directive Principles of State Policy (DPSP)',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit IV: Indian Polity (DPSP)',
    question: 'The Directive Principles of State Policy (Part IV, Articles 36–51) in the Indian Constitution were borrowed from the Constitution of which country?',
    options: ['United States of America', 'Ireland (Irish Constitution)', 'United Kingdom', 'Canada'],
    correctAnswer: 1,
    explanation: 'DPSP was inspired by the Constitution of Ireland (which had copied it from the Spanish Constitution).',
    sourceReference: 'Samacheer Kalvi Class 10 Social Science, Civics Lesson 1, Section 1.4',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 4,
    classId: 10,
    subject: 'Polity',
    lessonTitle: 'Indian Constitution: Preamble, Rights & DPSP',
    topic: 'Fundamental Duties & Swaran Singh Committee',
    difficulty: 'Medium',
    tag: 'Group 1 • Unit IV: Indian Polity (Fundamental Duties)',
    question: 'Fundamental Duties were incorporated into Part IV-A (Article 51-A) of the Indian Constitution on the recommendation of which committee?',
    options: ['Sarkaria Commission', 'Swaran Singh Committee', 'Verma Committee', 'Kothari Commission'],
    correctAnswer: 1,
    explanation: 'The Sardar Swaran Singh Committee (1976) recommended the inclusion of Fundamental Duties, which were enacted via the 42nd Constitutional Amendment Act 1976.',
    sourceReference: 'Samacheer Kalvi Class 10 Social Science, Civics Lesson 1, Section 1.5',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 4,
    classId: 10,
    subject: 'Polity',
    lessonTitle: 'Central Government: Executive and Parliament',
    topic: 'Supreme Court & Judicial Review',
    difficulty: 'Medium',
    tag: 'Group 1 • Unit IV: Indian Polity (Judiciary)',
    question: 'The concept of "Judicial Review", which empowers the Supreme Court and High Courts to strike down unconstitutional legislation, was adopted from:',
    options: ['British Parliamentary System', 'US Constitution', 'Australian Constitution', 'French Republic'],
    correctAnswer: 1,
    explanation: 'Judicial Review in India is adopted from the United States constitutional jurisprudence (Marbury v. Madison).',
    sourceReference: 'Samacheer Kalvi Class 10 Social Science, Civics Lesson 2, Section 2.7',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 4,
    classId: 9,
    subject: 'Polity',
    lessonTitle: 'Local Self Government: 73rd and 74th CAA',
    topic: '73rd Amendment & Grama Sabha',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit IV: Indian Polity (Local Government)',
    question: 'Under the 73rd Constitutional Amendment Act 1992, which permanent statutory body at the grassroots village level consists of all registered voters in the panchayat area?',
    options: ['Panchayat Samiti', 'Grama Sabha', 'Nyaya Panchayat', 'Zilla Parishad'],
    correctAnswer: 1,
    explanation: 'Under Article 243-A, the Grama Sabha is the grassroots general assembly composed of all persons registered in the electoral rolls of a village panchayat.',
    sourceReference: 'Samacheer Kalvi Class 9 Social Science, Civics Lesson 5, Section 5.3',
    status: 'staging'
  },

  // --- UNIT 5: INDIAN ECONOMY & TAMIL NADU ADMINISTRATION ---
  {
    category: 'group1',
    unitId: 5,
    classId: 10,
    subject: 'Economics',
    lessonTitle: 'Food Security and Universal PDS in Tamil Nadu',
    topic: 'National Food Security Act 2013',
    difficulty: 'Medium',
    tag: 'Group 1 • Unit V: Indian Economy (Food Security)',
    question: 'The National Food Security Act (NFSA) was passed by the Parliament of India in which year to legally guarantee subsidized foodgrains to eligible beneficiaries?',
    options: ['2009', '2011', '2013', '2015'],
    correctAnswer: 2,
    explanation: 'The National Food Security Act (NFSA) was enacted in September 2013, covering up to 75% of the rural population and 50% of the urban population.',
    sourceReference: 'Samacheer Kalvi Class 10 Social Science, Economics Lesson 3, Section 3.2',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 5,
    classId: 11,
    subject: 'Economics',
    lessonTitle: 'Indian Economy: Structural Features & Demography',
    topic: 'Demographic Transition & 2011 Census',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit V: Indian Economy (Demography)',
    question: 'Which year is famously known as the "Year of Great Divide" in the demographic history of India because population growth began steadily rising after it?',
    options: ['1911', '1921', '1951', '1971'],
    correctAnswer: 1,
    explanation: 'The Census of 1921 is known as the "Year of Great Divide" because prior to 1921 India had fluctuating population growth due to famines, after which it showed constant upward growth.',
    sourceReference: 'Samacheer Kalvi Class 11 Economics, Lesson 7: Indian Economy, Section 7.4',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 5,
    classId: 11,
    subject: 'Economics',
    lessonTitle: 'Development Experiences in India: 1991 Reforms',
    topic: 'LPG Policies & New Economic Policy 1991',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit V: Indian Economy (1991 Reforms)',
    question: 'Who was the Finance Minister of India who introduced the landmark New Economic Policy (LPG: Liberalisation, Privatisation, Globalisation) in July 1991?',
    options: ['P. Chidambaram', 'Dr. Manmohan Singh', 'Yashwant Sinha', 'Pranab Mukherjee'],
    correctAnswer: 1,
    explanation: 'Dr. Manmohan Singh served as Union Finance Minister in P.V. Narasimha Rao’s cabinet when the historic 1991 economic reforms budget was delivered.',
    sourceReference: 'Samacheer Kalvi Class 11 Economics, Lesson 8: Indian Economy, Section 8.2',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 5,
    classId: 12,
    subject: 'Economics',
    lessonTitle: 'Fiscal Economics: Budget, Deficits & Taxation',
    topic: 'Finance Commission (Article 280)',
    difficulty: 'Medium',
    tag: 'Group 1 • Unit V: Indian Economy (Fiscal)',
    question: 'Under Article 280 of the Indian Constitution, the Finance Commission is constituted by the President of India at the expiration of every:',
    options: ['3 years', '5 years', '6 years', '10 years'],
    correctAnswer: 1,
    explanation: 'Article 280 requires the President to constitute a Finance Commission every fifth year or earlier to recommend the sharing of tax revenues between Union and States.',
    sourceReference: 'Samacheer Kalvi Class 12 Economics, Lesson 9: Fiscal Economics, Section 9.6',
    status: 'staging'
  },

  // --- UNIT 6: TAMIL NADU HISTORY, CULTURE & HERITAGE ---
  {
    category: 'group1',
    unitId: 6,
    classId: 6,
    subject: 'History',
    lessonTitle: 'Society and Culture in Ancient Tamizhagam: The Sangam Age',
    topic: 'Three Crowned Kings (Cheras, Cholas, Pandyas)',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit VI: Sangam Age',
    question: 'The royal emblem of the Chera rulers during the ancient Sangam Age was the:',
    options: ['Tiger (புலி)', 'Bow and Arrow (வில் அம்பு)', 'Two Fishes (கயல் மீன்)', 'Lion (சிங்கம்)'],
    correctAnswer: 1,
    explanation: 'During the Sangam period: Cheras had the Bow and Arrow, Cholas had the Tiger, and Pandyas had the Double Fish (Carp) as their royal crest.',
    sourceReference: 'Samacheer Kalvi Class 6 Social Science, Term 3, History Lesson 1, Section 1.3',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 6,
    classId: 9,
    subject: 'Tamil & History',
    lessonTitle: 'Thirukkural: Secular Philosophy and Everyday Conduct',
    topic: 'Structure and Universal Human Values of Thirukkural',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit VI: Thirukkural',
    question: 'The Thirukkural by Thiruvalluvar is classified into three divisions (Arathuppal, Porutpal, Kammathuppal) comprising how many total chapters (Adhikarams) and couplets (Kurals)?',
    options: [
      '108 Chapters and 1080 Kurals',
      '133 Chapters and 1330 Kurals',
      '150 Chapters and 1500 Kurals',
      '100 Chapters and 1000 Kurals'
    ],
    correctAnswer: 1,
    explanation: 'Thirukkural consists of 133 Adhikarams, each containing 10 Kurals, totaling 1,330 couplets across Aram (38), Porul (70), and Inbam (25).',
    sourceReference: 'Samacheer Kalvi Class 9 Tamil & Social Science, Unit 3: Thirukkural',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 6,
    classId: 10,
    subject: 'History',
    lessonTitle: 'The Justice Party and Non-Brahmin Movement',
    topic: 'Midday Meal Scheme & Justice Party Firsts',
    difficulty: 'Medium',
    tag: 'Group 1 • Unit VI: Justice Party Governance',
    question: 'In 1920, the Justice Party government under Sir P. Theagaraya Chetty introduced the pioneer Midday Meal scheme in corporation schools of which city?',
    options: ['Madurai', 'Madras (Thousand Lights)', 'Tiruchirappalli', 'Coimbatore'],
    correctAnswer: 1,
    explanation: 'The Madras Corporation under Mayor Sir P. Theagaraya Chetty introduced a free school lunch scheme for poor children at Thousand Lights, Madras in 1920.',
    sourceReference: 'Samacheer Kalvi Class 10 Social Science, History Lesson 10, Section 10.2',
    status: 'staging'
  },
  {
    category: 'group1',
    unitId: 6,
    classId: 10,
    subject: 'History',
    lessonTitle: 'The Dravidian Movement and Perarignar Anna',
    topic: 'C.N. Annadurai Reforms (Self-Respect Marriages)',
    difficulty: 'Easy',
    tag: 'Group 1 • Unit VI: Dravidian Administration',
    question: 'In 1967, Chief Minister C.N. Annadurai legalised Self-Respect Marriages (Suyamariyadhai Thirumanam) without priestly rituals by amending which act?',
    options: [
      'Special Marriage Act 1954',
      'Hindu Marriage Act 1955 (Section 7-A)',
      'Indian Succession Act 1925',
      'Civil Marriages Act 1872'
    ],
    correctAnswer: 1,
    explanation: 'The Hindu Marriage (Tamil Nadu Amendment) Act 1967 inserted Section 7-A into the Hindu Marriage Act 1955, granting full legal recognition to Self-Respect Marriages.',
    sourceReference: 'Samacheer Kalvi Class 10 Social Science, History Lesson 10, Section 10.6',
    status: 'staging'
  }
];

export async function generateAndStageBatch() {
  console.log('--- Generating & Staging Comprehensive Batch 1 Questions ---');

  const allStaged = [
    ...stagedQuestions,
    ...additionalQuestions,
    ...stagedQuestionsPart2,
    ...stagedQuestionsPart3,
    ...stagedQuestionsPart4,
    ...stagedQuestionsPart5,
  ];
  console.log(`Total questions compiled for batch: ${allStaged.length}`);

  // 1. Write the full reviewable staging JSON file
  const stagingFilePath = path.resolve(__dirname, '../../../staged_questions_batch1.json');
  fs.writeFileSync(stagingFilePath, JSON.stringify(allStaged, null, 2), 'utf-8');
  console.log(`Staging JSON written to: ${stagingFilePath}`);

  // 2. Perform direct batch insertion into database with status = 'staging'
  const client = await pool.connect();
  let inserted = 0;
  let duplicates = 0;

  try {
    await client.query('BEGIN');

    for (const q of allStaged) {
      const query = `
        INSERT INTO questions (
          category, unit_id, class_id, subject, lesson_title, topic,
          difficulty, tag, question_text, options, correct_answer,
          explanation, source_reference, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'staging')
        ON CONFLICT (lesson_title, question_text) DO NOTHING
        RETURNING id;
      `;
      const values = [
        q.category,
        q.unitId,
        q.classId,
        q.subject,
        q.lessonTitle,
        q.topic,
        q.difficulty,
        q.tag,
        q.question,
        JSON.stringify(q.options),
        q.correctAnswer,
        q.explanation,
        q.sourceReference,
      ];

      const res = await client.query(query, values);
      if (res.rowCount && res.rowCount > 0) {
        inserted++;
      } else {
        duplicates++;
      }
    }

    await client.query('COMMIT');
    console.log(`Database batch staging completed: ${inserted} staged, ${duplicates} duplicates skipped.`);

    // Check count of staging vs published
    const countRes = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM questions 
      GROUP BY status;
    `);
    console.log('Current Database Question Counts by Status:', countRes.rows);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error staging batch into database:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  generateAndStageBatch();
}
