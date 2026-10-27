// TNPSC Group 2 & 2A: Samacheer Kalvi School Textbook (6th to 12th Standard) Syllabus Mapping
// Mapped specifically to the official Group 2 & 2A Preliminary Examination Syllabus (Code: 495)

import { group2Unit3Registry } from './group2Unit3Data'
import { group2Unit4Registry } from './group2Unit4Data'
import { group2Unit5Registry } from './group2Unit5Data'
import { group2Unit6Registry } from './group2Unit6Data'
import { group2LanguageRegistry } from './group2LanguageData'
import { group2TamilRegistry } from './group2TamilData'
import { group2EnglishRegistry } from './group2EnglishData'

export interface Group2SchoolLesson {
  id: string
  lessonNumber: string
  title: string
  term?: string
  description?: string
  status: 'Available' | 'Coming Soon'
  keyConcepts?: string[]
  studyNotes?: string[]
  practiceMCQs?: Array<{
    id: string
    question: string
    options: string[]
    correctAnswer: number
    explanation: string
  }>
}

export interface Group2UnitClassData {
  subjectId: string
  unitId: number
  classId: number
  subjectTitle: string
  unitTitle: string
  unitNumber: string
  classTitle: string
  standardNumber: number
  subjectName: string
  topics: string[]
  lessons: Group2SchoolLesson[]
}

export const standardClasses = [
  { id: 6, label: '6th Standard', shortLabel: '6th Std' },
  { id: 7, label: '7th Standard', shortLabel: '7th Std' },
  { id: 8, label: '8th Standard', shortLabel: '8th Std' },
  { id: 9, label: '9th Standard', shortLabel: '9th Std' },
  { id: 10, label: '10th Standard', shortLabel: '10th Std' },
  { id: 11, label: '11th Standard', shortLabel: '11th Std' },
  { id: 12, label: '12th Standard', shortLabel: '12th Std' },
]

