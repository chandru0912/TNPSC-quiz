// TNPSC Group 1: Samacheer Kalvi School Textbook (6th to 12th Standard) Syllabus Mapping
// Mapped to the 6 General Studies Units from 497_group 1 preliminary syllabus.pdf

export interface SchoolLesson {
  id: string
  lessonNumber: string
  title: string
  term?: string
  description?: string
  status: 'Available' | 'Coming Soon'
}

export interface UnitClassData {
  unitId: number
  classId: number
  unitTitle: string
  unitNumber: string
  classTitle: string
  standardNumber: number
  subjectName: string
  topics: string[]
  lessons: SchoolLesson[]
}

// 7 Standards: 6, 7, 8, 9, 10, 11, 12
export const standardClasses = [
  { id: 6, label: '6th Standard', shortLabel: '6th Std' },
  { id: 7, label: '7th Standard', shortLabel: '7th Std' },
  { id: 8, label: '8th Standard', shortLabel: '8th Std' },
  { id: 9, label: '9th Standard', shortLabel: '9th Std' },
  { id: 10, label: '10th Standard', shortLabel: '10th Std' },
  { id: 11, label: '11th Standard', shortLabel: '11th Std' },
  { id: 12, label: '12th Standard', shortLabel: '12th Std' },
]

export const unitClassRegistry: Record<string, UnitClassData> = {
  // ==========================================
  // UNIT 1: GENERAL SCIENCE (6th to 12th)
  // ==========================================
  '1-6': {
    unitId: 1,
    classId: 6,
    unitTitle: 'General Science',
    unitNumber: 'Unit I',
    classTitle: '6th Standard',
    standardNumber: 6,
    subjectName: 'Science (Samacheer Kalvi)',
    topics: [
      'Measurements: SI Units, Length, Mass, Time',
      'Forces and Motion: Types of Motion, Speed',
      'Matter Around Us: Solids, Liquids, Gases, Separation of Substances',
      'The Living World of Plants & Animals: Cell Structure, Habitat',
      'Health and Hygiene: Nutrients, Deficiency Diseases',
      'Electricity: Electric Circuits, Conductors and Insulators',
      'Heat & Magnetism: Temperature, Magnetic Poles, Applications',
    ],
    lessons: [
      { id: '1-6-l1', lessonNumber: '1.1', term: 'Term 1', title: 'Measurements and SI Units', description: 'Fundamental units, length, mass, time, volume and everyday measurement devices.', status: 'Available' },
      { id: '1-6-l2', lessonNumber: '1.2', term: 'Term 1', title: 'Forces and Motion', description: 'Contact and non-contact forces, types of motion, speed calculations and distance-time relations.', status: 'Available' },
      { id: '1-6-l3', lessonNumber: '1.3', term: 'Term 1', title: 'Matter Around Us', description: 'Physical states of matter, separation of mixtures, handpicking, filtration and decantation.', status: 'Available' },
      { id: '1-6-l4', lessonNumber: '1.4', term: 'Term 1', title: 'The Living World of Plants', description: 'Plant parts, root and shoot systems, photosynthesis basics and plant adaptations.', status: 'Available' },
      { id: '1-6-l5', lessonNumber: '1.5', term: 'Term 1', title: 'Living World of Animals', description: 'Unicellular and multicellular organisms, biodiversity, adaptations in camel, fish and birds.', status: 'Available' },
      { id: '1-6-l6', lessonNumber: '1.6', term: 'Term 1', title: 'Health and Hygiene', description: 'Carbohydrates, proteins, fats, vitamins, minerals, water and nutritional deficiency diseases.', status: 'Available' },
      { id: '1-6-l7', lessonNumber: '1.7', term: 'Term 2', title: 'Heat and Temperature', description: 'Sources of heat, thermal expansion, clinical and laboratory thermometers.', status: 'Available' },
      { id: '1-6-l8', lessonNumber: '1.8', term: 'Term 2', title: 'Electricity and Circuits', description: 'Electric cells, simple switch circuits, conductors, insulators and electrical safety.', status: 'Available' },
      { id: '1-6-l9', lessonNumber: '1.9', term: 'Term 3', title: 'Magnetism and Magnetic Materials', description: 'Discovery of magnets, magnetic poles, magnetic compass and demagnetization.', status: 'Available' },
    ],
  },
  '1-7': {
    unitId: 1,
    classId: 7,
    unitTitle: 'General Science',
    unitNumber: 'Unit I',
    classTitle: '7th Standard',
    standardNumber: 7,
    subjectName: 'Science (Samacheer Kalvi)',
    topics: [
      'Measurement & Motion: Velocity, Acceleration',
      'Heat & Temperature: Modes of Heat Transfer',
      'Light: Reflection, Plane and Spherical Mirrors',
      'Matter & Atomic Structure: Elements, Symbols, Valency',
      'Changes Around Us: Physical and Chemical Changes',
      'Reproduction in Plants: Pollination, Fertilization',
      'Health and Hygiene: Human Organ Systems, First Aid',
    ],
    lessons: [
      { id: '1-7-l1', lessonNumber: '1.1', term: 'Term 1', title: 'Measurement and Area Calculation', description: 'Derived quantities, area of irregular shapes, volume of liquids and density.', status: 'Available' },
      { id: '1-7-l2', lessonNumber: '1.2', term: 'Term 1', title: 'Motion: Velocity and Acceleration', description: 'Uniform and non-uniform motion, distance vs displacement, speed and acceleration formulas.', status: 'Available' },
      { id: '1-7-l3', lessonNumber: '1.3', term: 'Term 1', title: 'Matter in Our Surroundings & Atomic Structure', description: 'Molecules, atoms, chemical symbols, formula writing and valency.', status: 'Available' },
      { id: '1-7-l4', lessonNumber: '1.4', term: 'Term 2', title: 'Heat Transfer: Conduction, Convection & Radiation', description: 'Thermal equilibrium, sea breeze and land breeze, practical uses of heat transfer.', status: 'Available' },
      { id: '1-7-l5', lessonNumber: '1.5', term: 'Term 2', title: 'Electricity: Circuit Symbols and Heating Effects', description: 'Electric current, potential difference, fuse wire and heating appliances.', status: 'Available' },
    ],
  },
  '1-8': {
    unitId: 1,
    classId: 8,
    unitTitle: 'General Science',
    unitNumber: 'Unit I',
    classTitle: '8th Standard',
    standardNumber: 8,
    subjectName: 'Science (Samacheer Kalvi)',
    topics: [
      'Force and Pressure: Atmospheric Pressure, Friction',
      'Light: Laws of Reflection, Refraction, Optical Instruments',
      'Sound: Frequency, Amplitude, Human Ear',
      'Atomic Structure: Subatomic Particles, Isotopes',
      'Acids, Bases, and Salts in Everyday Life',
      'Microorganisms: Bacteria, Fungi, Viruses, Antibiotics',
      'Plant and Animal Cell Biology, Movement of Animals',
    ],
    lessons: [
      { id: '1-8-l1', lessonNumber: '1.1', title: 'Measurement: Base Units & Astronomical Units', description: 'SI base quantities, luminous intensity, plane angle, solid angle and precision.', status: 'Available' },
      { id: '1-8-l2', lessonNumber: '1.2', title: 'Force and Pressure in Fluids', description: 'Pascal law, hydraulic lift, atmospheric pressure, barometer and friction types.', status: 'Available' },
      { id: '1-8-l3', lessonNumber: '1.3', title: 'Light: Spherical Mirrors and Refraction', description: 'Concave and convex mirrors, ray diagrams, mirror formula and total internal reflection.', status: 'Available' },
      { id: '1-8-l4', lessonNumber: '1.4', title: 'Matter Around Us: Metals and Non-Metals', description: 'Physical and chemical properties, corrosion of metals and alloy composition.', status: 'Available' },
      { id: '1-8-l5', lessonNumber: '1.5', title: 'Microorganisms: Friendly and Harmful Microbes', description: 'Fermentation, pasteurization, pathogens, vaccines, and food preservation.', status: 'Available' },
    ],
  },
  '1-9': {
    unitId: 1,
    classId: 9,
    unitTitle: 'General Science',
    unitNumber: 'Unit I',
    classTitle: '9th Standard',
    standardNumber: 9,
    subjectName: 'Science (Samacheer Kalvi)',
    topics: [
      'Measurement: Vernier Caliper, Screw Gauge',
      'Motion: Equations of Motion, Circular Motion',
      'Fluids: Archimedes Principle, Buoyancy',
      'Work, Energy, and Power: Conservation Laws',
      'Periodic Classification of Elements',
      'Chemical Bonding: Ionic, Covalent Bonds',
      'Acids, Bases, Salts, pH in Daily Life',
      'Animal Kingdom, Plant Physiology, Environmental Science',
    ],
    lessons: [
      { id: '1-9-l1', lessonNumber: '1.1', title: 'Measurement: Vernier Caliper & Screw Gauge', description: 'Zero error, least count, measuring dimensions of spherical and cylindrical objects.', status: 'Available' },
      { id: '1-9-l2', lessonNumber: '1.2', title: 'Motion: Graphical Representation and Equations', description: 'Equations of motion under gravity, centripetal and centrifugal forces.', status: 'Available' },
      { id: '1-9-l3', lessonNumber: '1.3', title: 'Fluids: Pressure, Buoyancy and Archimedes Principle', description: 'Density, relative density, hydrometer, lactometer and laws of flotation.', status: 'Available' },
      { id: '1-9-l4', lessonNumber: '1.4', title: 'Periodic Classification of Elements', description: 'Dobereiner triads, Newlands octaves, Mendeleev periodic table and Modern Periodic Law.', status: 'Available' },
    ],
  },
  '1-10': {
    unitId: 1,
    classId: 10,
    unitTitle: 'General Science',
    unitNumber: 'Unit I',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'Science (Samacheer Kalvi)',
    topics: [
      'Laws of Motion: Newton Three Laws, Linear Momentum',
      'Optics: Lens Formula, Human Eye, Defects of Vision',
      'Thermal Physics: Gas Laws (Boyle, Charles, Avogadro)',
      'Electricity & Joule Heating: Ohm Law, Resistance',
      'Acoustics: Echo, Doppler Effect, SONAR',
      'Nuclear Physics: Radioactivity, Alpha/Beta/Gamma, Fission, Fusion',
      'Solutions, Types of Chemical Reactions, Carbon Compounds',
      'Genetics, Evolution, Health & Diseases, Environmental Management',
    ],
    lessons: [
      { id: '1-10-l1', lessonNumber: '1.1', title: 'Laws of Motion and Momentum', description: 'Inertia, Newton laws, principle of impulse, rocket propulsion and law of gravitation.', status: 'Available' },
      { id: '1-10-l2', lessonNumber: '1.2', title: 'Optics and Optical Instruments', description: 'Refraction of light, lenses, magnification, human eye, myopia, hypermetropia and presbyopia.', status: 'Available' },
      { id: '1-10-l3', lessonNumber: '1.3', title: 'Thermal Physics and Ideal Gas Equation', description: 'Real and apparent expansion of liquids, absolute temperature, Boyle law and Avogadro law.', status: 'Available' },
      { id: '1-10-l4', lessonNumber: '1.4', title: 'Electricity: Ohm Law & Domestic Circuits', description: 'Electric potential, resistance in series and parallel, electric power and safety earthing.', status: 'Available' },
      { id: '1-10-l5', lessonNumber: '1.5', title: 'Nuclear Physics: Radioactivity and Nuclear Reactors', description: 'Natural and artificial radioactivity, half-life, nuclear fission in Kudankulam and Kalpakkam, fusion.', status: 'Available' },
      { id: '1-10-l6', lessonNumber: '1.6', title: 'Genetics, DNA and Heredity', description: 'Mendel monohybrid and dihybrid cross, DNA structure, chromosomes and karyotyping.', status: 'Available' },
    ],
  },
  '1-11': {
    unitId: 1,
    classId: 11,
    unitTitle: 'General Science',
    unitNumber: 'Unit I',
    classTitle: '11th Standard',
    standardNumber: 11,
    subjectName: 'Physics, Chemistry & Biology (Higher Secondary)',
    topics: [
      'Nature of Physical World and Measurement',
      'Kinematics, Work, Energy and Power',
      'Thermodynamics and Kinetic Theory of Gases',
      'Basic Concepts of Chemistry and Chemical Calculations',
      'Periodic Properties and Chemical Bonding',
      'Diversity of Living World and Structural Organisation in Plants & Animals',
    ],
    lessons: [], // Lessons coming soon!
  },
  '1-12': {
    unitId: 1,
    classId: 12,
    unitTitle: 'General Science',
    unitNumber: 'Unit I',
    classTitle: '12th Standard',
    standardNumber: 12,
    subjectName: 'Physics, Chemistry & Biology (Higher Secondary)',
    topics: [
      'Electrostatics, Current Electricity, Magnetism',
      'Electromagnetic Induction and Alternating Current',
      'Optics and Dual Nature of Radiation and Matter',
      'Solid State, Electrochemistry, Surface Chemistry',
      'Genetics and Evolution, Biotechnology, Human Health and Disease',
      'Ecology and Environment',
    ],
    lessons: [], // Lessons coming soon!
  },

  // ==========================================
  // UNIT 2: GEOGRAPHY OF INDIA (6th to 12th)
  // ==========================================
  '2-6': {
    unitId: 2,
    classId: 6,
    unitTitle: 'Geography of India',
    unitNumber: 'Unit II',
    classTitle: '6th Standard',
    standardNumber: 6,
    subjectName: 'Social Science - Geography',
    topics: [
      'The Universe and Solar System: Planets, Moon, Asteroids',
      'Land and Oceans: Continents, Major Ocean Basins',
      'Resources: Renewable and Non-Renewable Resources',
      'Asia and Indian Subcontinent: Physical Features',
    ],
    lessons: [
      { id: '2-6-l1', lessonNumber: '2.1', term: 'Term 1', title: 'The Universe and Solar System', description: 'Big Bang theory, galaxies, solar system, planets, revolution and rotation of Earth.', status: 'Available' },
      { id: '2-6-l2', lessonNumber: '2.2', term: 'Term 1', title: 'Land and Oceans', description: 'First, second, and third order landforms, major oceans: Pacific, Atlantic, Indian, Arctic, Southern.', status: 'Available' },
      { id: '2-6-l3', lessonNumber: '2.3', term: 'Term 2', title: 'Resources: Natural, Human & Man-made', description: 'Renewable resources (solar, wind) and non-renewable resources (coal, petroleum).', status: 'Available' },
    ],
  },
  '2-7': {
    unitId: 2,
    classId: 7,
    unitTitle: 'Geography of India',
    unitNumber: 'Unit II',
    classTitle: '7th Standard',
    standardNumber: 7,
    subjectName: 'Social Science - Geography',
    topics: [
      'Interior of the Earth: Crust, Mantle, Core',
      'Landforms: Rivers, Glaciers, Wind, Waves',
      'Population and Settlement: Rural and Urban Settlements',
      'Natural Hazards and Disaster Management',
    ],
    lessons: [
      { id: '2-7-l1', lessonNumber: '2.1', term: 'Term 1', title: 'Interior of the Earth and Plate Tectonics', description: 'Lithospheric plates, earthquakes, volcanoes, seismic waves (P, S, L).', status: 'Available' },
      { id: '2-7-l2', lessonNumber: '2.2', term: 'Term 1', title: 'Landforms: Fluvial and Eolian Actions', description: 'Waterfalls, meanders, oxbow lakes, sand dunes and sea cliffs.', status: 'Available' },
      { id: '2-7-l3', lessonNumber: '2.3', term: 'Term 3', title: 'Disaster Management and Natural Hazards', description: 'Flood mitigation, cyclone preparedness, drought proofing, and emergency drills.', status: 'Available' },
    ],
  },
  '2-8': {
    unitId: 2,
    classId: 8,
    unitTitle: 'Geography of India',
    unitNumber: 'Unit II',
    classTitle: '8th Standard',
    standardNumber: 8,
    subjectName: 'Social Science - Geography',
    topics: [
      'Rocks and Soils: Igneous, Sedimentary, Metamorphic',
      'Weather and Climate: Temperature, Pressure, Winds',
      'Hydrologic Cycle: Evaporation, Condensation, Precipitation',
      'Migration and Urbanisation in India',
      'Hazards: Man-Made and Environmental Disasters',
    ],
    lessons: [
      { id: '2-8-l1', lessonNumber: '2.1', title: 'Rocks and Soils of India', description: 'Rock cycle, soil formation factors, soil horizons and soil conservation.', status: 'Available' },
      { id: '2-8-l2', lessonNumber: '2.2', title: 'Weather, Climate, and Wind Systems', description: 'Planetary winds, seasonal winds, local winds and humidity measurements.', status: 'Available' },
      { id: '2-8-l3', lessonNumber: '2.3', title: 'Hydrologic Cycle and Precipitation Types', description: 'Infiltration, runoff, groundwater table, rain gauges and rainfall distribution.', status: 'Available' },
    ],
  },
  '2-9': {
    unitId: 2,
    classId: 9,
    unitTitle: 'Geography of India',
    unitNumber: 'Unit II',
    classTitle: '9th Standard',
    standardNumber: 9,
    subjectName: 'Social Science - Geography',
    topics: [
      'Lithosphere: Endogenic and Exogenic Processes',
      'Atmosphere: Composition, Layers, Insolation, Weather Systems',
      'Hydrosphere: Ocean Currents, Tides, Marine Resources',
      'Biosphere: Ecosystems, Biomes, Biodiversity Hotspots',
    ],
    lessons: [
      { id: '2-9-l1', lessonNumber: '2.1', title: 'Atmosphere: Structure and Weather Systems', description: 'Troposphere to Exosphere, atmospheric pressure belts, cyclones and anticyclones.', status: 'Available' },
      { id: '2-9-l2', lessonNumber: '2.2', title: 'Hydrosphere and Ocean Currents', description: 'Warm and cold ocean currents, spring and neap tides, marine ecosystem.', status: 'Available' },
    ],
  },
  '2-10': {
    unitId: 2,
    classId: 10,
    unitTitle: 'Geography of India',
    unitNumber: 'Unit II',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'Social Science - Geography of India & Tamil Nadu',
    topics: [
      'India: Location, Relief, and Drainage Systems',
      'Climate and Natural Vegetation of India',
      'India - Agriculture, Cropping Seasons, Livestock',
      'India - Resources and Industries: Iron, Coal, Textiles',
      'India - Population, Transport, Communication & Trade',
      'Physical Geography of Tamil Nadu (Western Ghats, Coastal Plains)',
      'Human Geography of Tamil Nadu (Agriculture, Industries, Ports)',
    ],
    lessons: [
      { id: '2-10-l1', lessonNumber: '2.1', title: 'India: Location, Relief and Drainage', description: 'Northern Mountains, Great Northern Plains, Peninsular Plateau, Indian Islands, Himalayan and Peninsular rivers.', status: 'Available' },
      { id: '2-10-l2', lessonNumber: '2.2', title: 'Climate and Natural Vegetation of India', description: 'Factors affecting climate, Southwest and Northeast monsoon, tropical rainforests, deciduous, thorn and mangrove forests.', status: 'Available' },
      { id: '2-10-l3', lessonNumber: '2.3', title: 'India: Agriculture, Food Crops & Commercial Crops', description: 'Rice, wheat, sugarcane, cotton, tea, coffee, Green Revolution and agricultural challenges.', status: 'Available' },
      { id: '2-10-l4', lessonNumber: '2.4', title: 'Minerals, Energy Resources & Industries', description: 'Metallic and non-metallic minerals, thermal, hydel, nuclear and wind energy, industrial clusters.', status: 'Available' },
      { id: '2-10-l5', lessonNumber: '2.5', title: 'Physical Geography of Tamil Nadu', description: 'Western and Eastern Ghats, plateau regions, coastal plains, Cauvery, Vaigai, Thamirabarani rivers.', status: 'Available' },
    ],
  },
  '2-11': {
    unitId: 2,
    classId: 11,
    unitTitle: 'Geography of India',
    unitNumber: 'Unit II',
    classTitle: '11th Standard',
    standardNumber: 11,
    subjectName: 'Geography (Higher Secondary)',
    topics: ['Fundamentals of Physical Geography', 'Earth Movements', 'Climatology', 'Oceanography', 'Biogeography'],
    lessons: [], // Lessons coming soon!
  },
  '2-12': {
    unitId: 2,
    classId: 12,
    unitTitle: 'Geography of India',
    unitNumber: 'Unit II',
    classTitle: '12th Standard',
    standardNumber: 12,
    subjectName: 'Geography (Higher Secondary)',
    topics: ['Human Geography', 'Population Geography', 'Settlements', 'Economic Activities', 'Resources and Development'],
    lessons: [], // Lessons coming soon!
  },

  // ==========================================
  // UNIT 3: HISTORY, CULTURE & NATIONAL MOVEMENT (6th to 12th)
  // ==========================================
  '3-6': {
    unitId: 3,
    classId: 6,
    unitTitle: 'History, Culture of India, and Indian National Movement',
    unitNumber: 'Unit III',
    classTitle: '6th Standard',
    standardNumber: 6,
    subjectName: 'Social Science - History',
    topics: [
      'Indus Valley Civilization: Town Planning, Great Bath',
      'Ancient Cities of Tamilagam: Poompuhar, Madurai, Kanchi',
      'From Chiefdoms to Empires: Mauryan Empire, Ashoka',
      'The Age of Empires: Guptas and Vardhanas',
    ],
    lessons: [
      { id: '3-6-l1', lessonNumber: '3.1', term: 'Term 1', title: 'Indus Valley Civilization', description: 'Discovery, town planning, grid system, granary, dockyard at Lothal and script.', status: 'Available' },
      { id: '3-6-l2', lessonNumber: '3.2', term: 'Term 1', title: 'Ancient Cities of Tamilagam', description: 'Trade in Poompuhar, Sangam assemblies in Madurai, educational center Kanchi.', status: 'Available' },
      { id: '3-6-l3', lessonNumber: '3.3', term: 'Term 3', title: 'The Age of Guptas', description: 'Chandragupta I, Samudragupta, Chandragupta II, administrative officers, art, architecture and literature.', status: 'Available' },
    ],
  },
  '3-7': {
    unitId: 3,
    classId: 7,
    unitTitle: 'History, Culture of India, and Indian National Movement',
    unitNumber: 'Unit III',
    classTitle: '7th Standard',
    standardNumber: 7,
    subjectName: 'Social Science - History',
    topics: [
      'Later Cholas and Pandyas: Rajaraja I, Rajendra I',
      'Delhi Sultanate: Mamluk, Khalji, Tughlaq, Sayyid, Lodi',
      'Vijayanagar and Bahmani Kingdoms: Krishnadevaraya',
      'Mughal Empire: Babur, Akbar, Shah Jahan, Aurangzeb',
      'The Marathas and Peshwas: Shivaji Administration',
    ],
    lessons: [
      { id: '3-7-l1', lessonNumber: '3.1', term: 'Term 1', title: 'Later Cholas and Pandyas', description: 'Brihadisvara temple, land grants, village councils, Kudavolai and maritime expeditions.', status: 'Available' },
      { id: '3-7-l2', lessonNumber: '3.2', term: 'Term 1', title: 'Delhi Sultanate', description: 'Qutbuddin Aibak, Iltutmish, Balban, Alauddin market reforms, Muhammad bin Tughlaq.', status: 'Available' },
      { id: '3-7-l3', lessonNumber: '3.3', term: 'Term 2', title: 'Vijayanagar and Bahmani Kingdoms', description: 'Establishment in 1336, Krishnadevaraya patronage of Telugu/Sanskrit, Battle of Talikota 1565.', status: 'Available' },
      { id: '3-7-l4', lessonNumber: '3.4', term: 'Term 2', title: 'The Mughal Empire', description: 'Akbar administrative and religious policies (Sulh-i-Kul), Mansabdari system, architecture.', status: 'Available' },
    ],
  },
  '3-8': {
    unitId: 3,
    classId: 8,
    unitTitle: 'History, Culture of India, and Indian National Movement',
    unitNumber: 'Unit III',
    classTitle: '8th Standard',
    standardNumber: 8,
    subjectName: 'Social Science - History',
    topics: [
      'Advent of Europeans: Portuguese, Dutch, British, French',
      'From Trade to Territory: Carnatic Wars, Plassey, Buxar',
      'People Revolt: Poligar Rebellion, 1806 Vellore Mutiny, 1857 Revolt',
      'Status of Women in India through Ages',
    ],
    lessons: [
      { id: '3-8-l1', lessonNumber: '3.1', title: 'Advent of the Europeans in India', description: 'Vasco da Gama, British East India Company, Battle of Plassey (1757) and Buxar (1764).', status: 'Available' },
      { id: '3-8-l2', lessonNumber: '3.2', title: 'People Revolt: Poligar Rebellion and 1806 Vellore Mutiny', description: 'Puli Thevar, Kattabomman, Marudhu brothers, 1806 Vellore Mutiny sepoys uprising.', status: 'Available' },
      { id: '3-8-l3', lessonNumber: '3.3', title: 'The Great Revolt of 1857', description: 'Causes, Mangal Pandey, Rani Lakshmibai, Bahadur Shah Zafar, Queen Victoria Proclamation 1858.', status: 'Available' },
    ],
  },
  '3-9': {
    unitId: 3,
    classId: 9,
    unitTitle: 'History, Culture of India, and Indian National Movement',
    unitNumber: 'Unit III',
    classTitle: '9th Standard',
    standardNumber: 9,
    subjectName: 'Social Science - History',
    topics: ['Early Civilizations', 'Early Tamil Society and Culture', 'Intellectual Awakening and Socio-Political Changes'],
    lessons: [
      { id: '3-9-l1', lessonNumber: '3.1', title: 'Early Tamil Society and Culture', description: 'Sangam literature, epigraphy, Keezhadi archaeological findings and trade networks.', status: 'Available' },
    ],
  },
  '3-10': {
    unitId: 3,
    classId: 10,
    unitTitle: 'History, Culture of India, and Indian National Movement',
    unitNumber: 'Unit III',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'Social Science - Indian National Movement',
    topics: [
      'Social and Religious Reform Movements in 19th Century',
      'Early Revolts against British Rule in Tamil Nadu',
      'Anti-Colonial Movements and The Birth of Nationalism',
      'Nationalism: Gandhian Phase (Non-Cooperation, Civil Disobedience, Quit India)',
      'Freedom Struggle in Tamil Nadu (VOC, Bharathiar, Rajaji, Kamarajar)',
    ],
    lessons: [
      { id: '3-10-l1', lessonNumber: '3.1', title: 'Socio-Religious Reform Movements in the 19th Century', description: 'Brahmo Samaj, Prarthana Samaj, Arya Samaj, Ramakrishna Mission, Theosophical Society.', status: 'Available' },
      { id: '3-10-l2', lessonNumber: '3.2', title: 'Early Revolts Against British Rule in Tamil Nadu', description: 'Palayakkarars rebellion, Velu Nachiyar, Dheeran Chinnamalai and the Vellore revolt.', status: 'Available' },
      { id: '3-10-l3', lessonNumber: '3.3', title: 'Anti-Colonial Movements and Birth of Nationalism', description: 'Formation of INC, Moderates vs Extremists, Partition of Bengal, Swadeshi Movement.', status: 'Available' },
      { id: '3-10-l4', lessonNumber: '3.4', title: 'Gandhian Era of Freedom Struggle', description: 'Rowlatt Satyagraha, Jallianwala Bagh, Khilafat, Salt Satyagraha, Round Table Conferences, Quit India 1942.', status: 'Available' },
      { id: '3-10-l5', lessonNumber: '3.5', title: 'Freedom Struggle in Tamil Nadu', description: 'Madras Mahajana Sabha, Swadeshi Steam Navigation, Bharathiar poetry, Vedaranyam Salt March.', status: 'Available' },
    ],
  },
  '3-11': {
    unitId: 3,
    classId: 11,
    unitTitle: 'History, Culture of India, and Indian National Movement',
    unitNumber: 'Unit III',
    classTitle: '11th Standard',
    standardNumber: 11,
    subjectName: 'History (Higher Secondary)',
    topics: ['Early India', 'Vedic Age', 'Mauryan Empire', 'Guptas', 'Delhi Sultanate', 'Mughals', 'Marathas'],
    lessons: [], // Lessons coming soon!
  },
  '3-12': {
    unitId: 3,
    classId: 12,
    unitTitle: 'History, Culture of India, and Indian National Movement',
    unitNumber: 'Unit III',
    classTitle: '12th Standard',
    standardNumber: 12,
    subjectName: 'History (Higher Secondary)',
    topics: ['Rise of Nationalism in India', 'Communalism and Partition', 'Reconstruction of Post-Colonial India'],
    lessons: [], // Lessons coming soon!
  },

  // ==========================================
  // UNIT 4: INDIAN POLITY (6th to 12th)
  // ==========================================
  '4-6': {
    unitId: 4,
    classId: 6,
    unitTitle: 'Indian Polity',
    unitNumber: 'Unit IV',
    classTitle: '6th Standard',
    standardNumber: 6,
    subjectName: 'Social Science - Civics',
    topics: [
      'Understanding Diversity: Cultural, Linguistic, Religious Diversity',
      'Achieving Equality: Prejudices, Discrimination, Gender Inequality',
      'National Symbols: Flag, Emblem, Anthem, Calendar',
      'The Constitution of India: Preamble, Meaning, Framing',
      'Democracy: Direct and Representative Democracy',
      'Local Bodies - Rural and Urban: Grama Sabha, Panchayat',
    ],
    lessons: [
      { id: '4-6-l1', lessonNumber: '4.1', term: 'Term 1', title: 'Understanding Diversity in India', description: 'Unity in diversity, geographical, linguistic, cultural, and religious diversity.', status: 'Available' },
      { id: '4-6-l2', lessonNumber: '4.2', term: 'Term 1', title: 'Achieving Equality and Eradication of Discrimination', description: 'Constitutional safeguards, Dr. Ambedkar role, and promoting socio-economic equality.', status: 'Available' },
      { id: '4-6-l3', lessonNumber: '4.3', term: 'Term 2', title: 'The Constitution of India: Origin and Features', description: 'Drafting committee, preamble, fundamental rights, and supreme law of the land.', status: 'Available' },
      { id: '4-6-l4', lessonNumber: '4.4', term: 'Term 3', title: 'Local Self Government: Rural and Urban Bodies', description: 'Village Panchayat, Panchayat Union, District Panchayat, Municipalities and Corporations.', status: 'Available' },
    ],
  },
  '4-7': {
    unitId: 4,
    classId: 7,
    unitTitle: 'Indian Polity',
    unitNumber: 'Unit IV',
    classTitle: '7th Standard',
    standardNumber: 7,
    subjectName: 'Social Science - Civics',
    topics: ['Equality in Indian Democracy', 'Political Parties: National & Regional', 'State Government: Governor, CM, Assembly'],
    lessons: [
      { id: '4-7-l1', lessonNumber: '4.1', term: 'Term 1', title: 'Equality and Fundamental Freedoms', description: 'Article 14 to 18, rule of law, and adult suffrage in democratic elections.', status: 'Available' },
      { id: '4-7-l2', lessonNumber: '4.2', term: 'Term 1', title: 'Political Parties: Role and Functions', description: 'Party system, national parties, regional parties, election symbols, and opposition party.', status: 'Available' },
      { id: '4-7-l3', lessonNumber: '4.3', term: 'Term 2', title: 'State Government Administration', description: 'Role of Governor, Chief Minister, council of ministers, and legislative assembly.', status: 'Available' },
    ],
  },
  '4-8': {
    unitId: 4,
    classId: 8,
    unitTitle: 'Indian Polity',
    unitNumber: 'Unit IV',
    classTitle: '8th Standard',
    standardNumber: 8,
    subjectName: 'Social Science - Civics',
    topics: ['Citizenship: Acquisition & Termination', 'Understanding Secularism', 'Human Rights and UNO', 'Judiciary in India'],
    lessons: [
      { id: '4-8-l1', lessonNumber: '4.1', title: 'Citizenship: Rights and Duties', description: 'By birth, descent, registration, naturalization, incorporation, loss of citizenship.', status: 'Available' },
      { id: '4-8-l2', lessonNumber: '4.2', title: 'Understanding Secularism in India', description: 'Constitutional provisions, Sarva Dharma Sambhava, religious tolerance.', status: 'Available' },
      { id: '4-8-l3', lessonNumber: '4.3', title: 'Judiciary: Supreme Court, High Courts & Subordinate Courts', description: 'Hierarchy of courts, judicial review, civil vs criminal law, Lok Adalat.', status: 'Available' },
    ],
  },
  '4-9': {
    unitId: 4,
    classId: 9,
    unitTitle: 'Indian Polity',
    unitNumber: 'Unit IV',
    classTitle: '9th Standard',
    standardNumber: 9,
    subjectName: 'Social Science - Civics',
    topics: [
      'Forms of Government and Democracy',
      'Election, Political Parties, and Pressure Groups',
      'Fundamental Rights, Duties, and Human Rights',
      'Local Self Government and 73rd/74th Constitutional Amendments',
    ],
    lessons: [
      { id: '4-9-l1', lessonNumber: '4.1', title: 'Election Commission and Electoral System in India', description: 'Article 324, universal adult franchise, EVMs, VVPAT, Model Code of Conduct.', status: 'Available' },
      { id: '4-9-l2', lessonNumber: '4.2', title: 'Fundamental Rights and Duties (Part III & IV-A)', description: 'Articles 12 to 35, Article 51A, constitutional remedies under Article 32.', status: 'Available' },
    ],
  },
  '4-10': {
    unitId: 4,
    classId: 10,
    unitTitle: 'Indian Polity',
    unitNumber: 'Unit IV',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'Social Science - Civics (Constitution of India)',
    topics: [
      'Indian Constitution: Preamble, Salient Features, Fundamental Rights, DPSP, Amendments',
      'Central Government: President, Vice President, Prime Minister, Parliament, Supreme Court',
      'State Government: Governor, Chief Minister, Legislature, High Court',
      'India Foreign Policy and International Relations',
    ],
    lessons: [
      { id: '4-10-l1', lessonNumber: '4.1', title: 'Indian Constitution: Preamble, Rights & DPSP', description: 'Making of the Constitution, salient features, fundamental rights, directive principles, emergency powers (Arts 352, 356, 360).', status: 'Available' },
      { id: '4-10-l2', lessonNumber: '4.2', title: 'Central Government: Executive and Parliament', description: 'President election & powers, Prime Minister, Lok Sabha, Rajya Sabha, legislative procedure, Supreme Court of India.', status: 'Available' },
      { id: '4-10-l3', lessonNumber: '4.3', title: 'State Government Machinery', description: 'Governor functions, Chief Minister & Cabinet, Legislative Assembly, Speaker, Madras High Court.', status: 'Available' },
    ],
  },
  '4-11': {
    unitId: 4,
    classId: 11,
    unitTitle: 'Indian Polity',
    unitNumber: 'Unit IV',
    classTitle: '11th Standard',
    standardNumber: 11,
    subjectName: 'Political Science (Higher Secondary)',
    topics: ['Basic Concepts of State', 'Sovereignty', 'Constitution and Constitutionalism', 'Federalism in India', 'Local Governments'],
    lessons: [], // Lessons coming soon!
  },
  '4-12': {
    unitId: 4,
    classId: 12,
    unitTitle: 'Indian Polity',
    unitNumber: 'Unit IV',
    classTitle: '12th Standard',
    standardNumber: 12,
    subjectName: 'Political Science (Higher Secondary)',
    topics: ['Constitution of India', 'Legislature', 'Executive', 'Judiciary', 'Federalism', 'Administrative Machinery in India'],
    lessons: [], // Lessons coming soon!
  },

  // ==========================================
  // UNIT 5: ECONOMY & TN DEVELOPMENT (6th to 12th)
  // ==========================================
  '5-6': {
    unitId: 5,
    classId: 6,
    unitTitle: 'Indian Economy and Development Administration in Tamil Nadu',
    unitNumber: 'Unit V',
    classTitle: '6th Standard',
    standardNumber: 6,
    subjectName: 'Social Science - Economics',
    topics: [
      'Economics: An Introduction',
      'Primary, Secondary, and Tertiary Activities',
      'Village Economy and Urban Livelihoods',
      'Savings and Money Basics',
    ],
    lessons: [
      { id: '5-6-l1', lessonNumber: '5.1', term: 'Term 2', title: 'Economics: An Introduction', description: 'Needs, wants, producers, consumers, barter system, origin of money and banking.', status: 'Available' },
    ],
  },
  '5-7': {
    unitId: 5,
    classId: 7,
    unitTitle: 'Indian Economy and Development Administration in Tamil Nadu',
    unitNumber: 'Unit V',
    classTitle: '7th Standard',
    standardNumber: 7,
    subjectName: 'Social Science - Economics',
    topics: [
      'Production: Land, Labour, Capital, Organization',
      'Direct and Indirect Taxes',
      'Government Revenue and Public Expenditures',
    ],
    lessons: [
      { id: '5-7-l1', lessonNumber: '5.1', term: 'Term 1', title: 'Production and Factors of Production', description: 'Primary and secondary factors: land, labour, division of labour, capital, entrepreneurship.', status: 'Available' },
      { id: '5-7-l2', lessonNumber: '5.2', term: 'Term 3', title: 'Tax and its Importance in Development', description: 'Direct taxes (Income tax, wealth tax) and indirect taxes (GST, excise, customs).', status: 'Available' },
    ],
  },
  '5-8': {
    unitId: 5,
    classId: 8,
    unitTitle: 'Indian Economy and Development Administration in Tamil Nadu',
    unitNumber: 'Unit V',
    classTitle: '8th Standard',
    standardNumber: 8,
    subjectName: 'Social Science - Economics',
    topics: [
      'Money, Savings, and Investments',
      'Public and Private Sectors in India',
      'Socio-Economic Infrastructure',
    ],
    lessons: [
      { id: '5-8-l1', lessonNumber: '5.1', title: 'Money, Savings, and Financial Institutions', description: 'Evolution of money (metal, paper, digital money), role of RBI, commercial banks and savings.', status: 'Available' },
      { id: '5-8-l2', lessonNumber: '5.2', title: 'Public and Private Sectors in Development', description: 'PSUs, Navratnas, Maharatnas, socio-economic indicators and employment creation.', status: 'Available' },
    ],
  },
  '5-9': {
    unitId: 5,
    classId: 9,
    unitTitle: 'Indian Economy and Development Administration in Tamil Nadu',
    unitNumber: 'Unit V',
    classTitle: '9th Standard',
    standardNumber: 9,
    subjectName: 'Social Science - Economics',
    topics: [
      'Understanding Development: Perspectives, Measurement, Sustainability',
      'Employment in India and Tamil Nadu: Organized and Unorganized',
      'Money and Credit: Credit Systems in Rural Areas',
      'Agriculture in Tamil Nadu: Irrigation, Land Holdings, Cropping Pattern',
      'Migration: Patterns and Causes',
    ],
    lessons: [
      { id: '5-9-l1', lessonNumber: '5.1', title: 'Understanding Development and Human Development Index', description: 'Per capita income, purchasing power parity, literacy rate, HDI indicators and sustainability.', status: 'Available' },
      { id: '5-9-l2', lessonNumber: '5.2', title: 'Employment in India and Tamil Nadu', description: 'Primary/secondary/tertiary employment, organized vs unorganized sectors, gig workers.', status: 'Available' },
      { id: '5-9-l3', lessonNumber: '5.3', title: 'Agriculture in Tamil Nadu', description: 'Rivers, groundwater usage, delta regions, tenant farming, and crop yield in Tamil Nadu.', status: 'Available' },
    ],
  },
  '5-10': {
    unitId: 5,
    classId: 10,
    unitTitle: 'Indian Economy and Development Administration in Tamil Nadu',
    unitNumber: 'Unit V',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'Social Science - Economics (Indian Economy & TN Industry)',
    topics: [
      'Gross Domestic Product (GDP) and its Growth: An Introduction',
      'Globalization and Trade: WTO, MNCs, Fair Trade',
      'Food Security and Nutrition in India and Tamil Nadu: Universal PDS',
      'Government and Taxes: Direct and Indirect Taxes, GST Council',
      'Industrial Clusters in Tamil Nadu: Auto, Textile, Leather, IT Hubs',
    ],
    lessons: [
      { id: '5-10-l1', lessonNumber: '5.1', title: 'Gross Domestic Product and Sectoral Contributions', description: 'GDP, GNP, NNP, nominal vs real GDP, contribution of service sector in Tamil Nadu.', status: 'Available' },
      { id: '5-10-l2', lessonNumber: '5.2', title: 'Food Security and Universal PDS in Tamil Nadu', description: 'Buffer stock, FCI, National Food Security Act, Amma Unavagam, universal PDS implementation in TN.', status: 'Available' },
      { id: '5-10-l3', lessonNumber: '5.3', title: 'Government and Taxes: Fiscal Systems & GST', description: 'Tax revenue, non-tax revenue, progressive taxation, GST framework and tax evasion control.', status: 'Available' },
      { id: '5-10-l4', lessonNumber: '5.4', title: 'Industrial Clusters in Tamil Nadu', description: 'Detroit of Asia (Chennai auto hub), Tirupur knitwear, Sivakasi fireworks, Salem steel, Vellore leather.', status: 'Available' },
    ],
  },
  '5-11': {
    unitId: 5,
    classId: 11,
    unitTitle: 'Indian Economy and Development Administration in Tamil Nadu',
    unitNumber: 'Unit V',
    classTitle: '11th Standard',
    standardNumber: 11,
    subjectName: 'Economics (Higher Secondary)',
    topics: ['Indian Economy Pre & Post-Independence', 'Development Experience of India', 'Rural Economy', 'Tamil Nadu Economy'],
    lessons: [], // Lessons coming soon!
  },
  '5-12': {
    unitId: 5,
    classId: 12,
    unitTitle: 'Indian Economy and Development Administration in Tamil Nadu',
    unitNumber: 'Unit V',
    classTitle: '12th Standard',
    standardNumber: 12,
    subjectName: 'Economics (Higher Secondary)',
    topics: ['National Income', 'Theories of Employment', 'Monetary Economics', 'Fiscal Economics', 'Fiscal Federalism'],
    lessons: [], // Lessons coming soon!
  },

  // ==========================================
  // UNIT 6: TAMIL NADU HISTORY, CULTURE & MOVEMENTS (6th to 12th)
  // ==========================================
  '6-6': {
    unitId: 6,
    classId: 6,
    unitTitle: 'History, Culture, Heritage, and Socio-Political Movements in Tamil Nadu',
    unitNumber: 'Unit VI',
    classTitle: '6th Standard',
    standardNumber: 6,
    subjectName: 'Social Science - Tamil History & Culture',
    topics: [
      'Society and Culture in Ancient Tamizhagam: The Sangam Age',
      'The Three Dynasties: Cheras, Cholas, Pandyas',
      'Ancient Cities of Tamilagam: Poompuhar, Madurai, Kanchi',
      'Archaeological Excavations: Keeladi, Adichanallur',
    ],
    lessons: [
      { id: '6-6-l1', lessonNumber: '6.1', term: 'Term 1', title: 'Ancient Ports and Cities of Tamilagam', description: 'Poompuhar maritime trade with Yavanas, Madurai Sangam scholars, Kanchi educational institutions.', status: 'Available' },
      { id: '6-6-l2', lessonNumber: '6.2', term: 'Term 3', title: 'Society and Culture in Ancient Tamizhagam: The Sangam Age', description: 'Corpus of Sangam literature, Cheras, Cholas, Pandyas, Velirs, women poets (Avvaiyar, Velli Veethiyar).', status: 'Available' },
      { id: '6-6-l3', lessonNumber: '6.3', term: 'Term 3', title: 'Archaeological Excavations in Tamil Nadu', description: 'Adichanallur urn burials, Keeladi pottery graffiti, Korkai pearl fisheries, Kodumanal quartz beads.', status: 'Available' },
    ],
  },
  '6-7': {
    unitId: 6,
    classId: 7,
    unitTitle: 'History, Culture, Heritage, and Socio-Political Movements in Tamil Nadu',
    unitNumber: 'Unit VI',
    classTitle: '7th Standard',
    standardNumber: 7,
    subjectName: 'Social Science - Tamil Culture & Monuments',
    topics: [
      'Later Cholas and Pandyas: Architecture, Inscriptions',
      'Religious Movements in South India: Bhakti Era (Alwars & Nayanmars)',
      'Art and Architecture of Tamil Nadu',
    ],
    lessons: [
      { id: '6-7-l1', lessonNumber: '6.1', term: 'Term 1', title: 'Imperial Cholas and Later Pandyas', description: 'Thanjavur Brihadisvara temple, Gangaikonda Cholapuram, local self government via Kudavolai.', status: 'Available' },
      { id: '6-7-l2', lessonNumber: '6.2', term: 'Term 2', title: 'Bhakti Movement in South India', description: '63 Nayanmars, 12 Alwars, Thevaram, Thiruvasagam, Nalayira Divya Prabandham, religious synthesis.', status: 'Available' },
    ],
  },
  '6-8': {
    unitId: 6,
    classId: 8,
    unitTitle: 'History, Culture, Heritage, and Socio-Political Movements in Tamil Nadu',
    unitNumber: 'Unit VI',
    classTitle: '8th Standard',
    standardNumber: 8,
    subjectName: 'Social Science - Freedom Struggle in Tamil Nadu',
    topics: [
      'Early Agitations in Tamil Nadu: Puli Thevar, Kattabomman, Marudhu Brothers',
      'Queen Velu Nachiyar and The Role of Women Patriots',
      '1806 Vellore Mutiny: The First Spark of Independence',
    ],
    lessons: [
      { id: '6-8-l1', lessonNumber: '6.1', title: 'Poligars Revolt in Tamil Nadu (1755–1801)', description: 'Puli Thevar at Nerkattumseval, Veerapandiya Kattabomman at Panchalankurichi, Marudhu brothers Tiruchirappalli Proclamation.', status: 'Available' },
      { id: '6-8-l2', lessonNumber: '6.2', title: 'Queen Velu Nachiyar of Sivagangai & Kuyili', description: 'First Indian queen to fight British rule, formation of human suicide battalion led by Kuyili.', status: 'Available' },
      { id: '6-8-l3', lessonNumber: '6.3', title: '1806 Vellore Sepoy Mutiny', description: 'Agnew turban, sepoys capture of fort, Colonel Gillespie intervention, precursor to 1857 revolt.', status: 'Available' },
    ],
  },
  '6-9': {
    unitId: 6,
    classId: 9,
    unitTitle: 'History, Culture, Heritage, and Socio-Political Movements in Tamil Nadu',
    unitNumber: 'Unit VI',
    classTitle: '9th Standard',
    standardNumber: 9,
    subjectName: 'Social Science - Tamil Heritage',
    topics: [
      'Early Tamil Society and Culture: Sangam Literature & Epigraphy',
      'Excavations at Keeladi: Evidence of Urban Civilization along Vaigai',
      'Thirukkural and Universal Human Values',
    ],
    lessons: [
      { id: '6-9-l1', lessonNumber: '6.1', title: 'Early Tamil Society, Epigraphy and Archaeological Discoveries', description: 'Tamil Brahmi inscriptions, Hero stones (Nadukal), punch-marked coins, Roman amphorae and Keeladi carbon dating.', status: 'Available' },
      { id: '6-9-l2', lessonNumber: '6.2', title: 'Thirukkural: Secular Philosophy and Everyday Conduct', description: 'Egalitarianism, social harmony, ethical governance, and relevance to modern constitutional morality.', status: 'Available' },
    ],
  },
  '6-10': {
    unitId: 6,
    classId: 10,
    unitTitle: 'History, Culture, Heritage, and Socio-Political Movements in Tamil Nadu',
    unitNumber: 'Unit VI',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'Social Science - Social Transformation in Tamil Nadu',
    topics: [
      'Early Revolts against British Rule in Tamil Nadu',
      'Anti-Colonial Movements and Freedom Struggle in Tamil Nadu',
      'Social Transformation in Tamil Nadu (Justice Party, Self-Respect Movement, Periyar, Anna)',
    ],
    lessons: [
      { id: '6-10-l1', lessonNumber: '6.1', title: 'Pioneers of Freedom Struggle in Tamil Nadu', description: 'V.O. Chidambaranar and Swadeshi Steam Navigation, Subramania Bharati nationalist songs, Vanchinathan.', status: 'Available' },
      { id: '6-10-l2', lessonNumber: '6.2', title: 'Non-Cooperation and Vedaranyam Salt Satyagraha in TN', description: 'Rajaji leading march to Vedaranyam, Tiruppur Kumaran sacrifice, Quit India movement in Madurai and Chennai.', status: 'Available' },
      { id: '6-10-l3', lessonNumber: '6.3', title: 'The Justice Party and Non-Brahmin Movement', description: 'South Indian Liberal Federation, Non-Brahmin Manifesto (1916), Communal G.O. (1921), midday meal in Chennai.', status: 'Available' },
      { id: '6-10-l4', lessonNumber: '6.4', title: 'Self-Respect Movement and Thanthai Periyar', description: '1925 founding, anti-caste crusade, self-respect marriages, Kudi Arasu journal, women empowerment.', status: 'Available' },
      { id: '6-10-l5', lessonNumber: '6.5', title: 'The Dravidian Movement and Perarignar Anna', description: 'Dravidar Kazhagam, formation of DMK in 1949, 1967 victory, renaming Madras State as Tamil Nadu, two-language policy.', status: 'Available' },
    ],
  },
  '6-11': {
    unitId: 6,
    classId: 11,
    unitTitle: 'History, Culture, Heritage, and Socio-Political Movements in Tamil Nadu',
    unitNumber: 'Unit VI',
    classTitle: '11th Standard',
    standardNumber: 11,
    subjectName: 'History & Ethics (Higher Secondary)',
    topics: ['Cultural Heritage of Tamils', 'Tamil Literature through Ages', 'Religious Philosophy and Dravidian Movement'],
    lessons: [], // Lessons coming soon!
  },
  '6-12': {
    unitId: 6,
    classId: 12,
    unitTitle: 'History, Culture, Heritage, and Socio-Political Movements in Tamil Nadu',
    unitNumber: 'Unit VI',
    classTitle: '12th Standard',
    standardNumber: 12,
    subjectName: 'History & Ethics (Higher Secondary)',
    topics: ['Socio-Political Evolution of Modern Tamil Nadu', 'Eminent Leaders of Tamil Nadu', 'Social Justice Policy'],
    lessons: [], // Lessons coming soon!
  },
}

