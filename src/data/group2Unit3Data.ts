// TNPSC Group 2 & 2A Syllabus Mapping: Unit 3 - History, Culture of India, and Indian National Movement
// 100% Comprehensive Mapping to Samacheer Kalvi Textbooks (Classes 6 to 12)
// Source: TNPSC Group 2 & 2A Preliminary Syllabus (Code: 495)

import type { Group2UnitClassData } from './group2ClassSyllabusData'

export const group2Unit3Registry: Record<string, Group2UnitClassData> = {
  // -------------------------------------------------------------------------
  // 6TH STANDARD - UNIT 3
  // -------------------------------------------------------------------------
  'general-studies-3-6': {
    subjectId: 'general-studies',
    unitId: 3,
    classId: 6,
    subjectTitle: 'General Studies',
    unitTitle: 'History, Culture of India, and Indian National Movement',
    unitNumber: 'Unit 3',
    classTitle: '6th Standard',
    standardNumber: 6,
    subjectName: 'Social Science - History',
    topics: [
      'What is History & Prehistoric India: Rock Paintings, Chronology',
      'Human Evolution: Stone Age, Nomadic Life to Settlements',
      'Indus Valley Civilisation: Harappa, Mohenjo-Daro, Lothal Dockyard, Great Bath',
      'Ancient Cities of Tamilagam: Poompuhar, Madurai, Kanchi',
      'Vedic Culture in North India & Megalithic Culture in South India',
      'Great Thinkers & New Faiths: Jainism (Mahavira), Buddhism (Buddha)',
      'From Chiefdoms to Empires: Mauryas, Ashoka, Kalinga War',
      'Sangam Age Polity: Muvendhar, Five Tinais, Kallanai Dam, Roman Trade',
      'Guptas & Harshavardhana: Golden Age, Samudragupta, Nalanda University',
      'South Indian Kingdoms: Pallavas of Kanchi, Mamallapuram Rock-cut Caves',
    ],
    lessons: [
      {
        id: 'gs-3-6-l1',
        lessonNumber: '3.1',
        term: 'Term 1',
        title: 'What is History?',
        description: 'Introduction to historical sources, archaeological artifacts, rock paintings, and BCE/CE chronology.',
        status: 'Available',
        keyConcepts: ['Sources of History', 'BCE and CE', 'Rock Paintings of Bhimbetka', 'Ashoka Inscriptions'],
        studyNotes: [
          'History is the systematic study of past events in chronological order; derived from the Greek "historia".',
          'Emperor Ashoka embraced Buddhism and non-violence after the Kalinga War (261 BCE).',
          'The National Emblem of India is adopted from the Lion Capital of Ashoka at Sarnath.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-6-1',
            question: 'The Lion Capital on the Ashoka Pillar, adopted as the National Emblem of India, is located at which place?',
            options: ['Bodh Gaya', 'Sarnath', 'Lumbini', 'Sanchi'],
            correctAnswer: 1,
            explanation: 'The Lion Capital was erected by Emperor Ashoka at Sarnath, Uttar Pradesh, where Buddha delivered his first sermon.',
          },
        ],
      },
      {
        id: 'gs-3-6-l2',
        lessonNumber: '3.2',
        term: 'Term 1',
        title: 'Human Evolution',
        description: 'Biological and cultural evolution of humans from Australopithecus to Homo sapiens and invention of fire and wheel.',
        status: 'Available',
        keyConcepts: ['Stages of Evolution', 'Discovery of Fire', 'Invention of Wheel', 'Rock Art in Tamil Nadu'],
        studyNotes: [
          'Homo sapiens (Wise Man) emerged in Africa and developed complex tools and language.',
          'Prehistoric rock art in Tamil Nadu is found at Kilvalai, Mallapadi, and Usilampatti.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-6-2',
            question: 'Which species of early human is recognized as the "Wise Man" from whom modern humans evolved?',
            options: ['Australopithecus', 'Homo habilis', 'Homo erectus', 'Homo sapiens'],
            correctAnswer: 3,
            explanation: 'Homo sapiens evolved in Africa and developed symbolic communication, agriculture, and tool mastery.',
          },
        ],
      },
      {
        id: 'gs-3-6-l3',
        lessonNumber: '3.3',
        term: 'Term 1',
        title: 'Indus Civilisation',
        description: 'Urban planning of Harappa and Mohenjo-Daro, grid system, drainage, Great Bath, dockyard at Lothal, and seal inscriptions.',
        status: 'Available',
        keyConcepts: ['Grid Planning', 'Great Bath of Mohenjo-Daro', 'Tidal Dockyard at Lothal', 'Dancing Girl Bronze'],
        studyNotes: [
          'The Indus Valley Civilisation (c. 3300–1900 BCE) was a Bronze Age urban civilization characterized by baked brick architecture.',
          'Lothal in Gujarat served as a world-pioneering naval dockyard connected to the Gulf of Khambhat.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-6-3',
            question: 'At which Harappan site was an engineered tidal dockyard discovered by archaeologists?',
            options: ['Kalibangan', 'Lothal', 'Dholavira', 'Banawali'],
            correctAnswer: 1,
            explanation: 'Lothal in Gujarat was an important Harappan seaport and naval dockyard.',
          },
        ],
      },
      {
        id: 'gs-3-6-l4',
        lessonNumber: '3.4',
        term: 'Term 1',
        title: 'Ancient Cities of Tamilagam',
        description: 'Historic emporiums and cultural hubs: Poompuhar port, Madurai the seat of Sangam, and Kanchipuram the city of learning.',
        status: 'Available',
        keyConcepts: ['Poompuhar Port', 'Madurai the Sangam City', 'Kanchipuram Educational Hub', 'Keeladi Excavations'],
        studyNotes: [
          'Poompuhar was a bustling international port where foreign merchants lived and traded, celebrated in Silappathikaram.',
          'Madurai hosted all three Tamil Sangams; it was documented by Megasthenes and Xuanzang.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-6-4',
            question: 'Which ancient Tamil city was celebrated as the "City of Temples" and renowned as an eminent educational hub visited by Xuanzang?',
            options: ['Madurai', 'Kanchipuram', 'Poompuhar', 'Uraiyur'],
            correctAnswer: 1,
            explanation: 'Kanchipuram was known as an educational center (Ghatika) where renowned scholars like Dharmapala taught.',
          },
        ],
      },
      {
        id: 'gs-3-6-l5',
        lessonNumber: '3.5',
        term: 'Term 2',
        title: 'Vedic Culture in North India and Megalithic Culture in South India',
        description: 'Vedic literature, pastoral-agrarian economy, Sabha, Samiti, Iron Age Megalithic urn burials at Adichanallur and Kodumanal.',
        status: 'Available',
        keyConcepts: ['Early vs Later Vedic Period', 'Sabha and Samiti', 'Adichanallur Urn Burials', 'Megalithic Monuments'],
        studyNotes: [
          'While North India moved into the Later Vedic era, South India witnessed the flourishing Megalithic Iron Age.',
          'Adichanallur in Thoothukudi district yielded hundreds of burial urns (Mudumakkal Thazhi) with iron implements.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-6-5',
            question: 'At which archaeological site in Tamil Nadu were massive Megalithic burial urns (Mudumakkal Thazhi) extensively excavated?',
            options: ['Adichanallur', 'Gangaikonda Cholapuram', 'Mamallapuram', 'Puhar'],
            correctAnswer: 0,
            explanation: 'Adichanallur in Thoothukudi district is one of the richest Iron Age urn burial sites in South India.',
          },
        ],
      },
      {
        id: 'gs-3-6-l6',
        lessonNumber: '3.6',
        term: 'Term 2',
        title: 'Great Thinkers and New Faiths',
        description: 'Socio-religious background of the 6th century BCE: Mahavira and Jainism, Gautama Buddha and Buddhism, Eightfold Path.',
        status: 'Available',
        keyConcepts: ['Vardhamana Mahavira (24th Tirthankara)', 'Tri-ratnas of Jainism', 'Four Noble Truths & Eightfold Path', 'Spread of Buddhism'],
        studyNotes: [
          'Vardhamana Mahavira emphasized Ahimsa (non-violence) and preached the Three Jewels (Right faith, Right knowledge, Right conduct).',
          'Buddha attained Enlightenment at Bodh Gaya and delivered his First Sermon (Dharmachakra Pravartana) at Sarnath.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-6-6',
            question: 'Where did Gautama Buddha deliver his first sermon, known in Buddhist philosophy as Dharmachakra Pravartana?',
            options: ['Bodh Gaya', 'Kusinagara', 'Deer Park at Sarnath', 'Rajgriha'],
            correctAnswer: 2,
            explanation: 'Buddha delivered his inaugural sermon to five disciples at the Deer Park in Sarnath.',
          },
        ],
      },
      {
        id: 'gs-3-6-l7',
        lessonNumber: '3.7',
        term: 'Term 2',
        title: 'From Chiefdoms to Empires',
        description: '16 Mahajanapadas, rise of Magadha, Mauryan Empire under Chandragupta Maurya and Ashoka, Kautilya Arthashastra, Megasthenes Indica.',
        status: 'Available',
        keyConcepts: ['16 Mahajanapadas', 'Magadha Rise', 'Chandragupta Maurya & Chanakya', 'Ashoka Inscriptions & Dhamma'],
        studyNotes: [
          'Magadha rose to imperial supremacy due to iron ore mines, fertile alluvium, and timber for fortifications and chariots.',
          'Kautilya’s Arthashastra is a classic treatise on political administration, diplomacy, and civil governance.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-6-7',
            question: 'Which Greek ambassador was sent to the court of Chandragupta Maurya and authored the renowned work "Indica"?',
            options: ['Deimachus', 'Megasthenes', 'Pliny', 'Ptolemy'],
            correctAnswer: 1,
            explanation: 'Megasthenes was the Greek ambassador sent by Seleucus Nicator to Chandragupta Maurya\'s court at Pataliputra.',
          },
        ],
      },
      {
        id: 'gs-3-6-l8',
        lessonNumber: '3.8',
        term: 'Term 3',
        title: 'Society and Culture in Ancient Tamizhagam: The Sangam Age',
        description: 'Muvendhar (Cheras, Cholas, Pandyas), Velirs, Tinai classification, Sangam literature, Kallanai dam, and Indo-Roman trade.',
        status: 'Available',
        keyConcepts: ['Chera, Chola, Pandya Dynasties', 'Five Tinais (Kurinji, Mullai, Marutham, Neithal, Palai)', 'Kallanai Dam by Karikalan', 'Sangam Poets (Avvaiyar, Kapilar)'],
        studyNotes: [
          'Sangam literature comprises Ettuthogai, Pathupattu, and Pathinenkilkanakku moral collections.',
          'King Karikala Chola built the Kallanai dam across the river Cauvery, a masterpiece of ancient hydraulic engineering.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-6-8',
            question: 'Which Sangam monarch constructed the historic Kallanai (Grand Anicut) stone dam across river Cauvery?',
            options: ['Nedunjeliyan', 'Karikala Chola', 'Cheran Senguttuvan', 'Elara'],
            correctAnswer: 1,
            explanation: 'King Karikala of the Early Chola dynasty built the monumental Kallanai dam across the Cauvery.',
          },
        ],
      },
      {
        id: 'gs-3-6-l9',
        lessonNumber: '3.9',
        term: 'Term 3',
        title: 'The Age of Empires: Guptas and Vardhanas',
        description: 'Gupta Empire under Chandragupta I, Samudragupta, Chandragupta II (Vikramaditya), Navaratnas, Nalanda University, and Harshavardhana.',
        status: 'Available',
        keyConcepts: ['Samudragupta Prayag Prashasti', 'Navaratnas (Kalidasa, Aryabhata)', 'Nalanda University', 'Harsha Kingdom of Kannauj'],
        studyNotes: [
          'Samudragupta\'s conquests are inscribed on the Allahabad Pillar by his court poet Harisena.',
          'Nalanda was a residential university of international repute attracting scholars like Xuanzang.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-6-9',
            question: 'Who authored the Allahabad Pillar inscription (Prayag Prashasti) praising the conquests of emperor Samudragupta?',
            options: ['Banabhatta', 'Harisena', 'Kalidasa', 'Ravikirti'],
            correctAnswer: 1,
            explanation: 'Harisena, court poet and minister of Samudragupta, composed the Prayag Prashasti in Sanskrit.',
          },
        ],
      },
      {
        id: 'gs-3-6-l10',
        lessonNumber: '3.10',
        term: 'Term 3',
        title: 'South Indian Kingdoms',
        description: 'Pallavas of Kanchi, rock-cut architecture, monolithic rathas of Mamallapuram, Western Chalukyas, and Rashtrakutas.',
        status: 'Available',
        keyConcepts: ['Mahendravarman I Rock-Cut Temples', 'Mamallapuram Monolithic Rathas', 'Chalukyas of Badami (Pulakesin II)', 'Kailasanatha Temple at Ellora'],
        studyNotes: [
          'Narasimhavarman I defeated Pulakesin II in 642 CE and assumed the title "Vatapikonda".',
          'Pallava architecture is exemplified by the Shore Temple and Pancha Pandava Rathas in Mamallapuram.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-6-10',
            question: 'Which Pallava monarch defeated Pulakesin II and assumed the triumphant title "Vatapikonda"?',
            options: ['Mahendravarman I', 'Narasimhavarman I', 'Nandivarman II', 'Simhavishnu'],
            correctAnswer: 1,
            explanation: 'Narasimhavarman I conquered the Chalukya capital Vatapi and assumed the title Vatapikonda.',
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 7TH STANDARD - UNIT 3
  // -------------------------------------------------------------------------
  'general-studies-3-7': {
    subjectId: 'general-studies',
    unitId: 3,
    classId: 7,
    subjectTitle: 'General Studies',
    unitTitle: 'History, Culture of India, and Indian National Movement',
    unitNumber: 'Unit 3',
    classTitle: '7th Standard',
    standardNumber: 7,
    subjectName: 'Social Science - History',
    topics: [
      'Sources of Medieval India: Inscriptions, Monuments, Tarikh and Travelogues',
      'Emergence of New Kingdoms in North India: Rajputs, Palas, Chauhans',
      'Emergence of New Kingdoms in South India: Later Cholas (Rajaraja, Rajendra) and Pandyas',
      'The Delhi Sultanate: Slave, Khilji, Tughlaq, Sayyid, and Lodi Dynasties',
      'Vijayanagar and Bahmani Kingdoms: Krishnadevaraya, Battle of Talikota',
      'The Mughal Empire: Babur, Akbar (Sulh-i-kul), Jahangir, Shah Jahan, Aurangzeb',
      'Rise of Marathas and Peshwas: Chhatrapati Shivaji, Ashta Pradhan, Guerrilla Warfare',
      'New Religious Ideas and Movements: Bhakti and Sufi Saints (Alwars, Nayanmars, Ramanuja)',
      'Art and Architecture of Tamil Nadu: Dravidian Vimana, Gopurams, Brihadisvara Temple',
    ],
    lessons: [
      {
        id: 'gs-3-7-l1',
        lessonNumber: '3.1',
        term: 'Term 1',
        title: 'Sources of Medieval India',
        description: 'Epigraphical, numismatic, monument, and literary sources of medieval Indian history (Al-Beruni, Ibn Battuta, Marco Polo).',
        status: 'Available',
        keyConcepts: ['Uttiramerur Inscriptions', 'Copper Plate Grants', 'Ibn Battuta (Rihla)', 'Al-Beruni (Tarikh-al-Hind)'],
        studyNotes: [
          'Uttiramerur inscriptions in Kanchipuram provide elaborate details on Kudavolai electoral system in Chola village assemblies.',
          'Al-Beruni accompanied Mahmud of Ghazni and wrote Tarikh-al-Hind, a monumental study of Indian science and culture.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-7-1',
            question: 'Which village inscription in Tamil Nadu provides detailed evidence of the Kudavolai village assembly electoral system under the Cholas?',
            options: ['Manur', 'Uttiramerur', 'Thirumukkudal', 'Ennayiram'],
            correctAnswer: 1,
            explanation: 'Parantaka Chola I\'s Uttiramerur inscriptions describe the qualifications and voting mechanism for local sabhas.',
          },
        ],
      },
      {
        id: 'gs-3-7-l2',
        lessonNumber: '3.2',
        term: 'Term 1',
        title: 'Emergence of New Kingdoms in South India: Later Cholas and Pandyas',
        description: 'Imperial Cholas under Rajaraja I and Rajendra I, naval expeditions to Srivijaya, Brihadisvara Temple, and Second Pandyan Empire.',
        status: 'Available',
        keyConcepts: ['Rajaraja I (Brihadisvara Temple)', 'Rajendra I (Gangaikonda Cholapuram & Kadaram Conquest)', 'Kudavolai System', 'Jatavarman Sundara Pandyan I'],
        studyNotes: [
          'Rajaraja I constructed the Big Temple (Brihadisvara Temple) in Thanjavur completed in 1010 CE.',
          'Rajendra I earned the title "Gangaikonda Cholan" after defeating the Pala king and building Gangaikonda Cholapuram.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-7-2',
            question: 'Which Chola emperor undertook successful naval expeditions to Srivijaya (Sumatra and Malaya) and earned the title "Kadaramkondan"?',
            options: ['Vijayalaya Chola', 'Rajaraja I', 'Rajendra I', 'Kulothunga I'],
            correctAnswer: 2,
            explanation: 'Rajendra I sent powerful naval fleets across the Bay of Bengal, subduing the Srivijaya kingdom.',
          },
        ],
      },
      {
        id: 'gs-3-7-l3',
        lessonNumber: '3.3',
        term: 'Term 1',
        title: 'The Delhi Sultanate',
        description: 'Establishment of Turkish rule in Delhi: Qutb-ud-din Aibak, Iltutmish, Razia Sultan, Balban, Alauddin Khilji, and Muhammad bin Tughlaq.',
        status: 'Available',
        keyConcepts: ['Mamluk / Slave Dynasty', 'Alauddin Khilji Market Reforms', 'Token Currency of Muhammad bin Tughlaq', 'Qutb Minar'],
        studyNotes: [
          'Qutb-ud-din Aibak founded the Slave Dynasty in 1206 CE and started the construction of the Qutb Minar in Delhi.',
          'Alauddin Khilji instituted strict market price controls and established a standing army supported by the Dagh and Chehra system.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-7-3',
            question: 'Who was the first and only woman ruler of the Delhi Sultanate?',
            options: ['Nur Jahan', 'Razia Sultana', 'Chand Bibi', 'Mumtaz Mahal'],
            correctAnswer: 1,
            explanation: 'Razia Sultana, daughter of Iltutmish, ruled the Delhi Sultanate from 1236 to 1240 CE.',
          },
        ],
      },
      {
        id: 'gs-3-7-l4',
        lessonNumber: '3.4',
        term: 'Term 2',
        title: 'Vijayanagar and Bahmani Kingdoms',
        description: 'Foundation of Vijayanagar by Harihara and Bukka, reign of Krishnadevaraya, Battle of Talikota (1565), and Bahmani fragmentation.',
        status: 'Available',
        keyConcepts: ['Harihara & Bukka (Sangama Dynasty)', 'Krishnadevaraya (Tuluva Dynasty)', 'Amuktamalyada', 'Battle of Talikota (Rakshasi-Tangadi 1565)'],
        studyNotes: [
          'Krishnadevaraya (1509–1529) was the greatest emperor of Vijayanagar; his court was adorned by the Ashtadiggajas.',
          'The Battle of Talikota in 1565 led to the catastrophic sacking of Vijayanagar capital Hampi by the allied Deccan Sultanates.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-7-4',
            question: 'Which legendary Vijayanagar monarch authored the epic Telugu poem "Amuktamalyada" on the life of Andal?',
            options: ['Harihara II', 'Devaraya II', 'Krishnadevaraya', 'Rama Raya'],
            correctAnswer: 2,
            explanation: 'Emperor Krishnadevaraya was an accomplished scholar-king who composed Amuktamalyada in Telugu.',
          },
        ],
      },
      {
        id: 'gs-3-7-l5',
        lessonNumber: '3.5',
        term: 'Term 2',
        title: 'The Mughal Empire',
        description: 'Babur (First Battle of Panipat 1526), Humayun, Sher Shah Suri, Akbar (Mansabdari, Din-i-Ilahi), Jahangir, Shah Jahan, Aurangzeb.',
        status: 'Available',
        keyConcepts: ['First Battle of Panipat (1526)', 'Sher Shah Suri Rupiya & Grand Trunk Road', 'Akbar Sulh-i-kul & Mansabdari', 'Taj Mahal (Shah Jahan)'],
        studyNotes: [
          'Babur defeated Ibrahim Lodi in the First Battle of Panipat in 1526 using artillery (tulughma strategy).',
          'Akbar introduced the Mansabdari system for civil-military administration and abolished Jizya tax on non-Muslims.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-7-5',
            question: 'Which Mughal emperor introduced the Mansabdari system and promulgated the syncretic ethical code "Din-i-Ilahi"?',
            options: ['Babur', 'Akbar', 'Jahangir', 'Aurangzeb'],
            correctAnswer: 1,
            explanation: 'Akbar the Great introduced the Mansabdari ranking system and promoted universal peace (Sulh-i-kul).',
          },
        ],
      },
      {
        id: 'gs-3-7-l6',
        lessonNumber: '3.6',
        term: 'Term 2',
        title: 'Rise of Marathas and Peshwas',
        description: 'Chhatrapati Shivaji Maharaj, guerrilla warfare (Ganimi Kava), Ashta Pradhan council, Chauth and Sardeshmukhi, and the Peshwa era.',
        status: 'Available',
        keyConcepts: ['Chhatrapati Shivaji (Coronation at Raigad 1674)', 'Ashta Pradhan Council', 'Chauth & Sardeshmukhi Taxes', 'Peshwa Baji Rao I'],
        studyNotes: [
          'Shivaji was crowned Chhatrapati at Raigad fort in 1674, establishing Swarajya through guerrilla mountain warfare.',
          'The Ashta Pradhan was Shivaji\'s council of eight ministers led by the Peshwa (Prime Minister).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-7-6',
            question: 'What was the administrative council of eight ministers in Chhatrapati Shivaji’s government called?',
            options: ['Navaratnas', 'Ashta Pradhan', 'Ashtadiggajas', 'Paigah'],
            correctAnswer: 1,
            explanation: 'Shivaji governed with the assistance of the Ashta Pradhan council of eight ministers.',
          },
        ],
      },
      {
        id: 'gs-3-7-l7',
        lessonNumber: '3.7',
        term: 'Term 3',
        title: 'New Religious Ideas and Movements',
        description: 'Bhakti movement in South and North India: Alwars, Nayanmars, Ramanuja, Kabir, Guru Nanak, Mirabai, Chaitanya, and Sufism.',
        status: 'Available',
        keyConcepts: ['12 Alwars (Nalayira Divya Prabandham)', '63 Nayanmars (Thevaram & Thiruvasagam)', 'Ramanuja Vishishtadvaita', 'Kabir & Guru Nanak Dev'],
        studyNotes: [
          'The Bhakti movement originated in Tamil Nadu with the Shaivite Nayanmars and Vaishnavite Alwars preaching devotional equality.',
          'Sri Ramanuja expounded the philosophy of Vishishtadvaita (qualified non-dualism) and championed social inclusivity.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-7-7',
            question: 'Who compiled the hymns of the twelve Vaishnavite Alwars into the sacred scripture "Nalayira Divya Prabandham"?',
            options: ['Nambi Andar Nambi', 'Nathamuni', 'Appar', 'Manikkavasagar'],
            correctAnswer: 1,
            explanation: 'Acharya Nathamuni collected and systematized the 4,000 verses composed by the Alwars.',
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 8TH STANDARD - UNIT 3
  // -------------------------------------------------------------------------
  'general-studies-3-8': {
    subjectId: 'general-studies',
    unitId: 3,
    classId: 8,
    subjectTitle: 'General Studies',
    unitTitle: 'History, Culture of India, and Indian National Movement',
    unitNumber: 'Unit 3',
    classTitle: '8th Standard',
    standardNumber: 8,
    subjectName: 'Social Science - History',
    topics: [
      'Advent of Europeans: Portuguese, Dutch, British, Danish, and French settlements',
      'From Trade to Territory: Carnatic Wars, Battle of Plassey (1757), Battle of Buxar (1764)',
      'Subsidary Alliance & Doctrine of Lapse: Wellesley and Dalhousie Expansion Policies',
      'Rural Life and Society: Permanent Settlement, Ryotwari, and Mahalwari Land Revenue',
      'People’s Revolt: South Indian Rebellion (1800-1801), Vellore Revolt (1806), Great Revolt (1857)',
      'Educational Development in India: Macaulay’s Minute (1835), Wood’s Despatch (1854)',
      'Development of Industries & Urban Changes during the British Period',
      'Status of Women in India through the Ages: Sati abolition (1829), Widow Remarriage (1856)',
    ],
    lessons: [
      {
        id: 'gs-3-8-l1',
        lessonNumber: '3.1',
        term: 'Annual',
        title: 'Advent of the Europeans',
        description: 'Sea route discovery to Calicut by Vasco da Gama (1498), trade factories of Portuguese, Dutch, British, and French East India companies.',
        status: 'Available',
        keyConcepts: ['Vasco da Gama (Calicut 1498)', 'Blue Water Policy (Francisco de Almeida)', 'Dutch Coromandel Trade (Pulicat)', 'French Pondicherry (Dupleix)'],
        studyNotes: [
          'Vasco da Gama reached Calicut on May 20, 1498, received by the Zamorin king.',
          'Francis Day obtained Madraspatnam in 1639 and constructed Fort St. George, the first British fortified settlement in India.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-8-1',
            question: 'In which year did the Portuguese explorer Vasco da Gama land at Kappad near Calicut, pioneering the direct sea route to India?',
            options: ['1492', '1498', '1502', '1510'],
            correctAnswer: 1,
            explanation: 'Vasco da Gama landed at Calicut in 1498, opening maritime trade between Europe and India.',
          },
        ],
      },
      {
        id: 'gs-3-8-l2',
        lessonNumber: '3.2',
        term: 'Annual',
        title: 'From Trade to Territory',
        description: 'Carnatic Wars, Battle of Plassey (Robert Clive vs Siraj-ud-daulah), Battle of Buxar, Subsidiary Alliance, and Doctrine of Lapse.',
        status: 'Available',
        keyConcepts: ['Battle of Plassey (1757)', 'Battle of Buxar (1764) & Treaty of Allahabad', 'Lord Wellesley Subsidiary Alliance', 'Lord Dalhousie Doctrine of Lapse'],
        studyNotes: [
          'The Battle of Plassey on June 23, 1757 established the foundation of British political dominion in Bengal.',
          'Lord Wellesley introduced the Subsidiary Alliance in 1798; Hyderabad was the first Indian state to sign it.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-8-2',
            question: 'Which Indian princely state was the first to accept Lord Wellesley’s Subsidiary Alliance treaty in 1798?',
            options: ['Awadh', 'Mysore', 'Hyderabad', 'Tanjore'],
            correctAnswer: 2,
            explanation: 'The Nizam of Hyderabad was the first Indian ruler to sign the Subsidiary Alliance in 1798.',
          },
        ],
      },
      {
        id: 'gs-3-8-l3',
        lessonNumber: '3.3',
        term: 'Annual',
        title: 'Rural Life and Society',
        description: 'Colonial land revenue settlements: Permanent Settlement of Cornwallis, Ryotwari System of Thomas Munro, and Mahalwari System.',
        status: 'Available',
        keyConcepts: ['Permanent Settlement (Cornwallis 1793)', 'Ryotwari System (Thomas Munro 1820 in Madras)', 'Mahalwari System (Holt Mackenzie)', 'Commercialization of Agriculture'],
        studyNotes: [
          'Sir Thomas Munro introduced the Ryotwari system in Madras Presidency in 1820, dealing directly with individual cultivator-peasants.',
          'Permanent Settlement fixed revenue in perpetuity with Zamindars as proprietors, causing widespread peasant indebtedness.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-8-3',
            question: 'Who introduced the Ryotwari land revenue system in Madras Presidency in 1820?',
            options: ['Lord Cornwallis', 'Sir Thomas Munro', 'Holt Mackenzie', 'Warren Hastings'],
            correctAnswer: 1,
            explanation: 'Sir Thomas Munro introduced the Ryotwari settlement in Madras, establishing direct revenue relations with farmers.',
          },
        ],
      },
      {
        id: 'gs-3-8-l4',
        lessonNumber: '3.4',
        term: 'Annual',
        title: 'People’s Revolt',
        description: 'Palayakkarar rebellion: Puli Thevar, Velu Nachiyar, Veerapandiya Kattabomman, Maruthu Brothers, Vellore Revolt 1806, and 1857 Great Revolt.',
        status: 'Available',
        keyConcepts: ['Puli Thevar (Nerkattumseval)', 'Veerapandiya Kattabomman & Kayathar', 'Maruthu Pandiyar Tiruchirappalli Proclamation 1801', 'Vellore Mutiny 1806 & 1857 Revolt'],
        studyNotes: [
          'Puli Thevar was the first Indian ruler to resist and defeat British forces in the battle of Kalakadu.',
          'The Maruthu Pandiyars issued the historic Tiruchirappalli Proclamation of Independence in June 1801, calling for nationwide unity against the British.',
          'The Vellore Revolt of 10 July 1806 preceded the 1857 Sepoy Mutiny by half a century as an early military uprising against British rule.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-8-4',
            question: 'In which year did the historic Vellore Sepoy Revolt break out in Tamil Nadu, serving as a prelude to the 1857 rebellion?',
            options: ['1799', '1801', '1806', '1857'],
            correctAnswer: 2,
            explanation: 'The Vellore Revolt broke out on July 10, 1806, when Indian sepoys seized Vellore Fort against offensive new dress codes.',
          },
        ],
      },
      {
        id: 'gs-3-8-l5',
        lessonNumber: '3.5',
        term: 'Annual',
        title: 'Educational Development in India',
        description: 'Indigenous education, Charter Act of 1813, Macaulay’s Minute of 1835, Wood’s Despatch of 1854 (Magna Carta of English Education), and Hunter Commission.',
        status: 'Available',
        keyConcepts: ['Charter Act 1813 (Rs 1 Lakh Grant)', 'Macaulay Minute 1835', 'Wood Despatch 1854 (Magna Carta of English Education)', 'Serampore Missionaries'],
        studyNotes: [
          'Wood’s Despatch of 1854 is celebrated as the "Magna Carta of English Education in India", establishing universities at Calcutta, Bombay, and Madras in 1857.',
          'Macaulay’s Minute (1835) advocated Western education in the English medium to create a class of English-educated administrators.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-8-5',
            question: 'Which educational despatch sent by the President of the Board of Control is acclaimed as the "Magna Carta of English Education in India"?',
            options: ['Macaulay’s Minute 1835', 'Wood’s Despatch 1854', 'Hunter Commission 1882', 'Sadler Commission 1917'],
            correctAnswer: 1,
            explanation: 'Sir Charles Wood’s Despatch of 1854 created a comprehensive educational hierarchy from primary schools to universities.',
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 9TH STANDARD - UNIT 3
  // -------------------------------------------------------------------------
  'general-studies-3-9': {
    subjectId: 'general-studies',
    unitId: 3,
    classId: 9,
    subjectTitle: 'General Studies',
    unitTitle: 'History, Culture of India, and Indian National Movement',
    unitNumber: 'Unit 3',
    classTitle: '9th Standard',
    standardNumber: 9,
    subjectName: 'Social Science - History',
    topics: [
      'Evolution of Humans and Society: Prehistoric archaeology, Microliths, Rock art',
      'Early Civilisations of the Ancient World: Mesopotamian, Egyptian, Indus, and Chinese',
      'Early Tamil Society and Culture: Epigraphy, Tamil-Brahmi inscriptions, Keeladi, Arikamedu',
      'Intellectual Awakening and Socio-Political Changes: Iron Age religions, Mahavira, Buddha, Confucius',
      'State and Society in Medieval India: Chola polity, Vijayanagar administrative system, Mughals',
      'The Beginning of the Modern Age: Renaissance, Geographical discoveries, Reformation',
    ],
    lessons: [
      {
        id: 'gs-3-9-l1',
        lessonNumber: '3.1',
        term: 'Annual',
        title: 'Early Tamil Society and Culture',
        description: 'Sangam literature, archaeological excavations at Keeladi, Kodumanal, Pattanam, epigraphy, Tamil-Brahmi script, and overseas maritime contacts.',
        status: 'Available',
        keyConcepts: ['Keeladi Archaeological Excavations', 'Tamil-Brahmi Inscriptions', 'Kodumanal Iron & Gem Industry', 'Periplus of the Erythraean Sea'],
        studyNotes: [
          'Excavations at Keeladi on the Vaigai river basin date urban civilization in Tamil Nadu to the 6th century BCE.',
          'Pattanam (Muziris) in Kerala was a major port connecting Sangam Tamilagam with the Roman Empire for pepper and beryl.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-9-1',
            question: 'Archaeological excavations at which site near Madurai have unearthed an ancient urban civilization along the Vaigai river basin dating to 6th century BCE?',
            options: ['Adichanallur', 'Keeladi', 'Poompuhar', 'Kodumanal'],
            correctAnswer: 1,
            explanation: 'Keeladi excavations in Sivaganga district provided scientific evidence of an advanced urban culture contemporaneous with Gangetic urbanism.',
          },
        ],
      },
      {
        id: 'gs-3-9-l2',
        lessonNumber: '3.2',
        term: 'Annual',
        title: 'Intellectual Awakening and Socio-Political Changes',
        description: '6th century BCE socio-economic transformation: Second Urbanisation in the Gangetic valley, Ajivikas, Jainism, Buddhism, and Carvakas.',
        status: 'Available',
        keyConcepts: ['Second Urbanisation', 'Vardhamana Mahavira & Gautama Buddha', 'Makkhali Gosala (Ajivika sect)', 'Ashokan Edicts & Dhamma'],
        studyNotes: [
          'Iron technology accelerated surplus agricultural production in the Gangetic plains, facilitating urbanization and intellectual questioning of Vedic rituals.',
          'The Ajivika sect was founded by Makkhali Gosala, propounding fatalism (Niyati).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-9-2',
            question: 'Who was the founder of the heterodox philosophical sect known as Ajivika during the 6th century BCE?',
            options: ['Makkhali Gosala', 'Ajita Kesakambalin', 'Pakudha Kaccayana', 'Sanjaya Belatthiputta'],
            correctAnswer: 0,
            explanation: 'Makkhali Gosala founded the Ajivika school of philosophy which believed that everything was predetermined by destiny (Niyati).',
          },
        ],
      },
      {
        id: 'gs-3-9-l3',
        lessonNumber: '3.3',
        term: 'Annual',
        title: 'State and Society in Medieval India',
        description: 'Medieval social formations: Chola agrarian expansion, Ur and Sabha, Vijayanagar Nayankara system, and Mughal revenue administration.',
        status: 'Available',
        keyConcepts: ['Chola Brahmadeya & Devadana', 'Nayankara System of Vijayanagar', 'Zabt Revenue System of Todar Mal', 'Bhakti Synthesis'],
        studyNotes: [
          'Under the Cholas, land grants to Brahmins (Brahmadeya) and temples (Devadana) catalyzed agricultural irrigation expansion.',
          'Raja Todar Mal developed the Zabt system of land measurement and revenue assessment based on 10-year average yields.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-9-3',
            question: 'Which Mughal finance minister introduced the famous "Zabt" or "Dahsala" land revenue assessment system under Akbar?',
            options: ['Birbal', 'Raja Man Singh', 'Raja Todar Mal', 'Abul Fazl'],
            correctAnswer: 2,
            explanation: 'Raja Todar Mal was Akbar\'s finance minister who instituted the Dahsala/Zabt system of land revenue assessment.',
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 10TH STANDARD - UNIT 3
  // -------------------------------------------------------------------------
  'general-studies-3-10': {
    subjectId: 'general-studies',
    unitId: 3,
    classId: 10,
    subjectTitle: 'General Studies',
    unitTitle: 'History, Culture of India, and Indian National Movement',
    unitNumber: 'Unit 3',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'Social Science - History',
    topics: [
      'Social and Religious Reform Movements in the 19th Century: Brahmo Samaj, Arya Samaj, Ramakrishna Mission, Theosophical Society',
      'Islamic & Sikh Reforms: Aligarh Movement (Sir Syed Ahmad Khan), Akali Movement',
      'Social Reformers in Tamil Nadu: Ramalinga Adigal (Vallalar), Vaikunda Swamigal, Iyothee Thass Pandithar',
      'Early Revolts against British Rule in Tamil Nadu: Palayakkarar War, Velu Nachiyar, Kattabomman, Vellore Revolt 1806',
      'Anti-Colonial Movements and the Birth of Nationalism: Tribal uprisings (Santhal), 1857 Revolt, Indian National Congress (1885)',
      'Nationalism - Gandhian Phase: Champaran, Non-Cooperation, Civil Disobedience (Salt Satyagraha), Quit India Movement',
      'Freedom Struggle in Tamil Nadu: Swadeshi Movement (V.O.C., Bharathiar), Salt Satyagraha at Vedaranyam (Rajaji)',
      'Social Transformation in Tamil Nadu: Justice Party, Self-Respect Movement (Periyar E.V.R.), Dravidian Movement',
    ],
    lessons: [
      {
        id: 'gs-3-10-l1',
        lessonNumber: '3.1',
        term: 'Annual',
        title: 'Social and Religious Reform Movements in the 19th Century',
        description: 'Renaissance in India: Raja Rammohan Roy (Brahmo Samaj), Dayananda Saraswati (Arya Samaj), Swami Vivekananda, Theosophical Society, and Jyotirao Phule.',
        status: 'Available',
        keyConcepts: ['Raja Rammohan Roy & Sati Abolition Act 1829', 'Dayananda Saraswati ("Go Back to the Vedas")', 'Swami Vivekananda & Chicago Speech 1893', 'Jyotirao Phule (Gulamgiri)'],
        studyNotes: [
          'Raja Rammohan Roy founded the Brahmo Samaj in 1828; his relentless campaign persuaded William Bentinck to enact the Sati Abolition Act in 1829.',
          'Swami Dayananda Saraswati founded the Arya Samaj in 1875 with the rallying call "Go back to the Vedas" and authored Satyartha Prakash.',
          'Ramalinga Adigal established the Samarasa Suddha Sanmarga Sathiya Sangam in 1865 promoting compassion to all living beings (Jeevakarunyam).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-10-1',
            question: 'Which Tamil social reformer established the "Samarasa Suddha Sanmarga Sathiya Sangam" and composed the "Thiruvarutpa"?',
            options: ['Vaikunda Swamigal', 'Ramalinga Adigal (Vallalar)', 'Iyothee Thass Pandithar', 'Maraimalai Adigal'],
            correctAnswer: 1,
            explanation: 'Vallalar (Ramalinga Adigal) advocated universal brotherhood and founded the Sathiya Gnana Sabai at Vadalur.',
          },
        ],
      },
      {
        id: 'gs-3-10-l2',
        lessonNumber: '3.2',
        term: 'Annual',
        title: 'Early Revolts against British Rule in Tamil Nadu',
        description: 'Resistance of Palayakkarars: Puli Thevar, Velu Nachiyar (first female warrior against British), Veerapandiya Kattabomman, and the Vellore Revolt of 1806.',
        status: 'Available',
        keyConcepts: ['Puli Thevar Coalition', 'Velu Nachiyar & Kuyili', 'Veerapandiya Kattabomman at Kayathar', 'Vellore Mutiny of 1806 (Col. Fancourt)'],
        studyNotes: [
          'Velu Nachiyar, queen of Sivagangai, recaptured her kingdom from the British with assistance from Hyder Ali and Gopala Nayakar.',
          'Kuyili, the commander of Velu Nachiyar’s women\'s brigade, carried out the first recorded human-bomb suicide attack destroying British armories.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-10-2',
            question: 'Who was the brave female commander in Velu Nachiyar’s military force who doused herself in oil to blow up British ammunition stores?',
            options: ['Rani Mangammal', 'Kuyili', 'Velu Nachiyar', 'Udaiyal'],
            correctAnswer: 1,
            explanation: 'Kuyili walked into the British arsenal at Sivagangai, sacrificing her life and securing Velu Nachiyar\'s historic victory.',
          },
        ],
      },
      {
        id: 'gs-3-10-l3',
        lessonNumber: '3.3',
        term: 'Annual',
        title: 'Anti-Colonial Movements and the Birth of Nationalism',
        description: 'Santhal rebellion, Munda rebellion (Birsa Munda), the Great Revolt of 1857, Queen Victoria’s Proclamation (1858), and founding of INC (1885).',
        status: 'Available',
        keyConcepts: ['Santhal Hool 1855', 'Great Revolt of 1857 (Mangal Pandey, Rani Lakshmibai)', 'Queen Victoria Proclamation 1858', 'Founding of INC (A.O. Hume 1885)'],
        studyNotes: [
          'The Great Revolt of 1857 was ignited by sepoys at Meerut and spread across North India; Bahadur Shah Zafar was proclaimed Shahenshah-e-Hindustan.',
          'The Indian National Congress was founded on December 28, 1885 at Bombay by A.O. Hume, with W.C. Bonnerjee as its first president.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-10-3',
            question: 'Who presided over the inaugural session of the Indian National Congress held at Bombay in December 1885?',
            options: ['Dadabhai Naoroji', 'W.C. Bonnerjee', 'A.O. Hume', 'Surendranath Banerjee'],
            correctAnswer: 1,
            explanation: 'Womesh Chandra Bonnerjee was the first president of the Indian National Congress attended by 72 delegates in 1885.',
          },
        ],
      },
      {
        id: 'gs-3-10-l4',
        lessonNumber: '3.4',
        term: 'Annual',
        title: 'Nationalism: Gandhian Phase',
        description: 'Mahatma Gandhi: Satyagraha in South Africa, Champaran (1917), Kheda, Rowlatt Act, Jallianwala Bagh massacre (1919), Non-Cooperation, Civil Disobedience (Salt March 1930), and Quit India Movement (1942).',
        status: 'Available',
        keyConcepts: ['Champaran Satyagraha (1917)', 'Jallianwala Bagh Massacre (Gen. Dyer 1919)', 'Salt March to Dandi (1930)', 'Quit India Resolution ("Do or Die" 1942)'],
        studyNotes: [
          'The Non-Cooperation Movement was launched in 1920 but suspended by Gandhi in 1922 following the Chauri Chaura incident.',
          'The historic Salt March from Sabarmati Ashram to Dandi began on March 12, 1930 and covered 240 miles to break the salt tax laws.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-10-4',
            question: 'From where did Mahatma Gandhi embark on the historic Salt March on March 12, 1930?',
            options: ['Sevagram Ashram', 'Sabarmati Ashram', 'Phoenix Farm', 'Wardha'],
            correctAnswer: 1,
            explanation: 'Gandhiji marched 240 miles from Sabarmati Ashram to the coastal village of Dandi in Gujarat.',
          },
        ],
      },
      {
        id: 'gs-3-10-l5',
        lessonNumber: '3.5',
        term: 'Annual',
        title: 'Freedom Struggle in Tamil Nadu',
        description: 'Swadeshi Steam Navigation Company (V.O. Chidambaranar), Subramania Bharathiar, Vanchinathan (Ashe Murder at Maniyachi 1911), Rajaji’s Vedaranyam Salt Satyagraha, and Tiruppur Kumaran.',
        status: 'Available',
        keyConcepts: ['V.O.C. Swadeshi Steam Navigation Company', 'Subramania Bharathi Patriotic Poetry', 'Vedaranyam Salt Satyagraha (Rajaji 1930)', 'Tiruppur Kumaran (Kodikatha Kumaran)'],
        studyNotes: [
          'V.O. Chidambaranar purchased two ships, S.S. Gallia and S.S. Lawoe, to launch the Swadeshi Steam Navigation Company between Tuticorin and Colombo in 1906.',
          'C. Rajagopalachari led the Salt Satyagraha march from Tiruchirappalli to Vedaranyam in April 1930, singing Namakkal Ramalingam Pillai\'s patriotic song.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-10-5',
            question: 'Who led the famous Salt Satyagraha march from Tiruchirappalli to Vedaranyam in Tamil Nadu in April 1930?',
            options: ['K. Kamaraj', 'C. Rajagopalachari', 'Periyar E.V.R.', 'S. Satyamurti'],
            correctAnswer: 1,
            explanation: 'Rajaji organized and led the Vedaranyam Salt March in Tamil Nadu along with 100 dedicated volunteers.',
          },
        ],
      },
      {
        id: 'gs-3-10-l6',
        lessonNumber: '3.6',
        term: 'Annual',
        title: 'Social Transformation in Tamil Nadu',
        description: 'South Indian Liberal Federation (Justice Party), Dravidian Movement, Self-Respect Movement of Periyar E.V. Ramasamy, anti-Hindi agitation, and social justice enactments.',
        status: 'Available',
        keyConcepts: ['Justice Party Ministry (1920)', 'Periyar E.V.R. Self-Respect Movement (1925)', 'First Communal G.O. (1921)', 'Moovalur Ramamirtham Ammaiyar & Devadasi Abolition Act'],
        studyNotes: [
          'The Justice Party passed the pioneering Communal Government Order in 1921 providing reservation in education and public employment.',
          'Periyar launched the Self-Respect Movement in 1925 emphasizing rationalism, women\'s emancipation, and the eradication of caste hierarchies.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-10-6',
            question: 'In which year did Thanthai Periyar E.V. Ramasamy launch the Self-Respect Movement (Suya Mariyathai Iyakkam)?',
            options: ['1916', '1920', '1925', '1937'],
            correctAnswer: 2,
            explanation: 'Periyar founded the Self-Respect Movement in 1925 after resigning from the Indian National Congress at the Kanchipuram session.',
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 11TH STANDARD - UNIT 3
  // -------------------------------------------------------------------------
  'general-studies-3-11': {
    subjectId: 'general-studies',
    unitId: 3,
    classId: 11,
    subjectTitle: 'General Studies',
    unitTitle: 'History, Culture of India, and Indian National Movement',
    unitNumber: 'Unit 3',
    classTitle: '11th Standard',
    standardNumber: 11,
    subjectName: 'History (Higher Secondary)',
    topics: [
      'Early India: Indus Civilisation, Chalcolithic Cultures, Iron Age in Tamil Nadu',
      'Vedic Polity: Rig Vedic vs Later Vedic society, Rajan, Sabha, Samiti, Varna system',
      'Rise of Territorial Kingdoms: 16 Mahajanapadas, Haryanka, Shishunaga, Nanda empires',
      'Emergence of State & Empire: Mauryan Administration, Arthashastra, Ashokan Edicts',
      'The Guptas: Samudragupta, Chandragupta II, land grants, literature, science and architecture',
      'Harshavardhana: Kanauj assembly, Xuanzang account, Nalanda educational institutions',
      'South Indian Kingdoms: Pallavas, Chalukyas of Badami, Imperial Cholas, Pandyas',
      'Delhi Sultanate: Administrative machinery, Iqta system, Amir Khusrau, market reforms',
      'Vijayanagar Empire: Nayankara administration, art and architecture, Battle of Talikota',
      'The Mughal Empire: Mansabdari system, revenue reforms of Todar Mal, religious tolerance',
      'The Marathas: Shivaji administration, Ashta Pradhan, Peshwas (Balaji Vishwanath, Baji Rao I)',
    ],
    lessons: [
      {
        id: 'gs-3-11-l1',
        lessonNumber: '3.1',
        term: 'Volume 1',
        title: 'Early India: From the Beginnings to the Indus Civilisation',
        description: 'Paleolithic to Bronze Age: Harappan town planning, crafts, trade with Mesopotamia (Meluhha), script, and decline.',
        status: 'Available',
        keyConcepts: ['Harappan Citadels & Lower Towns', 'Mesopotamian Trade (Meluhha)', 'Pashupati Mahadeva Seal', 'Decline of Indus Civilization'],
        studyNotes: [
          'Cuneiform inscriptions from Mesopotamia reference trade with "Meluhha", identifying the Indus Valley.',
          'Standardized weight ratios based on binary and decimal systems were used across Harappan settlements.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-11-1',
            question: 'What geographical name was used in ancient Mesopotamian cuneiform inscriptions to denote the Indus Valley region?',
            options: ['Magan', 'Dilmun', 'Meluhha', 'Bactria'],
            correctAnswer: 2,
            explanation: 'Mesopotamian texts refer to their trade partner in the East as Meluhha, which historians identify as Harappa.',
          },
        ],
      },
      {
        id: 'gs-3-11-l2',
        lessonNumber: '3.2',
        term: 'Volume 1',
        title: 'The Guptas and Harshavardhana',
        description: 'Political unification under Guptas, Samudragupta Prayag Prashasti, Chandragupta II (Vikramaditya), Aryabhata, Varahamihira, and Harsha.',
        status: 'Available',
        keyConcepts: ['Prayag Prashasti (Harisena)', 'Aryabhatiya & Surya Siddhanta', 'Kalidasa Sanskrit Works', 'Xuanzang at Nalanda'],
        studyNotes: [
          'Aryabhata calculated the value of Pi to 3.1416 and stated that the Earth rotates on its axis.',
          'Harshavardhana convened the Kanauj religious assembly and the Prayag assembly, documented by Chinese traveler Xuanzang.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-11-2',
            question: 'Which celebrated ancient Indian mathematician-astronomer calculated the solar year and authored "Aryabhatiya"?',
            options: ['Varahamihira', 'Aryabhata', 'Brahmagupta', 'Bhaskara I'],
            correctAnswer: 1,
            explanation: 'Aryabhata, the pioneer of the classical mathematical tradition, wrote Aryabhatiya in Pataliputra.',
          },
        ],
      },
      {
        id: 'gs-3-11-l3',
        lessonNumber: '3.3',
        term: 'Volume 1',
        title: 'Imperial Cholas and Pandyas',
        description: 'Chola state administration: Mandalam, Valanadu, Nadu, Kudavolai system, maritime expeditions, irrigation tanks, and bronze sculpture.',
        status: 'Available',
        keyConcepts: ['Chola Administrative Hierarchy', 'Kudavolai Village Elections', 'Chola Bronze Nataraja', 'Second Pandyan Empire'],
        studyNotes: [
          'The Chola kingdom was structured hierarchically: Mandalam (province) -> Valanadu -> Nadu -> Kurram/Grama (village).',
          'Chola bronzes, particularly the Nataraja (cosmic dancer), represent the pinnacle of South Indian lost-wax metal sculpture.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-11-3',
            question: 'Under the Imperial Cholas, what was the primary administrative division called that formed a cluster of villages below a Valanadu?',
            options: ['Mandalam', 'Nadu', 'Ur', 'Sabha'],
            correctAnswer: 1,
            explanation: 'The Chola administrative units were Mandalam (province), Valanadu (district), and Nadu (taluk/group of villages).',
          },
        ],
      },
      {
        id: 'gs-3-11-l4',
        lessonNumber: '3.4',
        term: 'Volume 2',
        title: 'The Delhi Sultanate and Mughal Empire',
        description: 'Sultanate centralized administrative structure, Iqta system, Mansabdari system, Akbar Rajput policy, and Todar Mal revenue settlement.',
        status: 'Available',
        keyConcepts: ['Iqta System of Delhi Sultanate', 'Mansabdari System (Zat and Sawar)', 'Todar Mal Dahsala System', 'Mughal Architecture'],
        studyNotes: [
          'In the Mansabdari system, Zat indicated the personal status and salary of the noble, while Sawar indicated the cavalry contingent required.',
          'Sher Shah Suri built the Grand Trunk Road connecting Sonargaon in Bengal to Peshawar in the northwest.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-11-4',
            question: 'In the Mughal Mansabdari system introduced by Akbar, what did the rank term "Zat" signify?',
            options: ['Cavalry strength', 'Personal rank and salary status', 'Revenue collection area', 'Artillery contingent'],
            correctAnswer: 1,
            explanation: 'Zat determined the personal status and salary of the noble, whereas Sawar designated the military troop quota.',
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 12TH STANDARD - UNIT 3
  // -------------------------------------------------------------------------
  'general-studies-3-12': {
    subjectId: 'general-studies',
    unitId: 3,
    classId: 12,
    subjectTitle: 'General Studies',
    unitTitle: 'History, Culture of India, and Indian National Movement',
    unitNumber: 'Unit 3',
    classTitle: '12th Standard',
    standardNumber: 12,
    subjectName: 'History (Higher Secondary)',
    topics: [
      'Rise of Nationalism in India: Socio-economic background, Drain of Wealth theory (Dadabhai Naoroji)',
      'Rise of Extremism and Swadeshi Movement: Partition of Bengal (1905), Surat Split (1907), Boycott and Swadeshi',
      'Impact of World War I: Home Rule Movement (Tilak and Annie Besant), Lucknow Pact (1916)',
      'Advent of Gandhi and Mass Mobilisation: Champaran, Rowlatt Act, Khilafat Movement, Non-Cooperation',
      'Period of Radicalism: Revolutionary nationalism (Bhagat Singh, Surya Sen), Chittagong armoury raid',
      'Communalism in Nationalist Politics: Hindu Mahasabha, Muslim League, Two-Nation Theory',
      'Last Phase of Indian National Movement: Cripps Mission (1942), Quit India Movement, Subhas Chandra Bose and INA',
      'Partition and Reconstruction of Post-colonial India: Mountbatten Plan, Integration of Princely States (Sardar Patel)',
    ],
    lessons: [
      {
        id: 'gs-3-12-l1',
        lessonNumber: '3.1',
        term: 'Volume 1',
        title: 'Rise of Nationalism in India',
        description: 'Colonial exploitation, introduction of railways and English education, vernacular press, and Dadabhai Naoroji’s Drain Theory.',
        status: 'Available',
        keyConcepts: ['Drain of Wealth Theory (Poverty and Un-British Rule in India)', 'Ilbert Bill Controversy', 'Vernacular Press Act 1878', 'Early Congress Demands'],
        studyNotes: [
          'Dadabhai Naoroji expounded the "Drain of Wealth" theory in his seminal book "Poverty and Un-British Rule in India", showing capital flight to Britain.',
          'The Vernacular Press Act of 1878 enacted by Lord Lytton gagged Indian language newspapers from criticizing colonial policies.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-12-1',
            question: 'Who formulated the famous "Drain of Wealth" theory exposing the economic exploitation of India under British colonial rule?',
            options: ['Gopal Krishna Gokhale', 'Dadabhai Naoroji', 'R.C. Dutt', 'M.G. Ranade'],
            correctAnswer: 1,
            explanation: 'The Grand Old Man of India, Dadabhai Naoroji, proved how British rule systematically transferred Indian wealth to Britain.',
          },
        ],
      },
      {
        id: 'gs-3-12-l2',
        lessonNumber: '3.2',
        term: 'Volume 1',
        title: 'Rise of Extremism and Swadeshi Movement',
        description: 'Lord Curzon\'s Partition of Bengal in 1905, Swadeshi and Boycott, Lal-Bal-Pal triumvirate, Surat Split (1907), and V.O. Chidambaranar.',
        status: 'Available',
        keyConcepts: ['Partition of Bengal (October 16, 1905)', 'Lal-Bal-Pal & Aurobindo Ghosh', 'Surat Split (1907)', 'Swadeshi Steam Navigation Company'],
        studyNotes: [
          'October 16, 1905, the day Bengal partition took effect, was observed as a Day of Mourning and Raksha Bandhan across Bengal.',
          'The Indian National Congress split into Moderates and Extremists at the Surat session in 1907 presided over by Rash Behari Ghosh.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-12-2',
            question: 'In which historic Congress session did the formal split between Moderates and Extremists take place in 1907?',
            options: ['Calcutta', 'Surat', 'Banaras', 'Madras'],
            correctAnswer: 1,
            explanation: 'The Surat Session in 1907 witnessed ideological fracture between the Moderates led by Gokhale and Extremists led by Tilak.',
          },
        ],
      },
      {
        id: 'gs-3-12-l3',
        lessonNumber: '3.3',
        term: 'Volume 1',
        title: 'Advent of Gandhi and Mass Mobilisation',
        description: 'Gandhian philosophy: Satyagraha, Ahimsa, Champaran indigo planters (1917), Kheda peasant strike, Rowlatt Act, and Non-Cooperation Movement.',
        status: 'Available',
        keyConcepts: ['Champaran Satyagraha (1917)', 'Ahmedabad Mill Strike', 'Jallianwala Bagh Massacre (13 April 1919)', 'Non-Cooperation Movement (1920-1922)'],
        studyNotes: [
          'Gandhiji\'s first civil disobedience in India was Champaran Satyagraha in 1917, resolving the exploitative Tinkathia indigo system.',
          'Rabindranath Tagore renounced his Knighthood and Mahatma Gandhi returned his Kaisar-i-Hind gold medal protesting Jallianwala Bagh.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-12-3',
            question: 'Which honor was renounced by Rabindranath Tagore in protest against the brutal Jallianwala Bagh massacre of 1919?',
            options: ['Kaisar-i-Hind Medal', 'Knighthood', 'Nobel Prize', 'Order of the Star of India'],
            correctAnswer: 1,
            explanation: 'Tagore wrote a historic letter to the Viceroy Lord Chelmsford renouncing his British Knighthood title in May 1919.',
          },
        ],
      },
      {
        id: 'gs-3-12-l4',
        lessonNumber: '3.4',
        term: 'Volume 2',
        title: 'Last Phase of Indian National Movement and Partition',
        description: 'Quit India Movement (1942), Netaji Subhas Chandra Bose and the Indian National Army (INA), Cabinet Mission Plan (1946), Mountbatten Plan, and Partition.',
        status: 'Available',
        keyConcepts: ['Quit India Movement ("Do or Die")', 'Netaji Subhas Chandra Bose & Azad Hind Fauj', 'Royal Indian Navy (RIN) Mutiny 1946', 'Mountbatten Plan (3 June 1947)'],
        studyNotes: [
          'Netaji Subhas Chandra Bose reconstituted the Indian National Army (Azad Hind Fauj) in Singapore with the battle cry "Chalo Delhi".',
          'Sardar Vallabhbhai Patel, the Iron Man of India, successfully integrated over 565 princely states into the Indian Union.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-3-12-4',
            question: 'Who gave the famous battle cry "Chalo Delhi" and established the Provisional Government of Free India (Azad Hind) in Singapore in 1943?',
            options: ['Bhagat Singh', 'Rash Behari Bose', 'Subhas Chandra Bose', 'Mohan Singh'],
            correctAnswer: 2,
            explanation: 'Netaji Subhas Chandra Bose led the INA and proclaimed the provisional Azad Hind government in Singapore.',
          },
        ],
      },
    ],
  },
}
