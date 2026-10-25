// Official TNPSC Group 1 Preliminary Examination Syllabus Data
// Source: 497_group 1 preliminary syllabus.pdf (Code: 497)
// Part A: General Studies (Degree Standard - 175 Questions)
// Part B: Aptitude and Mental Ability (SSLC Standard - 25 Questions)

export interface Lesson {
  id: string
  lessonNumber: string
  title: string
  status: 'Awaiting Notes' | 'Available'
  estimatedReadTime?: string
  description?: string
}

export interface Chapter {
  id: string
  chapterNumber: number
  title: string
  lessons: Lesson[]
}

export interface SyllabusUnit {
  id: number
  unitNumber: string
  title: string
  tamilTitle?: string
  questionCount: number
  standard: string
  color: string
  officialSyllabusTopics: string[]
  chapters: Chapter[]
}

export const group1GeneralStudiesUnits: SyllabusUnit[] = [
  {
    id: 1,
    unitNumber: 'Unit I',
    title: 'General Science',
    tamilTitle: 'அலகு I: பொது அறிவியல்',
    questionCount: 10,
    standard: 'Degree Standard',
    color: '#38bdf8',
    officialSyllabusTopics: [
      'Scientific knowledge and scientific temper - Power of reasoning - Rote learning vs conceptual learning - Science as a tool to understand the past, present, and future',
      'Nature of universe - General scientific laws – Mechanics - Properties of matter, force, motion, and energy',
      'Everyday application of the basic principles of mechanics, electricity and magnetism, light, sound, heat, nuclear physics, laser, electronics, and communications',
      'Elements and compounds, acids, bases, salts, petroleum products, fertilizers, pesticides',
      'Main concepts of life science, classification of living organisms, evolution, genetics, physiology, nutrition, health and hygiene, human diseases',
      'Environment and ecology',
      'Latest inventions in science and technology',
      'Current affairs',
    ],
    chapters: [
      {
        id: 'u1-c1',
        chapterNumber: 1,
        title: 'Scientific Knowledge, Temper & Methodology',
        lessons: [
          {
            id: 'u1-c1-l1',
            lessonNumber: '1.1',
            title: 'Scientific Knowledge, Scientific Temper & Power of Reasoning',
            status: 'Awaiting Notes',
            description: 'Understanding scientific temper, empirical observation, hypothesis formulation, and critical rational reasoning.',
          },
          {
            id: 'u1-c1-l2',
            lessonNumber: '1.2',
            title: 'Rote Learning vs Conceptual Learning in Science',
            status: 'Awaiting Notes',
            description: 'Comparison of pedagogical approaches, conceptual clarity vs memory-based learning in scientific exploration.',
          },
          {
            id: 'u1-c1-l3',
            lessonNumber: '1.3',
            title: 'Science as a Tool to Understand the Past, Present, and Future',
            status: 'Awaiting Notes',
            description: 'Role of archaeology, carbon dating, technological projections, and retrospective science.',
          },
        ],
      },
      {
        id: 'u1-c2',
        chapterNumber: 2,
        title: 'Physics & Nature of Universe',
        lessons: [
          {
            id: 'u1-c2-l1',
            lessonNumber: '2.1',
            title: 'Nature of Universe & General Scientific Laws',
            status: 'Awaiting Notes',
            description: 'Cosmology, gravitation, planetary motion (Kepler laws), and universal physical constants.',
          },
          {
            id: 'u1-c2-l2',
            lessonNumber: '2.2',
            title: 'Mechanics: Matter, Force, Motion, and Energy',
            status: 'Awaiting Notes',
            description: 'Newton laws of motion, momentum, work, power, kinetic and potential energy transformations.',
          },
          {
            id: 'u1-c2-l3',
            lessonNumber: '2.3',
            title: 'Everyday Applications: Light, Sound, and Heat',
            status: 'Awaiting Notes',
            description: 'Optics (reflection, refraction, total internal reflection), acoustics, doppler effect, thermodynamics, and heat transfer.',
          },
          {
            id: 'u1-c2-l4',
            lessonNumber: '2.4',
            title: 'Electricity, Magnetism, Electronics, and Communications',
            status: 'Awaiting Notes',
            description: 'Electromagnetic induction, circuits, semiconductors, communication bands, fiber optics, and mobile transmission.',
          },
          {
            id: 'u1-c2-l5',
            lessonNumber: '2.5',
            title: 'Nuclear Physics, Laser Technology, and Applications',
            status: 'Awaiting Notes',
            description: 'Radioactivity, nuclear fission and fusion, nuclear reactors in India, laser principles, and medical/industrial uses.',
          },
        ],
      },
      {
        id: 'u1-c3',
        chapterNumber: 3,
        title: 'Applied Chemistry',
        lessons: [
          {
            id: 'u1-c3-l1',
            lessonNumber: '3.1',
            title: 'Elements, Compounds, and Periodic Classification',
            status: 'Awaiting Notes',
            description: 'Periodic table trends, atomic structure, chemical bonds, metals, non-metals, and noble gases.',
          },
          {
            id: 'u1-c3-l2',
            lessonNumber: '3.2',
            title: 'Acids, Bases, and Salts in Daily Life',
            status: 'Awaiting Notes',
            description: 'pH scale, buffer solutions, common industrial and household acids, neutralisation, and salt applications.',
          },
          {
            id: 'u1-c3-l3',
            lessonNumber: '3.3',
            title: 'Petroleum Products, Petrochemicals, and Fuels',
            status: 'Awaiting Notes',
            description: 'Fractional distillation of crude oil, LPG, CNG, octane numbers, bio-fuels, and refining.',
          },
          {
            id: 'u1-c3-l4',
            lessonNumber: '3.4',
            title: 'Fertilizers and Pesticides: Agricultural Chemistry',
            status: 'Awaiting Notes',
            description: 'Nitrogenous, phosphatic and potassic fertilizers, NPK ratio, bio-fertilizers, insecticides, and soil toxicity.',
          },
        ],
      },
      {
        id: 'u1-c4',
        chapterNumber: 4,
        title: 'Life Sciences & Human Biology',
        lessons: [
          {
            id: 'u1-c4-l1',
            lessonNumber: '4.1',
            title: 'Classification of Living Organisms and Evolutionary Theories',
            status: 'Awaiting Notes',
            description: 'Five-kingdom classification, binomial nomenclature, Darwinism, Lamarckism, and speciation.',
          },
          {
            id: 'u1-c4-l2',
            lessonNumber: '4.2',
            title: 'Genetics, Heredity, and Molecular Biology',
            status: 'Awaiting Notes',
            description: 'Mendelian laws of inheritance, DNA structure, RNA, genetic code, chromosomal aberrations, and genetic engineering.',
          },
          {
            id: 'u1-c4-l3',
            lessonNumber: '4.3',
            title: 'Human Physiology, Organ Systems & Vital Functions',
            status: 'Awaiting Notes',
            description: 'Circulatory, digestive, respiratory, nervous, and endocrine systems in human body.',
          },
          {
            id: 'u1-c4-l4',
            lessonNumber: '4.4',
            title: 'Nutrition, Health, Hygiene, and Dietary Balance',
            status: 'Awaiting Notes',
            description: 'Macronutrients, micronutrients, vitamin deficiencies, balanced diet, and public hygiene practices.',
          },
          {
            id: 'u1-c4-l5',
            lessonNumber: '4.5',
            title: 'Human Diseases: Causes, Transmission & Prevention',
            status: 'Awaiting Notes',
            description: 'Viral, bacterial, fungal, protozoan diseases, lifestyle disorders, vaccines, and pandemic control.',
          },
        ],
      },
      {
        id: 'u1-c5',
        chapterNumber: 5,
        title: 'Environment, Ecology & Emerging Technologies',
        lessons: [
          {
            id: 'u1-c5-l1',
            lessonNumber: '5.1',
            title: 'Environment, Ecology, and Biodiversity Conservation',
            status: 'Awaiting Notes',
            description: 'Biomes, food chains, ecological pyramids, endangered species, Ramsar sites, and ecological balance.',
          },
          {
            id: 'u1-c5-l2',
            lessonNumber: '5.2',
            title: 'Latest Inventions in Science, Space, and Technology',
            status: 'Awaiting Notes',
            description: 'ISRO space missions (Chandrayaan, Gaganyaan), AI, quantum computing, nanotechnology, and robotics.',
          },
          {
            id: 'u1-c5-l3',
            lessonNumber: '5.3',
            title: 'Current Scientific Affairs and Nobel Laureate Breakthroughs',
            status: 'Awaiting Notes',
            description: 'Recent developments in medical science, global environmental summits, and domestic scientific breakthroughs.',
          },
        ],
      },
    ],
  },
  {
    id: 2,
    unitNumber: 'Unit II',
    title: 'Geography of India',
    tamilTitle: 'அலகு II: இந்தியாவின் புவியியல்',
    questionCount: 10,
    standard: 'Degree Standard',
    color: '#10b981',
    officialSyllabusTopics: [
      'Location - Physical features - Monsoon, rainfall, weather and climate - Water resources - Rivers in India',
      'Soil, Minerals and Natural Resources - Forest and Wildlife - Agricultural pattern',
      'Transport – Communication',
      'Social Geography – Population density and distribution - Racial, linguistic groups and major tribes',
      'Natural calamity - Disaster management',
      'Environmental pollution - Reasons and preventive measures - Climate change - Green energy',
      'Geographical landmarks',
      'Current affairs',
    ],
    chapters: [
      {
        id: 'u2-c1',
        chapterNumber: 1,
        title: 'Physical Features, Climate & Drainage Systems',
        lessons: [
          {
            id: 'u2-c1-l1',
            lessonNumber: '1.1',
            title: 'Location, Frontiers, and Physiographic Divisions of India',
            status: 'Awaiting Notes',
            description: 'Himalayas, Indo-Gangetic Plains, Peninsular Plateau, Coastal Plains, and Island Groups.',
          },
          {
            id: 'u2-c1-l2',
            lessonNumber: '1.2',
            title: 'Monsoon Mechanism, Rainfall, Weather, and Climate of India',
            status: 'Awaiting Notes',
            description: 'Southwest and Northeast monsoons, El Nino, Indian Ocean Dipole, western disturbances, and climatic zones.',
          },
          {
            id: 'u2-c1-l3',
            lessonNumber: '1.3',
            title: 'Water Resources and Major River Systems of India',
            status: 'Awaiting Notes',
            description: 'Himalayan rivers (Indus, Ganga, Brahmaputra) and Peninsular rivers (Godavari, Krishna, Cauvery, Narmada, Tapti).',
          },
        ],
      },
      {
        id: 'u2-c2',
        chapterNumber: 2,
        title: 'Natural Resources, Forests & Agriculture',
        lessons: [
          {
            id: 'u2-c2-l1',
            lessonNumber: '2.1',
            title: 'Soil Types, Characteristics, and Distribution Across India',
            status: 'Awaiting Notes',
            description: 'Alluvial, black, red, laterite, mountain and desert soils, soil degradation, and conservation methods.',
          },
          {
            id: 'u2-c2-l2',
            lessonNumber: '2.2',
            title: 'Mineral and Natural Resources of India',
            status: 'Awaiting Notes',
            description: 'Metallic (iron, bauxite, copper) and non-metallic minerals, coal, petroleum, and natural gas fields.',
          },
          {
            id: 'u2-c2-l3',
            lessonNumber: '2.3',
            title: 'Forest Types, Wildlife, National Parks, and Biosphere Reserves',
            status: 'Awaiting Notes',
            description: 'Tropical evergreen, deciduous, mangrove, alpine forests, Project Tiger, Project Elephant, and wildlife protection.',
          },
          {
            id: 'u2-c2-l4',
            lessonNumber: '2.4',
            title: 'Agricultural Patterns, Crop Seasons, and Farming Systems',
            status: 'Awaiting Notes',
            description: 'Kharif, Rabi, Zaid crops, food grains, commercial crops, irrigation infrastructure, and sustainable agriculture.',
          },
        ],
      },
      {
        id: 'u2-c3',
        chapterNumber: 3,
        title: 'Transport, Communication & Economic Geography',
        lessons: [
          {
            id: 'u2-c3-l1',
            lessonNumber: '3.1',
            title: 'Transport Infrastructure: Roadways, Railways, Ports, and Airways',
            status: 'Awaiting Notes',
            description: 'Golden Quadrilateral, dedicated freight corridors, major ports, inland waterways, and UDAN scheme.',
          },
          {
            id: 'u2-c3-l2',
            lessonNumber: '3.2',
            title: 'Communication Networks, Satellite Systems, and Digital Connectivity',
            status: 'Awaiting Notes',
            description: 'Postal network, telecommunications, INSAT systems, BharatNet, and optical fiber connectivity.',
          },
        ],
      },
      {
        id: 'u2-c4',
        chapterNumber: 4,
        title: 'Social Geography & Demography',
        lessons: [
          {
            id: 'u2-c4-l1',
            lessonNumber: '4.1',
            title: 'Population Density, Distribution, and Demographic Trends',
            status: 'Awaiting Notes',
            description: 'Census dynamics, sex ratio, literacy, urbanization patterns, and demographic dividend in India.',
          },
          {
            id: 'u2-c4-l2',
            lessonNumber: '4.2',
            title: 'Racial, Linguistic Groups and Major Scheduled Tribes',
            status: 'Awaiting Notes',
            description: 'Ethno-racial classifications, Scheduled Languages (8th Schedule), PVTGs, and indigenous tribal heritage.',
          },
        ],
      },
      {
        id: 'u2-c5',
        chapterNumber: 5,
        title: 'Environmental Issues, Disasters & Green Energy',
        lessons: [
          {
            id: 'u2-c5-l1',
            lessonNumber: '5.1',
            title: 'Natural Calamities and Disaster Management Framework',
            status: 'Awaiting Notes',
            description: 'Cyclones, floods, droughts, earthquakes, tsunamis, landslides, NDMA institutional structure, and early warning.',
          },
          {
            id: 'u2-c5-l2',
            lessonNumber: '5.2',
            title: 'Environmental Pollution: Sources, Impact, and Control Measures',
            status: 'Awaiting Notes',
            description: 'Air pollution (AQI), water pollution (Namami Gange), solid waste management, and Central Pollution Control Board.',
          },
          {
            id: 'u2-c5-l3',
            lessonNumber: '5.3',
            title: 'Climate Change, COP Summits, and Green Energy Transition',
            status: 'Awaiting Notes',
            description: 'Paris Accord, Net Zero 2070 targets, solar parks, wind energy, green hydrogen, and geographical landmarks in news.',
          },
        ],
      },
    ],
  },
  {
    id: 3,
    unitNumber: 'Unit III',
    title: 'History, Culture of India, and Indian National Movement',
    tamilTitle: 'அலகு III: இந்தியாவின் வரலாறு, பண்பாடு மற்றும் இந்திய தேசிய இயக்கம்',
    questionCount: 25,
    standard: 'Degree Standard',
    color: '#f59e0b',
    officialSyllabusTopics: [
      'Indus Valley Civilization - Guptas, Delhi Sultans, Mughals, and Marathas - Age of Vijayanagaram and Bahmani Kingdoms - South Indian History',
      'Change and continuity in the socio-cultural history of India',
      'National Renaissance - Early uprising against British rule - Indian National Congress',
      'Emergence of leaders – B.R.Ambedkar, Bhagat Singh, Bharathiar, V.O.Chidambaranar, Jawaharlal Nehru, Kamarajar, Mahatma Gandhi, Maulana Abul Kalam Azad, Thanthai Periyar, Rajaji, Subash Chandra Bose, Rabindranath Tagore, and others',
      'Different modes of agitation: Growth of Satyagraha and Militant Movements; Communalism and Partition',
      'Characteristics of Indian Culture, Unity in Diversity – Race, Language, Custom; India as a Secular State, Social Harmony',
      'Prominent personalities in various spheres – Arts, Science, Literature and Philosophy; National symbols – Eminent personalities and places in news – Sports – Books and Authors; Current affairs',
    ],
    chapters: [
      {
        id: 'u3-c1',
        chapterNumber: 1,
        title: 'Ancient & Medieval Indian Dynasties',
        lessons: [
          {
            id: 'u3-c1-l1',
            lessonNumber: '1.1',
            title: 'Indus Valley Civilization: Urban Planning, Society & Culture',
            status: 'Awaiting Notes',
            description: 'Harappa, Mohenjodaro, Lothal, Dholavira, trade relations, religious practices, and script theories.',
          },
          {
            id: 'u3-c1-l2',
            lessonNumber: '1.2',
            title: 'The Imperial Guptas: Golden Era of Art, Science & Literature',
            status: 'Awaiting Notes',
            description: 'Samudragupta, Chandragupta II, Navaratnas, Kalidasa, Aryabhata, temple architecture, and coin currency.',
          },
          {
            id: 'u3-c1-l3',
            lessonNumber: '1.3',
            title: 'Delhi Sultanate: Administration, Architecture & Social Impact',
            status: 'Awaiting Notes',
            description: 'Slave, Khilji, Tughlaq, Sayyid, and Lodi dynasties, market reforms of Alauddin, and Indo-Islamic architecture.',
          },
          {
            id: 'u3-c1-l4',
            lessonNumber: '1.4',
            title: 'Mughal Empire: Administration, Religious Policies & Marathas',
            status: 'Awaiting Notes',
            description: 'Akbar Sulh-i-kul, Mansabdari system, Mughal art and architecture, Chhatrapati Shivaji, and Maratha Ashta Pradhan.',
          },
          {
            id: 'u3-c1-l5',
            lessonNumber: '1.5',
            title: 'Vijayanagara Empire and Bahmani Sultanate',
            status: 'Awaiting Notes',
            description: 'Harihara and Bukka, Krishnadevaraya golden age, Battle of Talikota, Bahmani disintegration, and architectural marvels.',
          },
          {
            id: 'u3-c1-l6',
            lessonNumber: '1.6',
            title: 'South Indian History: Pallavas, Imperial Cholas & Pandyas',
            status: 'Awaiting Notes',
            description: 'Rajaraja I, Rajendra I, Brihadisvara Temple, Uttiramerur local administration, maritime trade, and Tamil Bhakti movement.',
          },
        ],
      },
      {
        id: 'u3-c2',
        chapterNumber: 2,
        title: 'National Renaissance & Early Anti-British Resistance',
        lessons: [
          {
            id: 'u3-c2-l1',
            lessonNumber: '2.1',
            title: 'Socio-Cultural Renaissance and Religious Reform Movements',
            status: 'Awaiting Notes',
            description: 'Raja Ram Mohan Roy, Brahmo Samaj, Arya Samaj, Ramakrishna Mission, Theosophical Society, and Jyotirao Phule.',
          },
          {
            id: 'u3-c2-l2',
            lessonNumber: '2.2',
            title: 'Early Uprisings Against British Rule and The Great Revolt of 1857',
            status: 'Awaiting Notes',
            description: 'Tribal revolts (Santhal), peasant movements, Poligar Wars in Tamil Nadu, 1806 Vellore Mutiny, and 1857 Revolt.',
          },
          {
            id: 'u3-c2-l3',
            lessonNumber: '2.3',
            title: 'Birth of Indian National Congress and Early Nationalist Phase',
            status: 'Awaiting Notes',
            description: 'Foundation in 1885 by A.O. Hume, Early Moderates (Dadabhai Naoroji, Gokhale) and Drain of Wealth theory.',
          },
        ],
      },
      {
        id: 'u3-c3',
        chapterNumber: 3,
        title: 'Freedom Struggle & National Leadership',
        lessons: [
          {
            id: 'u3-c3-l1',
            lessonNumber: '3.1',
            title: 'The Rise of Extremism and The Swadeshi Movement (1905–1911)',
            status: 'Awaiting Notes',
            description: 'Partition of Bengal, Lal-Bal-Pal, revolutionary activities, Surat split (1907), and Home Rule Leagues.',
          },
          {
            id: 'u3-c3-l2',
            lessonNumber: '3.2',
            title: 'Gandhian Era: Non-Cooperation, Civil Disobedience & Quit India',
            status: 'Awaiting Notes',
            description: 'Champaran, Rowlatt Act, Jallianwala Bagh, Non-Cooperation, Dandi March, Round Table Conferences, and 1942 movement.',
          },
          {
            id: 'u3-c3-l3',
            lessonNumber: '3.3',
            title: 'Militant Movements, INA, and Revolutionary Struggle',
            status: 'Awaiting Notes',
            description: 'Hindustan Socialist Republican Association (Bhagat Singh), Subhash Chandra Bose and the Indian National Army (INA).',
          },
          {
            id: 'u3-c3-l4',
            lessonNumber: '3.4',
            title: 'Profiles of National Leaders & Patriots',
            status: 'Awaiting Notes',
            description: 'B.R. Ambedkar, Bhagat Singh, Bharathiar, V.O. Chidambaranar, Nehru, Kamarajar, Gandhi, Maulana Azad, Periyar, Rajaji, Bose, Tagore.',
          },
          {
            id: 'u3-c3-l5',
            lessonNumber: '3.5',
            title: 'Communalism, Cabinet Mission, Mountbatten Plan, and Partition',
            status: 'Awaiting Notes',
            description: 'Two-nation theory, Muslim League, Wavell Plan, Indian Independence Act 1947, and integration of princely states.',
          },
        ],
      },
      {
        id: 'u3-c4',
        chapterNumber: 4,
        title: 'Indian Culture, Secularism & Prominent Personalities',
        lessons: [
          {
            id: 'u3-c4-l1',
            lessonNumber: '4.1',
            title: 'Characteristics of Indian Culture and Unity in Diversity',
            status: 'Awaiting Notes',
            description: 'Synthesis of languages, races, customs, composite heritage, and syncretic traditions in India.',
          },
          {
            id: 'u3-c4-l2',
            lessonNumber: '4.2',
            title: 'India as a Secular State, Social Harmony and Philosophy',
            status: 'Awaiting Notes',
            description: 'Sarva Dharma Sambhava, constitutional secularism, prominent schools of philosophy, and spiritual masters.',
          },
          {
            id: 'u3-c4-l3',
            lessonNumber: '4.3',
            title: 'National Symbols, Eminent Personalities, Sports, Books and Authors',
            status: 'Awaiting Notes',
            description: 'National emblem, anthem, flag, sports achievements, literary awards, classical languages, and historical current affairs.',
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
    questionCount: 40,
    standard: 'Degree Standard',
    color: '#6366f1',
    officialSyllabusTopics: [
      'Constitution of India - Preamble to the Constitution - Salient features of the Constitution - Union, State and Union Territory',
      'Citizenship, Fundamental Rights, Fundamental Duties, Directive Principles of State Policy',
      'Union Executive, Union Legislature - State Executive, State Legislature - Local Governments, Panchayat Raj - Spirit of federalism: Centre - State relationships',
      'Election - Judiciary in India – Rule of Law',
      'Corruption in public life – Anti-corruption measures - Lokpal and Lok Ayukta - Right to Information',
      'Empowerment of Women - Consumer Protection Forums, Human Rights Charter',
      'Political parties and political system in India',
      'Current affairs',
    ],
    chapters: [
      {
        id: 'u4-c1',
        chapterNumber: 1,
        title: 'Constitutional Foundations & Preamble',
        lessons: [
          {
            id: 'u4-c1-l1',
            lessonNumber: '1.1',
            title: 'Constituent Assembly and Framing of the Constitution',
            status: 'Awaiting Notes',
            description: 'Historical evolution from Regulating Acts to 1935 Act, drafting committee, Dr. Ambedkar role, and enactment.',
          },
          {
            id: 'u4-c1-l2',
            lessonNumber: '1.2',
            title: 'Preamble: Philosophy, Guiding Principles & Amendments',
            status: 'Awaiting Notes',
            description: 'Sovereign, Socialist, Secular, Democratic, Republic, Justice, Liberty, Equality, Fraternity, and Kesavananda Bharati case.',
          },
          {
            id: 'u4-c1-l3',
            lessonNumber: '1.3',
            title: 'Salient Features of the Indian Constitution',
            status: 'Awaiting Notes',
            description: 'Lengthiest written constitution, blend of rigidity and flexibility, parliamentary form, and single citizenship.',
          },
          {
            id: 'u4-c1-l4',
            lessonNumber: '1.4',
            title: 'Union and its Territory (Articles 1–4)',
            status: 'Awaiting Notes',
            description: 'Formation of new states, reorganization, UT administration, and state boundary alter process.',
          },
        ],
      },
      {
        id: 'u4-c2',
        chapterNumber: 2,
        title: 'Citizenship, Rights & State Directive Principles',
        lessons: [
          {
            id: 'u4-c2-l1',
            lessonNumber: '2.1',
            title: 'Citizenship Provisions, Acquisition, and Loss (Articles 5–11)',
            status: 'Awaiting Notes',
            description: 'Citizenship Act 1955, constitutional articles, CAA framework, and overseas citizen rights.',
          },
          {
            id: 'u4-c2-l2',
            lessonNumber: '2.2',
            title: 'Fundamental Rights: Scope, Exceptions & Writs (Articles 12–35)',
            status: 'Awaiting Notes',
            description: 'Right to Equality, Freedom, Against Exploitation, Religion, Education, and Article 32 constitutional remedies.',
          },
          {
            id: 'u4-c2-l3',
            lessonNumber: '2.3',
            title: 'Directive Principles of State Policy (DPSP) (Articles 36–51)',
            status: 'Awaiting Notes',
            description: 'Socialistic, Gandhian, and Liberal-Intellectual principles, conflict between Fundamental Rights and DPSP.',
          },
          {
            id: 'u4-c2-l4',
            lessonNumber: '2.4',
            title: 'Fundamental Duties (Article 51A)',
            status: 'Awaiting Notes',
            description: 'Swaran Singh Committee, 42nd Amendment, Verma Committee, and 11 statutory duties of citizens.',
          },
        ],
      },
      {
        id: 'u4-c3',
        chapterNumber: 3,
        title: 'Union & State Executive and Legislature',
        lessons: [
          {
            id: 'u4-c3-l1',
            lessonNumber: '3.1',
            title: 'Union Executive: President, Vice-President, PM & Cabinet',
            status: 'Awaiting Notes',
            description: 'Election of President, ordinance making power (Art 123), emergency powers (Arts 352-360), and council of ministers.',
          },
          {
            id: 'u4-c3-l2',
            lessonNumber: '3.2',
            title: 'Union Parliament: Lok Sabha, Rajya Sabha & Law Making',
            status: 'Awaiting Notes',
            description: 'Composition, parliamentary committees, budget passage, joint sitting, and parliamentary privileges.',
          },
          {
            id: 'u4-c3-l3',
            lessonNumber: '3.3',
            title: 'State Executive: Governor, Chief Minister & Council',
            status: 'Awaiting Notes',
            description: 'Discretionary powers of Governor, Article 163, 164, relation with legislature, and constitutional boundaries.',
          },
          {
            id: 'u4-c3-l4',
            lessonNumber: '3.4',
            title: 'State Legislature: Legislative Assembly and Council',
            status: 'Awaiting Notes',
            description: 'Powers, functions, legislative procedure, speaker powers, and Tamil Nadu unicameral setup.',
          },
        ],
      },
      {
        id: 'u4-c4',
        chapterNumber: 4,
        title: 'Local Governance, Federalism & Centre-State Relations',
        lessons: [
          {
            id: 'u4-c4-l1',
            lessonNumber: '4.1',
            title: 'Panchayati Raj & Urban Local Bodies (73rd & 74th Amendments)',
            status: 'Awaiting Notes',
            description: '3-tier system, Gram Sabha, State Finance Commission, State Election Commission, and Tamil Nadu Panchayats Act 1994.',
          },
          {
            id: 'u4-c4-l2',
            lessonNumber: '4.2',
            title: 'Spirit of Federalism and Centre-State Relations',
            status: 'Awaiting Notes',
            description: 'Seventh Schedule lists, legislative, administrative, and financial relations, Sarkaria & Punchhi Commissions, Rajamannar Committee.',
          },
        ],
      },
      {
        id: 'u4-c5',
        chapterNumber: 5,
        title: 'Judiciary, Elections & Integrity Institutions',
        lessons: [
          {
            id: 'u4-c5-l1',
            lessonNumber: '5.1',
            title: 'Judiciary in India, Rule of Law & Judicial Review',
            status: 'Awaiting Notes',
            description: 'Supreme Court, High Courts, collegium system, PIL, basic structure doctrine, and judicial activism.',
          },
          {
            id: 'u4-c5-l2',
            lessonNumber: '5.2',
            title: 'Elections, Election Commission & Political Parties',
            status: 'Awaiting Notes',
            description: 'Article 324, Model Code of Conduct, electoral bonds, anti-defection law (10th Schedule), and national/state party recognition.',
          },
          {
            id: 'u4-c5-l3',
            lessonNumber: '5.3',
            title: 'Anti-Corruption Framework: Lokpal, Lok Ayukta, CVC & CBI',
            status: 'Awaiting Notes',
            description: 'Lokpal and Lokayuktas Act 2013, Prevention of Corruption Act, Whistleblowers Protection, and administrative vigilance.',
          },
          {
            id: 'u4-c5-l4',
            lessonNumber: '5.4',
            title: 'Right to Information, Citizen Rights & Consumer Protection',
            status: 'Awaiting Notes',
            description: 'RTI Act 2005 implementation, Consumer Protection Act 2019, Human Rights Charter, and Women Empowerment measures.',
          },
        ],
      },
    ],
  },
  {
    id: 5,
    unitNumber: 'Unit V',
    title: 'Indian Economy and Development Administration in Tamil Nadu',
    tamilTitle: 'அலகு V: இந்தியப் பொருளாதாரம் மற்றும் தமிழ்நாட்டில் வளர்ச்சி நிர்வாகம்',
    questionCount: 50,
    standard: 'Degree Standard',
    color: '#ec4899',
    officialSyllabusTopics: [
      'Nature of Indian Economy – Five-year plan models - an assessment - Planning Commission and Niti Aayog',
      'Sources of revenue - Reserve Bank of India - Fiscal Policy and Monetary Policy - Finance Commission - Resource sharing between Union and State Governments - Goods and Services Tax',
      'Structure of Indian economy and employment generation, Land Reforms and Agriculture - Application of Science and Technology in Agriculture - Industrial growth - Rural welfare oriented programmes - Social problems - Population, Education, Health, Employment, Poverty',
      'Human Development Indicators in Tamil Nadu and a comparative assessment across the Country – Impact of social reform movements in the socio-economic development of Tamil Nadu',
      'Political parties and welfare schemes for various sections of people - Rationale behind the reservation policy, and access to the social resources - Economic trends in Tamil Nadu',
      'Role and impact of social welfare schemes in the socio-economic development of Tamil Nadu - Social justice and social harmony as the cornerstones of socio-economic development',
      'Education and health systems in Tamil Nadu; Geography of Tamil Nadu and its impact on economic growth; Achievements of Tamil Nadu in various fields',
      'e-Governance in Tamil Nadu; Public awareness and General administration - Welfare oriented Government schemes and their utility, Problems in public delivery systems',
      'Current socio-economic issues; Current affairs',
    ],
    chapters: [
      {
        id: 'u5-c1',
        chapterNumber: 1,
        title: 'Indian Economy, Five-Year Plans & NITI Aayog',
        lessons: [
          {
            id: 'u5-c1-l1',
            lessonNumber: '1.1',
            title: 'Nature of Indian Economy: Mixed Economy & Structural Features',
            status: 'Awaiting Notes',
            description: 'Primary, secondary, and tertiary sectors, GDP trends, inclusive growth, and post-1991 economic reforms.',
          },
          {
            id: 'u5-c1-l2',
            lessonNumber: '1.2',
            title: 'Five-Year Plan Models Assessment & Planning Commission',
            status: 'Awaiting Notes',
            description: 'Harrod-Domar, Mahalanobis models, poverty alleviation plans, 12th plan objectives, and critical review.',
          },
          {
            id: 'u5-c1-l3',
            lessonNumber: '1.3',
            title: 'NITI Aayog: Structure, Mandate, and Cooperative Federalism',
            status: 'Awaiting Notes',
            description: 'Governing council, Team India Hub, Aspirational Districts Programme, and SDG index.',
          },
        ],
      },
      {
        id: 'u5-c2',
        chapterNumber: 2,
        title: 'Public Finance, Monetary System & Fiscal Federalism',
        lessons: [
          {
            id: 'u5-c2-l1',
            lessonNumber: '2.1',
            title: 'Sources of Government Revenue and Taxation Structure',
            status: 'Awaiting Notes',
            description: 'Direct and indirect taxes, non-tax revenue, capital receipts, and public debt management.',
          },
          {
            id: 'u5-c2-l2',
            lessonNumber: '2.2',
            title: 'Reserve Bank of India & Monetary Policy Framework',
            status: 'Awaiting Notes',
            description: 'Repo rate, Reverse Repo, CRR, SLR, Open Market Operations, Inflation targeting (MPC), and banking regulations.',
          },
          {
            id: 'u5-c2-l3',
            lessonNumber: '2.3',
            title: 'Fiscal Policy, Fiscal Responsibility (FRBM) & Finance Commission',
            status: 'Awaiting Notes',
            description: 'Article 280, 15th Finance Commission recommendations, vertical and horizontal tax devolution.',
          },
          {
            id: 'u5-c2-l4',
            lessonNumber: '2.4',
            title: 'Goods and Services Tax (GST) & Resource Sharing',
            status: 'Awaiting Notes',
            description: '101st Amendment, GST Council, CGST, SGST, IGST, compensation cess issues, and state revenue autonomy.',
          },
        ],
      },
      {
        id: 'u5-c3',
        chapterNumber: 3,
        title: 'Agriculture, Industry & Social Challenges in India',
        lessons: [
          {
            id: 'u5-c3-l1',
            lessonNumber: '3.1',
            title: 'Structure of Indian Economy, Employment & Skill Development',
            status: 'Awaiting Notes',
            description: 'Organized vs unorganized labor, gig economy, PLFS surveys, and National Skill Development Mission.',
          },
          {
            id: 'u5-c3-l2',
            lessonNumber: '3.2',
            title: 'Land Reforms, Agriculture & Technology Applications',
            status: 'Awaiting Notes',
            description: 'Tenancy reforms, ceiling acts, agri-tech, precision farming, PM-KISAN, e-NAM, and agricultural credit.',
          },
          {
            id: 'u5-c3-l3',
            lessonNumber: '3.3',
            title: 'Industrial Growth, Manufacturing, and Infrastructure Policies',
            status: 'Awaiting Notes',
            description: 'Industrial corridors, PLI schemes, National Manufacturing Policy, MSME classifications, and FDI trends.',
          },
          {
            id: 'u5-c3-l4',
            lessonNumber: '3.4',
            title: 'Rural Welfare, Poverty Alleviation & Social Problems',
            status: 'Awaiting Notes',
            description: 'MGNREGA, PMAY-G, poverty estimation (Tendulkar/Rangarajan lines), population dynamics, and healthcare.',
          },
        ],
      },
      {
        id: 'u5-c4',
        chapterNumber: 4,
        title: 'Human Development & Social Justice in Tamil Nadu',
        lessons: [
          {
            id: 'u5-c4-l1',
            lessonNumber: '4.1',
            title: 'Human Development Indicators in Tamil Nadu: Interstate Comparison',
            status: 'Awaiting Notes',
            description: 'Life expectancy, infant mortality rate (IMR), maternal mortality (MMR), sex ratio, and educational enrollment.',
          },
          {
            id: 'u5-c4-l2',
            lessonNumber: '4.2',
            title: 'Impact of Social Reform Movements on Socio-Economic Development',
            status: 'Awaiting Notes',
            description: 'Egalitarian initiatives, self-respect ideology, eradication of untouchability, and access to common public spaces.',
          },
          {
            id: 'u5-c4-l3',
            lessonNumber: '4.3',
            title: 'Rationale Behind Reservation Policy & Access to Social Resources',
            status: 'Awaiting Notes',
            description: 'History of Communal G.O., 69% reservation law, 9th Schedule protection, internal reservations (Arunthathiyar, MBC).',
          },
          {
            id: 'u5-c4-l4',
            lessonNumber: '4.4',
            title: 'Social Justice and Social Harmony as Foundation of Growth',
            status: 'Awaiting Notes',
            description: 'Dravidian model of socio-economic progress, inclusive welfare policies, and communal harmony.',
          },
        ],
      },
      {
        id: 'u5-c5',
        chapterNumber: 5,
        title: 'Welfare Schemes, e-Governance & Public Delivery in TN',
        lessons: [
          {
            id: 'u5-c5-l1',
            lessonNumber: '5.1',
            title: 'Pioneering Welfare Schemes of Government of Tamil Nadu',
            status: 'Awaiting Notes',
            description: 'Midday meal scheme, Chief Minister Breakfast scheme, Pudhumai Penn, Moovalur Ramamirtham, and Kalaignar Magalir Urimai.',
          },
          {
            id: 'u5-c5-l2',
            lessonNumber: '5.2',
            title: 'Education and Public Health Systems in Tamil Nadu',
            status: 'Awaiting Notes',
            description: 'Gross Enrollment Ratio (GER) in higher education, primary health centers (PHC), and Makkalai Thedi Maruthuvam.',
          },
          {
            id: 'u5-c5-l3',
            lessonNumber: '5.3',
            title: 'Geography of Tamil Nadu & Economic Achievements in Varied Sectors',
            status: 'Awaiting Notes',
            description: 'Automobile hub, textile clusters, electronic manufacturing, renewable wind energy leader, and IT corridors.',
          },
          {
            id: 'u5-c5-l4',
            lessonNumber: '5.4',
            title: 'e-Governance, Public Delivery Systems (PDS) & Challenges',
            status: 'Awaiting Notes',
            description: 'TNeGA, e-Sevai, universal PDS implementation, Aadhaar linkage, and redressing public delivery bottlenecks.',
          },
        ],
      },
    ],
  },
  {
    id: 6,
    unitNumber: 'Unit VI',
    title: 'History, Culture, Heritage, and Socio-Political Movements in Tamil Nadu',
    tamilTitle: 'அலகு VI: தமிழ்நாட்டின் வரலாறு, பண்பாடு, மரபு மற்றும் சமூக - அரசியல் இயக்கங்கள்',
    questionCount: 40,
    standard: 'Degree Standard',
    color: '#ffd700',
    officialSyllabusTopics: [
      'History of Tamil Society, related archaeological discoveries, Tamil literature from Sangam age till contemporary times',
      'Thirukkural - Significance as a secular literature - Relevance to everyday life, Impact of Thirukkural on humanity, Thirukkural and universal values - Relevance to Socio-politico-economic affairs, Philosophical content in Thirukkural',
      'Role of Tamil Nadu in freedom struggle - Early agitations against British Rule - Role of women in freedom struggle',
      'Evolution of 19th and 20th century socio-political movements in Tamil Nadu - Justice Party, Growth of Rationalism - Self Respect Movement, Dravidian Movement, and principles underlying both these movements',
      'Contributions of Thanthai Periyar and Perarignar Anna',
    ],
    chapters: [
      {
        id: 'u6-c1',
        chapterNumber: 1,
        title: 'Tamil Society, Archaeology & Literature',
        lessons: [
          {
            id: 'u6-c1-l1',
            lessonNumber: '1.1',
            title: 'History of Tamil Society: Origin, Culture & Social Stratification',
            status: 'Awaiting Notes',
            description: 'Prehistoric Tamil Nadu, Iron age burial sites, maritime trade routes (Muziris, Poompuhar), and ancient societal customs.',
          },
          {
            id: 'u6-c1-l2',
            lessonNumber: '1.2',
            title: 'Archaeological Discoveries: Keeladi, Kodumanal, Korkai & Mayiladumparai',
            status: 'Awaiting Notes',
            description: 'Excavations proving urban civilization along Vaigai, Tamil Brahmi script chronology, carbon dating, and pottery graffiti.',
          },
          {
            id: 'u6-c1-l3',
            lessonNumber: '1.3',
            title: 'Sangam Literature: Pathinen Melkanakku and Grammar Works',
            status: 'Awaiting Notes',
            description: 'Tholkappiyam, Ettuthogai, Pathupattu, Akam and Puram concepts, Tinai classification, and Sangam poets.',
          },
          {
            id: 'u6-c1-l4',
            lessonNumber: '1.4',
            title: 'Post-Sangam Epics, Bhakti Literature, and Contemporary Tamil Works',
            status: 'Awaiting Notes',
            description: 'Silappadikaram, Manimekalai, Thevaram, Thiruvasagam, Nalayira Divya Prabandham, Kamba Ramayanam, and modern Tamil literature.',
          },
        ],
      },
      {
        id: 'u6-c2',
        chapterNumber: 2,
        title: 'Thirukkural: Secular Literature & Universal Values',
        lessons: [
          {
            id: 'u6-c2-l1',
            lessonNumber: '2.1',
            title: 'Thirukkural as a Secular and Universal Literature',
            status: 'Awaiting Notes',
            description: 'Absence of religious dogma, non-sectarian moral compass, egalitarian worldview, and international translations.',
          },
          {
            id: 'u6-c2-l2',
            lessonNumber: '2.2',
            title: 'Relevance of Thirukkural to Everyday Life and Ethics',
            status: 'Awaiting Notes',
            description: 'Domestic virtue (Illaram), gratitude, truthfulness, humility, hospitality, and self-restraint.',
          },
          {
            id: 'u6-c2-l3',
            lessonNumber: '2.3',
            title: 'Impact of Thirukkural on Humanity and Humanist Philosophy',
            status: 'Awaiting Notes',
            description: 'Compassion (Aran), non-violence, vegetarianism, universal brotherhood, and humanitarian outlook.',
          },
          {
            id: 'u6-c2-l4',
            lessonNumber: '2.4',
            title: 'Relevance of Thirukkural to Socio-Politico-Economic Affairs',
            status: 'Awaiting Notes',
            description: 'Porutpal doctrines on ideal statehood, just kingship, ministers, diplomacy, agriculture, economy, and welfare state.',
          },
          {
            id: 'u6-c2-l5',
            lessonNumber: '2.5',
            title: 'Philosophical Tenets and Moral Framework in Thirukkural',
            status: 'Awaiting Notes',
            description: 'Fate (Oozh) vs human perseverance (Muyarchi), knowledge acquisition (Arivudaimai), and ethical leadership.',
          },
        ],
      },
      {
        id: 'u6-c3',
        chapterNumber: 3,
        title: 'Tamil Nadu in the Indian Freedom Struggle',
        lessons: [
          {
            id: 'u6-c3-l1',
            lessonNumber: '3.1',
            title: 'Early Agitations Against British Rule in Tamil Nadu',
            status: 'Awaiting Notes',
            description: 'Puli Thevar (1755), Ondiveeran, Veerapandiya Kattabomman, Marudhu Brothers (Tiruchirappalli Proclamation 1801), and Dheeran Chinnamalai.',
          },
          {
            id: 'u6-c3-l2',
            lessonNumber: '3.2',
            title: 'Velu Nachiyar and The Role of Women in Freedom Struggle',
            status: 'Awaiting Notes',
            description: 'Queen Velu Nachiyar of Sivagangai, Kuyili, Anjalai Ammal, Ambujathammal, and Rukmini Lakshmipathi.',
          },
          {
            id: 'u6-c3-l3',
            lessonNumber: '3.3',
            title: '1806 Vellore Mutiny: Causes, Course, and Significance',
            status: 'Awaiting Notes',
            description: 'New turban regulations, sepoys uprising at Vellore fort, Tipu Sultan sons involvement, and British repression.',
          },
          {
            id: 'u6-c3-l4',
            lessonNumber: '3.4',
            title: 'Swadeshi & Revolutionary Phase in Tamil Nadu',
            status: 'Awaiting Notes',
            description: 'V.O. Chidambaranar and Swadeshi Steam Navigation Company, Subramania Bharati nationalist poems, Subramania Siva, and Vanchinathan.',
          },
          {
            id: 'u6-c3-l5',
            lessonNumber: '3.5',
            title: 'Non-Cooperation, Vedaranyam Salt March & Civil Disobedience',
            status: 'Awaiting Notes',
            description: 'C. Rajagopalachari Vedaranyam March (1930), Tiruppur Kumaran sacrifice, and Quit India movement across Tamil Nadu.',
          },
        ],
      },
      {
        id: 'u6-c4',
        chapterNumber: 4,
        title: 'Socio-Political Movements & Dravidian Ideology',
        lessons: [
          {
            id: 'u6-c4-l1',
            lessonNumber: '4.1',
            title: 'Justice Party: Genesis, Governance, and Social Reforms',
            status: 'Awaiting Notes',
            description: 'Non-Brahmin Manifesto (1916), South Indian Liberal Federation, Communal G.O. (1921), midday meals, and women voting rights.',
          },
          {
            id: 'u6-c4-l2',
            lessonNumber: '4.2',
            title: 'Growth of Rationalism and Self-Respect Movement (1925)',
            status: 'Awaiting Notes',
            description: 'Rejection of caste hegemony, self-respect marriages (Suyamariyadhai Thirumanam), gender equality, and radical rationalism.',
          },
          {
            id: 'u6-c4-l3',
            lessonNumber: '4.3',
            title: 'Evolution of Dravidian Movement and Principles',
            status: 'Awaiting Notes',
            description: 'Dravidar Kazhagam (1944), anti-Hindi agitations, state autonomy demands, language pride, and social reform philosophy.',
          },
          {
            id: 'u6-c4-l4',
            lessonNumber: '4.4',
            title: 'Life, Philosophy, and Contributions of Thanthai Periyar',
            status: 'Awaiting Notes',
            description: 'Vaikom hero, Kudi Arasu journal, rationalist icon, champion of women emancipation, and crusade against social inequality.',
          },
          {
            id: 'u6-c4-l5',
            lessonNumber: '4.5',
            title: 'Life, Vision, and Contributions of Perarignar Anna',
            status: 'Awaiting Notes',
            description: 'Founding of DMK (1949), 1967 historic victory, renaming Madras State as Tamil Nadu, two-language policy, and legalizing self-respect marriage.',
          },
        ],
      },
    ],
  },
]

// Part B: Aptitude and Mental Ability (SSLC Standard - 25 Questions)
export interface AptitudeUnit {
  id: number
  unitNumber: string
  title: string
  questionCount: number
  standard: string
  topics: string[]
}

export const group1AptitudeUnits: AptitudeUnit[] = [
  {
    id: 1,
    unitNumber: 'Unit I',
    title: 'Aptitude',
    questionCount: 15,
    standard: 'SSLC Standard',
    topics: [
      'Simplification',
      'Percentage',
      'Highest Common Factor (HCF)',
      'Lowest Common Multiple (LCM)',
      'Ratio and Proportion',
      'Simple Interest',
      'Compound Interest',
      'Area',
      'Volume',
      'Time and Work',
    ],
  },
  {
    id: 2,
    unitNumber: 'Unit II',
    title: 'Reasoning',
    questionCount: 10,
    standard: 'SSLC Standard',
    topics: [
      'Logical Reasoning',
      'Puzzles',
      'Dice',
      'Visual Reasoning',
      'Alpha Numeric Reasoning',
      'Number Series',
    ],
  },
]

// Dynamic calculation helper functions based on stored data
export const getUnitById = (id: number): SyllabusUnit | undefined => {
  return group1GeneralStudiesUnits.find((u) => u.id === id)
}

export const getUnitChapterCount = (unit: SyllabusUnit): number => {
  return unit.chapters.length
}

export const getUnitLessonCount = (unit: SyllabusUnit): number => {
  return unit.chapters.reduce((acc, chap) => acc + chap.lessons.length, 0)
}

export const getTotalGSQuestions = (): number => {
  return group1GeneralStudiesUnits.reduce((acc, u) => acc + u.questionCount, 0) // Exactly 175
}

export const getTotalGSChapters = (): number => {
  return group1GeneralStudiesUnits.reduce((acc, u) => acc + u.chapters.length, 0)
}

export const getTotalGSLessons = (): number => {
  return group1GeneralStudiesUnits.reduce((acc, u) => acc + getUnitLessonCount(u), 0)
}