export const group2ClassRegistry: Record<string, Group2UnitClassData> = {
  // =========================================================================
  // UNIT 1: GENERAL SCIENCE (5 Questions)
  // =========================================================================

  // 6th Standard - Unit 1
  'general-studies-1-6': {
    subjectId: 'general-studies',
    unitId: 1,
    classId: 6,
    subjectTitle: 'General Studies',
    unitTitle: 'General Science',
    unitNumber: 'Unit 1',
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
      {
        id: 'gs-1-6-l1',
        lessonNumber: '1.1',
        term: 'Term 1',
        title: 'Measurements and SI Units',
        description: 'Fundamental units, length, mass, time, volume and everyday measurement devices.',
        status: 'Available',
        keyConcepts: ['SI Base Units', 'Derived Units', 'Parallax Method', 'Precision & Accuracy'],
        studyNotes: [
          'The International System of Units (SI) establishes standard base quantities: meter (m), kilogram (kg), second (s), ampere (A), kelvin (K), mole (mol), and candela (cd).',
          'Mass is the quantity of matter contained in a body, while weight is the gravitational force acting on that matter (W = mg).',
          'Volume of irregular solids is accurately measured using measuring cylinders via liquid displacement method.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-1',
            question: 'What is the SI base unit of thermodynamic temperature?',
            options: ['Degree Celsius (°C)', 'Kelvin (K)', 'Degree Fahrenheit (°F)', 'Joule (J)'],
            correctAnswer: 1,
            explanation: 'Kelvin (K) is the SI base unit of temperature in the International System of Units.',
          },
          {
            id: 'mcq-gs-6-1b',
            question: 'Which instrument is most suitable for measuring the thickness of a 5-rupee coin?',
            options: ['Meter scale', 'Vernier Caliper', 'Screw Gauge', 'Measuring tape'],
            correctAnswer: 2,
            explanation: 'A screw gauge has a least count of 0.01 mm, making it ideal for measuring tiny dimensions like coin thickness.',
          },
        ],
      },
      {
        id: 'gs-1-6-l2',
        lessonNumber: '1.2',
        term: 'Term 1',
        title: 'Forces and Motion',
        description: 'Contact and non-contact forces, types of motion, speed calculations and distance-time relations.',
        status: 'Available',
        keyConcepts: ['Contact Forces', 'Field Forces', 'Periodic Motion', 'Speed = Distance / Time'],
        studyNotes: [
          'Forces are push or pull interactions categorized into contact forces (muscular, friction) and non-contact field forces (gravitational, magnetic, electrostatic).',
          'Motion can be rectilinear, curvilinear, circular, rotatory, oscillatory, or zigzag (random).',
          'Speed is defined as the distance covered per unit time: Speed = Distance / Time (m/s).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-2',
            question: 'The motion of a pendulum in a clock is an example of which type of motion?',
            options: ['Linear motion', 'Oscillatory and periodic motion', 'Random motion', 'Circular non-periodic motion'],
            correctAnswer: 1,
            explanation: 'A pendulum exhibits oscillatory motion that repeats at regular intervals of time, making it periodic.',
          },
        ],
      },
      {
        id: 'gs-1-6-l3',
        lessonNumber: '1.3',
        term: 'Term 1',
        title: 'Matter Around Us',
        description: 'Physical states of matter, separation of mixtures, handpicking, filtration and decantation.',
        status: 'Available',
        keyConcepts: ['Solids, Liquids, Gases', 'Pure Substances vs Mixtures', 'Filtration', 'Centrifugation'],
        studyNotes: [
          'Matter consists of tiny particles that occupy space and have mass. The arrangement and kinetic energy of particles determine solid, liquid, or gaseous state.',
          'Heterogeneous mixtures can be separated using handpicking, sieving, winnowing, sedimentation, decantation, and filtration.',
          'Sublimation is used to separate volatile components from non-volatile solids (e.g., camphor and salt).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-3',
            question: 'Which method is used to separate butter from curd in households?',
            options: ['Filtration', 'Churning (Centrifugation)', 'Distillation', 'Sedimentation'],
            correctAnswer: 1,
            explanation: 'Churning uses centrifugal force where heavier liquid separates from lighter butter particles.',
          },
        ],
      },
      {
        id: 'gs-1-6-l4',
        lessonNumber: '1.4',
        term: 'Term 1',
        title: 'The Living World of Plants',
        description: 'Plant parts, root and shoot systems, photosynthesis basics and plant adaptations.',
        status: 'Available',
        keyConcepts: ['Taproot vs Fibrous Root', 'Chlorophyll', 'Transpiration', 'Stomata'],
        studyNotes: [
          'Flowering plants comprise a root system (taproot in dicots, fibrous in monocots) and a shoot system (stem, leaves, flowers, fruits).',
          'Leaves prepare food via photosynthesis using sunlight, chlorophyll, CO2, and water, releasing oxygen.',
          'Loss of excess water vapor through stomata is known as transpiration, creating suction pull for water absorption.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-4',
            question: 'In plants, water transpiration primarily takes place through:',
            options: ['Lenticels', 'Stomata', 'Root hairs', 'Bark'],
            correctAnswer: 1,
            explanation: 'Stomata present on the underside of leaves facilitate gaseous exchange and transpiration.',
          },
        ],
      },
      {
        id: 'gs-1-6-l5',
        lessonNumber: '1.5',
        term: 'Term 1',
        title: 'Living World of Animals',
        description: 'Unicellular and multicellular organisms, biodiversity, adaptations in camel, fish and birds.',
        status: 'Available',
        keyConcepts: ['Amoeba & Paramecium', 'Fish Gills & Fins', 'Camel Adaptations', 'Pneumatic Bones in Birds'],
        studyNotes: [
          'Unicellular organisms like Amoeba carry out digestion, respiration, and excretion in a single cell using pseudopodia and vacuoles.',
          'Fish possess streamlined bodies and gills for extracting dissolved oxygen from water.',
          'Birds have hollow pneumatic bones and modified forelimbs as wings to reduce body weight for flight.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-5',
            question: 'Which anatomical adaptation allows birds to have lightweight skeletons for flying?',
            options: ['Cartilage skeleton', 'Pneumatic (hollow) bones', 'Double bone density', 'absence of vertebrae'],
            correctAnswer: 1,
            explanation: 'Birds possess pneumatic bones filled with air cavities that drastically reduce weight while maintaining structural strength.',
          },
        ],
      },
      {
        id: 'gs-1-6-l6',
        lessonNumber: '1.6',
        term: 'Term 1',
        title: 'Health and Hygiene',
        description: 'Carbohydrates, proteins, fats, vitamins, minerals, water and nutritional deficiency diseases.',
        status: 'Available',
        keyConcepts: ['Balanced Diet', 'Marasmus & Kwashiorkor', 'Vitamin Deficiencies', 'Personal Hygiene'],
        studyNotes: [
          'Nutrients are categorized into macronutrients (carbohydrates, fats, proteins) and micronutrients (vitamins, minerals).',
          'Protein energy malnutrition results in Kwashiorkor (swollen belly, edema) and Marasmus (severe muscle wasting).',
          'Night blindness is caused by Vitamin A deficiency; Scurvy by Vitamin C deficiency; Rickets by Vitamin D deficiency.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-6',
            question: 'Scurvy is caused due to the dietary deficiency of which vitamin?',
            options: ['Vitamin A', 'Vitamin B1', 'Vitamin C', 'Vitamin D'],
            correctAnswer: 2,
            explanation: 'Vitamin C (Ascorbic acid) deficiency causes bleeding gums and impaired wound healing known as scurvy.',
          },
        ],
      },
      {
        id: 'gs-1-6-l7',
        lessonNumber: '1.7',
        term: 'Term 2',
        title: 'Heat and Temperature',
        description: 'Sources of heat, thermal expansion, clinical and laboratory thermometers.',
        status: 'Available',
        keyConcepts: ['Heat Energy (Joule)', 'Temperature (Kelvin)', 'Mercury Thermometer', 'Thermal Expansion'],
        studyNotes: [
          'Heat is a form of thermal energy transferred from a higher temperature body to a lower temperature body.',
          'Clinical thermometers measure human body temperature with a range of 35°C to 42°C (or 94°F to 108°F), containing a constriction to prevent mercury backflow.',
          'Most substances expand when heated and contract when cooled (anomalous expansion of water between 0°C and 4°C is an exception).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-7',
            question: 'The normal human body temperature on the Celsius scale is approximately:',
            options: ['35.5°C', '37°C', '39.2°C', '98.6°C'],
            correctAnswer: 1,
            explanation: 'Normal human body temperature is approximately 37°C (corresponding to 98.6°F).',
          },
        ],
      },
      {
        id: 'gs-1-6-l8',
        lessonNumber: '1.8',
        term: 'Term 2',
        title: 'Electricity and Circuits',
        description: 'Electric cells, simple switch circuits, conductors, insulators and electrical safety.',
        status: 'Available',
        keyConcepts: ['Primary & Secondary Cells', 'Closed Circuit', 'Good Conductors', 'Insulators'],
        studyNotes: [
          'An electric circuit provides a closed continuous conductive path for electric current from the positive terminal to the negative terminal.',
          'Materials that allow electric charges to flow freely are conductors (copper, aluminum), while those that resist are insulators (rubber, glass).',
          'Primary cells are single-use chemical cells; secondary cells (lead-acid, lithium-ion) can be recharged repeatedly.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-8',
            question: 'Which of the following is a non-metal that conducts electricity?',
            options: ['Diamond', 'Graphite', 'Sulphur', 'Phosphorus'],
            correctAnswer: 1,
            explanation: 'Graphite has free delocalized valence electrons between carbon layers, allowing it to conduct electricity.',
          },
        ],
      },
      {
        id: 'gs-1-6-l9',
        lessonNumber: '1.9',
        term: 'Term 2',
        title: 'Changes Around Us',
        description: 'Slow and fast changes, reversible and irreversible, physical and chemical changes.',
        status: 'Available',
        keyConcepts: ['Physical vs Chemical', 'Reversibility', 'Endothermic Changes', 'Exothermic Changes'],
        studyNotes: [
          'Physical changes alter the physical state or shape without forming any new substance (e.g. melting of ice).',
          'Chemical changes involve reaction and new chemical bonds forming irreversible products (e.g. rusting of iron, burning of paper).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-9a',
            question: 'Which of the following is an irreversible chemical change?',
            options: ['Melting of candle wax', 'Dissolving salt in water', 'Curdling of milk', 'Boiling of water'],
            correctAnswer: 2,
            explanation: 'Curdling of milk into curd is an irreversible chemical process driven by lactic acid bacteria.',
          },
        ],
      },
      {
        id: 'gs-1-6-l10',
        lessonNumber: '1.10',
        term: 'Term 2',
        title: 'Human Organ Systems',
        description: 'Skeletal, muscular, digestive, respiratory, circulatory and nervous systems.',
        status: 'Available',
        keyConcepts: ['Human Skeleton (206 bones)', 'Digestive Enzymes', 'Lungs & Alveoli', 'Heart Chambers'],
        studyNotes: [
          'An adult human skeletal system consists of 206 bones divided into axial and appendicular skeletons.',
          'Digestion begins in the mouth with salivary amylase (ptyalin) breaking down starch into maltose.',
          'Human heart is four-chambered (two atria, two ventricles) ensuring separated oxygenated and deoxygenated blood streams.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-10',
            question: 'Salivary amylase (ptyalin) enzyme initiates the digestion of which nutrient in the mouth?',
            options: ['Proteins', 'Fats', 'Starch (Carbohydrates)', 'Vitamins'],
            correctAnswer: 2,
            explanation: 'Salivary amylase initiates carbohydrate digestion by hydrolyzing starch into simpler sugars like maltose.',
          },
        ],
      },
      {
        id: 'gs-1-6-l11',
        lessonNumber: '1.11',
        term: 'Term 3',
        title: 'Magnetism and Magnetic Materials',
        description: 'Discovery of magnets, magnetic poles, magnetic compass and demagnetization.',
        status: 'Available',
        keyConcepts: ['Natural vs Artificial Magnets', 'Like Poles Repel', 'Magnetic Compass', 'Earth Magnetic Field'],
        studyNotes: [
          'Magnetite is a natural magnetic iron ore discovered in ancient Magnesia.',
          'Every magnet has two poles: North and South. Like poles repel each other, whereas unlike poles attract.',
          'Earth behaves like a huge magnetic dipole with its magnetic south pole located near the geographic north pole.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-11',
            question: 'A freely suspended magnetic needle always comes to rest pointing in which direction?',
            options: ['East-West', 'North-South', 'North-East', 'South-West'],
            correctAnswer: 1,
            explanation: 'Due to the Earth magnetic field, a freely suspended magnet aligns along the geographic North-South direction.',
          },
        ],
      },
      {
        id: 'gs-1-6-l12',
        lessonNumber: '1.12',
        term: 'Term 3',
        title: 'Water & Freshwater Ecosystems',
        description: 'Water distribution, water cycle, potable water and conservation methods.',
        status: 'Available',
        keyConcepts: ['Water Cycle', 'Rainwater Harvesting', 'Potable Water', 'Conservation Techniques'],
        studyNotes: [
          'About 97% of Earth water is saline seawater; only about 3% is freshwater, with most locked in glaciers and polar ice.',
          'Tamil Nadu became the first state in India to make rainwater harvesting compulsory for all buildings in 2001.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-12',
            question: 'Which Indian state was the first to mandate rooftop rainwater harvesting for all buildings by law?',
            options: ['Kerala', 'Tamil Nadu', 'Karnataka', 'Maharashtra'],
            correctAnswer: 1,
            explanation: 'Tamil Nadu pioneered rooftop rainwater harvesting legislation in 2001.',
          },
        ],
      },
      {
        id: 'gs-1-6-l13',
        lessonNumber: '1.13',
        term: 'Term 3',
        title: 'Chemistry in Everyday Life',
        description: 'Soaps, detergents, bio-fertilizers, natural adhesives and cement.',
        status: 'Available',
        keyConcepts: ['Saponification', 'Soaps vs Detergents', 'Bio-fertilizers', 'Portland Cement'],
        studyNotes: [
          'Soaps are sodium or potassium salts of long-chain fatty acids prepared through saponification.',
          'Portland cement is manufactured by calcining limestone and clay at high temperatures, with gypsum added to retard setting time.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-13',
            question: 'Gypsum (CaSO4·2H2O) is added during cement manufacturing primarily to:',
            options: ['Increase strength', 'Slow down the initial setting rate', 'Impart grey color', 'Increase water solubility'],
            correctAnswer: 1,
            explanation: 'Gypsum acts as a setting retarder in cement, preventing flash setting upon adding water.',
          },
        ],
      },
      {
        id: 'gs-1-6-l14',
        lessonNumber: '1.14',
        term: 'Term 3',
        title: 'Our Environment & Pollution',
        description: 'Ecosystems, food chains, trophic levels, biodegradable and non-biodegradable waste.',
        status: 'Available',
        keyConcepts: ['Trophic Levels', 'Producers & Consumers', 'Solid Waste Management (3Rs)', 'Plastics Ban'],
        studyNotes: [
          'In a food chain, green autotrophic plants form trophic level 1, herbivores level 2, and carnivores higher levels.',
          'The 3R strategy for municipal waste consists of Reduce, Reuse, and Recycle.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-14',
            question: 'In any terrestrial ecological pyramid, which organisms always occupy the first trophic level?',
            options: ['Herbivores', 'Decomposers', 'Green autotrophic plants (Producers)', 'Apex predators'],
            correctAnswer: 2,
            explanation: 'Producers (green autotrophic plants) convert solar energy into chemical energy, forming trophic level 1.',
          },
        ],
      },
    ],
  },

  // 7th Standard - Unit 1
  'general-studies-1-7': {
    subjectId: 'general-studies',
    unitId: 1,
    classId: 7,
    subjectTitle: 'General Studies',
    unitTitle: 'General Science',
    unitNumber: 'Unit 1',
    classTitle: '7th Standard',
    standardNumber: 7,
    subjectName: 'Science (Samacheer Kalvi)',
    topics: [
      'Measurement & Motion: Velocity, Acceleration',
      'Heat & Temperature: Modes of Heat Transfer',
      'Light: Reflection, Plane and Spherical Mirrors',
      'Matter & Atomic Structure: Elements, Symbols, Valency',
      'Changes Around Us: Physical and Chemical Changes',
      'Cell Biology: Structure and Functions',
      'Reproduction in Plants: Pollination, Fertilization',
      'Health and Hygiene: Human Organ Systems, Communicable Diseases',
    ],
    lessons: [
      {
        id: 'gs-1-7-l1',
        lessonNumber: '1.1',
        term: 'Term 1',
        title: 'Measurement and Area Calculation',
        description: 'Derived quantities, area of irregular shapes, volume of liquids and density.',
        status: 'Available',
        keyConcepts: ['Density = Mass / Volume', 'Graphical Method for Irregular Area', 'CGS vs SI Units', 'Density of Water (1000 kg/m³)'],
        studyNotes: [
          'Density represents mass per unit volume (ρ = m / V). SI unit is kg/m³; CGS unit is g/cm³ (1 g/cm³ = 1000 kg/m³).',
          'Area of irregular 2D planar figures is estimated using graph paper by counting full, 3/4, and 1/2 squares.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-7-1',
            question: 'What is the density of pure water at 4°C in SI units?',
            options: ['100 kg/m³', '500 kg/m³', '1000 kg/m³', '13600 kg/m³'],
            correctAnswer: 2,
            explanation: 'The density of pure water reaches its maximum at 4°C, which is 1000 kg/m³ (or 1 g/cm³).',
          },
        ],
      },
      {
        id: 'gs-1-7-l2',
        lessonNumber: '1.2',
        term: 'Term 1',
        title: 'Motion: Velocity and Acceleration',
        description: 'Uniform and non-uniform motion, distance vs displacement, speed and acceleration formulas.',
        status: 'Available',
        keyConcepts: ['Displacement (Vector)', 'Velocity = Displacement / Time', 'Acceleration = (v - u) / t', 'Velocity-Time Graphs'],
        studyNotes: [
          'Distance is a scalar quantity (total path length), while displacement is a vector (shortest straight line between start and end).',
          'Acceleration is the rate of change of velocity: a = (v - u) / t (unit: m/s²). Negative acceleration is deceleration/retardation.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-7-2',
            question: 'A car accelerates uniformly from rest to 20 m/s in 5 seconds. What is its acceleration?',
            options: ['2 m/s²', '4 m/s²', '5 m/s²', '10 m/s²'],
            correctAnswer: 1,
            explanation: 'Acceleration a = (v - u) / t = (20 - 0) / 5 = 4 m/s².',
          },
        ],
      },
      {
        id: 'gs-1-7-l3',
        lessonNumber: '1.3',
        term: 'Term 1',
        title: 'Matter in Our Surroundings & Atomic Structure',
        description: 'Molecules, atoms, chemical symbols, formula writing and valency.',
        status: 'Available',
        keyConcepts: ['Berzelius Chemical Symbols', 'Atomicity of Elements', 'Valency of Common Ions', 'Chemical Formulas'],
        studyNotes: [
          'J.J. Berzelius introduced the modern system of using alphabetical letters for chemical symbols of elements.',
          'Atomicity refers to the number of atoms present in one molecule (e.g. O2 is diatomic, O3 is triatomic, P4 is tetratomic).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-7-3',
            question: 'What is the atomicity of an Ozone molecule (O3)?',
            options: ['Monatomic', 'Diatomic', 'Triatomic', 'Polyatomic (octatomic)'],
            correctAnswer: 2,
            explanation: 'Ozone (O3) contains 3 oxygen atoms per molecule, making it triatomic.',
          },
        ],
      },
      {
        id: 'gs-1-7-l4',
        lessonNumber: '1.4',
        term: 'Term 1',
        title: 'Reproduction and Modification in Plants',
        description: 'Vegetative propagation, pollination types (self & cross), fertilization, root/stem modifications.',
        status: 'Available',
        keyConcepts: ['Anemophily & Entomophily', 'Double Fertilization', 'Root Modifications (Carrot, Radish)', 'Stem Modifications (Ginger, Potato)'],
        studyNotes: [
          'Pollination can be self-pollination (autogamy) or cross-pollination (allogamy) facilitated by wind, water, insects, or birds.',
          'Vegetative storage modifications include taproot storage (carrot, beetroot) and underground stems (rhizome in ginger, tuber in potato).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-7-4',
            question: 'Potato is an example of which type of plant modification?',
            options: ['Modified taproot', 'Underground stem tuber', 'Fibrous root', 'Modified petiole'],
            correctAnswer: 1,
            explanation: 'Potato is an underground stem modification (tuber) possessing nodes and buds (eyes) for vegetative propagation.',
          },
        ],
      },
      {
        id: 'gs-1-7-l5',
        lessonNumber: '1.5',
        term: 'Term 1',
        title: 'Health and Hygiene',
        description: 'Personal hygiene, oral health, communicable diseases, bacterial and viral pathogens.',
        status: 'Available',
        keyConcepts: ['Bacterial Pathogens', 'Viral Pathogens', 'Water-borne Epidemics', 'Vaccination Schedule'],
        studyNotes: [
          'Tuberculosis and cholera are bacterial diseases; influenza, common cold, polio, and measles are caused by viruses.',
          'Contaminated water spreads typhoid (Salmonella typhi) and cholera (Vibrio cholerae).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-7-5',
            question: 'Typhoid fever is caused by which bacterial pathogen?',
            options: ['Mycobacterium tuberculosis', 'Salmonella typhi', 'Plasmodium vivax', 'Clostridium tetani'],
            correctAnswer: 1,
            explanation: 'Salmonella typhi is the bacterium responsible for typhoid enteric fever.',
          },
        ],
      },
      {
        id: 'gs-1-7-l6',
        lessonNumber: '1.6',
        term: 'Term 2',
        title: 'Heat Transfer: Conduction, Convection & Radiation',
        description: 'Thermal equilibrium, sea breeze and land breeze, practical uses of heat transfer.',
        status: 'Available',
        keyConcepts: ['Conduction in Solids', 'Convection in Fluids', 'Radiation (No Medium Required)', 'Land & Sea Breeze Mechanisms'],
        studyNotes: [
          'Conduction is heat transfer through solids via particle vibration without actual particle displacement.',
          'Convection occurs in liquids and gases through actual fluid circulation, causing coastal land and sea breezes.',
          'Radiation transfers heat through electromagnetic waves without any material medium (e.g. solar energy reaching Earth).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-7-6',
            question: 'By which mode of heat transfer does solar energy travel across the vacuum of space to reach the Earth?',
            options: ['Conduction', 'Convection', 'Radiation', 'Advection'],
            correctAnswer: 2,
            explanation: 'Radiation does not require any material medium, allowing solar electromagnetic thermal waves to traverse space.',
          },
        ],
      },
      {
        id: 'gs-1-7-l7',
        lessonNumber: '1.7',
        term: 'Term 2',
        title: 'Electricity: Circuit Symbols and Heating Effects',
        description: 'Electric current, potential difference, fuse wire and heating appliances.',
        status: 'Available',
        keyConcepts: ['Current (Amperes)', 'Potential Difference (Volts)', 'Joule Heating (H = I²Rt)', 'Electric Fuse Alloys'],
        studyNotes: [
          'Electric current is the rate of flow of electric charges: I = Q / t (measured in Amperes with an Ammeter in series).',
          'Fuse wire is made of a lead-tin alloy having a low melting point to melt and protect circuits during overcurrent.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-7-7',
            question: 'An electric fuse wire is made of an alloy characterized by:',
            options: ['High melting point and high resistance', 'Low melting point and high resistance', 'Low resistance and high melting point', 'Zero resistance'],
            correctAnswer: 1,
            explanation: 'A fuse wire has a low melting point so that Joule heating rapidly melts it to break unsafe electric circuits.',
          },
        ],
      },
      {
        id: 'gs-1-7-l8',
        lessonNumber: '1.8',
        term: 'Term 2',
        title: 'Changes Around Us: Periodic & Chemical Reactions',
        description: 'Exothermic and endothermic changes, rusting of iron, crystallization.',
        status: 'Available',
        keyConcepts: ['Rusting Formula (Fe2O3·xH2O)', 'Galvanization (Zinc Coating)', 'Crystallization of Copper Sulphate', 'Exothermic vs Endothermic'],
        studyNotes: [
          'Rusting requires both oxygen and moisture: 4Fe + 3O2 + 2xH2O → 2Fe2O3·xH2O (hydrated ferric oxide).',
          'Galvanization deposits a protective thin layer of zinc over iron to prevent atmospheric rusting.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-7-8',
            question: 'Galvanization is the metallurgical process of coating iron sheets with a thin layer of:',
            options: ['Copper', 'Zinc', 'Tin', 'Chromium'],
            correctAnswer: 1,
            explanation: 'Galvanization coats iron with sacrificial zinc, which oxidizes preferentiaily to protect the iron underneath.',
          },
        ],
      },
      {
        id: 'gs-1-7-l9',
        lessonNumber: '1.9',
        term: 'Term 2',
        title: 'Cell Biology: Ultrastructure of Plant & Animal Cells',
        description: 'Nucleus, mitochondria, chloroplast, endoplasmic reticulum, vacuole.',
        status: 'Available',
        keyConcepts: ['Mitochondria (Powerhouse of Cell)', 'Chloroplast & Thylakoids', 'Cell Wall (Cellulose in Plants)', 'Ribosomes (Protein Synthesis)'],
        studyNotes: [
          'Mitochondria produce cellular ATP through oxidative phosphorylation, earning the title "powerhouse of the cell".',
          'Plant cells possess a rigid cellulose cell wall and large central vacuole, which are absent in animal cells.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-7-9',
            question: 'Which cell organelle is universally designated as the "Powerhouse of the Cell"?',
            options: ['Golgi apparatus', 'Ribosome', 'Mitochondria', 'Lysosome'],
            correctAnswer: 2,
            explanation: 'Mitochondria synthesize adenosine triphosphate (ATP), the primary energy currency of biological cells.',
          },
        ],
      },
      {
        id: 'gs-1-7-l10',
        lessonNumber: '1.10',
        term: 'Term 3',
        title: 'Light: Spherical Mirrors, Dispersion & Spectrum',
        description: 'Laws of reflection, plane mirrors, concave & convex mirrors, Newton disc.',
        status: 'Available',
        keyConcepts: ['Angle of Incidence = Angle of Reflection', 'Concave Mirror (Converging)', 'Convex Mirror (Rear-view)', 'Dispersion via Glass Prism'],
        studyNotes: [
          'Law of reflection states angle of incidence equals angle of reflection (∠i = ∠r).',
          'Convex mirrors always produce erect, diminished, virtual images with a wide field of view, making them ideal vehicle rear-view mirrors.',
          'White light splits into seven spectral colors (VIBGYOR) through a prism via dispersion.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-7-10',
            question: 'Why are convex mirrors preferred as side rear-view mirrors in motor vehicles?',
            options: ['They produce inverted real images', 'They produce upright, diminished images with a broad field of view', 'They magnify distant objects', 'They absorb glare completely'],
            correctAnswer: 1,
            explanation: 'Convex mirrors produce virtual, erect, diminished images and provide a wide field of view for drivers.',
          },
        ],
      },
      {
        id: 'gs-1-7-l11',
        lessonNumber: '1.11',
        term: 'Term 3',
        title: 'Universe and Space: Solar System & Satellites',
        description: 'Planetary characteristics, Kepler laws overview, artificial satellites.',
        status: 'Available',
        keyConcepts: ['Inner vs Outer Planets', 'Light Year (9.46 x 10^12 km)', 'Geostationary vs Polar Orbit', 'ISRO Satellite Applications'],
        studyNotes: [
          'Inner terrestrial rocky planets are Mercury, Venus, Earth, Mars; outer Jovian gas giants are Jupiter, Saturn, Uranus, Neptune.',
          'A light year is the distance light travels in vacuum in one Julian year: 9.46 × 10^12 km.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-7-11',
            question: 'One light year is defined as the distance traversed by light in vacuum in one year, approximately equal to:',
            options: ['1.496 × 10^8 km', '9.46 × 10^12 km', '3.84 × 10^5 km', '3 × 10^8 km'],
            correctAnswer: 1,
            explanation: 'One light year = 3 × 10^8 m/s × 365.25 × 24 × 3600 s ≈ 9.46 × 10^12 km.',
          },
        ],
      },
      {
        id: 'gs-1-7-l12',
        lessonNumber: '1.12',
        term: 'Term 3',
        title: 'Polymer Chemistry & Daily Life Chemistry',
        description: 'Natural and synthetic fibers, plastics, resin identification codes, medicines.',
        status: 'Available',
        keyConcepts: ['Monomers & Polymers', 'Thermoplastics vs Thermosetting', 'Resin Identification Codes (1 to 7)', 'Antipyretics & Analgesics'],
        studyNotes: [
          'Thermoplastics (PVC, polyethylene) can be repeatedly softened by heating; thermosetting plastics (Bakelite, melamine) set irreversibly upon moulding.',
          'Resin code 1 indicates PET (Polyethylene Terephthalate) widely used in water and beverage bottles.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-7-12',
            question: 'Which of the following is an example of a thermosetting polymer plastic?',
            options: ['Polyethylene', 'Polyvinyl Chloride (PVC)', 'Bakelite', 'Polystyrene'],
            correctAnswer: 2,
            explanation: 'Bakelite forms cross-linked network polymers that do not soften upon reheating, making it a thermosetting plastic.',
          },
        ],
      },
    ],
  },

  // 8th Standard - Unit 1
  'general-studies-1-8': {
    subjectId: 'general-studies',
    unitId: 1,
    classId: 8,
    subjectTitle: 'General Studies',
    unitTitle: 'General Science',
    unitNumber: 'Unit 1',
    classTitle: '8th Standard',
    standardNumber: 8,
    subjectName: 'Science (Samacheer Kalvi)',
    topics: [
      'Measurement: Base Units & Astronomical Units',
      'Force and Pressure: Pascal Law, Atmospheric Pressure',
      'Light: Spherical Mirrors, Refraction, Optical Instruments',
      'Sound: Frequency, Amplitude, Human Ear Mechanism',
      'Acids, Bases, and Salts in Everyday Life',
      'Microorganisms: Bacteria, Fungi, Viruses, Antibiotics, Vaccines',
      'Crop Production, Plant Kingdom, Human Endocrine System',
    ],
    lessons: [
      {
        id: 'gs-1-8-l1',
        lessonNumber: '1.1',
        term: 'Term 1',
        title: 'Measurement: Base Units & Astronomical Units',
        description: 'SI base quantities, luminous intensity, plane angle, solid angle and precision.',
        status: 'Available',
        keyConcepts: ['7 SI Base Units', 'Radian & Steradian', 'Astronomical Unit (1.496 x 10^11 m)', 'Parsec (3.26 Light Years)'],
        studyNotes: [
          'Supplementary physical quantities: Plane angle is measured in radians (rad); Solid angle is measured in steradians (sr).',
          'Astronomical Unit (AU) is 1.496 × 10^11 m; Parsec (parallactic second) is 3.08 × 10^16 m (approx. 3.26 light years).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-1',
            question: 'What is the SI unit of solid angle?',
            options: ['Radian', 'Steradian', 'Degree', 'Gradian'],
            correctAnswer: 1,
            explanation: 'Steradian (sr) is the standard SI derived unit of solid angle.',
          },
        ],
      },
      {
        id: 'gs-1-8-l2',
        lessonNumber: '1.2',
        term: 'Term 1',
        title: 'Force and Pressure in Fluids',
        description: 'Pascal law, hydraulic lift, atmospheric pressure, barometer and friction types.',
        status: 'Available',
        keyConcepts: ['Pressure = Force / Area', 'Pascal Principle', 'Torricelli Mercury Barometer', 'Friction: Static vs Kinetic'],
        studyNotes: [
          'Pascal Law states that pressure applied to an enclosed liquid is transmitted equally in all directions throughout the liquid.',
          'Hydraulic brakes and hydraulic lifts operate on Pascal Law.',
          'Standard atmospheric pressure at sea level supports 760 mm (76 cm) of mercury column (1 atm = 101.3 kPa).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-2',
            question: 'Hydraulic brakes in automobiles operate on which fundamental physical principle?',
            options: ['Archimedes Principle', 'Bernoulli Principle', 'Pascal Law', 'Hooke Law'],
            correctAnswer: 2,
            explanation: 'Pascal Law of fluid pressure transmission is the fundamental working principle behind hydraulic brakes and lifts.',
          },
        ],
      },
      {
        id: 'gs-1-8-l3',
        lessonNumber: '1.3',
        term: 'Term 1',
        title: 'Light: Spherical Mirrors and Refraction',
        description: 'Concave and convex mirrors, ray diagrams, mirror formula and total internal reflection.',
        status: 'Available',
        keyConcepts: ['Mirror Formula: 1/f = 1/v + 1/u', 'Radius of Curvature R = 2f', 'Dentist Head Mirror (Concave)', 'Optical Fibers (TIR)'],
        studyNotes: [
          'Concave mirrors converge light and produce magnified virtual images when an object is placed between pole and focus (dentists, shaving mirrors).',
          'Total Internal Reflection occurs when light travels from denser to rarer medium at an angle of incidence greater than the critical angle.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-3',
            question: 'Which type of mirror is used by dental surgeons to examine magnified images of teeth?',
            options: ['Plane mirror', 'Convex mirror', 'Concave mirror', 'Cylindrical mirror'],
            correctAnswer: 2,
            explanation: 'A concave mirror forms an erect, magnified virtual image when the object is within its focal length.',
          },
        ],
      },
      {
        id: 'gs-1-8-l4',
        lessonNumber: '1.4',
        term: 'Term 1',
        title: 'Matter Around Us: Elements & Compounds',
        description: 'Metals, non-metals, metalloids, symbols, chemical formulas and atomicity.',
        status: 'Available',
        keyConcepts: ['Malleability & Ductility', 'Metalloids (Silicon, Germanium)', 'Liquid Metal (Mercury)', 'Liquid Non-metal (Bromine)'],
        studyNotes: [
          'Mercury (Hg) is the only metal that is liquid at room temperature; Bromine (Br) is the only liquid non-metal.',
          'Metalloids like Silicon (Si) and Germanium (Ge) exhibit properties intermediate between metals and non-metals, serving as key semiconductors.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-4',
            question: 'Which of the following elements is a non-metal that exists as a reddish-brown liquid at room temperature?',
            options: ['Mercury', 'Bromine', 'Gallium', 'Iodine'],
            correctAnswer: 1,
            explanation: 'Bromine is the only halogen non-metal that remains in liquid state at normal room temperature.',
          },
        ],
      },
      {
        id: 'gs-1-8-l5',
        lessonNumber: '1.5',
        term: 'Term 1',
        title: 'Changes Around Us: Chemical & Physical',
        description: 'Rusting, combustion, crystallization, exothermic and endothermic reactions.',
        status: 'Available',
        keyConcepts: ['Conditions for Combustion', 'Ignition Temperature', 'Fire Extinguishers (CO2 & Halon)', 'Calorific Value'],
        studyNotes: [
          'Combustion requires three essentials: combustible fuel, oxygen (supporter of combustion), and reaching ignition temperature.',
          'Hydrogen gas possesses the highest calorific value (approx. 150,000 kJ/kg).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-5',
            question: 'Which fuel has the highest calorific value among the following?',
            options: ['Methane', 'Petrol', 'LPG', 'Hydrogen'],
            correctAnswer: 3,
            explanation: 'Hydrogen possesses the highest calorific value of approximately 150,000 kJ/kg.',
          },
        ],
      },
      {
        id: 'gs-1-8-l6',
        lessonNumber: '1.6',
        term: 'Term 1',
        title: 'Microorganisms: Friendly and Harmful Microbes',
        description: 'Fermentation, pasteurization, pathogens, vaccines, antibiotics and food preservation.',
        status: 'Available',
        keyConcepts: ['Alexander Fleming (Penicillin 1928)', 'Louis Pasteur (Pasteurization)', 'Edward Jenner (Smallpox Vaccine)', 'Rhizobium Nitrogen Fixation'],
        studyNotes: [
          'Alexander Fleming discovered Penicillin from Penicillium notatum fungus in 1928, marking the dawn of antibiotics.',
          'Louis Pasteur developed pasteurization (heating milk to 72°C for 15 seconds followed by rapid chilling) and the rabies vaccine.',
          'Edward Jenner developed the smallpox vaccine in 1796, founding modern immunology.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-6',
            question: 'Who discovered the world’s first antibiotic drug, Penicillin, in 1928?',
            options: ['Louis Pasteur', 'Alexander Fleming', 'Robert Koch', 'Edward Jenner'],
            correctAnswer: 1,
            explanation: 'Sir Alexander Fleming discovered Penicillin from the mould Penicillium notatum in 1928.',
          },
        ],
      },
      {
        id: 'gs-1-8-l7',
        lessonNumber: '1.7',
        term: 'Term 1',
        title: 'Plant Kingdom & Organisation of Life',
        description: 'Cryptogams vs Phanerogams, cellular hierarchy, tissues and organ systems.',
        status: 'Available',
        keyConcepts: ['Algae, Bryophytes, Pteridophytes', 'Gymnosperms vs Angiosperms', 'Xylem (Water) & Phloem (Food)', 'Cellular Differentiation'],
        studyNotes: [
          'Bryophytes are amphibians of the plant kingdom requiring water for fertilization.',
          'Pteridophytes are the first vascular cryptogams possessing xylem and phloem.',
          'Gymnosperms bear naked seeds; Angiosperms produce enclosed seeds within fruits.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-7',
            question: 'Which group of plants is widely referred to as the "Amphibians of the Plant Kingdom"?',
            options: ['Thallophytes (Algae)', 'Bryophytes', 'Pteridophytes', 'Gymnosperms'],
            correctAnswer: 1,
            explanation: 'Bryophytes grow in terrestrial soil but depend on water film for flagellated male gamete fertilization.',
          },
        ],
      },
      {
        id: 'gs-1-8-l8',
        lessonNumber: '1.8',
        term: 'Term 2',
        title: 'Heat: Calorimetry & Change of State',
        description: 'Specific heat capacity, thermal expansion, thermal conductors and insulators.',
        status: 'Available',
        keyConcepts: ['Specific Heat of Water (4184 J/kg·K)', 'Latent Heat of Fusion', 'Anomalous Expansion of Water', 'Calorimeter Design'],
        studyNotes: [
          'Water has an exceptionally high specific heat capacity (4184 J/kg·K), making it an outstanding coolant in car radiators and thermal stabilizer for climate.',
          'Anomalous expansion: Water contracts from 0°C to 4°C and expands when cooled below 4°C, preserving aquatic life beneath frozen lakes.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-8',
            question: 'At what temperature does water achieve its maximum density?',
            options: ['0°C', '4°C', '100°C', '-4°C'],
            correctAnswer: 1,
            explanation: 'Water exhibits anomalous expansion and attains maximum density (1000 kg/m³) at 4°C.',
          },
        ],
      },
      {
        id: 'gs-1-8-l9',
        lessonNumber: '1.9',
        term: 'Term 2',
        title: 'Electricity: Static Electricity & Chemical Effects',
        description: 'Electroscope, electric field, electrolysis, electroplating and lightning safety.',
        status: 'Available',
        keyConcepts: ['Faraday Laws of Electrolysis', 'Electroplating Cathode & Anode', 'Gold Leaf Electroscope', 'Lightning Conductor'],
        studyNotes: [
          'In electroplating, the metal article to be coated is connected to the cathode (-), while pure coating metal serves as anode (+).',
          'Benjamin Franklin demonstrated lightning is electric discharge and invented the lightning conductor.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-9',
            question: 'In an electroplating electrolytic setup, the object to be coated is connected to which electrode?',
            options: ['Anode (Positive)', 'Cathode (Negative)', 'Neutral Ground', 'Alternating Source'],
            correctAnswer: 1,
            explanation: 'Metal cations in the electrolyte migrate toward and deposit onto the negative electrode (cathode).',
          },
        ],
      },
      {
        id: 'gs-1-8-l10',
        lessonNumber: '1.10',
        term: 'Term 2',
        title: 'Air & Applied Chemistry: Petroleum and Fertilizers',
        description: 'Greenhouse gases, acid rain, fractional distillation of crude oil, NPK fertilizers.',
        status: 'Available',
        keyConcepts: ['Fractional Distillation of Petroleum', 'LPG (Propane & Butane)', 'CNG (Compressed Methane)', 'NPK Macronutrients'],
        studyNotes: [
          'Liquefied Petroleum Gas (LPG) consists primarily of butane and propane, odorized with ethyl mercaptan for leak detection.',
          'Compressed Natural Gas (CNG) is predominantly methane (CH4) emitting significantly less particulate matter.',
          'NPK fertilizers supply Nitrogen (vegetative growth), Phosphorus (root development), and Potassium (disease resistance).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-10',
            question: 'Which chemical compound is added to commercial LPG cylinders to emit a strong odor for leak detection?',
            options: ['Methyl isocyanate', 'Ethyl mercaptan', 'Carbon monoxide', 'Sulphur dioxide'],
            correctAnswer: 1,
            explanation: 'Ethyl mercaptan (ethanethiol) has a distinct pungent smell added to odorless LPG so leaks are detected immediately.',
          },
        ],
      },
      {
        id: 'gs-1-8-l11',
        lessonNumber: '1.11',
        term: 'Term 2',
        title: 'Atomic Structure & Chemical Bonding',
        description: 'Subatomic particles, Thomson and Rutherford atomic models, valency and ions.',
        status: 'Available',
        keyConcepts: ['J.J. Thomson (Electron 1897)', 'Goldstein / Rutherford (Proton)', 'James Chadwick (Neutron 1932)', 'Isotopes vs Isobars'],
        studyNotes: [
          'James Chadwick discovered the neutral neutron in 1932 via alpha bombardment of beryllium.',
          'Isotopes have identical atomic numbers (Z) but differing mass numbers (A) (e.g. 1H, 2H, 3H); Isobars have identical mass numbers (e.g. 40Ar, 40Ca).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-11',
            question: 'Who discovered the subatomic particle "Neutron" in 1932?',
            options: ['J.J. Thomson', 'Ernest Rutherford', 'James Chadwick', 'Niels Bohr'],
            correctAnswer: 2,
            explanation: 'Sir James Chadwick discovered the neutron in 1932, earning the Nobel Prize in Physics in 1935.',
          },
        ],
      },
      {
        id: 'gs-1-8-l12',
        lessonNumber: '1.12',
        term: 'Term 2',
        title: 'Movements in Animals & Endocrine System',
        description: 'Human skeleton, joints, endocrine glands, hormones and adolescent physiology.',
        status: 'Available',
        keyConcepts: ['Pituitary (Master Gland)', 'Thyroxine (Iodine Metabolism)', 'Insulin & Glucagon (Pancreas)', 'Synovial Joints'],
        studyNotes: [
          'The pituitary gland at the base of the brain is the master endocrine gland coordinating other hormonal secretions.',
          'Thyroid gland requires dietary iodine to synthesize thyroxine; deficiency leads to Simple Goitre.',
          'Islets of Langerhans in pancreas secrete insulin (beta cells) and glucagon (alpha cells) regulating blood glucose.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-12',
            question: 'Deficiency of dietary iodine in humans causes which endocrine medical condition?',
            options: ['Diabetes insipidus', 'Simple Goitre', 'Cushing syndrome', 'Addison disease'],
            correctAnswer: 1,
            explanation: 'Iodine deficiency causes enlargement of the thyroid gland in the neck, medically known as Simple Goitre.',
          },
        ],
      },
      {
        id: 'gs-1-8-l13',
        lessonNumber: '1.13',
        term: 'Term 3',
        title: 'Sound: Wave Propagation, Pitch & Human Ear',
        description: 'Frequency, amplitude, audible and inaudible sound, noise pollution and control.',
        status: 'Available',
        keyConcepts: ['Audible Range (20 Hz to 20,000 Hz)', 'Infrasonic (<20 Hz)', 'Ultrasonic (>20 kHz)', 'Decibel (dB) Sound Level Scale'],
        studyNotes: [
          'Human audible sound frequency ranges from 20 Hz to 20,000 Hz (20 kHz).',
          'Infrasonic sound (< 20 Hz) is produced by earthquakes, elephants, and whales; Ultrasonic sound (> 20 kHz) is utilized by bats and dolphins for echolocation.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-13',
            question: 'What is the audible hearing frequency range for a healthy human ear?',
            options: ['10 Hz to 10,000 Hz', '20 Hz to 20,000 Hz', '50 Hz to 50,000 Hz', '100 Hz to 100,000 Hz'],
            correctAnswer: 1,
            explanation: 'The standard audible sound frequency spectrum for humans is 20 Hz to 20,000 Hz (20 kHz).',
          },
        ],
      },
      {
        id: 'gs-1-8-l14',
        lessonNumber: '1.14',
        term: 'Term 3',
        title: 'Magnetism: Magnetic Field & Earth Magnetism',
        description: 'Magnetic flux, hysteresis, magnetic behavior of materials and applications.',
        status: 'Available',
        keyConcepts: ['Ferromagnetic (Iron, Cobalt, Nickel)', 'Paramagnetic & Diamagnetic', 'Magnetic Declination', 'Curie Temperature'],
        studyNotes: [
          'Ferromagnetic materials (iron, nickel, cobalt) are strongly attracted by magnets and retain magnetization.',
          'At Curie temperature, ferromagnetic materials lose their permanent magnetism and become paramagnetic.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-14',
            question: 'What happens to a ferromagnetic material when it is heated above its Curie Temperature?',
            options: ['It becomes diamagnetic', 'It transforms into a paramagnetic material', 'Its magnetism increases', 'It becomes a superconductor'],
            correctAnswer: 1,
            explanation: 'Above the Curie temperature, thermal agitation overcomes magnetic dipole alignment, converting the material to paramagnetic.',
          },
        ],
      },
      {
        id: 'gs-1-8-l15',
        lessonNumber: '1.15',
        term: 'Term 3',
        title: 'Universe and Space Science: Rockets & ISRO Missions',
        description: 'Rockets, propulsion systems, PSLV, GSLV, Chandrayaan, Mangalyaan and astronomy.',
        status: 'Available',
        keyConcepts: ['Newton Third Law in Propulsion', 'Cryogenic Engines (Liquid H2 & O2)', 'Chandrayaan-1, 2, 3', 'Mangalyaan (Mars Orbiter Mission)'],
        studyNotes: [
          'Rocket propulsion illustrates Newton’s Third Law of Motion and Conservation of Linear Momentum.',
          'Chandrayaan-1 (2008) confirmed water molecules (H2O/OH) on the Moon; Chandrayaan-3 achieved soft-landing near the lunar South Pole on August 23, 2023 (National Space Day).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-15',
            question: 'India celebrates National Space Day every year on which date to commemorate the Chandrayaan-3 lunar landing?',
            options: ['July 14', 'August 15', 'August 23', 'October 22'],
            correctAnswer: 2,
            explanation: 'August 23 was designated National Space Day following Chandrayaan-3 historic soft landing on the lunar south polar region in 2023.',
          },
        ],
      },
      {
        id: 'gs-1-8-l16',
        lessonNumber: '1.16',
        term: 'Term 3',
        title: 'Acids, Bases, Indicators and Salts',
        description: 'Arrhenius definition, natural indicators, neutralization and salts in daily life.',
        status: 'Available',
        keyConcepts: ['Litmus (Lichens)', 'Phenolphthalein & Methyl Orange', 'Baking Soda (NaHCO3)', 'Washing Soda (Na2CO3·10H2O)'],
        studyNotes: [
          'Acids turn blue litmus red; bases turn red litmus blue. Phenolphthalein is colorless in acid and pink in alkaline base.',
          'Baking soda is Sodium hydrogen carbonate (NaHCO3); Washing soda is Sodium carbonate decahydrate (Na2CO3·10H2O).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-8-16',
            question: 'What is the color of phenolphthalein indicator in an aqueous basic (alkaline) solution?',
            options: ['Colorless', 'Deep Pink', 'Bright Yellow', 'Blue'],
            correctAnswer: 1,
            explanation: 'Phenolphthalein turns vivid pink in alkaline solutions (pH > 8.3) and remains colorless in acidic solutions.',
          },
        ],
      },
    ],
  },

  // 9th Standard - Unit 1
  'general-studies-1-9': {
    subjectId: 'general-studies',
    unitId: 1,
    classId: 9,
    subjectTitle: 'General Studies',
    unitTitle: 'General Science',
    unitNumber: 'Unit 1',
    classTitle: '9th Standard',
    standardNumber: 9,
    subjectName: 'Science (Samacheer Kalvi)',
    topics: [
      'Measurement: Vernier Caliper, Screw Gauge',
      'Motion: Equations of Motion, Centripetal & Centrifugal Force',
      'Fluids: Archimedes Principle, Laws of Floatation',
      'Electric Charge & Current: Coulomb Law, Resistance',
      'Magnetism & Electromagnetism: Fleming Rules, Electric Motor',
      'Periodic Classification of Elements & Chemical Bonding',
      'Acids, Bases, Salts, pH in Daily Life, Carbon Compounds',
      'Animal Kingdom, Plant Physiology, Organ Systems, World of Microbes',
    ],
    lessons: [
      {
        id: 'gs-1-9-l1',
        lessonNumber: '1.1',
        term: 'Term 1',
        title: 'Measurement: Vernier Caliper & Screw Gauge',
        description: 'Least count, zero error, measuring dimensions of cylindrical and spherical bodies.',
        status: 'Available',
        keyConcepts: ['Vernier Least Count (0.1 mm)', 'Screw Gauge Least Count (0.01 mm)', 'Positive & Negative Zero Errors', 'Pitch of Screw'],
        studyNotes: [
          'Least count of a standard Vernier Caliper is 0.1 mm (0.01 cm); Least count of standard Screw Gauge is 0.01 mm (0.001 cm).',
          'Zero error is corrected by subtracting the observed error algebraically from measured readings.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-1',
            question: 'What is the least count of a standard school laboratory Screw Gauge with 100 circular scale divisions and 1 mm pitch?',
            options: ['0.1 mm', '0.01 mm', '0.001 mm', '1.0 mm'],
            correctAnswer: 1,
            explanation: 'Least Count = Pitch / Number of circular divisions = 1 mm / 100 = 0.01 mm.',
          },
        ],
      },
      {
        id: 'gs-1-9-l2',
        lessonNumber: '1.2',
        term: 'Term 1',
        title: 'Motion: Graphical Equations and Centripetal Force',
        description: 'Equations of motion under gravity, uniform circular motion, centrifugal forces.',
        status: 'Available',
        keyConcepts: ['v = u + at', 's = ut + ½at²', 'v² = u² + 2as', 'Centripetal Acceleration (v²/r)'],
        studyNotes: [
          'Equations of uniformly accelerated motion: v = u + at; s = ut + ½at²; v² = u² + 2as.',
          'Centripetal force (Fc = mv²/r) acts towards the centre of the circular path; centrifugal force is a pseudo inertial force acting outwards.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-2',
            question: 'Which equation correctly represents distance (s) covered under uniform linear acceleration (a)?',
            options: ['s = vt', 's = ut + ½at²', 's = u² + 2as', 's = (v - u) / t'],
            correctAnswer: 1,
            explanation: 'The kinematic displacement formula is s = ut + ½at² where u is initial velocity and t is time.',
          },
        ],
      },
      {
        id: 'gs-1-9-l3',
        lessonNumber: '1.3',
        term: 'Term 1',
        title: 'Fluids: Pressure, Buoyancy and Archimedes Principle',
        description: 'Fluid pressure, Pascal principle, atmospheric pressure, relative density and hydrometer.',
        status: 'Available',
        keyConcepts: ['Fluid Pressure P = hρg', 'Archimedes Principle', 'Laws of Floatation', 'Hydrometer & Lactometer'],
        studyNotes: [
          'Hydrostatic pressure increases with depth: P = hρg (where h is depth, ρ is density, g is acceleration due to gravity).',
          'Archimedes Principle: An immersed body experiences an upward buoyant force equal to the weight of displaced fluid.',
          'Lactometer is a specialized hydrometer used to test the purity and density of milk.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-3',
            question: 'Which instrument based on Archimedes Principle is specifically used to verify the purity and density of milk?',
            options: ['Barometer', 'Hydrometer', 'Lactometer', 'Hygrometer'],
            correctAnswer: 2,
            explanation: 'A lactometer operates on Archimedes principle and floatation to determine milk density and detect water adulteration.',
          },
        ],
      },
      {
        id: 'gs-1-9-l4',
        lessonNumber: '1.4',
        term: 'Term 1',
        title: 'Matter Around Us: Elements, Compounds & Mixtures',
        description: 'Types of mixtures, separation techniques, centrifugation, chromatography and colloid states.',
        status: 'Available',
        keyConcepts: ['Homogeneous vs Heterogeneous', 'Tyndall Effect', 'Brownian Motion', 'Paper Chromatography'],
        studyNotes: [
          'Colloids exhibit Tyndall effect (scattering of light by colloidal particles) and Brownian movement (random zig-zag kinetic motion).',
          'Chromatography separates pigments from dyes and plant extracts based on differential solubility and absorption.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-4',
            question: 'The scattering of a beam of light as it passes through a colloidal solution is known as:',
            options: ['Raman Effect', 'Tyndall Effect', 'Doppler Effect', 'Zeeman Effect'],
            correctAnswer: 1,
            explanation: 'The Tyndall effect is the scattering of light by suspended colloidal particles in a medium.',
          },
        ],
      },
      {
        id: 'gs-1-9-l5',
        lessonNumber: '1.5',
        term: 'Term 1',
        title: 'Atomic Structure: Thomson and Rutherford Models',
        description: 'Discovery of electrons, protons, neutrons, atomic number, mass number and isotopes.',
        status: 'Available',
        keyConcepts: ['Plum Pudding Model', 'Rutherford Alpha Scattering Experiment', 'Discovery of Nucleus', 'Atomic Number (Z) & Mass (A)'],
        studyNotes: [
          'Rutherford alpha particle gold foil scattering experiment showed most of the atom is empty space and discovered the dense positively charged nucleus.',
          'Electrons revolve in discrete orbits outside the nucleus; protons and neutrons reside within as nucleons.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-5',
            question: 'Rutherford’s alpha particle gold foil scattering experiment led directly to the discovery of:',
            options: ['Electron', 'Proton', 'Atomic Nucleus', 'Neutron'],
            correctAnswer: 2,
            explanation: 'Rutherford alpha scattering experiment proved the existence of a central, dense, positively charged atomic nucleus.',
          },
        ],
      },
      {
        id: 'gs-1-9-l6',
        lessonNumber: '1.6',
        term: 'Term 1',
        title: 'Plant Physiology: Tropism and Transpiration',
        description: 'Phototropism, geotropism, transpiration pull, photosynthesis light/dark reactions.',
        status: 'Available',
        keyConcepts: ['Phototropism (Auxin)', 'Geotropism (Roots +)', 'Hydrotropism & Thigmotropism', 'Stomatal Transpiration'],
        studyNotes: [
          'Plant shoot systems exhibit positive phototropism (growing toward light driven by auxin elongation on shaded side).',
          'Roots exhibit positive geotropism (growing downward toward gravity) and positive hydrotropism toward moisture.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-6',
            question: 'Which plant growth hormone is primarily responsible for phototropic curvature of shoot tips toward light?',
            options: ['Gibberellin', 'Auxin', 'Cytokinin', 'Abscisic Acid'],
            correctAnswer: 1,
            explanation: 'Auxins migrate to the shaded side of shoots, causing cell elongation that bends the shoot tip toward the light source.',
          },
        ],
      },
      {
        id: 'gs-1-9-l7',
        lessonNumber: '1.7',
        term: 'Term 1',
        title: 'Organisation of Tissues in Plants and Animals',
        description: 'Meristematic, parenchyma, collenchyma, xylem, phloem and animal epithelial/neural tissues.',
        status: 'Available',
        keyConcepts: ['Apical & Intercalary Meristems', 'Simple Permanent Tissues', 'Xylem Tracheids & Vessels', 'Neurons & Glial Cells'],
        studyNotes: [
          'Xylem consists of tracheids, vessels, xylem parenchyma, and xylem fibers, conducting water and minerals upwards.',
          'Phloem consists of sieve tubes, companion cells, phloem parenchyma, and phloem fibers, translocating organic sucrose bidirectionally.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-7',
            question: 'Which tissue in vascular plants is responsible for transporting manufactured sucrose food from leaves to other organs?',
            options: ['Xylem', 'Phloem', 'Sclerenchyma', 'Collenchyma'],
            correctAnswer: 1,
            explanation: 'Phloem conducts dissolved organic sugars bidirectionally from source (leaves) to sink tissues.',
          },
        ],
      },
      {
        id: 'gs-1-9-l8',
        lessonNumber: '1.8',
        term: 'Term 2',
        title: 'Light: Refraction, Lenses and Total Internal Reflection',
        description: 'Snell law, lens maker formula, optical density, fiber optics applications.',
        status: 'Available',
        keyConcepts: ['Snell Law: n1 sin i = n2 sin r', 'Refractive Index n = c / v', 'Convex Lens (Converging)', 'Optical Fiber Cladding & Core'],
        studyNotes: [
          'Snell Law of refraction: sin(i) / sin(r) = constant = n2 / n1.',
          'Optical fibers consist of a higher refractive index inner glass core surrounded by lower refractive index cladding, guiding signals via TIR.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-8',
            question: 'What is the absolute refractive index of a diamond, giving it exceptional optical brilliance and sparkle?',
            options: ['1.33', '1.52', '2.42', '1.00'],
            correctAnswer: 2,
            explanation: 'Diamond has a very high refractive index of 2.42 and a very small critical angle (approx. 24.4°), ensuring total internal reflection.',
          },
        ],
      },
      {
        id: 'gs-1-9-l9',
        lessonNumber: '1.9',
        term: 'Term 2',
        title: 'Heat: Thermal Capacity & Latent Heat',
        description: 'Conduction, convection, radiation, specific heat, latent heat of fusion and vaporization.',
        status: 'Available',
        keyConcepts: ['Q = mcΔT', 'Latent Heat of Fusion of Ice (3.36 x 10^5 J/kg)', 'Latent Heat of Steam (2.26 x 10^6 J/kg)', 'Thermal Equilibrium'],
        studyNotes: [
          'Latent heat of fusion is thermal energy absorbed during solid-to-liquid transition without temperature change.',
          'Steam causes more severe burns than boiling water at 100°C due to its massive latent heat of vaporization (2260 kJ/kg).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-9',
            question: 'Why do burns caused by steam at 100°C cause more severe tissue damage than boiling water at 100°C?',
            options: ['Steam has higher pressure', 'Steam contains additional latent heat of vaporization', 'Steam is chemically reactive', 'Water cools faster'],
            correctAnswer: 1,
            explanation: 'Steam at 100°C carries extra latent heat of vaporization (approx. 2260 J/g), releasing far more thermal energy upon condensing on skin.',
          },
        ],
      },
      {
        id: 'gs-1-9-l10',
        lessonNumber: '1.10',
        term: 'Term 2',
        title: 'Electric Charge and Electric Current',
        description: 'Coulomb law, electric field, potential difference, Ohm law preview, resistance.',
        status: 'Available',
        keyConcepts: ['Coulomb Law: F = k(q1*q2)/r²', 'Electric Potential V = W / Q', 'Conductors vs Superconductors', 'Ammeter vs Voltmeter Connection'],
        studyNotes: [
          'Coulomb Law: Electrostatic force between two point charges is directly proportional to the product of charges and inversely to distance squared.',
          'An Ammeter has very low resistance and is connected in series; a Voltmeter has high resistance and is connected in parallel.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-10',
            question: 'In an electric circuit, an Ammeter is always connected in ______ and a Voltmeter is connected in ______:',
            options: ['Parallel, Series', 'Series, Parallel', 'Series, Series', 'Parallel, Parallel'],
            correctAnswer: 1,
            explanation: 'Ammeters are connected in series to measure total current; voltmeters are connected in parallel to measure potential difference across components.',
          },
        ],
      },
      {
        id: 'gs-1-9-l11',
        lessonNumber: '1.11',
        term: 'Term 2',
        title: 'Periodic Classification of Elements',
        description: 'Dobereiner, Newlands, Mendeleev periodic table and modern periodic law.',
        status: 'Available',
        keyConcepts: ['Dobereiner Triads', 'Newlands Law of Octaves', 'Mendeleev Periodic Law', 'Moseley Modern Periodic Law (Atomic Number)'],
        studyNotes: [
          'Mendeleev arranged elements in order of increasing atomic mass, leaving gaps for undiscovered elements like Eka-Silicon (Germanium).',
          'Henry Moseley discovered that atomic number (Z), not atomic mass, is the fundamental property governing periodic chemical behavior.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-11',
            question: 'Henry Moseley established that the physical and chemical properties of elements are periodic functions of their:',
            options: ['Atomic mass', 'Atomic number', 'Density', 'Equivalent weight'],
            correctAnswer: 1,
            explanation: 'Moseley’s X-ray spectra experiments established atomic number (Z = nuclear charge) as the true basis for the Modern Periodic Table.',
          },
        ],
      },
      {
        id: 'gs-1-9-l12',
        lessonNumber: '1.12',
        term: 'Term 2',
        title: 'Chemical Bonding: Ionic, Covalent & Coordinate',
        description: 'Octet rule, Lewis dot structure, ionic and covalent compound properties.',
        status: 'Available',
        keyConcepts: ['Octet Rule', 'Electrovalent (Ionic) Bonding', 'Covalent Electron Sharing', 'Coordinate Covalent Bond'],
        studyNotes: [
          'Ionic bonds involve complete transfer of electrons from electropositive metal to electronegative non-metal (e.g. NaCl, MgO).',
          'Covalent bonds form via mutual sharing of electron pairs (e.g. H2, CH4, H2O). Ionic compounds conduct electricity in molten/aqueous states.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-12',
            question: 'Which of the following compounds exhibits pure ionic (electrovalent) bonding?',
            options: ['Methane (CH4)', 'Sodium Chloride (NaCl)', 'Water (H2O)', 'Carbon Dioxide (CO2)'],
            correctAnswer: 1,
            explanation: 'NaCl forms through complete electron transfer from sodium to chlorine, resulting in an electrostatic crystal lattice.',
          },
        ],
      },
      {
        id: 'gs-1-9-l13',
        lessonNumber: '1.13',
        term: 'Term 2',
        title: 'Animal Kingdom: Invertebrates & Vertebrates',
        description: 'Phylum Porifera to Chordata, cold-blooded vs warm-blooded animals.',
        status: 'Available',
        keyConcepts: ['Invertebrate Phyla (Porifera to Echinodermata)', 'Cold-blooded (Poikilotherms)', 'Warm-blooded (Homeotherms)', 'Five Classes of Chordates'],
        studyNotes: [
          'Arthropoda is the largest phylum in the animal kingdom, characterized by jointed appendages and chitinous exoskeletons.',
          'Birds (Aves) and mammals are homeothermic (warm-blooded), maintaining constant body temperature.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-13',
            question: 'Which phylum constitutes the largest group of organisms in the entire animal kingdom?',
            options: ['Mollusca', 'Arthropoda', 'Annelida', 'Nematoda'],
            correctAnswer: 1,
            explanation: 'Phylum Arthropoda comprises more than 80% of all described animal species, dominated by insects.',
          },
        ],
      },
      {
        id: 'gs-1-9-l14',
        lessonNumber: '1.14',
        term: 'Term 3',
        title: 'Sound: Waves, Ultrasound and SONAR',
        description: 'Longitudinal waves, echo, reverberation, ultrasonic waves and diagnostic uses.',
        status: 'Available',
        keyConcepts: ['Echo Formula: 2d = v * t', 'Minimum Distance for Echo (17.2 m)', 'Reverberation & Acoustic Tiles', 'SONAR & Ultrasonography'],
        studyNotes: [
          'For an echo to be heard distinctly, the reflected sound must reach the ear after at least 0.1 s; minimum distance at 20°C is 17.2 m.',
          'SONAR (Sound Navigation and Ranging) utilizes ultrasound waves to measure sea depths and locate submarines.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-14',
            question: 'What is the minimum distance between the sound source and reflecting surface required to hear a distinct echo in air (at 20°C, v = 344 m/s)?',
            options: ['8.6 meters', '17.2 meters', '25.0 meters', '34.4 meters'],
            correctAnswer: 1,
            explanation: 'Minimum distance d = (v × t) / 2 = (344 m/s × 0.1 s) / 2 = 17.2 meters.',
          },
        ],
      },
      {
        id: 'gs-1-9-l15',
        lessonNumber: '1.15',
        term: 'Term 3',
        title: 'Magnetism and Electromagnetism',
        description: 'Oersted experiment, magnetic field around current conductor, Fleming left-hand rule, motors.',
        status: 'Available',
        keyConcepts: ['Right-Hand Thumb Rule', 'Solenoid Magnetic Field', 'Fleming Left-Hand Rule (Electric Motor)', 'Electromagnet Applications'],
        studyNotes: [
          'Hans Christian Oersted proved electric current produces a surrounding magnetic field in 1820.',
          'Fleming’s Left-Hand Rule predicts the direction of force in electric motors: Thumb = Force/Motion, Forefinger = Magnetic Field, Centre finger = Current.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-15',
            question: 'According to Fleming’s Left-Hand Rule for electric motors, what does the Thumb represent?',
            options: ['Magnetic field direction', 'Electric current direction', 'Direction of force / motion of conductor', 'Induced voltage'],
            correctAnswer: 2,
            explanation: 'In Fleming Left-Hand Rule: Thumb = Motion/Force, Forefinger = Field, Middle finger = Current.',
          },
        ],
      },
      {
        id: 'gs-1-9-l16',
        lessonNumber: '1.16',
        term: 'Term 3',
        title: 'Acids, Bases, and Salts: Chemical Behavior',
        description: 'Chemical reactions of acids/bases, indicator colors, preparation of common salts.',
        status: 'Available',
        keyConcepts: ['Acid + Metal → Salt + H2 Gas', 'Acid + Base → Salt + Water', 'Plaster of Paris (CaSO4·½H2O)', 'Bleaching Powder (CaOCl2)'],
        studyNotes: [
          'Acids react with active metals to liberate hydrogen gas, confirmed by the characteristic popping sound.',
          'Bleaching powder (CaOCl2) is prepared by passing chlorine gas over dry slaked lime [Ca(OH)2].',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-16',
            question: 'What is the chemical formula of Plaster of Paris (POP)?',
            options: ['CaSO4·2H2O', 'CaSO4·½H2O', 'CaCO3', 'CaOCl2'],
            correctAnswer: 1,
            explanation: 'Plaster of Paris is calcium sulphate hemihydrate, represented by CaSO4·½H2O.',
          },
        ],
      },
      {
        id: 'gs-1-9-l17',
        lessonNumber: '1.17',
        term: 'Term 3',
        title: 'Applied Chemistry: Nanotechnology & Pharmaceuticals',
        description: 'Nanomaterials, drug discovery, dyes, pesticides and organic farming chemicals.',
        status: 'Available',
        keyConcepts: ['Nanoscale (1 to 100 nm)', 'Surface Area to Volume Ratio', 'Antipyretics (Paracetamol)', 'Bio-pesticides (Neem Extracts)'],
        studyNotes: [
          'Nanomaterials operate in the 1–100 nanometre range where quantum confinement and ultra-high surface area give rise to novel catalytic properties.',
          'Antipyretics lower elevated body fever temperature (e.g. Paracetamol); analgesics relieve pain.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-17',
            question: 'Nanomaterials are defined as materials having at least one dimension within the scale of:',
            options: ['1 to 100 micrometers', '1 to 100 nanometers', '1 to 100 picometers', '1 to 10 millimeters'],
            correctAnswer: 1,
            explanation: 'Nanotechnology strictly concerns structures engineered at the scale of 1 to 100 nanometers (1 nm = 10^-9 m).',
          },
        ],
      },
      {
        id: 'gs-1-9-l18',
        lessonNumber: '1.18',
        term: 'Term 3',
        title: 'Nutrition, Health and World of Microbes',
        description: 'Vitamins, minerals, food adulteration tests, microbial pathogens and epidemiology.',
        status: 'Available',
        keyConcepts: ['Water-soluble (B & C) vs Fat-soluble (A, D, E, K)', 'Iron Deficiency (Anemia)', 'Iodine (Goitre)', 'Adulteration (Metanil Yellow in Turmeric)'],
        studyNotes: [
          'Vitamins B complex and C are water-soluble; Vitamins A, D, E, and K are fat-soluble.',
          'Iron deficiency leads to Microcytic Anemia; Vitamin D deficiency leads to Rickets in children and Osteomalacia in adults.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-18',
            question: 'Which of the following vitamins is water-soluble?',
            options: ['Vitamin A', 'Vitamin D', 'Vitamin C', 'Vitamin K'],
            correctAnswer: 2,
            explanation: 'Vitamins B and C are water-soluble, whereas vitamins A, D, E, and K are fat-soluble.',
          },
        ],
      },
      {
        id: 'gs-1-9-l19',
        lessonNumber: '1.19',
        term: 'Term 3',
        title: 'Environmental Science: Biogeochemical Cycles & Pollution',
        description: 'Nitrogen cycle, carbon cycle, water cycle, solid waste management and biodiversity.',
        status: 'Available',
        keyConcepts: ['Nitrogen Fixation (Rhizobium & Azotobacter)', 'Nitrification (Nitrosomonas & Nitrobacter)', 'Denitrification (Pseudomonas)', 'Eutrophication'],
        studyNotes: [
          'Nitrogen fixation converts atmospheric N2 into ammonia; nitrification oxidizes ammonia to nitrites and nitrates; denitrification converts nitrates back to N2.',
          'Eutrophication is nutrient enrichment (nitrates/phosphates) of water bodies leading to algal blooms and aquatic oxygen depletion.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-9-19',
            question: 'Which bacterium is primarily involved in the denitrification step of the nitrogen cycle, returning nitrogen gas to the atmosphere?',
            options: ['Rhizobium', 'Nitrosomonas', 'Pseudomonas', 'Azotobacter'],
            correctAnswer: 2,
            explanation: 'Pseudomonas denitrificans breaks down nitrates in waterlogged soil into elemental atmospheric nitrogen gas.',
          },
        ],
      },
    ],
  },

  // 10th Standard - Unit 1
  'general-studies-1-10': {
    subjectId: 'general-studies',
    unitId: 1,
    classId: 10,
    subjectTitle: 'General Studies',
    unitTitle: 'General Science',
    unitNumber: 'Unit 1',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'Science (SSLC Text)',
    topics: [
      'Laws of Motion: Newton Three Laws, Linear Momentum, Rocket Propulsion',
      'Optics: Lens Formula, Human Eye, Defects of Vision, Telescopes',
      'Thermal Physics: Gas Laws (Boyle, Charles, Avogadro), Ideal Gas Equation',
      'Electricity & Joule Heating: Ohm Law, Resistance, Power',
      'Acoustics: Echo, Doppler Effect, Speed of Sound',
      'Nuclear Physics: Radioactivity, Alpha/Beta/Gamma, Fission, Fusion',
      'Periodic Classification, Solutions, Chemical Reactions, Carbon Compounds',
      'Plant Physiology, Endocrine System, Heredity, Evolution & Biotechnology',
    ],
    lessons: [
      {
        id: 'gs-1-10-l1',
        lessonNumber: '1.1',
        title: 'Laws of Motion and Universal Gravitation',
        description: 'Newton laws of motion, momentum, impulse, law of conservation of momentum, and universal gravitation.',
        status: 'Available',
        keyConcepts: ['Newton Laws of Motion', 'Conservation of Momentum', 'Rocket Propulsion', 'Universal Law of Gravitation (G = 6.674 x 10^-11)'],
        studyNotes: [
          'Newton’s First Law defines inertia; Second Law provides F = ma (rate of change of momentum); Third Law guarantees action and reaction are equal and opposite.',
          'Rocket propulsion illustrates both Newton’s third law and the law of conservation of linear momentum.',
          'Universal Gravitation: F = G(m1·m2)/r² where G = 6.674 × 10^-11 N·m²/kg².',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-1',
            question: 'The recoil of a gun after firing a bullet illustrates which fundamental physical law?',
            options: ['Newton\'s First Law', 'Law of Conservation of Linear Momentum', 'Boyle\'s Law', 'Coulomb\'s Law'],
            correctAnswer: 1,
            explanation: 'Gun recoil is a direct application of Newton\'s Third Law and the Law of Conservation of Linear Momentum.',
          },
        ],
      },
      {
        id: 'gs-1-10-l2',
        lessonNumber: '1.2',
        title: 'Optics: Lenses, Human Eye and Optical Defects',
        description: 'Convex and concave lenses, lens maker formula, refractive index, power of lenses, and vision defects.',
        status: 'Available',
        keyConcepts: ['Lens Formula: 1/f = 1/v - 1/u', 'Power of Lens P = 1/f (Dioptres)', 'Myopia (Short-sightedness, Concave Lens)', 'Hypermetropia (Convex Lens)'],
        studyNotes: [
          'Myopia (short-sightedness): Image forms in front of retina, corrected using concave (diverging) lens.',
          'Hypermetropia (far-sightedness): Image forms behind retina, corrected using convex (converging) lens.',
          'Power of lens is P = 1 / f (in metres), measured in Dioptres (D).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-2',
            question: 'Which type of corrective lens is prescribed to rectify Myopia (short-sightedness)?',
            options: ['Convex lens', 'Concave lens', 'Bifocal lens', 'Cylindrical lens'],
            correctAnswer: 1,
            explanation: 'A concave lens diverges incoming light rays to shift the focal point back onto the retina in myopic eyes.',
          },
        ],
      },
      {
        id: 'gs-1-10-l3',
        lessonNumber: '1.3',
        title: 'Thermal Physics and Ideal Gas Equation',
        description: 'Real and apparent expansion of liquids, absolute zero, Boyle law, Charles law, Avogadro law.',
        status: 'Available',
        keyConcepts: ['Boyle Law: P ∝ 1/V', 'Charles Law: V ∝ T', 'Avogadro Law: V ∝ n', 'Ideal Gas Equation: PV = nRT'],
        studyNotes: [
          'Boyle Law: At constant temperature, pressure is inversely proportional to volume (PV = constant).',
          'Charles Law: At constant pressure, volume is directly proportional to absolute temperature (V/T = constant).',
          'Ideal gas equation: PV = nRT (where R is the universal gas constant = 8.314 J/mol·K).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-3',
            question: 'What is the universal gas constant (R) value in SI units?',
            options: ['1.38 × 10^-23 J/K', '6.023 × 10^23 mol^-1', '8.314 J/(mol·K)', '9.8 m/s²'],
            correctAnswer: 2,
            explanation: 'The universal gas constant R equals 8.314 J/(mol·K).',
          },
        ],
      },
      {
        id: 'gs-1-10-l4',
        lessonNumber: '1.4',
        title: 'Electricity: Ohm Law & Domestic Circuits',
        description: 'Electric potential, resistance in series and parallel, electric power, Joule heating effect, earthing.',
        status: 'Available',
        keyConcepts: ['Ohm Law: V = IR', 'Resistors in Series (R = R1+R2)', 'Resistors in Parallel (1/R = 1/R1+1/R2)', 'Domestic Supply (230 V, 50 Hz AC)'],
        studyNotes: [
          'Ohm Law: Current passing through a conductor is directly proportional to potential difference across ends at constant temperature (V = IR).',
          'Domestic electric supply in India operates at 230 V alternating current (AC) with a frequency of 50 Hz.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-4',
            question: 'What is the standard voltage and frequency of domestic alternating current (AC) supply in India?',
            options: ['110 V, 60 Hz', '230 V, 50 Hz', '220 V, 60 Hz', '440 V, 50 Hz'],
            correctAnswer: 1,
            explanation: 'Domestic power in India is standardized at 230 V AC frequency of 50 Hz.',
          },
        ],
      },
      {
        id: 'gs-1-10-l5',
        lessonNumber: '1.5',
        title: 'Acoustics: Doppler Effect and SONAR',
        description: 'Propagation of sound, speed in different media, reflection of sound, echo, Doppler effect applications.',
        status: 'Available',
        keyConcepts: ['Doppler Effect', 'Apparent Frequency Formula', 'SONAR Principles', 'Speed of Sound in Solids vs Air'],
        studyNotes: [
          'Sound travels fastest in solids (steel approx. 5960 m/s), slower in liquids (water approx. 1480 m/s), and slowest in air (approx. 343 m/s).',
          'Doppler Effect: Apparent shift in wave frequency observed when there is relative motion between source and listener.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-5',
            question: 'The apparent change in the pitch/frequency of a sound siren as an ambulance approaches and then moves away is caused by:',
            options: ['Tyndall Effect', 'Doppler Effect', 'Raman Effect', 'Zeeman Effect'],
            correctAnswer: 1,
            explanation: 'Christian Doppler described the apparent change in frequency of waves due to relative motion between source and observer.',
          },
        ],
      },
      {
        id: 'gs-1-10-l6',
        lessonNumber: '1.6',
        title: 'Nuclear Physics: Radioactivity and Nuclear Power',
        description: 'Alpha, beta, gamma decay, nuclear fission, chain reactions, Kudankulam and Kalpakkam, nuclear fusion.',
        status: 'Available',
        keyConcepts: ['Becquerel & Marie Curie', 'Alpha, Beta, Gamma Penetration', 'Nuclear Fission (U-235)', 'Kudankulam & Kalpakkam Reactors'],
        studyNotes: [
          'Henri Becquerel discovered natural radioactivity; Marie and Pierre Curie discovered Polonium and Radium.',
          'Nuclear fission splits heavy nuclei (U-235) liberating immense energy; nuclear fusion joins lighter nuclei (hydrogen into helium) powering the Sun.',
          'Tamil Nadu hosts Kudankulam (VVER-1000 reactors) and Kalpakkam (MAPS & Fast Breeder Test Reactor).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-6',
            question: 'Which nuclear power plant in Tamil Nadu operates 1000 MW VVER pressurized water reactors in collaboration with Russia?',
            options: ['Kalpakkam (MAPS)', 'Kudankulam Nuclear Power Plant', 'Kaiga Atomic Power Station', 'Tarapur Atomic Power Station'],
            correctAnswer: 1,
            explanation: 'Kudankulam Nuclear Power Plant in Tirunelveli district operates 1000 MW Russian VVER reactors.',
          },
        ],
      },
      {
        id: 'gs-1-10-l7',
        lessonNumber: '1.7',
        title: 'Periodic Classification of Elements',
        description: 'Modern periodic law, periods, groups, atomic radius, ionization energy, electronegativity trends.',
        status: 'Available',
        keyConcepts: ['18 Groups & 7 Periods', 'Atomic Radius Trends', 'Ionization Energy Trends', 'Electronegativity (Fluorine Highest)'],
        studyNotes: [
          'Across a period (left to right), atomic radius decreases while ionization energy and electronegativity increase.',
          'Down a group (top to bottom), atomic radius increases while ionization energy and electronegativity decrease.',
          'Fluorine (F) is the most electronegative element in the periodic table (Paulings value: 4.0).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-7',
            question: 'Which chemical element possesses the highest electronegativity value in the Pauling scale?',
            options: ['Oxygen', 'Chlorine', 'Fluorine', 'Nitrogen'],
            correctAnswer: 2,
            explanation: 'Fluorine has the highest electronegativity (4.0 on Pauling scale) in the periodic table.',
          },
        ],
      },
      {
        id: 'gs-1-10-l8',
        lessonNumber: '1.8',
        title: 'Solutions, Solubility and pH Scale',
        description: 'Solute-solvent types, solubility factors, hydration, pH scale calculations and applications.',
        status: 'Available',
        keyConcepts: ['Sorensen pH Scale (0 to 14)', 'pH = -log10[H+]', 'Acid Rain (pH < 5.6)', 'Human Blood pH (7.35 - 7.45)'],
        studyNotes: [
          'S.P.L. Sorensen introduced the pH scale in 1909: pH = -log10[H+]. pH < 7 is acidic, pH = 7 is neutral, pH > 7 is basic.',
          'Human blood maintains a tight physiological pH between 7.35 and 7.45; saliva is 6.5–7.5; stomach gastric juice is 1.0–2.0.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-8',
            question: 'What is the normal physiological pH range of healthy human blood?',
            options: ['5.5 to 6.5', '6.8 to 7.0', '7.35 to 7.45', '8.0 to 8.5'],
            correctAnswer: 2,
            explanation: 'Human blood is slightly alkaline, strictly buffered between pH 7.35 and 7.45.',
          },
        ],
      },
      {
        id: 'gs-1-10-l9',
        lessonNumber: '1.9',
        title: 'Types of Chemical Reactions & Carbon Compounds',
        description: 'Combination, decomposition, displacement, redox, IUPAC nomenclature of hydrocarbons, soaps.',
        status: 'Available',
        keyConcepts: ['Catenation in Carbon', 'Homologous Series', 'Functional Groups (-OH, -CHO, -COOH)', 'Micelle Formation in Soaps'],
        studyNotes: [
          'Carbon forms millions of organic compounds due to catenation (self-linking) and tetravalency.',
          'Soap molecules possess a hydrophilic ionic carboxylate head and a hydrophobic non-polar hydrocarbon tail, forming micelles to dissolve grease.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-9',
            question: 'The extraordinary ability of carbon atoms to link with one another forming long chains is known as:',
            options: ['Allotropy', 'Catenation', 'Isomerism', 'Electronegativity'],
            correctAnswer: 1,
            explanation: 'Catenation is the self-linking of carbon atoms through covalent bonds to form long open or closed ring structures.',
          },
        ],
      },
      {
        id: 'gs-1-10-l10',
        lessonNumber: '1.10',
        title: 'Plant Anatomy and Plant Physiology',
        description: 'Internal tissue systems of dicot/monocot root and stem, chloroplast, respiration, photosynthesis.',
        status: 'Available',
        keyConcepts: ['Dicot vs Monocot Anatomy', 'Light Reaction (Granum)', 'Dark Reaction (Stroma, Calvin Cycle)', 'ATP Synthesis'],
        studyNotes: [
          'Photosynthesis: Light-dependent reactions occur in chloroplast grana (thylakoids); dark reactions (Calvin cycle) occur in stroma.',
          'Cellular respiration produces 38 ATP molecules per molecule of glucose through glycolysis, Krebs cycle, and electron transport chain.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-10',
            question: 'In which part of the chloroplast does the light-independent dark reaction (Calvin cycle) of photosynthesis take place?',
            options: ['Thylakoid membrane', 'Grana', 'Stroma', 'Outer membrane'],
            correctAnswer: 2,
            explanation: 'The dark enzymatic reactions of photosynthesis (Calvin cycle) occur in the stroma fluid of chloroplasts.',
          },
        ],
      },
      {
        id: 'gs-1-10-l11',
        lessonNumber: '1.11',
        title: 'Transportation in Plants & Circulation in Animals',
        description: 'Xylem, phloem, blood composition, human heart structure, double circulation, blood pressure.',
        status: 'Available',
        keyConcepts: ['RBC, WBC, Platelets', 'Karl Landsteiner (ABO Blood Groups)', 'Double Circulation', 'Blood Pressure (120/80 mmHg)'],
        studyNotes: [
          'Karl Landsteiner discovered the ABO blood group system in 1900. Blood group O is universal donor; AB is universal recipient.',
          'Normal adult human blood pressure is 120/80 mmHg (systolic/diastolic), measured using a Sphygmomanometer.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-11',
            question: 'Which instrument is clinical standard for measuring arterial blood pressure in humans?',
            options: ['Stethoscope', 'Sphygmomanometer', 'Electrocardiograph (ECG)', 'Spirometer'],
            correctAnswer: 1,
            explanation: 'A sphygmomanometer (BP apparatus) measures systolic and diastolic arterial blood pressure.',
          },
        ],
      },
      {
        id: 'gs-1-10-l12',
        lessonNumber: '1.12',
        title: 'Nervous System & Hormonal Coordination',
        description: 'Neuron, brain anatomy, spinal cord, pituitary, thyroid, adrenal, insulin and glucagon.',
        status: 'Available',
        keyConcepts: ['Forebrain, Midbrain, Hindbrain', 'Medulla Oblongata (Involuntary Center)', 'Adrenaline (Fight or Flight)', 'Insulin Deficiency (Diabetes Mellitus)'],
        studyNotes: [
          'Medulla oblongata controls vital involuntary cardiovascular and respiratory reflexes (cardiac centre, breathing, coughing, vomiting).',
          'Adrenal medulla secretes adrenaline (epinephrine), the emergency "fight or flight" hormone in stressful situations.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-12',
            question: 'Which part of the human brain controls vital involuntary reflex actions such as heartbeat, breathing, and blood pressure?',
            options: ['Cerebrum', 'Cerebellum', 'Medulla Oblongata', 'Hypothalamus'],
            correctAnswer: 2,
            explanation: 'The medulla oblongata located in the brainstem coordinates cardiac, vasomotor, and respiratory reflex centres.',
          },
        ],
      },
      {
        id: 'gs-1-10-l13',
        lessonNumber: '1.13',
        title: 'Heredity, DNA and Evolution',
        description: 'Mendel laws of inheritance, DNA double helix, chromosomes, sex determination, Darwinism.',
        status: 'Available',
        keyConcepts: ['Watson & Crick DNA Model (1953)', 'Monohybrid (3:1) & Dihybrid (9:3:3:1)', 'Sex Chromosomes (XX vs XY)', 'Darwin Origin of Species (1859)'],
        studyNotes: [
          'James Watson and Francis Crick proposed the double-helical structure of DNA in 1953 based on Rosalind Franklin’s X-ray crystallography.',
          'In humans, females possess 44+XX chromosomes; males possess 44+XY. The sperm determines the biological sex of offspring.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-13',
            question: 'In humans, which gamete determines the biological sex of the child during fertilization?',
            options: ['Ovum (Egg)', 'Sperm', 'Autosome 21', 'Mitochondrial DNA'],
            correctAnswer: 1,
            explanation: 'Eggs contribute only X chromosomes, while sperm can carry either X or Y, determining whether the child is female (XX) or male (XY).',
          },
        ],
      },
      {
        id: 'gs-1-10-l14',
        lessonNumber: '1.14',
        title: 'Breeding, Biotechnology & Human Diseases',
        description: 'Recombinant DNA technology, stem cell therapy, communicable vs non-communicable diseases, vaccines.',
        status: 'Available',
        keyConcepts: ['Restriction Endonucleases (Molecular Scissors)', 'DNA Ligase (Molecular Glue)', 'Stem Cells', 'Insulin Synthesis via rDNA'],
        studyNotes: [
          'Restriction endonucleases cut DNA at specific palindromic sequences (molecular scissors); DNA ligase seals fragments.',
          'Recombinant human insulin (Humulin) produced using Escherichia coli was the first commercial genetically engineered pharmaceutical (1982).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-14',
            question: 'Which enzymes are known as "molecular scissors" in recombinant DNA genetic engineering?',
            options: ['DNA Ligases', 'Restriction Endonucleases', 'DNA Polymerases', 'Ribonucleases'],
            correctAnswer: 1,
            explanation: 'Restriction endonucleases cut DNA strands at specific palindromic recognition sequences.',
          },
        ],
      },
      {
        id: 'gs-1-10-l15',
        lessonNumber: '1.15',
        title: 'Environmental Management and Green Energy',
        description: 'Wildlife conservation, rain water harvesting, solar energy, wind energy, e-waste recycling.',
        status: 'Available',
        keyConcepts: ['Tamil Nadu Wind Energy Leadership', 'Solar Power (Kamuthi Plant)', 'Wildlife Protection Act 1972', 'Chipko & Silent Valley Movements'],
        studyNotes: [
          'Tamil Nadu is a national leader in renewable wind energy, with Muppandal wind farm in Kanyakumari being one of the largest in Asia.',
          'Kamuthi Solar Power Project in Ramanathapuram was one of the world’s largest single-location solar power plants (648 MW).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-10-15',
            question: 'Which prominent wind energy corridor in Kanyakumari district of Tamil Nadu hosts one of Asia’s largest onshore wind farms?',
            options: ['Kayathar', 'Muppandal', 'Aralvaimozhi', 'Palladam'],
            correctAnswer: 1,
            explanation: 'Muppandal wind farm in Kanyakumari district is one of Asia’s largest operational wind farms.',
          },
        ],
      },
    ],
  },

  // 11th Standard - Unit 1
  'general-studies-1-11': {
    subjectId: 'general-studies',
    unitId: 1,
    classId: 11,
    subjectTitle: 'General Studies',
    unitTitle: 'General Science',
    unitNumber: 'Unit 1',
    classTitle: '11th Standard',
    standardNumber: 11,
    subjectName: 'Physics, Chemistry & Biology (Higher Secondary)',
    topics: [
      'Nature of Physical World and Measurement',
      'Kinematics, Work, Energy, Power & Gravitation',
      'Properties of Matter: Elasticity, Viscosity, Surface Tension',
      'Thermodynamics and Kinetic Theory of Gases',
      'Basic Concepts of Chemistry, Periodic Properties & Chemical Bonding',
      'Biomolecules, Plant Physiology & Human Physiology',
    ],
    lessons: [
      {
        id: 'gs-1-11-l1',
        lessonNumber: '1.1',
        title: 'Nature of Physical World and Measurement',
        description: 'SI unit definitions, dimensional analysis, errors in measurements and significant figures.',
        status: 'Available',
        keyConcepts: ['Dimensional Formulas', 'Principle of Homogeneity', 'Systematic vs Random Errors', 'Significant Figure Rules'],
        studyNotes: [
          'Dimensional analysis checks equation consistency using the principle of homogeneity (dimensions on both sides must match).',
          'Gravitational constant G has dimensions [M^-1 L^3 T^-2]; Planck constant h has [M L^2 T^-1].',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-11-1',
            question: 'What are the dimensional formula dimensions of Planck’s constant (h)?',
            options: ['[M L² T^-1]', '[M L T^-2]', '[M L² T^-2]', '[M^-1 L³ T^-2]'],
            correctAnswer: 0,
            explanation: 'E = hν => h = E / ν = [M L² T^-2] / [T^-1] = [M L² T^-1], which is identical to angular momentum.',
          },
        ],
      },
      {
        id: 'gs-1-11-l2',
        lessonNumber: '1.2',
        title: 'Kinematics and Laws of Motion',
        description: 'Vectors, projectile motion, Newton laws, friction, circular motion and banking of roads.',
        status: 'Available',
        keyConcepts: ['Projectile Trajectory (Parabola)', 'Banking of Roads: tan θ = v²/(rg)', 'Frictional Coefficient μ', 'Impulse = Change in Momentum'],
        studyNotes: [
          'The trajectory of a projectile fired in a gravitational field neglecting air resistance is a parabola.',
          'Optimum banking angle for curved roads without relying on friction: tan(θ) = v² / (rg).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-11-2',
            question: 'The path (trajectory) followed by an ideal projectile launched in uniform gravity is:',
            options: ['Hyperbola', 'Parabola', 'Ellipse', 'Circle'],
            correctAnswer: 1,
            explanation: 'Equations of horizontal and vertical displacement yield y = ax - bx², representing a parabola.',
          },
        ],
      },
      {
        id: 'gs-1-11-l3',
        lessonNumber: '1.3',
        title: 'Work, Energy, Power and Gravitation',
        description: 'Work-energy theorem, conservative forces, Kepler laws, gravitational potential, escape velocity.',
        status: 'Available',
        keyConcepts: ['Work-Energy Theorem (W = ΔK)', 'Escape Velocity of Earth (11.2 km/s)', 'Kepler 3 Laws of Planetary Motion', 'Orbital Velocity (7.9 km/s)'],
        studyNotes: [
          'Escape velocity from Earth’s surface: ve = √(2gR) ≈ 11.2 km/s.',
          'Kepler’s Third Law (Law of Periods): The square of orbital period is proportional to cube of semi-major axis (T² ∝ r³).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-11-3',
            question: 'What is the escape velocity required for a body to overcome Earth’s gravitational field from its surface?',
            options: ['7.9 km/s', '9.8 km/s', '11.2 km/s', '15.0 km/s'],
            correctAnswer: 2,
            explanation: 'Earth escape velocity ve = √(2gR) ≈ 11.2 km/s.',
          },
        ],
      },
      {
        id: 'gs-1-11-l4',
        lessonNumber: '1.4',
        title: 'Properties of Matter & Fluid Mechanics',
        description: 'Hooke law, Young modulus, Bernoulli theorem, Stokes law, surface tension, capillarity.',
        status: 'Available',
        keyConcepts: ['Hooke Law (Stress ∝ Strain)', 'Young, Bulk & Rigidity Moduli', 'Bernoulli Equation: P + ½ρv² + ρgh = constant', 'Surface Tension'],
        studyNotes: [
          'Bernoulli’s Principle: For an inviscid, incompressible fluid in streamline flow, total energy (pressure, kinetic, potential) remains constant.',
          'Dynamic lift on aeroplane wings and paint sprayers operate on Bernoulli’s theorem.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-11-4',
            question: 'The aerodynamic upward lift experienced by an aircraft wing during flight is primarily explained by:',
            options: ['Archimedes Principle', 'Bernoulli Principle', 'Stokes Law', 'Pascal Law'],
            correctAnswer: 1,
            explanation: 'Faster airflow over the curved upper aerofoil wing creates lower pressure compared to underneath, generating aerodynamic lift.',
          },
        ],
      },
      {
        id: 'gs-1-11-l5',
        lessonNumber: '1.5',
        title: 'Thermodynamics & Kinetic Theory',
        description: 'Zeroth, First, Second laws of thermodynamics, Carnot engine, isothermal and adiabatic processes.',
        status: 'Available',
        keyConcepts: ['First Law: ΔQ = ΔU + ΔW', 'Carnot Engine Efficiency η = 1 - T2/T1', 'Entropy & Second Law', 'Degrees of Freedom'],
        studyNotes: [
          'Zeroth Law defines temperature; First Law defines internal energy (conservation of energy); Second Law introduces entropy and limits heat engine efficiency.',
          'Maximum efficiency of a heat engine operating between hot reservoir T1 and cold reservoir T2 is given by Carnot efficiency: η = 1 - T2/T1.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-11-5',
            question: 'Which law of thermodynamics provides the scientific definition and operational basis for Temperature?',
            options: ['Zeroth Law', 'First Law', 'Second Law', 'Third Law'],
            correctAnswer: 0,
            explanation: 'The Zeroth Law of thermodynamics establishes thermal equilibrium and provides the concept of temperature.',
          },
        ],
      },
      {
        id: 'gs-1-11-l6',
        lessonNumber: '1.6',
        title: 'Basic Concepts of Chemistry & Stoichiometry',
        description: 'Mole concept, molar mass, empirical formula, oxidation states, balancing redox reactions.',
        status: 'Available',
        keyConcepts: ['Avogadro Number (6.022 x 10^23)', 'Molar Volume at STP (22.4 L)', 'Empirical vs Molecular Formula', 'Oxidation Numbers'],
        studyNotes: [
          'One mole of any gas at STP occupies 22.4 litres and contains 6.022 × 10^23 particles (Avogadro constant).',
          'Oxidation involves loss of electrons or increase in oxidation number; reduction involves gain of electrons.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-11-6',
            question: 'What is the volume occupied by one mole of an ideal gas at Standard Temperature and Pressure (STP)?',
            options: ['11.2 litres', '22.4 litres', '44.8 litres', '1.0 litre'],
            correctAnswer: 1,
            explanation: 'One mole of any ideal gas occupies 22.4 dm³ (litres) at standard temperature (273 K) and pressure (1 atm).',
          },
        ],
      },
      {
        id: 'gs-1-11-l7',
        lessonNumber: '1.7',
        title: 'Periodic Classification & Chemical Bonding',
        description: 'Periodic properties, VSEPR theory, hybridization (sp, sp2, sp3), molecular orbital theory.',
        status: 'Available',
        keyConcepts: ['sp3 Hybridization (CH4, Tetrahedral)', 'sp2 (Ethene, Planar)', 'sp (Ethyne, Linear)', 'Hydrogen Bonding in Water'],
        studyNotes: [
          'Methane (CH4) exhibits sp3 hybridization with tetrahedral geometry and 109.5° bond angle.',
          'Hydrogen bonding causes high boiling point of water and makes ice less dense than liquid water.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-11-7',
            question: 'What is the type of hybridization and molecular geometry of a Methane (CH4) molecule?',
            options: ['sp, Linear', 'sp2, Trigonal planar', 'sp3, Tetrahedral', 'sp3d, Trigonal bipyramidal'],
            correctAnswer: 2,
            explanation: 'Methane has sp3 hybridization resulting in a regular tetrahedral shape with bond angles of 109° 28\'.',
          },
        ],
      },
      {
        id: 'gs-1-11-l8',
        lessonNumber: '1.8',
        title: 'Environmental Chemistry & Hydrocarbons',
        description: 'Atmospheric pollution, ozone depletion, photochemical smog, alkanes, alkenes and alkynes.',
        status: 'Available',
        keyConcepts: ['CFCs & Ozone Hole', 'Photochemical Smog (NOx & VOCs)', 'Greenhouse Gases (CO2, CH4, N2O)', 'Acid Rain (H2SO4 & HNO3)'],
        studyNotes: [
          'Chlorofluorocarbons (CFCs) release chlorine free radicals in stratosphere, catalytically destroying ozone (O3).',
          'Photochemical smog forms under sunny conditions involving nitrogen oxides, ozone, and peroxyacetyl nitrate (PAN).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-11-8',
            question: 'Which radical species is primarily responsible for the catalytic breakdown of stratospheric ozone by CFCs?',
            options: ['Chlorine free radical (Cl•)', 'Hydroxyl radical (OH•)', 'Nitrate radical (NO3•)', 'Sulphate radical'],
            correctAnswer: 0,
            explanation: 'UV photolysis of CFCs releases reactive atomic chlorine radicals (Cl•) that catalytically deplete thousands of ozone molecules.',
          },
        ],
      },
      {
        id: 'gs-1-11-l9',
        lessonNumber: '1.9',
        title: 'Cell Biology, Biomolecules & Plant Physiology',
        description: 'Proteins, carbohydrates, lipids, enzymes, photosynthesis (C3 & C4 cycles), respiration.',
        status: 'Available',
        keyConcepts: ['Primary, Secondary, Tertiary Protein Structure', 'Enzyme Lock & Key vs Induced Fit', 'C4 Pathway (Kranz Anatomy)', 'Photorespiration'],
        studyNotes: [
          'Enzymes act as biological catalysts lowering activation energy for metabolic pathways.',
          'C4 plants (maize, sugarcane) possess Kranz anatomy, effectively eliminating wasteful photorespiration under high temperatures.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-11-9',
            question: 'Kranz leaf anatomy is an evolutionary structural adaptation characteristic of which group of plants?',
            options: ['C3 plants', 'C4 plants', 'CAM desert plants', 'Bryophytes'],
            correctAnswer: 1,
            explanation: 'Kranz anatomy (distinctive bundle sheath cells) enables C4 plants like sugarcane and maize to fix carbon efficiently without photorespiration.',
          },
        ],
      },
      {
        id: 'gs-1-11-l10',
        lessonNumber: '1.10',
        title: 'Human Physiology: Digestion, Respiration & Excretion',
        description: 'Gastrointestinal tract, respiratory pigments, nephron functioning and counter-current mechanism.',
        status: 'Available',
        keyConcepts: ['Nephron Filtration & Reabsorption', 'Counter-Current Mechanism', 'Hemoglobin Oxygen Dissociation Curve', 'Renin-Angiotensin System (RAAS)'],
        studyNotes: [
          'Nephrons are functional units of kidneys; ultrafiltration occurs in glomerulus; counter-current mechanism in Loop of Henle concentrates urine.',
          'Hemoglobin exhibits a sigmoidal oxygen dissociation curve shifted right by increased CO2, acidity, and temperature (Bohr effect).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-11-10',
            question: 'The counter-current multiplier mechanism responsible for concentrating mammalian urine operates within which nephron segment?',
            options: ['Bowman Capsule', 'Loop of Henle', 'Proximal Convoluted Tubule', 'Glomerulus'],
            correctAnswer: 1,
            explanation: 'The hairpin Loop of Henle and vasa recta maintain the hypertonic medullary gradient via counter-current multiplication.',
          },
        ],
      },
    ],
  },

  // 12th Standard - Unit 1
  'general-studies-1-12': {
    subjectId: 'general-studies',
    unitId: 1,
    classId: 12,
    subjectTitle: 'General Studies',
    unitTitle: 'General Science',
    unitNumber: 'Unit 1',
    classTitle: '12th Standard',
    standardNumber: 12,
    subjectName: 'Physics, Chemistry & Biology (Higher Secondary)',
    topics: [
      'Electrostatics, Current Electricity & Magnetism',
      'Electromagnetic Induction & Alternating Current',
      'Electromagnetic Waves & Wave Optics',
      'Atomic Physics, Nuclear Physics & Semiconductor Electronics',
      'Solid State, Electrochemistry, Surface Chemistry & Polymers',
      'Genetics, Molecular Biology, Biotechnology, Health & Disease',
    ],
    lessons: [
      {
        id: 'gs-1-12-l1',
        lessonNumber: '1.1',
        title: 'Electrostatics & Current Electricity',
        description: 'Coulomb law, Gauss theorem, electric dipoles, Kirchhoff laws, Wheatstone bridge, potentiometer.',
        status: 'Available',
        keyConcepts: ['Gauss Law (Φ = q/ε0)', 'Kirchhoff Current & Voltage Laws', 'Wheatstone Bridge Balance (P/Q = R/S)', 'Potentiometer vs Voltmeter'],
        studyNotes: [
          'Kirchhoff’s First Law (Current Law) represents conservation of electric charge; Second Law (Voltage Law) represents conservation of energy.',
          'Wheatstone bridge is balanced when no current flows through the galvanometer: P / Q = R / S.',
          'A potentiometer measures EMF with zero drawn current, outperforming ordinary voltmeters.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-12-1',
            question: 'Kirchhoff’s First Law (Junction Rule, ΣI = 0) is a direct consequence of which conservation law?',
            options: ['Conservation of Energy', 'Conservation of Electric Charge', 'Conservation of Linear Momentum', 'Conservation of Angular Momentum'],
            correctAnswer: 1,
            explanation: 'Kirchhoff Junction Rule is based directly on the conservation of electric charge (charge cannot accumulate at a junction).',
          },
        ],
      },
      {
        id: 'gs-1-12-l2',
        lessonNumber: '1.2',
        title: 'Magnetism, EMI and Alternating Current',
        description: 'Biot-Savart law, Ampere law, Faraday laws of induction, Lenz law, AC generators, transformers.',
        status: 'Available',
        keyConcepts: ['Faraday Law (EMF = -dΦ/dt)', 'Lenz Law (Energy Conservation)', 'Step-up & Step-down Transformers', 'Eddy Currents & Core Lamination'],
        studyNotes: [
          'Faraday Law of electromagnetic induction: Induced EMF is proportional to negative rate of magnetic flux change.',
          'Lenz Law dictates that induced current direction opposes the change in flux producing it, obeying conservation of energy.',
          'Transformer cores are laminated to minimize power dissipation from circulating eddy currents.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-12-2',
            question: 'Why are iron cores in AC power transformers constructed using thin laminated insulated sheets rather than solid metal blocks?',
            options: ['To reduce cost', 'To minimize energy loss due to Eddy Currents', 'To prevent thermal expansion', 'To increase magnetic hysteresis'],
            correctAnswer: 1,
            explanation: 'Laminating the transformer core breaks electrical conductive paths, drastically reducing eddy current heating losses.',
          },
        ],
      },
      {
        id: 'gs-1-12-l3',
        lessonNumber: '1.3',
        title: 'Electromagnetic Waves and Wave Optics',
        description: 'EM spectrum, Huygens principle, interference, diffraction, polarization, optical fibers.',
        status: 'Available',
        keyConcepts: ['Maxwell Equations', 'EM Spectrum (Radio to Gamma)', 'Young Double Slit Experiment', 'Brewster Law of Polarization'],
        studyNotes: [
          'James Clerk Maxwell predicted EM waves travel at speed of light: c = 1 / √(μ0·ε0).',
          'Young’s Double Slit Experiment proved wave nature of light via constructive and destructive interference fringes.',
          'Brewster Law: At polarizing angle ip, reflected light is completely plane-polarized: tan(ip) = n.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-12-3',
            question: 'Young’s classic Double Slit Experiment provided decisive experimental proof for which nature of light?',
            options: ['Corpuscular nature', 'Electromagnetic wave nature', 'Photoelectric emission', 'Nuclear radiation'],
            correctAnswer: 1,
            explanation: 'Young double slit experiment demonstrated interference fringes, firmly proving the wave nature of light.',
          },
        ],
      },
      {
        id: 'gs-1-12-l4',
        lessonNumber: '1.4',
        title: 'Dual Nature of Radiation & Nuclear Physics',
        description: 'Photoelectric effect, Einstein equation, de Broglie wavelength, mass defect, binding energy curve.',
        status: 'Available',
        keyConcepts: ['Einstein Photoelectric Equation (E = hν - Φ)', 'Threshold Frequency', 'de Broglie Wavelength λ = h / p', 'Nuclear Binding Energy per Nucleon'],
        studyNotes: [
          'Einstein won the 1921 Nobel Prize in Physics for explaining the Photoelectric Effect using photon quantization: hν = Kmax + Φ0.',
          'Louis de Broglie proposed wave-particle duality for all matter: λ = h / mv.',
          'Iron-56 (56Fe) has the highest binding energy per nucleon (approx. 8.8 MeV), making it the most stable nucleus.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-12-4',
            question: 'Albert Einstein was awarded the 1921 Nobel Prize in Physics specifically for his theoretical explanation of:',
            options: ['Special Theory of Relativity', 'General Theory of Relativity', 'Photoelectric Effect', 'Brownian Motion'],
            correctAnswer: 2,
            explanation: 'Einstein received the 1921 Nobel Prize for his services to Theoretical Physics, especially for his discovery of the law of the Photoelectric Effect.',
          },
        ],
      },
      {
        id: 'gs-1-12-l5',
        lessonNumber: '1.5',
        title: 'Semiconductor Electronics & Communications',
        description: 'P-N junction diode, Zener diode, rectifiers, transistors, logic gates, modulation techniques.',
        status: 'Available',
        keyConcepts: ['P-type (Trivalent) vs N-type (Pentavalent)', 'Zener Diode (Voltage Regulator)', 'Logic Gates (AND, OR, NOT, NAND, NOR)', 'AM vs FM Modulation'],
        studyNotes: [
          'Doping silicon with trivalent impurities (boron, indium) produces p-type (holes major); pentavalent (phosphorus, arsenic) produces n-type (electrons major).',
          'Zener diode operates in reverse breakdown region, serving as a constant DC voltage regulator.',
          'NAND and NOR are universal gates capable of realizing all other basic logic circuits.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-12-5',
            question: 'Which semiconductor device operates in the reverse breakdown voltage region as a voltage regulator?',
            options: ['Light Emitting Diode (LED)', 'Photodiode', 'Zener Diode', 'Solar Cell'],
            correctAnswer: 2,
            explanation: 'A Zener diode maintains a constant voltage across its terminals when operated in reverse breakdown.',
          },
        ],
      },
      {
        id: 'gs-1-12-l6',
        lessonNumber: '1.6',
        title: 'Electrochemistry, Metallurgy & Coordination Chemistry',
        description: 'Nernst equation, Galvanic cells, extraction of metals, coordination complexes and isomerism.',
        status: 'Available',
        keyConcepts: ['Nernst Equation', 'Electrochemical Series', 'Froth Floatation (Sulphide Ores)', 'Werner Coordination Theory'],
        studyNotes: [
          'Galvanic (voltaic) cells convert chemical energy into electrical energy; electrolytic cells consume electricity to drive non-spontaneous reactions.',
          'Froth floatation concentrates sulphide ores (galena, zinc blende) using pine oil collector and frothing agents.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-12-6',
            question: 'The froth floatation concentration process is primarily employed for which type of metallurgical ores?',
            options: ['Oxide ores', 'Carbonate ores', 'Sulphide ores', 'Halide ores'],
            correctAnswer: 2,
            explanation: 'Froth floatation relies on differential wetting with pine oil and is universally used for sulphide ores like zinc blende and copper pyrites.',
          },
        ],
      },
      {
        id: 'gs-1-12-l7',
        lessonNumber: '1.7',
        title: 'Organic Chemistry & Chemistry in Everyday Life',
        description: 'Alcohols, phenols, carbonyl compounds, carboxylic acids, polymers, medicines and analgesics.',
        status: 'Available',
        keyConcepts: ['Lucas Test (Alcohols)', 'Tollens & Fehling Tests (Aldehydes)', 'Aspirin (Acetylsalicylic Acid)', 'Biodegradable Polymers (PHBV)'],
        studyNotes: [
          'Aspirin (acetylsalicylic acid) acts as an analgesic, antipyretic, and blood antiplatelet aggregator.',
          'Tollens reagent (ammoniacal silver nitrate) forms a silver mirror with aldehydes, distinguishing them from ketones.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-12-7',
            question: 'What is the chemical systematic name of the popular analgesic and anti-inflammatory drug Aspirin?',
            options: ['Methyl salicylate', 'Acetylsalicylic acid', 'Phenyl salicylate', 'Sodium benzoate'],
            correctAnswer: 1,
            explanation: 'Aspirin is chemically known as acetylsalicylic acid, synthesized by acetylating salicylic acid.',
          },
        ],
      },
      {
        id: 'gs-1-12-l8',
        lessonNumber: '1.8',
        title: 'Genetics, Molecular Basis of Inheritance',
        description: 'DNA replication, transcription, translation, genetic code, Lac operon, human genome project.',
        status: 'Available',
        keyConcepts: ['Meselson-Stahl Semiconservative Replication', 'Universal Genetic Code (64 Codons)', 'Central Dogma: DNA → RNA → Protein', 'Lac Operon in E. coli'],
        studyNotes: [
          'Central Dogma of molecular biology: Genetic information flows from DNA to RNA (transcription) and RNA to protein (translation).',
          'AUG serves as the universal initiator start codon, coding for methionine.',
          'The human genome contains approximately 3 × 10^9 base pairs across 23 chromosome pairs.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-12-8',
            question: 'Which universal codon serves as the initiator (start) codon during biological protein translation?',
            options: ['UAA', 'UAG', 'AUG', 'UGA'],
            correctAnswer: 2,
            explanation: 'AUG codes for methionine and initiates polypeptide translation in both prokaryotes and eukaryotes.',
          },
        ],
      },
      {
        id: 'gs-1-12-l9',
        lessonNumber: '1.9',
        title: 'Human Health, Immunology & Microbes',
        description: 'Innate and acquired immunity, antibodies, antigen-antibody interactions, AIDS, cancer, vaccines.',
        status: 'Available',
        keyConcepts: ['Immunoglobulins (IgG, IgA, IgM, IgE, IgD)', 'HIV/AIDS Retrovirus (ELISA & Western Blot)', 'Active vs Passive Immunity', 'Oncogenes & Carcinogens'],
        studyNotes: [
          'IgG is the only maternal antibody that crosses the human placenta; IgA is abundant in mother’s colostrum milk.',
          'HIV is a retrovirus possessing single-stranded RNA and reverse transcriptase, attacking CD4+ T-helper lymphocytes.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-12-9',
            question: 'Which class of maternal immunoglobulin is capable of crossing the human placenta to confer natural passive immunity to the fetus?',
            options: ['IgA', 'IgE', 'IgG', 'IgM'],
            correctAnswer: 2,
            explanation: 'Immunoglobulin G (IgG) is the only antibody class capable of crossing the placental barrier to protect the developing fetus.',
          },
        ],
      },
      {
        id: 'gs-1-12-l10',
        lessonNumber: '1.10',
        title: 'Biotechnology & Environmental Ecology',
        description: 'Cloning vectors, PCR, ELISA, transgenic plants and animals, biodiversity conservation, pollution control.',
        status: 'Available',
        keyConcepts: ['Polymerase Chain Reaction (Kary Mullis)', 'Taq Polymerase (Thermus aquaticus)', 'Bt Cotton (Bacillus thuringiensis)', 'In-situ vs Ex-situ Conservation'],
        studyNotes: [
          'Polymerase Chain Reaction (PCR) amplifies specific DNA fragments exponentially using heat-stable Taq DNA polymerase.',
          'Bt cotton contains Cry toxin genes from Bacillus thuringiensis providing resistance against bollworm pests.',
          'In-situ conservation protects species in natural habitats (National Parks, Biosphere Reserves); Ex-situ in zoos, botanical gardens, and seed banks.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-12-10',
            question: 'The heat-stable DNA polymerase enzyme (Taq polymerase) utilized in PCR cycles is isolated from which thermophilic bacterium?',
            options: ['Escherichia coli', 'Thermus aquaticus', 'Bacillus thuringiensis', 'Agrobacterium tumefaciens'],
            correctAnswer: 1,
            explanation: 'Taq polymerase is extracted from the thermophilic bacterium Thermus aquaticus, surviving high 95°C denaturation temperatures.',
          },
        ],
      },
    ],
  },

  // =========================================================================
  // UNIT 2: GEOGRAPHY OF INDIA (5 Questions)
  // =========================================================================

  // 6th Standard - Unit 2
  'general-studies-2-6': {
    subjectId: 'general-studies',
    unitId: 2,
    classId: 6,
    subjectTitle: 'General Studies',
    unitTitle: 'Geography of India',
    unitNumber: 'Unit 2',
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
      {
        id: 'gs-2-6-l1',
        lessonNumber: '2.1',
        term: 'Term 1',
        title: 'The Universe and Solar System',
        description: 'Big Bang theory, galaxies, solar system, planets, revolution and rotation of Earth.',
        status: 'Available',
        keyConcepts: ['Big Bang Theory', 'Milky Way Galaxy', 'Rotation (Day & Night)', 'Revolution (Seasons)'],
        studyNotes: [
          'Earth rotates on its axis from West to East in 23 hours, 56 minutes, and 4 seconds, causing alternating day and night.',
          'Earth revolves around the Sun in an elliptical orbit in 365¼ days; axial tilt of 23½° causes changes in seasons.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-6-1',
            question: 'The alternation of day and night on Earth is caused directly by:',
            options: ['Earth\'s revolution around the Sun', 'Earth\'s axial rotation on its axis', 'Gravitational pull of the Moon', 'Sun\'s solar flares'],
            correctAnswer: 1,
            explanation: 'The spinning rotation of the Earth on its inclined axis causes regular alternation of day and night.',
          },
        ],
      },
      {
        id: 'gs-2-6-l2',
        lessonNumber: '2.2',
        term: 'Term 1',
        title: 'Land and Oceans',
        description: 'First, second, and third order landforms, major oceans: Pacific, Atlantic, Indian, Arctic, Southern.',
        status: 'Available',
        keyConcepts: ['1st Order (Continents & Oceans)', '2nd Order (Mountains, Plateaus, Plains)', '3rd Order (Valleys, Beaches, Sand Dunes)', 'Mariana Trench (Deepest Spot)'],
        studyNotes: [
          'First-order landforms comprise continents and oceans; second-order comprise mountains, plateaus, and plains; third-order comprise landforms carved by erosion and deposition.',
          'Mariana Trench in the Pacific Ocean (Challenger Deep, approx. 10,994 m) is the deepest point on Earth.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-6-2',
            question: 'Which of the following is the deepest oceanic trench in the world?',
            options: ['Java Trench', 'Puerto Rico Trench', 'Mariana Trench', 'Sunda Trench'],
            correctAnswer: 2,
            explanation: 'The Mariana Trench located in the western Pacific Ocean is the deepest oceanic trench on Earth.',
          },
        ],
      },
      {
        id: 'gs-2-6-l3',
        lessonNumber: '2.3',
        term: 'Term 2',
        title: 'Resources: Natural, Human & Man-made',
        description: 'Renewable resources (solar, wind) and non-renewable resources (coal, petroleum).',
        status: 'Available',
        keyConcepts: ['Renewable Energy (Solar, Wind, Hydro)', 'Non-renewable Fossil Fuels', 'Human Capital Development', 'Conservation Ethics'],
        studyNotes: [
          'Renewable resources naturally regenerate in a short time frame and do not deplete with sustainable use (solar, wind, biomass).',
          'Non-renewable mineral resources and fossil fuels (coal, petroleum, natural gas) take millions of years to form and are finite.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-6-3',
            question: 'Which of the following is classified as an inexhaustible, renewable natural resource?',
            options: ['Coal', 'Petroleum', 'Solar energy', 'Natural Gas'],
            correctAnswer: 2,
            explanation: 'Solar energy is an inexhaustible renewable resource powered continuously by nuclear fusion in the Sun.',
          },
        ],
      },
      {
        id: 'gs-2-6-l4',
        lessonNumber: '2.4',
        term: 'Term 3',
        title: 'Asia and India: Geographical Setting',
        description: 'Location, physical boundaries, climate zones and major rivers of the Indian subcontinent.',
        status: 'Available',
        keyConcepts: ['Indian Subcontinent Boundaries', 'Himalayas as Climatic Barrier', 'Peninsular Plateau', 'Tropical Monsoon Zone'],
        studyNotes: [
          'India is located in the southern part of Asia, bounded by the Himalayas in the north, Indian Ocean in the south, Arabian Sea in the west, and Bay of Bengal in the east.',
          'The Himalayas act as a formidable climatic divide preventing freezing Central Asian winds from entering India while trapping monsoon moisture.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-6-4',
            question: 'Which natural physical barrier prevents cold polar continental air masses of Central Asia from entering the Indian subcontinent during winter?',
            options: ['Western Ghats', 'Himalayas', 'Aravalli Range', 'Vindhya Range'],
            correctAnswer: 1,
            explanation: 'The massive high-altitude Himalayan mountain wall shields the Indian subcontinent from bitter sub-zero Central Asian winter winds.',
          },
        ],
      },
    ],
  },

  // 7th Standard - Unit 2
  'general-studies-2-7': {
    subjectId: 'general-studies',
    unitId: 2,
    classId: 7,
    subjectTitle: 'General Studies',
    unitTitle: 'Geography of India',
    unitNumber: 'Unit 2',
    classTitle: '7th Standard',
    standardNumber: 7,
    subjectName: 'Social Science - Geography',
    topics: [
      'Interior of the Earth: Crust, Mantle, Core',
      'Landforms: Fluvial, Glacial, Aeolian, Coastal',
      'Population and Settlement: Rural and Urban Settlements',
      'Weather and Climate: Atmospheric Elements',
      'Natural Hazards and Disaster Management',
    ],
    lessons: [
      {
        id: 'gs-2-7-l1',
        lessonNumber: '2.1',
        term: 'Term 1',
        title: 'Interior of the Earth and Plate Tectonics',
        description: 'Lithospheric plates, earthquakes, volcanoes, seismic waves (P, S, L).',
        status: 'Available',
        keyConcepts: ['Crust (SIAL & SIMA)', 'Mantle (Asthenosphere)', 'Core (NIFE - Nickel & Iron)', 'Seismic Waves (P, S, Surface Waves)'],
        studyNotes: [
          'Earth interior has 3 concentric layers: Crust (continental SIAL, oceanic SIMA), Mantle (molten asthenosphere), and Core (NIFE).',
          'Primary waves (P-waves) are fastest longitudinal waves travelling through solids, liquids, and gases; Secondary waves (S-waves) travel only through solids.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-7-1',
            question: 'The core of the Earth is composed primarily of which heavy metallic elements, termed NIFE?',
            options: ['Nitrogen and Iron', 'Nickel and Ferrous (Iron)', 'Nickel and Fluorine', 'Nitrogen and Ferrite'],
            correctAnswer: 1,
            explanation: 'NIFE stands for Nickel (Ni) and Ferrous/Iron (Fe), which comprise the dense metallic inner and outer core.',
          },
        ],
      },
      {
        id: 'gs-2-7-l2',
        lessonNumber: '2.2',
        term: 'Term 1',
        title: 'Landforms: Fluvial and Eolian Actions',
        description: 'Waterfalls, meanders, oxbow lakes, sand dunes and sea cliffs.',
        status: 'Available',
        keyConcepts: ['River Course (Upper, Middle, Lower)', 'Oxbow Lake Formation', 'Mushroom Rocks & Sand Dunes', 'Delta Formation'],
        studyNotes: [
          'In upper course, rivers form steep V-shaped valleys and waterfalls; in middle course, meanders and oxbow lakes; in lower course, distributaries and deltas.',
          'Wind erosion in deserts forms mushroom rocks; wind deposition creates crescent-shaped sand dunes called barchans.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-7-2',
            question: 'Crescent-shaped sand dunes formed by wind deposition in desert environments with constant wind direction are called:',
            options: ['Mushroom rocks', 'Barchans', 'Yardangs', 'Loess'],
            correctAnswer: 1,
            explanation: 'Barchans are crescent-shaped shifting sand dunes with tips pointing downwind.',
          },
        ],
      },
      {
        id: 'gs-2-7-l3',
        lessonNumber: '2.3',
        term: 'Term 2',
        title: 'Weather and Climate: Elements & Instruments',
        description: 'Atmospheric pressure, isotherms, isobars, humidity, anemometer and rain gauges.',
        status: 'Available',
        keyConcepts: ['Weather vs Climate', 'Isobars & Isotherms', 'Anemometer (Wind Speed)', 'Relative Humidity (Hygrometer)'],
        studyNotes: [
          'Weather is day-to-day atmospheric conditions; Climate is the statistical average of weather over at least 30 to 35 years.',
          'Isobars are lines connecting places of equal atmospheric pressure; isotherms connect places of equal temperature.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-7-3',
            question: 'On a meteorological weather map, lines connecting places having equal atmospheric pressure are known as:',
            options: ['Isotherms', 'Isobars', 'Isohyets', 'Isohalines'],
            correctAnswer: 1,
            explanation: 'Isobars are contour lines connecting geographic points of equal atmospheric pressure.',
          },
        ],
      },
      {
        id: 'gs-2-7-l4',
        lessonNumber: '2.4',
        term: 'Term 3',
        title: 'Disaster Management and Natural Hazards',
        description: 'Flood mitigation, cyclone preparedness, drought proofing, and emergency drills.',
        status: 'Available',
        keyConcepts: ['Disaster Management Cycle (Mitigation, Preparedness, Response, Recovery)', 'Early Warning Systems', 'NDRF & SDRF', 'Cyclone Shelters'],
        studyNotes: [
          'Disaster management cycle comprises pre-disaster risk reduction (mitigation, preparedness) and post-disaster response (relief, rehabilitation).',
          'India Meteorological Department (IMD) issues color-coded weather warnings: Green (all clear), Yellow (be updated), Orange (be prepared), Red (take action).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-7-4',
            question: 'In the IMD early warning weather system, which color code indicates the highest alert status requiring immediate disaster response action?',
            options: ['Yellow Alert', 'Orange Alert', 'Red Alert', 'Blue Alert'],
            correctAnswer: 2,
            explanation: 'Red Alert signifies extreme weather conditions requiring disaster management authorities to take emergency action.',
          },
        ],
      },
    ],
  },

  // 8th Standard - Unit 2
  'general-studies-2-8': {
    subjectId: 'general-studies',
    unitId: 2,
    classId: 8,
    subjectTitle: 'General Studies',
    unitTitle: 'Geography of India',
    unitNumber: 'Unit 2',
    classTitle: '8th Standard',
    standardNumber: 8,
    subjectName: 'Social Science - Geography',
    topics: [
      'Rocks and Soils: Igneous, Sedimentary, Metamorphic',
      'Weather and Climate: Planetary and Seasonal Winds',
      'Hydrologic Cycle: Evaporation, Condensation, Precipitation',
      'Migration and Urbanisation in India',
      'Hazards: Man-Made and Environmental Disasters',
      'Industries: Factors of Location & Industrial Regions',
    ],
    lessons: [
      {
        id: 'gs-2-8-l1',
        lessonNumber: '2.1',
        term: 'Term 1',
        title: 'Rocks and Soils of India',
        description: 'Rock cycle, soil formation factors, soil horizons and soil conservation.',
        status: 'Available',
        keyConcepts: ['Primary Igneous Rocks (Granite, Basalt)', 'Sedimentary Stratification (Sandstone, Limestone)', 'Metamorphic Rocks (Marble, Slate)', 'Black Regur Soil'],
        studyNotes: [
          'Igneous rocks are primary rocks formed by cooling of molten magma (intrusive granite, extrusive basalt of Deccan Traps).',
          'Black soil (Regur) is derived from basaltic lava weathering, rich in clay and moisture retentive, ideal for cotton cultivation.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-8-1',
            question: 'Which soil type in India is famously known as "Regur Soil" and is best suited for cotton cultivation?',
            options: ['Alluvial Soil', 'Black Soil', 'Red Soil', 'Laterite Soil'],
            correctAnswer: 1,
            explanation: 'Black cotton soil (Regur) formed from Deccan lava rocks is rich in iron, lime, and clay, ideal for cotton.',
          },
        ],
      },
      {
        id: 'gs-2-8-l2',
        lessonNumber: '2.2',
        term: 'Term 1',
        title: 'Weather, Climate, and Wind Systems',
        description: 'Planetary winds, seasonal winds, local winds and humidity measurements.',
        status: 'Available',
        keyConcepts: ['Trade Winds, Westerlies, Polar Easterlies', 'Coriolis Force (Ferrel Law)', 'Monsoon as Seasonal Reversal', 'Local Winds (Loo, Mango Showers)'],
        studyNotes: [
          'Ferrel’s Law: Moving winds defect right in the Northern Hemisphere and left in the Southern Hemisphere due to Earth rotation (Coriolis effect).',
          'Monsoon is derived from the Arabic word "Mawsim" meaning season, characterized by rhythmic seasonal wind reversal.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-8-2',
            question: 'The term "Monsoon" is derived from the Arabic word "Mawsim", which literally translates to:',
            options: ['Ocean currents', 'Season', 'Rainstorm', 'Cloud cover'],
            correctAnswer: 1,
            explanation: 'Monsoon originates from the Arabic word "Mawsim", meaning seasonal rhythmic wind reversal.',
          },
        ],
      },
      {
        id: 'gs-2-8-l3',
        lessonNumber: '2.3',
        term: 'Term 2',
        title: 'Hydrologic Cycle and Precipitation Types',
        description: 'Infiltration, runoff, groundwater table, rain gauges and rainfall distribution.',
        status: 'Available',
        keyConcepts: ['Evaporation, Transpiration, Condensation', 'Relief / Orographic Rainfall', 'Convectional Rainfall (4 O\'clock Rain)', 'Cyclonic Precipitation'],
        studyNotes: [
          'Orographic rainfall occurs when moisture-laden winds strike mountain barriers (Western Ghats windward slope gets heavy rain; leeward Deccan is rain-shadow).',
          'Equatorial regions experience daily afternoon convectional rainfall termed "4 o\'clock rain".',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-8-3',
            question: 'Why does the western slope of the Western Ghats receive heavy rainfall while the Deccan Plateau remains dry?',
            options: ['Convectional rainfall effect', 'Orographic rainfall on windward slope and rain-shadow on leeward slope', 'Cyclonic depression effect', 'Inversion of temperature'],
            correctAnswer: 1,
            explanation: 'Moist Southwest monsoon winds rise against the Western Ghats causing heavy orographic rain on the windward slope, leaving the leeward side in rain shadow.',
          },
        ],
      },
      {
        id: 'gs-2-8-l4',
        lessonNumber: '2.4',
        term: 'Term 3',
        title: 'Migration and Urbanisation in India',
        description: 'Push and pull factors, rural-to-urban trends, smart cities and urban challenges.',
        status: 'Available',
        keyConcepts: ['Push Factors (Drought, Unemployment)', 'Pull Factors (Jobs, Higher Education)', 'Census Urban Criteria', 'Smart Cities Mission'],
        studyNotes: [
          'Migration causes are categorized into rural push factors (unemployment, poverty, crop failure) and urban pull factors (employment, healthcare, education).',
          'Tamil Nadu is one of the most urbanized large states in India, with over 48% of its population living in urban municipal areas (Census 2011).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-8-4',
            question: 'According to the 2011 Census, which large Indian state recorded the highest percentage of urbanized population (over 48%)?',
            options: ['Uttar Pradesh', 'Tamil Nadu', 'Bihar', 'Rajasthan'],
            correctAnswer: 1,
            explanation: 'Tamil Nadu recorded an urbanization level of 48.4% in the 2011 Census, ranking among India’s most urbanized major states.',
          },
        ],
      },
      {
        id: 'gs-2-8-l5',
        lessonNumber: '2.5',
        term: 'Term 3',
        title: 'Hazards and Disaster Mitigation',
        description: 'Geological, meteorological and biological hazards, emergency prevention and response.',
        status: 'Available',
        keyConcepts: ['Tectonic Earthquakes', 'Tropical Cyclones in Bay of Bengal', 'Tsunami Early Warning (INCOIS, Hyderabad)', 'Industrial Chemical Hazards (Bhopal)'],
        studyNotes: [
          'Indian National Centre for Ocean Information Services (INCOIS) in Hyderabad operates the Indian Tsunami Early Warning System set up after the 2004 Indian Ocean Tsunami.',
          'Bhopal Gas Tragedy (December 1984) caused by toxic Methyl Isocyanate (MIC) gas release is history’s worst industrial disaster.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-8-5',
            question: 'The Indian Tsunami Early Warning Centre (ITEWC) is headquartered at which national scientific institution?',
            options: ['IMD, New Delhi', 'INCOIS, Hyderabad', 'ISRO, Bengaluru', 'NIOT, Chennai'],
            correctAnswer: 1,
            explanation: 'INCOIS (Indian National Centre for Ocean Information Services) in Hyderabad operates India’s 24/7 Tsunami Early Warning System.',
          },
        ],
      },
      {
        id: 'gs-2-8-l6',
        lessonNumber: '2.6',
        term: 'Term 3',
        title: 'Industries: Classification and Industrial Belts',
        description: 'Agro-based, mineral-based, forest-based industries, Chota Nagpur and southern industrial hubs.',
        status: 'Available',
        keyConcepts: ['Raw Material Classification', 'Weber Industrial Location Theory', 'Chota Nagpur Mineral Belt (Ruhr of India)', 'Detroit of South Asia (Chennai)'],
        studyNotes: [
          'Chota Nagpur Plateau is known as the "Ruhr of India" due to rich deposits of iron ore, coal, manganese, and bauxite.',
          'Chennai is called the "Detroit of South Asia" for its major automotive and component manufacturing hubs.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-8-6',
            question: 'Which Indian city is globally designated as the "Detroit of South Asia" due to its automobile manufacturing concentration?',
            options: ['Pune', 'Bengaluru', 'Chennai', 'Gurugram'],
            correctAnswer: 2,
            explanation: 'Chennai accounts for a major share of India’s automobile and vehicle components exports, earning the title "Detroit of South Asia".',
          },
        ],
      },
    ],
  },

  // 9th Standard - Unit 2
  'general-studies-2-9': {
    subjectId: 'general-studies',
    unitId: 2,
    classId: 9,
    subjectTitle: 'General Studies',
    unitTitle: 'Geography of India',
    unitNumber: 'Unit 2',
    classTitle: '9th Standard',
    standardNumber: 9,
    subjectName: 'Social Science - Geography',
    topics: [
      'Lithosphere: Endogenic and Exogenic Processes',
      'Atmosphere: Composition, Layers, Insolation, Weather Systems',
      'Hydrosphere: Ocean Currents, Tides, Marine Resources',
      'Biosphere: Ecosystems, Biomes, Biodiversity Hotspots',
      'Man and Environment: Anthropogenic Impact & Conservation',
      'Disaster Management: Practical Response & Preparedness',
    ],
    lessons: [
      {
        id: 'gs-2-9-l1',
        lessonNumber: '2.1',
        term: 'Term 1',
        title: 'Lithosphere: Endogenic & Exogenic Dynamics',
        description: 'Continental drift, faulting, folding, volcanic landforms, weathering and mass wasting.',
        status: 'Available',
        keyConcepts: ['Alfred Wegener Continental Drift', 'Fold Mountains (Himalayas)', 'Pacific Ring of Fire', 'Weathering (Chemical & Physical)'],
        studyNotes: [
          'Himalayas are young fold mountains formed by the collision of the Indo-Australian plate with the Eurasian plate.',
          'Pacific Ring of Fire accounts for over 75% of world active volcanoes and 90% of global earthquakes.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-9-1',
            question: 'The Himalayan mountain range was formed as a result of tectonic collision between:',
            options: ['Indo-Australian Plate and Eurasian Plate', 'African Plate and Eurasian Plate', 'Pacific Plate and North American Plate', 'Arabian Plate and Indian Plate'],
            correctAnswer: 0,
            explanation: 'Convergent tectonic collision between the northward-moving Indo-Australian plate and Eurasian plate uplifted the Tethys geosyncline into the Himalayas.',
          },
        ],
      },
      {
        id: 'gs-2-9-l2',
        lessonNumber: '2.2',
        term: 'Term 2',
        title: 'Atmosphere: Structure and Weather Systems',
        description: 'Troposphere to Exosphere, atmospheric pressure belts, cyclones and anticyclones.',
        status: 'Available',
        keyConcepts: ['Troposphere (Weather Layer)', 'Stratosphere (Ozone Layer & Jet Flying)', 'Ionosphere (Radio Waves)', 'Tropical Cyclones'],
        studyNotes: [
          'Troposphere contains 75% of atmospheric mass and all weather phenomena; temperature decreases with altitude at normal lapse rate (6.5°C per km).',
          'Stratosphere contains the protective ozone layer absorbing harmful solar UV radiation; jet aircraft fly here to avoid turbulent weather.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-9-2',
            question: 'In which atmospheric layer is the protective Ozone Layer (O3) situated that shields Earth from solar ultraviolet radiation?',
            options: ['Troposphere', 'Stratosphere', 'Mesosphere', 'Thermosphere'],
            correctAnswer: 1,
            explanation: 'The stratospheric ozone layer located between 15 km and 35 km altitude absorbs short-wavelength solar UV-B rays.',
          },
        ],
      },
      {
        id: 'gs-2-9-l3',
        lessonNumber: '2.3',
        term: 'Term 2',
        title: 'Hydrosphere and Ocean Currents',
        description: 'Warm and cold ocean currents, spring and neap tides, marine ecosystem.',
        status: 'Available',
        keyConcepts: ['Spring Tides (Full & New Moon Syzygy)', 'Neap Tides (Quadrature)', 'Gulf Stream & Kuroshio Currents', 'Fishing Grounds at Confluence'],
        studyNotes: [
          'Spring tides with maximum tidal range occur during full moon and new moon when Sun, Moon, and Earth align in a straight line (Syzygy).',
          'Meeting zones of warm and cold ocean currents (e.g. Gulf Stream and Labrador Current at Grand Banks) create prolific fishing grounds due to nutrient plankton growth.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-9-3',
            question: 'Spring tides characterized by highest high tides and lowest low tides occur on Earth during which lunar phases?',
            options: ['First and Third Quarter Moon', 'New Moon and Full Moon', 'Waning Crescent', 'Waxing Gibbous'],
            correctAnswer: 1,
            explanation: 'During New Moon and Full Moon, the Sun, Moon, and Earth align along a straight line (syzygy), compounding gravitational pull to produce spring tides.',
          },
        ],
      },
      {
        id: 'gs-2-9-l4',
        lessonNumber: '2.4',
        term: 'Term 3',
        title: 'Biosphere: Major Biomes and Hotspots',
        description: 'Tropical rainforests, savannas, tundra, Western Ghats biodiversity hotspot.',
        status: 'Available',
        keyConcepts: ['Tropical Rainforests (Selvas)', 'Savanna Grasslands', 'Norman Myers Biodiversity Hotspots', 'Western Ghats & Eastern Himalayas'],
        studyNotes: [
          'Norman Myers coined the term Biodiversity Hotspot; India has 4 hotspots: Western Ghats, Himalayas, Indo-Burma, and Sundaland (Nicobar).',
          'Western Ghats is recognized as a UNESCO World Heritage site and global biodiversity hotspot sheltering endemic species like the Lion-tailed Macaque and Nilgiri Tahr.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-9-4',
            question: 'Which of the following is an endemic mammal species found exclusively in the Western Ghats montane shola-grassland ecosystems?',
            options: ['Snow Leopard', 'Nilgiri Tahr', 'One-horned Rhinoceros', 'Hangul'],
            correctAnswer: 1,
            explanation: 'Nilgiri Tahr (Nilgiritragus hylocrius) is the state animal of Tamil Nadu, endemic to the high-altitude shola-grasslands of Western Ghats.',
          },
        ],
      },
      {
        id: 'gs-2-9-l5',
        lessonNumber: '2.5',
        term: 'Term 3',
        title: 'Man and Environment: Resource Use & Sustainable Living',
        description: 'Overexploitation of resources, ecological footprint, carbon offsets and conservation.',
        status: 'Available',
        keyConcepts: ['Ecological Footprint', 'Carrying Capacity', 'Sustainable Development Goals (SDGs)', 'Carbon Neutrality'],
        studyNotes: [
          'Brundtland Commission Report (1987) "Our Common Future" defined sustainable development as meeting present needs without compromising future generations.',
          'The United Nations adopted 17 Sustainable Development Goals (SDGs) to be achieved by 2030.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-9-5',
            question: 'The concept of Sustainable Development was officially defined for the first time in 1987 by which international commission report?',
            options: ['Brundtland Commission (Our Common Future)', 'Ramsar Convention', 'Kyoto Protocol', 'Montreal Protocol'],
            correctAnswer: 0,
            explanation: 'The Brundtland Commission report "Our Common Future" in 1987 formulated the internationally accepted definition of sustainable development.',
          },
        ],
      },
      {
        id: 'gs-2-9-l6',
        lessonNumber: '2.6',
        term: 'Term 3',
        title: 'Disaster Management: Institutional Preparedness',
        description: 'Role of NDMA, SDRF, disaster mapping, community awareness and cyclone shelters.',
        status: 'Available',
        keyConcepts: ['Disaster Management Act 2005', 'Prime Minister as NDMA Chairman', 'Chief Minister as SDMA Chairman', 'Emergency Response 112'],
        studyNotes: [
          'Disaster Management Act, 2005 established the National Disaster Management Authority (NDMA) headed ex-officio by the Prime Minister.',
          'State Disaster Management Authorities (SDMA) are chaired by respective State Chief Ministers.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-9-6',
            question: 'Under the Disaster Management Act of 2005, who acts as the ex-officio Chairperson of the National Disaster Management Authority (NDMA)?',
            options: ['Union Minister of Home Affairs', 'Prime Minister of India', 'Cabinet Secretary', 'Chief of Defence Staff'],
            correctAnswer: 1,
            explanation: 'Under Section 3(2) of the Disaster Management Act 2005, the Prime Minister of India is the ex-officio Chairperson of NDMA.',
          },
        ],
      },
    ],
  },

  // 10th Standard - Unit 2
  'general-studies-2-10': {
    subjectId: 'general-studies',
    unitId: 2,
    classId: 10,
    subjectTitle: 'General Studies',
    unitTitle: 'Geography of India',
    unitNumber: 'Unit 2',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'Social Science - Geography of India & Tamil Nadu',
    topics: [
      'India: Location, Relief, and Drainage Systems (Himalayan & Peninsular)',
      'Climate and Natural Vegetation of India: Monsoon Mechanisms, Forests',
      'India - Agriculture, Cropping Seasons, Multipurpose River Projects',
      'India - Resources and Industries: Minerals, Green Energy, Manufacturing',
      'India - Population, Transport, Communication & Trade Logistics',
      'Physical Geography of Tamil Nadu (Western Ghats, River Basins)',
      'Human Geography of Tamil Nadu (Agriculture, Industries, Ports)',
    ],
    lessons: [
      {
        id: 'gs-2-10-l1',
        lessonNumber: '2.1',
        title: 'India: Location, Relief and Drainage',
        description: 'Northern Mountains, Great Northern Plains, Peninsular Plateau, Indian Islands, Himalayan and Peninsular rivers.',
        status: 'Available',
        keyConcepts: ['82°30\' E Standard Meridian (IST)', 'Himalayan Ranges (Himadri, Himachal, Shivaliks)', 'Perennial Himalayan Rivers', 'Peninsular Rivers (Cauvery, Godavari, Krishna)'],
        studyNotes: [
          'India extends from 8°4\' N to 37°6\' N latitude and 68°7\' E to 97°25\' E longitude; Standard Meridian is 82°30\' E passing through Mirzapur (UP), 5 hours 30 minutes ahead of GMT.',
          'Himalayan rivers (Ganga, Indus, Brahmaputra) are snow-fed and perennial; Peninsular rivers (Godavari, Krishna, Cauvery) are rain-fed and seasonal.',
          'Cauvery river originates at Talakaveri in Brahmagiri hills, Karnataka, entering Tamil Nadu at Hogenakkal falls.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-10-1',
            question: 'The Indian Standard Time (IST) meridian passing through Mirzapur near Prayagraj is located at which longitudinal coordinate?',
            options: ['80°00\' E', '82°30\' E', '85°00\' E', '90°00\' E'],
            correctAnswer: 1,
            explanation: 'The 82°30\' E longitude meridian passing through Mirzapur, Uttar Pradesh determines Indian Standard Time (UTC+05:30).',
          },
        ],
      },
      {
        id: 'gs-2-10-l2',
        lessonNumber: '2.2',
        title: 'Climate and Natural Vegetation of India',
        description: 'Factors affecting climate, Southwest and Northeast monsoon, tropical rainforests, deciduous, thorn and mangrove forests.',
        status: 'Available',
        keyConcepts: ['Southwest Monsoon (June - September)', 'Northeast Monsoon (October - December)', 'Tropical Evergreen vs Deciduous', 'Sundarbans Mangrove Ecosystem'],
        studyNotes: [
          'Southwest monsoon delivers over 75% of India’s rainfall; Northeast (retreating) monsoon provides almost half (approx. 48%) of Tamil Nadu’s annual rainfall.',
          'Tropical deciduous (monsoon) forests are the most widespread forest type in India, shedding leaves during dry season (teak, sal, sandalwood).',
          'Sundarbans in West Bengal is the world’s largest mangrove delta formed by the Ganga-Brahmaputra confluence.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-10-2',
            question: 'Which of the following is the most widespread and dominant natural forest type across mainland India?',
            options: ['Tropical Evergreen Rain Forests', 'Tropical Deciduous (Monsoon) Forests', 'Alpine Montane Forests', 'Mangrove Tidal Forests'],
            correctAnswer: 1,
            explanation: 'Tropical deciduous forests (monsoon forests) are the most extensive forest ecosystem in India, flourishing under 70–200 cm annual rainfall.',
          },
        ],
      },
      {
        id: 'gs-2-10-l3',
        lessonNumber: '2.3',
        title: 'India: Agriculture, Food Crops & Commercial Crops',
        description: 'Rice, wheat, sugarcane, cotton, tea, coffee, Green Revolution and agricultural challenges.',
        status: 'Available',
        keyConcepts: ['Cropping Seasons (Kharif, Rabi, Zaid)', 'Rice & Wheat Cultivation', 'M.S. Swaminathan (Father of Green Revolution)', 'Major Multipurpose River Dams'],
        studyNotes: [
          'Cropping seasons: Kharif (sown in June/monsoon, harvested autumn - rice, cotton); Rabi (sown in winter Oct-Dec, harvested spring - wheat, mustard); Zaid (summer crops - watermelon, vegetables).',
          'Dr. M.S. Swaminathan pioneered India’s Green Revolution introducing High-Yielding Variety (HYV) dwarf wheat and rice strains.',
          'Bhakra Nangal dam on Sutlej river is India’s highest gravity dam; Hirakud on Mahanadi is the longest dam.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-10-3',
            question: 'Which agricultural cropping season in India is sown in winter months (October–December) and harvested in spring (March–April)?',
            options: ['Kharif season', 'Rabi season', 'Zaid season', 'Aus season'],
            correctAnswer: 1,
            explanation: 'Rabi crops (such as wheat, barley, gram, and mustard) are sown in winter and harvested in spring.',
          },
        ],
      },
      {
        id: 'gs-2-10-l4',
        lessonNumber: '2.4',
        title: 'Minerals, Energy Resources & Industries',
        description: 'Metallic and non-metallic minerals, thermal, hydel, nuclear and wind energy, industrial clusters.',
        status: 'Available',
        keyConcepts: ['Iron Ore Belts (Odisha-Jharkhand)', 'Coal Belts (Jharia, Raniganj)', 'Petroleum (Mumbai High, Digboi)', 'Neyveli Lignite Corporation (NLC)'],
        studyNotes: [
          'Digboi in Assam is India’s oldest operational oil field (drilled in 1889); Mumbai High in Arabian Sea is the largest offshore crude oil producer.',
          'Neyveli in Cuddalore district of Tamil Nadu holds the largest deposits of brown coal (lignite) in India, mined by NLC.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-10-4',
            question: 'Neyveli in Cuddalore district of Tamil Nadu is famous for possessing the largest Indian deposits of:',
            options: ['Anthracite coal', 'Lignite (Brown coal)', 'Bituminous coal', 'Peat'],
            correctAnswer: 1,
            explanation: 'Neyveli holds the vast majority of India’s proven reserves of tertiary lignite (brown coal).',
          },
        ],
      },
      {
        id: 'gs-2-10-l5',
        lessonNumber: '2.5',
        title: 'Population, Transport, Communication and Trade',
        description: 'Demographics, Golden Quadrilateral, railway zones, National Waterways, major sea ports and foreign trade.',
        status: 'Available',
        keyConcepts: ['Golden Quadrilateral (5,846 km)', 'Southern Railway Headquarters (Chennai)', 'Major Sea Ports (Chennai, Ennore, Tuticorin)', 'Demographic Density'],
        studyNotes: [
          'Golden Quadrilateral superhighway connects Delhi, Mumbai, Chennai, and Kolkata spanning 5,846 km.',
          'Tamil Nadu is the only Indian state with 3 major sea ports: Chennai Port, Kamarajar Port (Ennore), and V.O. Chidambaranar Port (Tuticorin).',
          'Southern Railway zone is headquartered at Chennai.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-10-5',
            question: 'Which Indian maritime state has the unique distinction of hosting three major commercial sea ports?',
            options: ['Gujarat', 'Maharashtra', 'Tamil Nadu', 'Andhra Pradesh'],
            correctAnswer: 2,
            explanation: 'Tamil Nadu has 3 major ports: Chennai, Kamarajar (Ennore - India’s only corporatized port), and V.O. Chidambaranar Port (Tuticorin).',
          },
        ],
      },
      {
        id: 'gs-2-10-l6',
        lessonNumber: '2.6',
        title: 'Physical Geography of Tamil Nadu',
        description: 'Western and Eastern Ghats, plateau regions, coastal plains, Cauvery, Vaigai, Thamirabarani rivers.',
        status: 'Available',
        keyConcepts: ['Doddabetta (2,637 m, Nilgiris)', 'Eastern Ghats (Javadhu, Shevaroy, Kolli, Kalrayan)', 'Cauvery River Basin', 'Thamirabarani (Perennial TN River)'],
        studyNotes: [
          'Doddabetta (2,637 m) in the Nilgiri hills is the highest peak in Tamil Nadu where the Western and Eastern Ghats meet.',
          'Thamirabarani is the only perennial river in Tamil Nadu originating in Pothigai hills of Western Ghats.',
          'Cauvery forms the rich granary delta of Thanjavur, known as the "Garden of Southern India".',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-10-6',
            question: 'What is the highest mountain peak in Tamil Nadu, located in the Nilgiris range at an elevation of 2,637 meters?',
            options: ['Anamudi', 'Doddabetta', 'Mukkurthi', 'Vandaravu'],
            correctAnswer: 1,
            explanation: 'Doddabetta (2,637 m) is the highest peak in the Nilgiri district and the state of Tamil Nadu.',
          },
        ],
      },
      {
        id: 'gs-2-10-l7',
        lessonNumber: '2.7',
        title: 'Human Geography of Tamil Nadu',
        description: 'Cropping patterns, tank irrigation, industrial hubs, lignite mining, urban growth and environmental issues.',
        status: 'Available',
        keyConcepts: ['Kuruvai, Thaladi & Samba Cropping', 'Textile Valley (Tiruppur, Coimbatore, Erode)', 'Salem Steel Plant', 'Leather Clusters (Vellore, Ambur)'],
        studyNotes: [
          'Tiruppur is known as the "Knitwear Capital of India"; Coimbatore is the "Manchester of South India".',
          'Traditional paddy cropping seasons in the Cauvery delta: Kuruvai (short duration, June-Sept), Samba (medium/long, Aug-Jan), and Thaladi (Oct-Feb).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-10-7',
            question: 'Which city in western Tamil Nadu is renowned as the "Knitwear Capital of India" accounting for major textile cotton knit exports?',
            options: ['Coimbatore', 'Tiruppur', 'Karur', 'Erode'],
            correctAnswer: 1,
            explanation: 'Tiruppur is recognized as the Knitwear Capital of India, contributing vastly to India’s textile exports.',
          },
        ],
      },
    ],
  },

  // 11th Standard - Unit 2
  'general-studies-2-11': {
    subjectId: 'general-studies',
    unitId: 2,
    classId: 11,
    subjectTitle: 'General Studies',
    unitTitle: 'Geography of India',
    unitNumber: 'Unit 2',
    classTitle: '11th Standard',
    standardNumber: 11,
    subjectName: 'Geography (Higher Secondary)',
    topics: [
      'Fundamentals of Physical Geography',
      'Earth Movements: Plate Tectonics, Volcanism, Earthquakes',
      'Climatology: Atmospheric Circulation, Monsoons, Jet Streams',
      'Oceanography: Ocean Floor, Salinity, Currents',
      'Biogeography & Natural Hazards of India',
    ],
    lessons: [
      {
        id: 'gs-2-11-l1',
        lessonNumber: '2.1',
        title: 'Fundamentals of Physical Geography & Earth Movements',
        description: 'Origin of Earth, internal constitution, continental drift, plate tectonics, seismic zones in India.',
        status: 'Available',
        keyConcepts: ['Lithospheric Plate Boundaries (Divergent, Convergent, Transform)', 'Seismic Zoning Map of India (Zone II to V)', 'Wadati-Benioff Subduction Zone', 'Geomorphological Cycles'],
        studyNotes: [
          'India is divided into 4 seismic zones (Zone II, III, IV, and V); Zone V (very high risk) covers Kashmir, Western Himalayas, Northeast India, and Rann of Kutch.',
          'Plate boundaries: Divergent (constructive ridges like Mid-Atlantic Ridge); Convergent (destructive subduction/folding); Transform (San Andreas fault).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-11-1',
            question: 'According to the Bureau of Indian Standards (BIS) seismic hazard map, which zone represents the highest seismicity risk in India?',
            options: ['Zone I', 'Zone II', 'Zone IV', 'Zone V'],
            correctAnswer: 3,
            explanation: 'Seismic Zone V is the highest risk zone in India, encompassing the Himalayas, Northeast India, and Kutch.',
          },
        ],
      },
      {
        id: 'gs-2-11-l2',
        lessonNumber: '2.2',
        title: 'Climatology: Insolation, Air Masses & Jet Streams',
        description: 'Heat budget, planetary wind systems, origin of Indian monsoon, El Niño, La Niña and IOD.',
        status: 'Available',
        keyConcepts: ['Tropical Easterly Jet & Subtropical Westerly Jet', 'Tibetan Heating Mechanism', 'El Niño-Southern Oscillation (ENSO)', 'Indian Ocean Dipole (IOD)'],
        studyNotes: [
          'Intense summer heating of the Tibetan Plateau generates a strong high-altitude Tropical Easterly Jet stream that reinforces the Indian Southwest monsoon.',
          'El Niño (warming of eastern tropical Pacific waters) generally suppresses Indian monsoon rainfall; Positive Indian Ocean Dipole (IOD) enhances monsoon showers.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-11-2',
            question: 'Which periodic oceanic-atmospheric phenomenon in the eastern equatorial Pacific Ocean is traditionally associated with weak Indian monsoon rainfall and drought?',
            options: ['La Niña', 'El Niño', 'Negative IOD', 'North Atlantic Oscillation'],
            correctAnswer: 1,
            explanation: 'El Niño disrupts Walker circulation and warming in the eastern Pacific, historically correlating with reduced monsoon precipitation over India.',
          },
        ],
      },
      {
        id: 'gs-2-11-l3',
        lessonNumber: '2.3',
        title: 'Oceanography: Ocean Topography & Marine Currents',
        description: 'Continental shelf, abyssal plains, salinity factors, Indian Ocean circulation, coral reef conservation.',
        status: 'Available',
        keyConcepts: ['Continental Shelf & Petroleum Reservoirs', 'Mid-Oceanic Ridges', 'Gulf of Mannar Biosphere Reserve (Coral Reefs)', 'Ocean Salinity (Average 35 PSU)'],
        studyNotes: [
          'Continental shelves are shallow (depth < 200 m) margins of continents rich in marine life and offshore petroleum hydrocarbons (e.g. Mumbai High).',
          'Gulf of Mannar in Tamil Nadu is India’s first marine biosphere reserve, protecting coral reefs, seagrass beds, and the endangered Dugong (sea cow).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-11-3',
            question: 'The Gulf of Mannar Biosphere Reserve off the coast of Tamil Nadu is famous for conserving which endangered marine herbivore mammal?',
            options: ['Blue Whale', 'Dugong (Sea Cow)', 'Ganges River Dolphin', 'Olive Ridley Turtle'],
            correctAnswer: 1,
            explanation: 'Gulf of Mannar and Palk Bay shelter India’s primary population of Dugong (Dugong dugon), the endangered marine herbivorous mammal.',
          },
        ],
      },
      {
        id: 'gs-2-11-l4',
        lessonNumber: '2.4',
        title: 'Biogeography: Soil Horizons and Natural Vegetation',
        description: 'Soil genesis, USDA soil classification, forest biomes of India, ecological succession.',
        status: 'Available',
        keyConcepts: ['Soil Horizons (O, A, B, C, R)', 'Laterite Soil Formation (Leaching)', 'Forest Conservation Act 1980', 'Ramsar Wetland Sites in Tamil Nadu'],
        studyNotes: [
          'Laterite soils develop in tropical regions with high temperature and heavy alternating rainfall through intense silica leaching, leaving iron and aluminium oxides.',
          'Tamil Nadu holds the highest number of designated Ramsar wetland sites in India (including Point Calimere, Vedanthangal, Pichavaram).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-11-4',
            question: 'Which state in India possesses the largest number of officially designated Ramsar Wetlands of International Importance?',
            options: ['Kerala', 'Uttar Pradesh', 'Tamil Nadu', 'West Bengal'],
            correctAnswer: 2,
            explanation: 'Tamil Nadu holds the highest count of Ramsar sites in India (with over 16 designated wetlands).',
          },
        ],
      },
      {
        id: 'gs-2-11-l5',
        lessonNumber: '2.5',
        title: 'Natural Hazards & Disaster Management in India',
        description: 'Flood-prone zones, cyclone tracks of Bay of Bengal, drought-prone districts, NDMA protocols.',
        status: 'Available',
        keyConcepts: ['Tropical Cyclone Vulnerability', 'Flood Zoning (Brahmaputra & Gangetic Plains)', 'Drought Prone Areas Programme (DPAP)', 'Sendai Framework (2015-2030)'],
        studyNotes: [
          'Bay of Bengal generates roughly four times more cyclones than the Arabian Sea due to higher sea surface temperatures and enclosed basin morphology.',
          'Sendai Framework for Disaster Risk Reduction (2015–2030) guides global and Indian disaster resilience planning.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-11-5',
            question: 'Why does the Bay of Bengal witness significantly higher frequency of severe tropical cyclones compared to the Arabian Sea?',
            options: ['Higher sea surface temperature and influx of warm fresh river waters', 'Absence of Coriolis force', 'Shallower oceanic depth', 'High atmospheric pressure dominance'],
            correctAnswer: 0,
            explanation: 'The Bay of Bengal has higher sea surface temperatures (>28°C) and substantial freshwater runoff from large rivers that maintains a stratified warm surface layer ideal for cyclogenesis.',
          },
        ],
      },
    ],
  },

  // 12th Standard - Unit 2
  'general-studies-2-12': {
    subjectId: 'general-studies',
    unitId: 2,
    classId: 12,
    subjectTitle: 'General Studies',
    unitTitle: 'Geography of India',
    unitNumber: 'Unit 2',
    classTitle: '12th Standard',
    standardNumber: 12,
    subjectName: 'Geography (Higher Secondary)',
    topics: [
      'Human Geography: Population Dynamics & Density',
      'Human Settlements: Rural vs Urban Patterns',
      'Economic Geography: Primary, Secondary & Tertiary Sectors',
      'Sustainable Resource Management & Green Energy in India',
      'Geographical Landmarks, GIS & Remote Sensing',
    ],
    lessons: [
      {
        id: 'gs-2-12-l1',
        lessonNumber: '2.1',
        title: 'Population Geography: Distribution, Density & Growth',
        description: 'Demographic transition model, census of India trends, gender ratio, age structure, tribal demography.',
        status: 'Available',
        keyConcepts: ['Demographic Transition Model (Stage 3 in India)', 'Sex Ratio Trends (Census 2011: 943)', 'Literacy Rates (Kerala & Tamil Nadu)', 'Scheduled Tribes Demography'],
        studyNotes: [
          'According to Census 2011, India’s population density was 382 persons per km²; sex ratio stood at 943 females per 1000 males.',
          'India is currently in the third stage of the demographic transition model characterized by declining birth rates and death rates with high working-age demographic dividend.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-12-1',
            question: 'What was the overall national sex ratio of India recorded during the 2011 Census (females per 1000 males)?',
            options: ['933', '940', '943', '950'],
            correctAnswer: 2,
            explanation: 'According to Census 2011, the sex ratio of India was 943 females per 1000 males.',
          },
        ],
      },
      {
        id: 'gs-2-12-l2',
        lessonNumber: '2.2',
        title: 'Human Settlements: Urban Systems & Conurbations',
        description: 'Morphology of Indian cities, metropolitan clusters, smart city mission, slums and urban infrastructure.',
        status: 'Available',
        keyConcepts: ['Primate City Concept', 'Megalopolis & Conurbations', 'Smart Cities Mission', 'AMRUT & Swachh Bharat Urban'],
        studyNotes: [
          'Census classifies a settlement as urban if it has a minimum population of 5,000, density of at least 400 persons/km², and over 75% of male main workforce in non-agricultural pursuits.',
          'India has over 53 metropolitan cities with a population exceeding 1 million (Census 2011).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-12-2',
            question: 'According to the Census of India, an urban statutory town requires what minimum percentage of male working population to be engaged in non-agricultural pursuits?',
            options: ['50%', '60%', '75%', '90%'],
            correctAnswer: 2,
            explanation: 'Census definition requires at least 75% of the male working population to be employed in non-agricultural activities.',
          },
        ],
      },
      {
        id: 'gs-2-12-l3',
        lessonNumber: '2.3',
        title: 'Resource Distribution & Green Energy Transition',
        description: 'Renewable energy corridors, solar parks (Bhadla, Kamuthi), offshore wind, national hydrogen mission.',
        status: 'Available',
        keyConcepts: ['National Solar Mission (500 GW Target by 2030)', 'Bhadla Solar Park (Rajasthan, 2245 MW)', 'National Green Hydrogen Mission', 'Nuclear Capacity Expansion'],
        studyNotes: [
          'India committed at COP26 (Panchamrit) to achieve 500 GW non-fossil energy capacity and 50% renewable energy share by 2030, targeting net zero emissions by 2070.',
          'Bhadla Solar Park in Rajasthan is one of the world’s largest solar photovoltaic parks.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-12-3',
            question: 'Under the Panchamrit climate commitments announced at COP26, India pledged to achieve Net-Zero carbon emissions by which target year?',
            options: ['2047', '2050', '2060', '2070'],
            correctAnswer: 3,
            explanation: 'India committed at COP26 in Glasgow to reach Net Zero greenhouse gas emissions by 2070.',
          },
        ],
      },
      {
        id: 'gs-2-12-l4',
        lessonNumber: '2.4',
        title: 'Transport, Communication and International Trade',
        description: 'Multi-modal logistics parks, Bharatmala, Sagarmala, inland waterways, balance of trade.',
        status: 'Available',
        keyConcepts: ['Bharatmala Pariyojana (Highways)', 'Sagarmala Programme (Port-led Industrialization)', 'National Waterways Act 2016', 'Dedicated Freight Corridors (DFC)'],
        studyNotes: [
          'Bharatmala Pariyojana focuses on developing economic corridors, border roads, and coastal expressways.',
          'Sagarmala promotes port modernization, port connectivity, and coastal community development.',
          'National Waterway 1 (NW-1) spans the Ganga river from Prayagraj to Haldia (1,620 km).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-12-4',
            question: 'National Waterway 1 (NW-1), the longest operational inland waterway in India, operates along which river system?',
            options: ['Brahmaputra River', 'Ganga-Bhagirathi-Hooghly River System', 'Godavari-Krishna River System', 'West Coast Canal'],
            correctAnswer: 1,
            explanation: 'National Waterway 1 runs along the Ganga-Bhagirathi-Hooghly river system between Prayagraj and Haldia covering 1,620 km.',
          },
        ],
      },
      {
        id: 'gs-2-12-l5',
        lessonNumber: '2.5',
        title: 'Sustainable Development, Geo-informatics & Remote Sensing',
        description: 'ISRO satellites (Cartosat, Oceansat), GIS mapping, environmental impact assessment (EIA).',
        status: 'Available',
        keyConcepts: ['Indian Remote Sensing (IRS) Satellites', 'Bhuvan Geoportal (ISRO)', 'Geographic Information System (GIS)', 'Environmental Impact Assessment (EIA)'],
        studyNotes: [
          'ISRO’s IRS constellation (Cartosat, Oceansat, RISAT, Resourcesat) provides multi-spectral satellite imagery for agriculture, forestry, water resources, and disaster mapping.',
          'Bhuvan is ISRO’s indigenous web-based 3D GIS platform providing satellite imagery and thematic spatial maps.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-geo-12-5',
            question: 'Which web-based indigenous satellite imagery and 3D GIS geoportal was developed by the Indian Space Research Organisation (ISRO)?',
            options: ['Bhoomi', 'Bhuvan', 'Meghraj', 'Disha'],
            correctAnswer: 1,
            explanation: 'Bhuvan is ISRO’s Indian national geoportal providing free access to multi-sensor satellite imagery and spatial data.',
          },
        ],
      },
    ],
  },

  // =========================================================================
  // UNITS 3 TO 6 & LANGUAGE REGISTRIES (100% Comprehensive Mapping)
  // =========================================================================
  ...group2Unit3Registry,
  ...group2Unit4Registry,
  ...group2Unit5Registry,
  ...group2Unit6Registry,
  ...group2LanguageRegistry,
  ...group2TamilRegistry,
  ...group2EnglishRegistry,
}