// Helper to look up unit class data
export const getUnitClassData = (unitId: number, classId: number): UnitClassData => {
  const key = `${unitId}-${classId}`
  if (unitClassRegistry[key]) {
    return unitClassRegistry[key]
  }

  // Fallback if not found: returns structured placeholder with "Lessons coming soon."
  const unitNames: Record<number, string> = {
    1: 'General Science',
    2: 'Geography of India',
    3: 'History, Culture of India, and Indian National Movement',
    4: 'Indian Polity',
    5: 'Indian Economy and Development Administration in Tamil Nadu',
    6: 'History, Culture, Heritage, and Socio-Political Movements in Tamil Nadu',
  }

  const unitNumerals: Record<number, string> = {
    1: 'Unit I',
    2: 'Unit II',
    3: 'Unit III',
    4: 'Unit IV',
    5: 'Unit V',
    6: 'Unit VI',
  }

  return {
    unitId,
    classId,
    unitTitle: unitNames[unitId] || `Unit ${unitId}`,
    unitNumber: unitNumerals[unitId] || `Unit ${unitId}`,
    classTitle: `${classId}th Standard`,
    standardNumber: classId,
    subjectName: `Samacheer Kalvi (${classId}th Standard)`,
    topics: [
      `Official ${classId}th Standard Textbook curriculum relevant to ${unitNames[unitId] || `Unit ${unitId}`}`,
      'Tamil Nadu State Board Samacheer Kalvi syllabus alignment',
      'Fundamental concepts, glossary, and objective question areas',
    ],
    lessons: [], // empty -> triggers "Lessons coming soon."
  }
}