export const getGroup2UnitClassData = (
  subjectId: string,
  unitId: number,
  classId: number
): Group2UnitClassData => {
  const directKey = `${subjectId}-${unitId}-${classId}`
  if (group2ClassRegistry[directKey]) {
    return group2ClassRegistry[directKey]
  }

  const altKey = `general-studies-${unitId}-${classId}`
  if (group2ClassRegistry[altKey]) {
    return group2ClassRegistry[altKey]
  }

  // Generative fallback for all other valid combinations
  const classObj = standardClasses.find((c) => c.id === classId) || standardClasses[0]
  return {
    subjectId,
    unitId,
    classId,
    subjectTitle:
      subjectId === 'general-studies'
        ? 'General Studies'
        : subjectId === 'aptitude'
        ? 'Aptitude and Mental Ability'
        : subjectId === 'general-english'
        ? 'General English'
        : 'General Tamil',
    unitTitle: `Unit ${unitId}`,
    unitNumber: `Unit ${unitId}`,
    classTitle: classObj.label,
    standardNumber: classId,
    subjectName: 'Samacheer Kalvi Textbook Mapping',
    topics: [
      `${classObj.label} Curriculum Scope for Unit ${unitId}`,
      'Prescribed Chapter Readings from SCERT Tamil Nadu Textbooks',
      'School Textbook Terms & Revision Exercises',
      'Previous Year Questions Linked to this Standard',
    ],
    lessons: [
      {
        id: `${subjectId}-${unitId}-${classId}-l1`,
        lessonNumber: '1.1',
        term: 'Term 1',
        title: `${classObj.label} Core Topic Mastery for Unit ${unitId}`,
        description: `Official school textbook alignment for ${classObj.label} addressing Group 2 & 2A syllabus requirements.`,
        status: 'Available',
        practiceMCQs: [
          {
            id: `mcq-${subjectId}-${unitId}-${classId}-1`,
            question: `Which fundamental principle is highlighted in the ${classObj.label} SCERT curriculum for this unit?`,
            options: ['Conceptual Understanding', 'Direct Memorization', 'Historical Approximation', 'Experimental Deviation'],
            correctAnswer: 0,
            explanation: 'TNPSC questions emphasize conceptual understanding from Tamil Nadu SCERT school textbooks.',
          },
        ],
      },
    ],
  }
}
