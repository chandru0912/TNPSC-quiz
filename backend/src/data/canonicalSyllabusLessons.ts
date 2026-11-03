/**
 * canonicalSyllabusLessons.ts
 *
 * Authoritative Canonical Syllabus Lessons Dataset for TNPSC Study Hub.
 * Covers all TNPSC Subjects (General Studies, Aptitude, General Tamil, General English),
 * Standards 6th through 12th, Units 1 through 7, and Terms (Term 1, Term 2, Term 3, Full Year).
 */

export interface CanonicalLesson {
  subjectId: string;
  unitId: number;
  standard: number;
  lessonId: string;
  lessonNumber: string;
  title: string;
  term: string;
  volume?: string;
  mappedSubject?: string;
}

export const CANONICAL_SYLLABUS_LESSONS: CanonicalLesson[] = [
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 6,
    "lessonId": "1-6-l1",
    "lessonNumber": "1.1",
    "title": "Measurements and SI Units",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 6,
    "lessonId": "1-6-l2",
    "lessonNumber": "1.2",
    "title": "Forces and Motion",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 6,
    "lessonId": "1-6-l3",
    "lessonNumber": "1.3",
    "title": "Matter Around Us",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 6,
    "lessonId": "1-6-l4",
    "lessonNumber": "1.4",
    "title": "The Living World of Plants",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 6,
    "lessonId": "1-6-l5",
    "lessonNumber": "1.5",
    "title": "Living World of Animals",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 6,
    "lessonId": "1-6-l6",
    "lessonNumber": "1.6",
    "title": "Health and Hygiene",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 6,
    "lessonId": "1-6-l7",
    "lessonNumber": "1.7",
    "title": "Heat and Temperature",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 6,
    "lessonId": "1-6-l8",
    "lessonNumber": "1.8",
    "title": "Electricity and Circuits",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 6,
    "lessonId": "1-6-l9",
    "lessonNumber": "1.9",
    "title": "Changes Around Us",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 6,
    "lessonId": "1-6-l10",
    "lessonNumber": "1.10",
    "title": "Human Organ Systems",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 6,
    "lessonId": "1-6-l11",
    "lessonNumber": "1.11",
    "title": "Magnetism and Magnetic Materials",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 6,
    "lessonId": "1-6-l12",
    "lessonNumber": "1.12",
    "title": "Water & Freshwater Ecosystems",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 6,
    "lessonId": "1-6-l13",
    "lessonNumber": "1.13",
    "title": "Chemistry in Everyday Life",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 6,
    "lessonId": "1-6-l14",
    "lessonNumber": "1.14",
    "title": "Our Environment & Pollution",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 7,
    "lessonId": "1-7-l1",
    "lessonNumber": "1.1",
    "title": "Measurement and Area Calculation",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 7,
    "lessonId": "1-7-l2",
    "lessonNumber": "1.2",
    "title": "Motion: Velocity and Acceleration",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 7,
    "lessonId": "1-7-l3",
    "lessonNumber": "1.3",
    "title": "Matter in Our Surroundings & Atomic Structure",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 7,
    "lessonId": "1-7-l4",
    "lessonNumber": "1.4",
    "title": "Reproduction and Modification in Plants",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 7,
    "lessonId": "1-7-l5",
    "lessonNumber": "1.5",
    "title": "Health and Hygiene",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 7,
    "lessonId": "1-7-l6",
    "lessonNumber": "1.6",
    "title": "Heat Transfer: Conduction, Convection & Radiation",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 7,
    "lessonId": "1-7-l7",
    "lessonNumber": "1.7",
    "title": "Electricity: Circuit Symbols and Heating Effects",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 7,
    "lessonId": "1-7-l8",
    "lessonNumber": "1.8",
    "title": "Changes Around Us: Periodic & Chemical Reactions",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 7,
    "lessonId": "1-7-l9",
    "lessonNumber": "1.9",
    "title": "Cell Biology: Ultrastructure of Plant & Animal Cells",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 7,
    "lessonId": "1-7-l10",
    "lessonNumber": "1.10",
    "title": "Light: Spherical Mirrors, Dispersion & Spectrum",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 7,
    "lessonId": "1-7-l11",
    "lessonNumber": "1.11",
    "title": "Universe and Space: Solar System & Satellites",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 7,
    "lessonId": "1-7-l12",
    "lessonNumber": "1.12",
    "title": "Polymer Chemistry & Daily Life Chemistry",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l1",
    "lessonNumber": "1.1",
    "title": "Measurement: Base Units & Astronomical Units",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l2",
    "lessonNumber": "1.2",
    "title": "Force and Pressure in Fluids",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l3",
    "lessonNumber": "1.3",
    "title": "Light: Spherical Mirrors and Refraction",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l4",
    "lessonNumber": "1.4",
    "title": "Matter Around Us: Elements & Compounds",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l5",
    "lessonNumber": "1.5",
    "title": "Changes Around Us: Chemical & Physical",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l6",
    "lessonNumber": "1.6",
    "title": "Microorganisms: Friendly and Harmful Microbes",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l7",
    "lessonNumber": "1.7",
    "title": "Plant Kingdom & Organisation of Life",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l8",
    "lessonNumber": "1.8",
    "title": "Heat: Calorimetry & Change of State",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l9",
    "lessonNumber": "1.9",
    "title": "Electricity: Static Electricity & Chemical Effects",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l10",
    "lessonNumber": "1.10",
    "title": "Air & Applied Chemistry: Petroleum and Fertilizers",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l11",
    "lessonNumber": "1.11",
    "title": "Atomic Structure & Chemical Bonding",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l12",
    "lessonNumber": "1.12",
    "title": "Movements in Animals & Endocrine System",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l13",
    "lessonNumber": "1.13",
    "title": "Sound: Wave Propagation, Pitch & Human Ear",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l14",
    "lessonNumber": "1.14",
    "title": "Magnetism: Magnetic Field & Earth Magnetism",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l15",
    "lessonNumber": "1.15",
    "title": "Universe and Space Science: Rockets & ISRO Missions",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 8,
    "lessonId": "1-8-l16",
    "lessonNumber": "1.16",
    "title": "Acids, Bases, Indicators and Salts",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l1",
    "lessonNumber": "1.1",
    "title": "Measurement: Vernier Caliper & Screw Gauge",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l2",
    "lessonNumber": "1.2",
    "title": "Motion: Graphical Equations and Centripetal Force",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l3",
    "lessonNumber": "1.3",
    "title": "Fluids: Pressure, Buoyancy and Archimedes Principle",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l4",
    "lessonNumber": "1.4",
    "title": "Matter Around Us: Elements, Compounds & Mixtures",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l5",
    "lessonNumber": "1.5",
    "title": "Atomic Structure: Thomson and Rutherford Models",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l6",
    "lessonNumber": "1.6",
    "title": "Plant Physiology: Tropism and Transpiration",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l7",
    "lessonNumber": "1.7",
    "title": "Organisation of Tissues in Plants and Animals",
    "term": "Term 1",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l8",
    "lessonNumber": "1.8",
    "title": "Light: Refraction, Lenses and Total Internal Reflection",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l9",
    "lessonNumber": "1.9",
    "title": "Heat: Thermal Capacity & Latent Heat",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l10",
    "lessonNumber": "1.10",
    "title": "Electric Charge and Electric Current",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l11",
    "lessonNumber": "1.11",
    "title": "Periodic Classification of Elements",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l12",
    "lessonNumber": "1.12",
    "title": "Chemical Bonding: Ionic, Covalent & Coordinate",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l13",
    "lessonNumber": "1.13",
    "title": "Animal Kingdom: Invertebrates & Vertebrates",
    "term": "Term 2",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l14",
    "lessonNumber": "1.14",
    "title": "Sound: Waves, Ultrasound and SONAR",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l15",
    "lessonNumber": "1.15",
    "title": "Magnetism and Electromagnetism",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l16",
    "lessonNumber": "1.16",
    "title": "Acids, Bases, and Salts: Chemical Behavior",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l17",
    "lessonNumber": "1.17",
    "title": "Applied Chemistry: Nanotechnology & Pharmaceuticals",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l18",
    "lessonNumber": "1.18",
    "title": "Nutrition, Health and World of Microbes",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 9,
    "lessonId": "1-9-l19",
    "lessonNumber": "1.19",
    "title": "Environmental Science: Biogeochemical Cycles & Pollution",
    "term": "Term 3",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l1",
    "lessonNumber": "1.1",
    "title": "Laws of Motion and Momentum",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l2",
    "lessonNumber": "1.2",
    "title": "Optics: Lenses, Human Eye and Optical Defects",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l3",
    "lessonNumber": "1.3",
    "title": "Thermal Physics and Ideal Gas Equation",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l4",
    "lessonNumber": "1.4",
    "title": "Electricity: Ohm Law & Domestic Circuits",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l5",
    "lessonNumber": "1.5",
    "title": "Acoustics: Doppler Effect and SONAR",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l6",
    "lessonNumber": "1.6",
    "title": "Nuclear Physics: Radioactivity and Nuclear Power",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l7",
    "lessonNumber": "1.7",
    "title": "Periodic Classification of Elements",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l8",
    "lessonNumber": "1.8",
    "title": "Solutions, Solubility and pH Scale",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l9",
    "lessonNumber": "1.9",
    "title": "Types of Chemical Reactions & Carbon Compounds",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l10",
    "lessonNumber": "1.10",
    "title": "Plant Anatomy and Plant Physiology",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l11",
    "lessonNumber": "1.11",
    "title": "Transportation in Plants & Circulation in Animals",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l12",
    "lessonNumber": "1.12",
    "title": "Nervous System & Hormonal Coordination",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l13",
    "lessonNumber": "1.13",
    "title": "Heredity, DNA and Evolution",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l14",
    "lessonNumber": "1.14",
    "title": "Breeding, Biotechnology & Human Diseases",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 10,
    "lessonId": "1-10-l15",
    "lessonNumber": "1.15",
    "title": "Environmental Management and Green Energy",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 11,
    "lessonId": "1-11-l1",
    "lessonNumber": "1.1",
    "title": "Nature of Physical World and Measurement",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 11,
    "lessonId": "1-11-l2",
    "lessonNumber": "1.2",
    "title": "Kinematics and Laws of Motion",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 11,
    "lessonId": "1-11-l3",
    "lessonNumber": "1.3",
    "title": "Work, Energy, Power and Gravitation",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 11,
    "lessonId": "1-11-l4",
    "lessonNumber": "1.4",
    "title": "Properties of Matter & Fluid Mechanics",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 11,
    "lessonId": "1-11-l5",
    "lessonNumber": "1.5",
    "title": "Thermodynamics & Kinetic Theory",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 11,
    "lessonId": "1-11-l6",
    "lessonNumber": "1.6",
    "title": "Basic Concepts of Chemistry & Stoichiometry",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 11,
    "lessonId": "1-11-l7",
    "lessonNumber": "1.7",
    "title": "Periodic Classification & Chemical Bonding",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 11,
    "lessonId": "1-11-l8",
    "lessonNumber": "1.8",
    "title": "Environmental Chemistry & Hydrocarbons",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 11,
    "lessonId": "1-11-l9",
    "lessonNumber": "1.9",
    "title": "Cell Biology, Biomolecules & Plant Physiology",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 11,
    "lessonId": "1-11-l10",
    "lessonNumber": "1.10",
    "title": "Human Physiology: Digestion, Respiration & Excretion",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 12,
    "lessonId": "1-12-l1",
    "lessonNumber": "1.1",
    "title": "Electrostatics & Current Electricity",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 12,
    "lessonId": "1-12-l2",
    "lessonNumber": "1.2",
    "title": "Magnetism, EMI and Alternating Current",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 12,
    "lessonId": "1-12-l3",
    "lessonNumber": "1.3",
    "title": "Electromagnetic Waves and Optics",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 12,
    "lessonId": "1-12-l4",
    "lessonNumber": "1.4",
    "title": "Dual Nature of Radiation & Nuclear Physics",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 12,
    "lessonId": "1-12-l5",
    "lessonNumber": "1.5",
    "title": "Semiconductor Electronics & Communications",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 12,
    "lessonId": "1-12-l6",
    "lessonNumber": "1.6",
    "title": "Electrochemistry, Metallurgy & Coordination Chemistry",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 12,
    "lessonId": "1-12-l7",
    "lessonNumber": "1.7",
    "title": "Organic Chemistry & Chemistry in Everyday Life",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 12,
    "lessonId": "1-12-l8",
    "lessonNumber": "1.8",
    "title": "Genetics, Molecular Basis of Inheritance",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 12,
    "lessonId": "1-12-l9",
    "lessonNumber": "1.9",
    "title": "Human Health, Immunology & Microbes",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 1,
    "standard": 12,
    "lessonId": "1-12-l10",
    "lessonNumber": "1.10",
    "title": "Biotechnology & Environmental Ecology",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 6,
    "lessonId": "2-6-l1",
    "lessonNumber": "2.1",
    "title": "The Universe and Solar System",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 6,
    "lessonId": "2-6-l2",
    "lessonNumber": "2.2",
    "title": "Land and Oceans",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 6,
    "lessonId": "2-6-l3",
    "lessonNumber": "2.3",
    "title": "Resources: Natural, Human & Man-made",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 6,
    "lessonId": "2-6-l4",
    "lessonNumber": "2.4",
    "title": "Asia and India: Geographical Setting",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 7,
    "lessonId": "2-7-l1",
    "lessonNumber": "2.1",
    "title": "Interior of the Earth and Plate Tectonics",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 7,
    "lessonId": "2-7-l2",
    "lessonNumber": "2.2",
    "title": "Landforms: Fluvial and Eolian Actions",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 7,
    "lessonId": "2-7-l3",
    "lessonNumber": "2.3",
    "title": "Weather and Climate: Elements & Instruments",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 7,
    "lessonId": "2-7-l4",
    "lessonNumber": "2.4",
    "title": "Disaster Management and Natural Hazards",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 8,
    "lessonId": "2-8-l1",
    "lessonNumber": "2.1",
    "title": "Rocks and Soils of India",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 8,
    "lessonId": "2-8-l2",
    "lessonNumber": "2.2",
    "title": "Weather, Climate, and Wind Systems",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 8,
    "lessonId": "2-8-l3",
    "lessonNumber": "2.3",
    "title": "Hydrologic Cycle and Precipitation Types",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 8,
    "lessonId": "2-8-l4",
    "lessonNumber": "2.4",
    "title": "Migration and Urbanisation in India",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 8,
    "lessonId": "2-8-l5",
    "lessonNumber": "2.5",
    "title": "Hazards and Disaster Mitigation",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 8,
    "lessonId": "2-8-l6",
    "lessonNumber": "2.6",
    "title": "Industries: Classification and Industrial Belts",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 9,
    "lessonId": "2-9-l1",
    "lessonNumber": "2.1",
    "title": "Lithosphere: Endogenic & Exogenic Dynamics",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 9,
    "lessonId": "2-9-l2",
    "lessonNumber": "2.2",
    "title": "Atmosphere: Structure and Weather Systems",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 9,
    "lessonId": "2-9-l3",
    "lessonNumber": "2.3",
    "title": "Hydrosphere and Ocean Currents",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 9,
    "lessonId": "2-9-l4",
    "lessonNumber": "2.4",
    "title": "Biosphere: Major Biomes and Hotspots",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 9,
    "lessonId": "2-9-l5",
    "lessonNumber": "2.5",
    "title": "Man and Environment: Resource Use & Sustainable Living",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 9,
    "lessonId": "2-9-l6",
    "lessonNumber": "2.6",
    "title": "Disaster Management: Institutional Preparedness",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 10,
    "lessonId": "2-10-l1",
    "lessonNumber": "2.1",
    "title": "India: Location, Relief and Drainage",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 10,
    "lessonId": "2-10-l2",
    "lessonNumber": "2.2",
    "title": "Climate and Natural Vegetation of India",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 10,
    "lessonId": "2-10-l3",
    "lessonNumber": "2.3",
    "title": "India: Agriculture, Food Crops & Commercial Crops",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 10,
    "lessonId": "2-10-l4",
    "lessonNumber": "2.4",
    "title": "Minerals, Energy Resources & Industries",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 10,
    "lessonId": "2-10-l5",
    "lessonNumber": "2.5",
    "title": "Population, Transport, Communication and Trade",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 10,
    "lessonId": "2-10-l6",
    "lessonNumber": "2.6",
    "title": "Physical Geography of Tamil Nadu",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 10,
    "lessonId": "2-10-l7",
    "lessonNumber": "2.7",
    "title": "Human Geography of Tamil Nadu",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 11,
    "lessonId": "2-11-l1",
    "lessonNumber": "2.1",
    "title": "Fundamentals of Physical Geography & Earth Movements",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 11,
    "lessonId": "2-11-l2",
    "lessonNumber": "2.2",
    "title": "Climatology: Insolation, Air Masses & Jet Streams",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 11,
    "lessonId": "2-11-l3",
    "lessonNumber": "2.3",
    "title": "Oceanography: Ocean Topography & Marine Currents",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 11,
    "lessonId": "2-11-l4",
    "lessonNumber": "2.4",
    "title": "Biogeography: Soil Horizons and Natural Vegetation",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 11,
    "lessonId": "2-11-l5",
    "lessonNumber": "2.5",
    "title": "Natural Hazards & Disaster Management in India",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 12,
    "lessonId": "2-12-l1",
    "lessonNumber": "2.1",
    "title": "Population Geography: Distribution, Density & Growth",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 12,
    "lessonId": "2-12-l2",
    "lessonNumber": "2.2",
    "title": "Human Settlements: Urban Systems & Conurbations",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 12,
    "lessonId": "2-12-l3",
    "lessonNumber": "2.3",
    "title": "Resource Distribution & Green Energy Transition",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 12,
    "lessonId": "2-12-l4",
    "lessonNumber": "2.4",
    "title": "Transport, Communication and International Trade",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 2,
    "standard": 12,
    "lessonId": "2-12-l5",
    "lessonNumber": "2.5",
    "title": "Sustainable Development, Geo-informatics & Remote Sensing",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 6,
    "lessonId": "3-6-l1",
    "lessonNumber": "3.1",
    "title": "Indus Valley Civilization",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 6,
    "lessonId": "3-6-l2",
    "lessonNumber": "3.2",
    "title": "Ancient Cities of Tamilagam",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 6,
    "lessonId": "3-6-l3",
    "lessonNumber": "3.3",
    "title": "Vedic Culture, Jainism & Buddhism",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 6,
    "lessonId": "3-6-l4",
    "lessonNumber": "3.4",
    "title": "From Chiefdoms to Empires: Mauryan Dynasty",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 6,
    "lessonId": "3-6-l5",
    "lessonNumber": "3.5",
    "title": "The Age of Guptas and Vardhanas",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 6,
    "lessonId": "3-6-l6",
    "lessonNumber": "3.6",
    "title": "South Indian Kingdoms: Pallavas and Chalukyas",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 7,
    "lessonId": "3-7-l1",
    "lessonNumber": "3.1",
    "title": "Later Cholas and Pandyas",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 7,
    "lessonId": "3-7-l2",
    "lessonNumber": "3.2",
    "title": "Delhi Sultanate: Dynasty Rule and Reforms",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 7,
    "lessonId": "3-7-l3",
    "lessonNumber": "3.3",
    "title": "Vijayanagar and Bahmani Kingdoms",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 7,
    "lessonId": "3-7-l4",
    "lessonNumber": "3.4",
    "title": "The Mughal Empire: Polity and Culture",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 7,
    "lessonId": "3-7-l5",
    "lessonNumber": "3.5",
    "title": "The Marathas and Peshwas: Rise of Shivaji",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 7,
    "lessonId": "3-7-l6",
    "lessonNumber": "3.6",
    "title": "Bhakti and Sufi Movements",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 8,
    "lessonId": "3-8-l1",
    "lessonNumber": "3.1",
    "title": "Advent of the Europeans in India",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 8,
    "lessonId": "3-8-l2",
    "lessonNumber": "3.2",
    "title": "From Trade to Territory: Expansionist Policies",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 8,
    "lessonId": "3-8-l3",
    "lessonNumber": "3.3",
    "title": "Rural Life and Society: Colonial Land Tenures",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 8,
    "lessonId": "3-8-l4",
    "lessonNumber": "3.4",
    "title": "People Revolt: Poligar Rebellion & 1806 Vellore Mutiny",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 8,
    "lessonId": "3-8-l5",
    "lessonNumber": "3.5",
    "title": "The Great Revolt of 1857",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 8,
    "lessonId": "3-8-l6",
    "lessonNumber": "3.6",
    "title": "Educational and Industrial Development in India",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 8,
    "lessonId": "3-8-l7",
    "lessonNumber": "3.7",
    "title": "Status of Women in India through the Ages",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 9,
    "lessonId": "3-9-l1",
    "lessonNumber": "3.1",
    "title": "Prehistoric India and Early Civilizations",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 9,
    "lessonId": "3-9-l2",
    "lessonNumber": "3.2",
    "title": "Early Tamil Society and Culture",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 9,
    "lessonId": "3-9-l3",
    "lessonNumber": "3.3",
    "title": "State and Society in Medieval Times",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 10,
    "lessonId": "3-10-l1",
    "lessonNumber": "3.1",
    "title": "Socio-Religious Reform Movements in the 19th Century",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 10,
    "lessonId": "3-10-l2",
    "lessonNumber": "3.2",
    "title": "Early Revolts Against British Rule in Tamil Nadu",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 10,
    "lessonId": "3-10-l3",
    "lessonNumber": "3.3",
    "title": "Anti-Colonial Movements and Birth of Nationalism",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 10,
    "lessonId": "3-10-l4",
    "lessonNumber": "3.4",
    "title": "Gandhian Era of Freedom Struggle",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 10,
    "lessonId": "3-10-l5",
    "lessonNumber": "3.5",
    "title": "Freedom Struggle in Tamil Nadu",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 10,
    "lessonId": "3-10-l6",
    "lessonNumber": "3.6",
    "title": "Social Transformation in Tamil Nadu",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 11,
    "lessonId": "3-11-l1",
    "lessonNumber": "3.1",
    "title": "Early India: From Beginnings to Indus Civilisation",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 11,
    "lessonId": "3-11-l2",
    "lessonNumber": "3.2",
    "title": "Vedic Cultures, Rise of Mahajanapadas & Heterodox Sects",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 11,
    "lessonId": "3-11-l3",
    "lessonNumber": "3.3",
    "title": "The Mauryan Empire & Post-Mauryan Kingdoms",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 11,
    "lessonId": "3-11-l4",
    "lessonNumber": "3.4",
    "title": "The Guptas and Harsha Vardhana",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 11,
    "lessonId": "3-11-l5",
    "lessonNumber": "3.5",
    "title": "South Indian Dynasties: Pallavas, Cholas and Pandyas",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 11,
    "lessonId": "3-11-l6",
    "lessonNumber": "3.6",
    "title": "The Delhi Sultanate & Administrative Institutions",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 11,
    "lessonId": "3-11-l7",
    "lessonNumber": "3.7",
    "title": "Vijayanagar and Bahmani Kingdoms: Polity & Arts",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 11,
    "lessonId": "3-11-l8",
    "lessonNumber": "3.8",
    "title": "The Mughal Empire: Administration, Economy & Culture",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 11,
    "lessonId": "3-11-l9",
    "lessonNumber": "3.9",
    "title": "The Marathas, Peshwas & Decline of Central Authority",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 11,
    "lessonId": "3-11-l10",
    "lessonNumber": "3.10",
    "title": "Cultural Syncretism and Bhakti Movement in India",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 12,
    "lessonId": "3-12-l1",
    "lessonNumber": "3.1",
    "title": "Rise of Nationalism in India & Early Congress",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 12,
    "lessonId": "3-12-l2",
    "lessonNumber": "3.2",
    "title": "Extremism & Swadeshi Movement (1905–1911)",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 12,
    "lessonId": "3-12-l3",
    "lessonNumber": "3.3",
    "title": "World War I, Home Rule League & Lucknow Pact",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 12,
    "lessonId": "3-12-l4",
    "lessonNumber": "3.4",
    "title": "Advent of Gandhi: Champaran, Kheda & Non-Cooperation",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 12,
    "lessonId": "3-12-l5",
    "lessonNumber": "3.5",
    "title": "Revolutionary Nationalism: Bhagat Singh & HSRA",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 12,
    "lessonId": "3-12-l6",
    "lessonNumber": "3.6",
    "title": "Civil Disobedience Movement and Round Table Conferences",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 12,
    "lessonId": "3-12-l7",
    "lessonNumber": "3.7",
    "title": "Quit India Movement, Subash Bose & Indian National Army",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 12,
    "lessonId": "3-12-l8",
    "lessonNumber": "3.8",
    "title": "Communalism in Politics, Partition & Independence",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 3,
    "standard": 12,
    "lessonId": "3-12-l9",
    "lessonNumber": "3.9",
    "title": "Reconstruction of Post-Colonial India (1947–1964)",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 6,
    "lessonId": "4-6-l1",
    "lessonNumber": "4.1",
    "title": "Understanding Diversity in India",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 6,
    "lessonId": "4-6-l2",
    "lessonNumber": "4.2",
    "title": "Achieving Equality and Eradication of Discrimination",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 6,
    "lessonId": "4-6-l3",
    "lessonNumber": "4.3",
    "title": "National Symbols of India",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 6,
    "lessonId": "4-6-l4",
    "lessonNumber": "4.4",
    "title": "The Constitution of India: Origin and Features",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 6,
    "lessonId": "4-6-l5",
    "lessonNumber": "4.5",
    "title": "Democracy: Direct and Representative Democracy",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 6,
    "lessonId": "4-6-l6",
    "lessonNumber": "4.6",
    "title": "Local Self Government: Rural and Urban Bodies",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 7,
    "lessonId": "4-7-l1",
    "lessonNumber": "4.1",
    "title": "Equality and Fundamental Freedoms",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 7,
    "lessonId": "4-7-l2",
    "lessonNumber": "4.2",
    "title": "Political Parties: Role and Functions",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 7,
    "lessonId": "4-7-l3",
    "lessonNumber": "4.3",
    "title": "State Government Administration",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 7,
    "lessonId": "4-7-l4",
    "lessonNumber": "4.4",
    "title": "Women Empowerment and Gender Equality",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 7,
    "lessonId": "4-7-l5",
    "lessonNumber": "4.5",
    "title": "Media and Democracy",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 8,
    "lessonId": "4-8-l1",
    "lessonNumber": "4.1",
    "title": "How the State Government Works",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 8,
    "lessonId": "4-8-l2",
    "lessonNumber": "4.2",
    "title": "Citizenship: Rights and Duties",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 8,
    "lessonId": "4-8-l3",
    "lessonNumber": "4.3",
    "title": "Understanding Secularism in India",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 8,
    "lessonId": "4-8-l4",
    "lessonNumber": "4.4",
    "title": "Human Rights and UNO",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 8,
    "lessonId": "4-8-l5",
    "lessonNumber": "4.5",
    "title": "Judiciary: Supreme Court, High Courts & Subordinate Courts",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 9,
    "lessonId": "4-9-l1",
    "lessonNumber": "4.1",
    "title": "Forms of Government and Democratic Institutions",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 9,
    "lessonId": "4-9-l2",
    "lessonNumber": "4.2",
    "title": "Election Commission and Electoral System in India",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 9,
    "lessonId": "4-9-l3",
    "lessonNumber": "4.3",
    "title": "Fundamental Rights and Duties (Part III & IV-A)",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 9,
    "lessonId": "4-9-l4",
    "lessonNumber": "4.4",
    "title": "Local Self Government: 73rd and 74th CAA",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 10,
    "lessonId": "4-10-l1",
    "lessonNumber": "4.1",
    "title": "Indian Constitution: Preamble, Rights & DPSP",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 10,
    "lessonId": "4-10-l2",
    "lessonNumber": "4.2",
    "title": "Central Government: Executive and Parliament",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 10,
    "lessonId": "4-10-l3",
    "lessonNumber": "4.3",
    "title": "State Government Machinery",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 10,
    "lessonId": "4-10-l4",
    "lessonNumber": "4.4",
    "title": "India Foreign Policy & Nuclear Doctrine",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 10,
    "lessonId": "4-10-l5",
    "lessonNumber": "4.5",
    "title": "India International Relations & Neighborhood Policy",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 11,
    "lessonId": "4-11-l1",
    "lessonNumber": "4.1",
    "title": "Basic Concepts of Political Theory: State & Sovereignty",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 11,
    "lessonId": "4-11-l2",
    "lessonNumber": "4.2",
    "title": "Liberty, Equality, Justice & Rights",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 11,
    "lessonId": "4-11-l3",
    "lessonNumber": "4.3",
    "title": "Indian Political Thought: Gandhi, Ambedkar & Periyar",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 11,
    "lessonId": "4-11-l4",
    "lessonNumber": "4.4",
    "title": "Democracy, Political Parties & Pressure Groups",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 11,
    "lessonId": "4-11-l5",
    "lessonNumber": "4.5",
    "title": "Social Justice and Reservation System",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 11,
    "lessonId": "4-11-l6",
    "lessonNumber": "4.6",
    "title": "Local Governance and Grassroots Democracy",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 12,
    "lessonId": "4-12-l1",
    "lessonNumber": "4.1",
    "title": "Constitution of India: Framing & Basic Structure",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 12,
    "lessonId": "4-12-l2",
    "lessonNumber": "4.2",
    "title": "Legislature: Union Parliament & State Assemblies",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 12,
    "lessonId": "4-12-l3",
    "lessonNumber": "4.3",
    "title": "Executive: President, Prime Minister & Governor",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 12,
    "lessonId": "4-12-l4",
    "lessonNumber": "4.4",
    "title": "Indian Judiciary: Judicial Activism & Rule of Law",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 12,
    "lessonId": "4-12-l5",
    "lessonNumber": "4.5",
    "title": "Federalism in India & Centre-State Relations",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 12,
    "lessonId": "4-12-l6",
    "lessonNumber": "4.6",
    "title": "Anti-Corruption Measures: Lokpal, Lokayukta, CVC & CBI",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 4,
    "standard": 12,
    "lessonId": "4-12-l7",
    "lessonNumber": "4.7",
    "title": "Right to Information & Citizen Empowerment",
    "term": "Full Year",
    "mappedSubject": "Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 6,
    "lessonId": "5-6-l1",
    "lessonNumber": "5.1",
    "title": "Economics: An Introduction",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 6,
    "lessonId": "5-6-l2",
    "lessonNumber": "5.2",
    "title": "Economic Sectors in Village and City",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 7,
    "lessonId": "5-7-l1",
    "lessonNumber": "5.1",
    "title": "Production and Factors of Production",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 7,
    "lessonId": "5-7-l2",
    "lessonNumber": "5.2",
    "title": "Tax and its Importance in Development",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 8,
    "lessonId": "5-8-l1",
    "lessonNumber": "5.1",
    "title": "Money, Savings, and Financial Institutions",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 8,
    "lessonId": "5-8-l2",
    "lessonNumber": "5.2",
    "title": "Public and Private Sectors in Development",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 9,
    "lessonId": "5-9-l1",
    "lessonNumber": "5.1",
    "title": "Understanding Development and Human Development Index",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 9,
    "lessonId": "5-9-l2",
    "lessonNumber": "5.2",
    "title": "Employment in India and Tamil Nadu",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 9,
    "lessonId": "5-9-l3",
    "lessonNumber": "5.3",
    "title": "Money, Credit and Self-Help Groups (SHGs)",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 9,
    "lessonId": "5-9-l4",
    "lessonNumber": "5.4",
    "title": "Agriculture in Tamil Nadu: Patterns & Water Issues",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 9,
    "lessonId": "5-9-l5",
    "lessonNumber": "5.5",
    "title": "Migration: Trends and Urbanisation in Tamil Nadu",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 10,
    "lessonId": "5-10-l1",
    "lessonNumber": "5.1",
    "title": "Gross Domestic Product and Sectoral Contributions",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 10,
    "lessonId": "5-10-l2",
    "lessonNumber": "5.2",
    "title": "Globalization, MNCs and Fair Trade Policies",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 10,
    "lessonId": "5-10-l3",
    "lessonNumber": "5.3",
    "title": "Food Security and Universal PDS in Tamil Nadu",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 10,
    "lessonId": "5-10-l4",
    "lessonNumber": "5.4",
    "title": "Government and Taxes: Fiscal Systems & GST",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 10,
    "lessonId": "5-10-l5",
    "lessonNumber": "5.5",
    "title": "Industrial Clusters in Tamil Nadu",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 11,
    "lessonId": "5-11-l1",
    "lessonNumber": "5.1",
    "title": "Indian Economy: Structural Features & Demography",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 11,
    "lessonId": "5-11-l2",
    "lessonNumber": "5.2",
    "title": "Indian Economy Before and After Independence",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 11,
    "lessonId": "5-11-l3",
    "lessonNumber": "5.3",
    "title": "Development Experiences in India: 1991 Reforms",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 11,
    "lessonId": "5-11-l4",
    "lessonNumber": "5.4",
    "title": "Rural Economy: Poverty, Indebtedness & Employment",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 11,
    "lessonId": "5-11-l5",
    "lessonNumber": "5.5",
    "title": "Tamil Nadu Economy: Macro Performance & HDI",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 11,
    "lessonId": "5-11-l6",
    "lessonNumber": "5.6",
    "title": "Welfare Schemes & Social Justice in Tamil Nadu",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 12,
    "lessonId": "5-12-l1",
    "lessonNumber": "5.1",
    "title": "National Income: Measurement & Circular Flow",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 12,
    "lessonId": "5-12-l2",
    "lessonNumber": "5.2",
    "title": "Monetary Economics: Inflation Dynamics & Causes",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 12,
    "lessonId": "5-12-l3",
    "lessonNumber": "5.3",
    "title": "Banking and Central Banking: Reserve Bank of India",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 12,
    "lessonId": "5-12-l4",
    "lessonNumber": "5.4",
    "title": "Fiscal Economics: Budget, Deficits & Taxation",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 12,
    "lessonId": "5-12-l5",
    "lessonNumber": "5.5",
    "title": "Finance Commission and Centre-State Financial Sharing",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 12,
    "lessonId": "5-12-l6",
    "lessonNumber": "5.6",
    "title": "Economics of Development, Planning & NITI Aayog",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 5,
    "standard": 12,
    "lessonId": "5-12-l7",
    "lessonNumber": "5.7",
    "title": "e-Governance & Public Delivery Systems in Tamil Nadu",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 6,
    "lessonId": "6-6-l1",
    "lessonNumber": "6.1",
    "title": "Ancient Ports and Cities of Tamilagam",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 6,
    "lessonId": "6-6-l2",
    "lessonNumber": "6.2",
    "title": "Society and Culture in Ancient Tamizhagam: The Sangam Age",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 6,
    "lessonId": "6-6-l3",
    "lessonNumber": "6.3",
    "title": "Archaeological Excavations in Tamil Nadu",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 7,
    "lessonId": "6-7-l1",
    "lessonNumber": "6.1",
    "title": "Imperial Cholas and Later Pandyas",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 7,
    "lessonId": "6-7-l2",
    "lessonNumber": "6.2",
    "title": "Bhakti Movement in South India",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 7,
    "lessonId": "6-7-l3",
    "lessonNumber": "6.3",
    "title": "Art and Architecture of Tamil Nadu",
    "term": "Term 3",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 8,
    "lessonId": "6-8-l1",
    "lessonNumber": "6.1",
    "title": "Poligars Revolt in Tamil Nadu (1755–1801)",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 8,
    "lessonId": "6-8-l2",
    "lessonNumber": "6.2",
    "title": "Queen Velu Nachiyar of Sivagangai & Kuyili",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 8,
    "lessonId": "6-8-l3",
    "lessonNumber": "6.3",
    "title": "1806 Vellore Sepoy Mutiny",
    "term": "Term 2",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 9,
    "lessonId": "6-9-l1",
    "lessonNumber": "6.1",
    "title": "Early Tamil Society, Epigraphy and Archaeological Discoveries",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 9,
    "lessonId": "6-9-l2",
    "lessonNumber": "6.2",
    "title": "Thirukkural: Secular Philosophy and Everyday Conduct",
    "term": "Term 1",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 10,
    "lessonId": "6-10-l1",
    "lessonNumber": "6.1",
    "title": "Pioneers of Freedom Struggle in Tamil Nadu",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 10,
    "lessonId": "6-10-l2",
    "lessonNumber": "6.2",
    "title": "Non-Cooperation and Vedaranyam Salt Satyagraha in TN",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 10,
    "lessonId": "6-10-l3",
    "lessonNumber": "6.3",
    "title": "The Justice Party and Non-Brahmin Movement",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 10,
    "lessonId": "6-10-l4",
    "lessonNumber": "6.4",
    "title": "Self-Respect Movement and Thanthai Periyar",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 10,
    "lessonId": "6-10-l5",
    "lessonNumber": "6.5",
    "title": "The Dravidian Movement and Perarignar Anna",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 11,
    "lessonId": "6-11-l1",
    "lessonNumber": "6.1",
    "title": "Tamil Culture — An Introduction (தமிழகப் பண்பாடு)",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 11,
    "lessonId": "6-11-l2",
    "lessonNumber": "6.2",
    "title": "Indus Valley Civilisation and Dravidian Links",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 11,
    "lessonId": "6-11-l3",
    "lessonNumber": "6.3",
    "title": "Living Values in Tamil Literature (வாழ்வியல் நெறிகள்)",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 11,
    "lessonId": "6-11-l4",
    "lessonNumber": "6.4",
    "title": "Arts of the Tamils: Architecture, Sculptures & Music",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 11,
    "lessonId": "6-11-l5",
    "lessonNumber": "6.5",
    "title": "Festivals of the Tamils & Folk Traditions",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 11,
    "lessonId": "6-11-l6",
    "lessonNumber": "6.6",
    "title": "Evolution of Society in South India (History Vol 1)",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 12,
    "lessonId": "6-12-l1",
    "lessonNumber": "6.1",
    "title": "Bhakti Movement in Tamil Nadu (பக்தி இயக்கம்)",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 12,
    "lessonId": "6-12-l2",
    "lessonNumber": "6.2",
    "title": "Social Reformers of Tamil Nadu (சமூக சீர்திருத்தவாதிகள்)",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 12,
    "lessonId": "6-12-l3",
    "lessonNumber": "6.3",
    "title": "Thirukkural: Secular Character & Socio-Politico-Economic Ideals",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 12,
    "lessonId": "6-12-l4",
    "lessonNumber": "6.4",
    "title": "Tamil Nadu in the Indian Freedom Struggle",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 12,
    "lessonId": "6-12-l5",
    "lessonNumber": "6.5",
    "title": "The Justice Party Ministries & Affirmative Policies",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 12,
    "lessonId": "6-12-l6",
    "lessonNumber": "6.6",
    "title": "Self-Respect Movement, Thanthai Periyar & Rationalism",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "general-studies",
    "unitId": 6,
    "standard": 12,
    "lessonId": "6-12-l7",
    "lessonNumber": "6.7",
    "title": "Dravidian Movement & Perarignar Anna Administration",
    "term": "Full Year",
    "mappedSubject": "Social Science"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 6,
    "lessonId": "apt-6-1-1-1",
    "lessonNumber": "1.1",
    "title": "Numbers, Place Values & Estimation",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 6,
    "lessonId": "apt-6-1-1-2",
    "lessonNumber": "1.2",
    "title": "HCF and LCM of Whole Numbers",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 6,
    "lessonId": "apt-6-1-1-3",
    "lessonNumber": "1.3",
    "title": "Ratio and Proportion Basics",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 6,
    "lessonId": "apt-6-1-1-4",
    "lessonNumber": "1.4",
    "title": "Measurements & Conversion of Units",
    "term": "Term 2",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 6,
    "lessonId": "apt-6-1-1-5",
    "lessonNumber": "1.5",
    "title": "Bill, Profit, Loss & Percentage Basics",
    "term": "Term 2",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 6,
    "lessonId": "apt-6-1-1-6",
    "lessonNumber": "1.6",
    "title": "Fractions & Operations on Decimals",
    "term": "Term 3",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 6,
    "lessonId": "apt-6-1-1-7",
    "lessonNumber": "1.7",
    "title": "Perimeter and Area of 2D Shapes",
    "term": "Term 3",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 6,
    "lessonId": "apt-6-2-2-1",
    "lessonNumber": "2.1",
    "title": "Basic Number Patterns & Symmetry",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 6,
    "lessonId": "apt-6-2-2-2",
    "lessonNumber": "2.2",
    "title": "Information Processing & Flow Charts",
    "term": "Term 2",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 6,
    "lessonId": "apt-6-2-2-3",
    "lessonNumber": "2.3",
    "title": "Visual Puzzles & Pictographs",
    "term": "Term 3",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 7,
    "lessonId": "apt-7-1-1-1",
    "lessonNumber": "1.1",
    "title": "Number System & Integers Operations",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 7,
    "lessonId": "apt-7-1-1-2",
    "lessonNumber": "1.2",
    "title": "Algebra & Linear Expressions",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 7,
    "lessonId": "apt-7-1-1-3",
    "lessonNumber": "1.3",
    "title": "Percentage and Simple Interest",
    "term": "Term 2",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 7,
    "lessonId": "apt-7-1-1-4",
    "lessonNumber": "1.4",
    "title": "Measurements: Area of Four Walls & Pathways",
    "term": "Term 2",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 7,
    "lessonId": "apt-7-1-1-5",
    "lessonNumber": "1.5",
    "title": "Direct and Inverse Proportion",
    "term": "Term 3",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 7,
    "lessonId": "apt-7-1-1-6",
    "lessonNumber": "1.6",
    "title": "Perimeter & Area of Rhombus and Trapezium",
    "term": "Term 3",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 7,
    "lessonId": "apt-7-2-2-1",
    "lessonNumber": "2.1",
    "title": "Logical Reasoning & Magic Squares",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 7,
    "lessonId": "apt-7-2-2-2",
    "lessonNumber": "2.2",
    "title": "Number Series & Sequencing",
    "term": "Term 2",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 7,
    "lessonId": "apt-7-2-2-3",
    "lessonNumber": "2.3",
    "title": "Dice, Venn Diagrams & Puzzles",
    "term": "Term 3",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 8,
    "lessonId": "apt-8-1-1-1",
    "lessonNumber": "1.1",
    "title": "Rational Numbers & Square Roots",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 8,
    "lessonId": "apt-8-1-1-2",
    "lessonNumber": "1.2",
    "title": "Measurements: Sector & Circular Arc Length",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 8,
    "lessonId": "apt-8-1-1-3",
    "lessonNumber": "1.3",
    "title": "Life Mathematics: Percentage & Profit/Loss",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 8,
    "lessonId": "apt-8-1-1-4",
    "lessonNumber": "1.4",
    "title": "Compound Interest & Difference between SI & CI",
    "term": "Term 2",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 8,
    "lessonId": "apt-8-1-1-5",
    "lessonNumber": "1.5",
    "title": "Time and Work & Unitary Method",
    "term": "Term 2",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 8,
    "lessonId": "apt-8-1-1-6",
    "lessonNumber": "1.6",
    "title": "Algebra: Factorization & Identities",
    "term": "Term 3",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 8,
    "lessonId": "apt-8-1-1-7",
    "lessonNumber": "1.7",
    "title": "Geometry: Volume and Surface Area of Prisms",
    "term": "Term 3",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 8,
    "lessonId": "apt-8-2-2-1",
    "lessonNumber": "2.1",
    "title": "Alpha-Numeric Reasoning & Coding-Decoding",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 8,
    "lessonId": "apt-8-2-2-2",
    "lessonNumber": "2.2",
    "title": "Puzzles, Cubes and Dice",
    "term": "Term 2",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 8,
    "lessonId": "apt-8-2-2-3",
    "lessonNumber": "2.3",
    "title": "Data Interpretation & Graphs",
    "term": "Term 3",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 9,
    "lessonId": "apt-9-1-1-1",
    "lessonNumber": "1.1",
    "title": "Set Language & Venn Diagrams",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 9,
    "lessonId": "apt-9-1-1-2",
    "lessonNumber": "1.2",
    "title": "Real Numbers & Surds Simplification",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 9,
    "lessonId": "apt-9-1-1-3",
    "lessonNumber": "1.3",
    "title": "Algebra: Polynomials & GCD of Polynomials",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 9,
    "lessonId": "apt-9-1-1-4",
    "lessonNumber": "1.4",
    "title": "Coordinate Geometry & Distance Formula",
    "term": "Term 2",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 9,
    "lessonId": "apt-9-1-1-5",
    "lessonNumber": "1.5",
    "title": "Trigonometry: Ratios & Standard Angles",
    "term": "Term 2",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 9,
    "lessonId": "apt-9-1-1-6",
    "lessonNumber": "1.6",
    "title": "Mensuration: Surface Area and Volume of Cuboids",
    "term": "Term 2",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 9,
    "lessonId": "apt-9-1-1-7",
    "lessonNumber": "1.7",
    "title": "Probability: Empirical & Theoretical",
    "term": "Term 3",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 9,
    "lessonId": "apt-9-1-1-8",
    "lessonNumber": "1.8",
    "title": "Statistics: Mean, Median & Mode",
    "term": "Term 3",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 9,
    "lessonId": "apt-9-2-2-1",
    "lessonNumber": "2.1",
    "title": "Logical Deduction & Syllogism",
    "term": "Term 1",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 9,
    "lessonId": "apt-9-2-2-2",
    "lessonNumber": "2.2",
    "title": "Visual & Spatial Reasoning",
    "term": "Term 2",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 9,
    "lessonId": "apt-9-2-2-3",
    "lessonNumber": "2.3",
    "title": "Mathematical Operations & Blood Relations",
    "term": "Term 3",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 10,
    "lessonId": "apt-10-1-1-1",
    "lessonNumber": "1.1",
    "title": "Relations and Functions",
    "term": "Full Year",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 10,
    "lessonId": "apt-10-1-1-2",
    "lessonNumber": "1.2",
    "title": "Numbers and Sequences: Arithmetic & Geometric Progressions",
    "term": "Full Year",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 10,
    "lessonId": "apt-10-1-1-3",
    "lessonNumber": "1.3",
    "title": "Algebra: Simultaneous Linear Equations & Quadratic Equations",
    "term": "Full Year",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 10,
    "lessonId": "apt-10-1-1-4",
    "lessonNumber": "1.4",
    "title": "Coordinate Geometry: Slope, Straight Lines & Concurrency",
    "term": "Full Year",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 10,
    "lessonId": "apt-10-1-1-5",
    "lessonNumber": "1.5",
    "title": "Trigonometry: Heights and Distances",
    "term": "Full Year",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 10,
    "lessonId": "apt-10-1-1-6",
    "lessonNumber": "1.6",
    "title": "Mensuration: Surface Area, Volume of Cylinders, Cones, Spheres & Frustum",
    "term": "Full Year",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 1,
    "standard": 10,
    "lessonId": "apt-10-1-1-7",
    "lessonNumber": "1.7",
    "title": "Statistics and Probability: Standard Deviation & Variance",
    "term": "Full Year",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 10,
    "lessonId": "apt-10-2-2-1",
    "lessonNumber": "2.1",
    "title": "Logical Reasoning & Analytical Thinking",
    "term": "Full Year",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 10,
    "lessonId": "apt-10-2-2-2",
    "lessonNumber": "2.2",
    "title": "Puzzles, Number Patterns & Sequence Logic",
    "term": "Full Year",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "aptitude",
    "unitId": 2,
    "standard": 10,
    "lessonId": "apt-10-2-2-3",
    "lessonNumber": "2.3",
    "title": "Data Sufficiency and Graph Interpretation",
    "term": "Full Year",
    "mappedSubject": "Mathematics"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 6,
    "lessonId": "tam-6-1-1-1",
    "lessonNumber": "1.1",
    "title": "தமிழ் எழுத்துகளின் வகை தொகை (இலக்கணம்)",
    "term": "Term 1",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 2,
    "standard": 6,
    "lessonId": "tam-6-2-2-1",
    "lessonNumber": "2.1",
    "title": "இன்பத்தமிழ் & தமிழ்க்கும்மி (பாரதிதாசன், பெருஞ்சித்திரனார்)",
    "term": "Term 1",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 5,
    "standard": 6,
    "lessonId": "tam-6-5-5-1",
    "lessonNumber": "5.1",
    "title": "வளர்தமிழ் & கனவு பலித்தது (உரைநடை/கடிதம்)",
    "term": "Term 1",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 6,
    "lessonId": "tam-6-1-1-2",
    "lessonNumber": "1.2",
    "title": "இனவெழுத்துகள் & மயங்கொலிகள் (இலக்கணம்)",
    "term": "Term 2",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 3,
    "standard": 6,
    "lessonId": "tam-6-3-3-1",
    "lessonNumber": "3.1",
    "title": "மூதுரை & துன்பம் வெல்லும் கல்வி (பட்டுக்கோட்டை கல்யாணசுந்தரம்)",
    "term": "Term 2",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 5,
    "standard": 6,
    "lessonId": "tam-6-5-5-2",
    "lessonNumber": "5.2",
    "title": "கல்விக்கண் திறந்த காமராசர் & நூலகம் நோக்கி",
    "term": "Term 2",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 6,
    "lessonId": "tam-6-1-1-3",
    "lessonNumber": "1.3",
    "title": "சுட்டு எழுத்துகள், வினா எழுத்துகள் & நால்வகைச் சொற்கள்",
    "term": "Term 3",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 4,
    "standard": 6,
    "lessonId": "tam-6-4-4-1",
    "lessonNumber": "4.1",
    "title": "பாரதம் அன்றைய நாற்றங்கால் & பராபரக் கண்ணி (தாயுமானவர்)",
    "term": "Term 3",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 5,
    "standard": 6,
    "lessonId": "tam-6-5-5-3",
    "lessonNumber": "5.3",
    "title": "தமிழ்நாட்டில் காந்தி & வேலுநாச்சியார்",
    "term": "Term 3",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 7,
    "lessonId": "tam-7-1-1-1",
    "lessonNumber": "1.1",
    "title": "குற்றியலுகரம், குற்றியலிகரம் (இலக்கணம்)",
    "term": "Term 1",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 2,
    "standard": 7,
    "lessonId": "tam-7-2-2-1",
    "lessonNumber": "2.1",
    "title": "எங்கள் தமிழ் & ஒன்றல்ல இரண்டல்ல (நாமக்கல் கவிஞர், உடுமலை நாராயணகவி)",
    "term": "Term 1",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 5,
    "standard": 7,
    "lessonId": "tam-7-5-5-1",
    "lessonNumber": "5.1",
    "title": "பேச்சுமொழியும் எழுத்துமொழியும் (மொழி நடை)",
    "term": "Term 1",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 7,
    "lessonId": "tam-7-1-1-2",
    "lessonNumber": "1.2",
    "title": "இலக்கிய வகைச் சொற்கள் & நால்வகை குறுக்கங்கள்",
    "term": "Term 2",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 2,
    "standard": 7,
    "lessonId": "tam-7-2-2-2",
    "lessonNumber": "2.2",
    "title": "காடு (சுரதா) & அப்படியே நிற்கட்டும் அந்த மரம்",
    "term": "Term 2",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 5,
    "standard": 7,
    "lessonId": "tam-7-5-5-2",
    "lessonNumber": "5.2",
    "title": "கப்பலோட்டிய தமிழர் வ.உ.சி & தேசியம் காத்த செம்மல் பசும்பொன் முத்துராமலிங்கத்தேவர்",
    "term": "Term 2",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 7,
    "lessonId": "tam-7-1-1-3",
    "lessonNumber": "1.3",
    "title": "அணி இலக்கணம் (உவமை, உருவகம், ஏகதேச உருவகம்)",
    "term": "Term 3",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 3,
    "standard": 7,
    "lessonId": "tam-7-3-3-1",
    "lessonNumber": "3.1",
    "title": "விருந்தோம்பல், வயல் வழி & திருக்குறள் அறக்கருத்துகள்",
    "term": "Term 3",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 5,
    "standard": 7,
    "lessonId": "tam-7-5-5-3",
    "lessonNumber": "5.3",
    "title": "தமிழர் வணிகம் & கப்பற்கலை",
    "term": "Term 3",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 8,
    "lessonId": "tam-8-1-1-1",
    "lessonNumber": "1.1",
    "title": "எழுத்துகளின் பிறப்பு & வேற்றுமை உருபுகள் (இலக்கணம்)",
    "term": "Term 1",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 2,
    "standard": 8,
    "lessonId": "tam-8-2-2-1",
    "lessonNumber": "2.1",
    "title": "தமிழ்மொழி வாழ்த்து (பாரதியார்) & தமிழ்மொழி மரபு",
    "term": "Term 1",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 5,
    "standard": 8,
    "lessonId": "tam-8-5-5-1",
    "lessonNumber": "5.1",
    "title": "தமிழ் வரிவடிவ வளர்ச்சி & கவிமணி தேசிக விநாயகம் பிள்ளை",
    "term": "Term 1",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 8,
    "lessonId": "tam-8-1-1-2",
    "lessonNumber": "1.2",
    "title": "வினைமுற்று, எச்சம், வினையெச்சம் & பெயரெச்சம்",
    "term": "Term 2",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 3,
    "standard": 8,
    "lessonId": "tam-8-3-3-1",
    "lessonNumber": "3.1",
    "title": "திருக்குறள், நன்னெறி & நீதி வெண்பா",
    "term": "Term 2",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 5,
    "standard": 8,
    "lessonId": "tam-8-5-5-2",
    "lessonNumber": "5.2",
    "title": "அயோத்திதாசப் பண்டிதர் சிந்தனைகள் & கல்வி வளர்ச்சி",
    "term": "Term 2",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 8,
    "lessonId": "tam-8-1-1-3",
    "lessonNumber": "1.3",
    "title": "யாப்பிலக்கணம் (எழுத்து, அசை, சீர், தளை, அடி, தொடை) & அணி",
    "term": "Term 3",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 4,
    "standard": 8,
    "lessonId": "tam-8-4-4-1",
    "lessonNumber": "4.1",
    "title": "படை வேழம் (ஜெயங்கொண்டார் - கலிங்கத்துப்பரணி)",
    "term": "Term 3",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 7,
    "standard": 8,
    "lessonId": "tam-8-7-7-1",
    "lessonNumber": "7.1",
    "title": "நாட்டுப்புறக் கைவினைக் கலைகள் & தமிழர் இசைக்கருவிகள்",
    "term": "Term 3",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 9,
    "lessonId": "tam-9-1-1-1",
    "lessonNumber": "1.1",
    "title": "தொடர் இலக்கணம் & தன்வினை, பிறவினை, செய்வினை, செயப்பாட்டுவினை",
    "term": "Term 1",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 2,
    "standard": 9,
    "lessonId": "tam-9-2-2-1",
    "lessonNumber": "2.1",
    "title": "திராவிட மொழிக்குடும்பம் & தமிழோவியம் (ஈரோடு தமிழன்பன்)",
    "term": "Term 1",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 5,
    "standard": 9,
    "lessonId": "tam-9-5-5-1",
    "lessonNumber": "5.1",
    "title": "தமிழ் விடு தூது & தற்கால உரைநடை வளர்ச்சி",
    "term": "Term 1",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 9,
    "lessonId": "tam-9-1-1-2",
    "lessonNumber": "1.2",
    "title": "துணைவினைகள் & புணர்ச்சி விதிகள்",
    "term": "Term 2",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 2,
    "standard": 9,
    "lessonId": "tam-9-2-2-2",
    "lessonNumber": "2.2",
    "title": "பட்டமரம், பெரியபுராணம் (சேக்கிழார்) & புறநானூறு",
    "term": "Term 2",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 5,
    "standard": 9,
    "lessonId": "tam-9-5-5-2",
    "lessonNumber": "5.2",
    "title": "பெரியாரின் பெண் விடுதலைச் சிந்தனைகள்",
    "term": "Term 2",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 9,
    "lessonId": "tam-9-1-1-3",
    "lessonNumber": "1.3",
    "title": "ஆகுபெயர் வகைகள் & வல்லினம் மிகும் இடங்கள் மிகா இடங்கள்",
    "term": "Term 3",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 2,
    "standard": 9,
    "lessonId": "tam-9-2-2-3",
    "lessonNumber": "2.3",
    "title": "இராவண காவியம் (புலவர் குழந்தை) & மணிமேகலை (சீத்தலைச் சாத்தனார்)",
    "term": "Term 3",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 7,
    "standard": 9,
    "lessonId": "tam-9-7-7-1",
    "lessonNumber": "7.1",
    "title": "சிற்பக்கலை, இந்திய தேசிய ராணுவத்தில் தமிழர் பங்கு",
    "term": "Term 3",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 10,
    "lessonId": "tam-10-1-1-1",
    "lessonNumber": "1.1",
    "title": "எழுத்து, சொல் (இலக்கணம் - இயல் 1)",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 10,
    "lessonId": "tam-10-1-1-2",
    "lessonNumber": "1.2",
    "title": "தொகைநிலைத் தொடர்கள் (இலக்கணம் - இயல் 2)",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 10,
    "lessonId": "tam-10-1-1-3",
    "lessonNumber": "1.3",
    "title": "தொகாநிலைத் தொடர்கள் (இலக்கணம் - இயல் 3)",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 10,
    "lessonId": "tam-10-1-1-4",
    "lessonNumber": "1.4",
    "title": "இலக்கணம் - பொது & வினா, விடை, பொருள்கோள் (இயல் 4 & 5)",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 10,
    "lessonId": "tam-10-1-1-5",
    "lessonNumber": "1.5",
    "title": "அகப்பொருள் இலக்கணம் & புறப்பொருள் இலக்கணம் (இயல் 6 & 7)",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 10,
    "lessonId": "tam-10-1-1-6",
    "lessonNumber": "1.6",
    "title": "பா-வகை, அலகிடுதல் & அணி இலக்கணம் (இயல் 8 & 9)",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 2,
    "standard": 10,
    "lessonId": "tam-10-2-2-1",
    "lessonNumber": "2.1",
    "title": "அன்னை மொழியே (பெருஞ்சித்திரனார்) & இரட்டுற மொழிதல்",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 2,
    "standard": 10,
    "lessonId": "tam-10-2-2-2",
    "lessonNumber": "2.2",
    "title": "காற்றே வா (பாரதியார்) & முல்லைப்பாட்டு (நப்பூதனார்)",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 3,
    "standard": 10,
    "lessonId": "tam-10-3-3-1",
    "lessonNumber": "3.1",
    "title": "காசிக்காண்டம் (அதிவீரராம பாண்டியர்) & மலைபடுகடாம்",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 4,
    "standard": 10,
    "lessonId": "tam-10-4-4-1",
    "lessonNumber": "4.1",
    "title": "நீதி வெண்பா (செய்குதம்பி பாவலர்) & திருவிளையாடற் புராணம்",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 5,
    "standard": 10,
    "lessonId": "tam-10-5-5-1",
    "lessonNumber": "5.1",
    "title": "தமிழ்ச் சொல்வளம் (தேவநேயப் பாவாணர்) & மொழிபெயர்ப்புக் கல்வி",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 5,
    "standard": 10,
    "lessonId": "tam-10-5-5-2",
    "lessonNumber": "5.2",
    "title": "செயற்கை நுண்ணறிவு & காலம் தந்த தன்னம்பிக்கை (ஸ்டீபன் ஹாக்கிங்)",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 7,
    "standard": 10,
    "lessonId": "tam-10-7-7-1",
    "lessonNumber": "7.1",
    "title": "நிகழ்கலை (சிற்றகல் ஒளி - ம.பொ.சி) & சிலப்பதிகாரம் (இளங்கோவடிகள்)",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 11,
    "lessonId": "tam-11-1-1-1",
    "lessonNumber": "1.1",
    "title": "மொழியின் முதல் மற்றும் இறுதி எழுத்துகள், புணர்ச்சி விதிகள்",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 2,
    "standard": 11,
    "lessonId": "tam-11-2-2-1",
    "lessonNumber": "2.1",
    "title": "நற்றிணை, குறுந்தொகை, புறநானூறு செய்யுள் பகுதிகள்",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 3,
    "standard": 11,
    "lessonId": "tam-11-3-3-1",
    "lessonNumber": "3.1",
    "title": "சீவக சிந்தாமணி (திருத்தக்கதேவர்) & கம்பராமாயணம்",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 5,
    "standard": 11,
    "lessonId": "tam-11-5-5-1",
    "lessonNumber": "5.1",
    "title": "தமிழர் பண்பாடு, பாரதிதாசன் கவிதைகள் & தற்கால உரைநடை",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 1,
    "standard": 12,
    "lessonId": "tam-12-1-1-1",
    "lessonNumber": "1.1",
    "title": "பொருள்கோள், யாப்பு, பாவினங்கள் & தண்டியலங்கார அணிகள்",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 2,
    "standard": 12,
    "lessonId": "tam-12-2-2-1",
    "lessonNumber": "2.1",
    "title": "சிலப்பதிகாரம், கம்பராமாயணம், நெடுநல்வாடை",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 4,
    "standard": 12,
    "lessonId": "tam-12-4-4-1",
    "lessonNumber": "4.1",
    "title": "தேம்பாவணி, திருக்குறள் மெய்ப்பாட்டியல் & புறப்பொருள் வெண்பாமாலை",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-tamil",
    "unitId": 5,
    "standard": 12,
    "lessonId": "tam-12-5-5-1",
    "lessonNumber": "5.1",
    "title": "பாரதியார் கவிதைகள், உ.வே.சா தமிழ்ப்பணி & சிற்பிகளின் கலைப்பயணம்",
    "term": "Full Year",
    "mappedSubject": "Tamil"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 6,
    "lessonId": "eng-6-1-1-1",
    "lessonNumber": "1.1",
    "title": "Grammar: Nouns, Pronouns & Types of Adjectives",
    "term": "Term 1",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 6,
    "lessonId": "eng-6-7-7-1",
    "lessonNumber": "7.1",
    "title": "Prose & Poetry: Sea Turtles & The Crocodile",
    "term": "Term 1",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 6,
    "lessonId": "eng-6-1-1-2",
    "lessonNumber": "1.2",
    "title": "Grammar: Verbs, Simple Present & Past Tenses",
    "term": "Term 2",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 6,
    "lessonId": "eng-6-7-7-2",
    "lessonNumber": "7.2",
    "title": "Prose & Poetry: Trip to Ooty & From a Railway Carriage",
    "term": "Term 2",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 6,
    "lessonId": "eng-6-1-1-3",
    "lessonNumber": "1.3",
    "title": "Grammar: Prepositions, Conjunctions & Sentence Building",
    "term": "Term 3",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 6,
    "lessonId": "eng-6-7-7-3",
    "lessonNumber": "7.3",
    "title": "Prose & Poetry: Who Owns the Water? & The Indian Seasons",
    "term": "Term 3",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 7,
    "lessonId": "eng-7-1-1-1",
    "lessonNumber": "1.1",
    "title": "Grammar: Adverbs, Modal Auxiliaries & Question Tags",
    "term": "Term 1",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 7,
    "lessonId": "eng-7-7-7-1",
    "lessonNumber": "7.1",
    "title": "Prose & Poetry: Eidgah & The Computer Swallowed Grandma",
    "term": "Term 1",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 7,
    "lessonId": "eng-7-1-1-2",
    "lessonNumber": "1.2",
    "title": "Grammar: Active and Passive Voice Basics",
    "term": "Term 2",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 7,
    "lessonId": "eng-7-7-7-2",
    "lessonNumber": "7.2",
    "title": "Prose & Poetry: The Wind on Haunted Hill & The Listeners",
    "term": "Term 2",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 7,
    "lessonId": "eng-7-1-1-3",
    "lessonNumber": "1.3",
    "title": "Grammar: Direct and Indirect Speech Fundamentals",
    "term": "Term 3",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 7,
    "lessonId": "eng-7-7-7-3",
    "lessonNumber": "7.3",
    "title": "Prose & Poetry: Journey by Train & Sea Fever",
    "term": "Term 3",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 8,
    "lessonId": "eng-8-1-1-1",
    "lessonNumber": "1.1",
    "title": "Grammar: Subject-Verb Agreement & Parts of Speech",
    "term": "Term 1",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 2,
    "standard": 8,
    "lessonId": "eng-8-2-2-1",
    "lessonNumber": "2.1",
    "title": "Vocabulary: Synonyms, Antonyms, Homophones & Homonyms",
    "term": "Term 1",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 8,
    "lessonId": "eng-8-7-7-1",
    "lessonNumber": "7.1",
    "title": "Prose & Poetry: The Nose-Jewel & Special Hero",
    "term": "Term 1",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 8,
    "lessonId": "eng-8-1-1-2",
    "lessonNumber": "1.2",
    "title": "Grammar: Non-Finite Verbs (Infinitives, Gerunds, Participles)",
    "term": "Term 2",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 8,
    "lessonId": "eng-8-7-7-2",
    "lessonNumber": "7.2",
    "title": "Prose & Poetry: Sir Isaac Newton & The Secret of the Machines",
    "term": "Term 2",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 8,
    "lessonId": "eng-8-1-1-3",
    "lessonNumber": "1.3",
    "title": "Grammar: Sentence Patterns & Conditional Clauses (If-clauses)",
    "term": "Term 3",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 8,
    "lessonId": "eng-8-7-7-3",
    "lessonNumber": "7.3",
    "title": "Prose & Poetry: The Wooden Horse & The Mystery of the Cyber Friend",
    "term": "Term 3",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 9,
    "lessonId": "eng-9-1-1-1",
    "lessonNumber": "1.1",
    "title": "Grammar: Prepositional Phrases, Tenses & Aspects",
    "term": "Term 1",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 2,
    "standard": 9,
    "lessonId": "eng-9-2-2-1",
    "lessonNumber": "2.1",
    "title": "Vocabulary: Idioms, Phrasal Verbs & Collocations",
    "term": "Term 1",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 9,
    "lessonId": "eng-9-7-7-1",
    "lessonNumber": "7.1",
    "title": "Prose & Poetry: Learning the Game & Stopping by Woods on a Snowy Evening",
    "term": "Term 1",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 9,
    "lessonId": "eng-9-1-1-2",
    "lessonNumber": "1.2",
    "title": "Grammar: Degrees of Comparison (Positive, Comparative, Superlative)",
    "term": "Term 2",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 9,
    "lessonId": "eng-9-7-7-2",
    "lessonNumber": "7.2",
    "title": "Prose & Drama: A Poison Tree & The Tempest (Tales from Shakespeare)",
    "term": "Term 2",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 9,
    "lessonId": "eng-9-1-1-3",
    "lessonNumber": "1.3",
    "title": "Grammar: Phrases and Clauses, Relative Clauses & Connectors",
    "term": "Term 3",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 9,
    "lessonId": "eng-9-7-7-3",
    "lessonNumber": "7.3",
    "title": "Prose & Poetry: Earthquake, The Cat and the Pain-Killer & On Killing a Tree",
    "term": "Term 3",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 10,
    "lessonId": "eng-10-1-1-1",
    "lessonNumber": "1.1",
    "title": "Grammar: Modals, Semi-modals & Active-Passive Voice Transformation",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 10,
    "lessonId": "eng-10-1-1-2",
    "lessonNumber": "1.2",
    "title": "Grammar: Articles, Prepositional Verbs & Relative Pronouns",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 10,
    "lessonId": "eng-10-1-1-3",
    "lessonNumber": "1.3",
    "title": "Grammar: Reported Speech (Direct & Indirect) & Conjunctions",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 10,
    "lessonId": "eng-10-1-1-4",
    "lessonNumber": "1.4",
    "title": "Grammar: Simple, Compound and Complex Sentences Transformation",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 2,
    "standard": 10,
    "lessonId": "eng-10-2-2-1",
    "lessonNumber": "2.1",
    "title": "Vocabulary: Affixes (Prefixes & Suffixes), Compound Words & Abbreviations",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 5,
    "standard": 10,
    "lessonId": "eng-10-5-5-1",
    "lessonNumber": "5.1",
    "title": "Reading Comprehension: Literary and Factual Passages",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 10,
    "lessonId": "eng-10-7-7-1",
    "lessonNumber": "7.1",
    "title": "Prose & Poetry: His First Flight & Life (Henry Van Dyke)",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 10,
    "lessonId": "eng-10-7-7-2",
    "lessonNumber": "7.2",
    "title": "Prose & Poetry: The Night the Ghost Got In & The Grumble Family",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 10,
    "lessonId": "eng-10-7-7-3",
    "lessonNumber": "7.3",
    "title": "Prose & Poetry: Empowered Women Navigating the World & I am Every Woman",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 10,
    "lessonId": "eng-10-7-7-4",
    "lessonNumber": "7.4",
    "title": "Prose & Drama: The Attic & The Ant and the Cricket",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 11,
    "lessonId": "eng-11-1-1-1",
    "lessonNumber": "1.1",
    "title": "Grammar: Advanced Synthesis of Sentences, Inversion & Conditional Types",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 2,
    "standard": 11,
    "lessonId": "eng-11-2-2-1",
    "lessonNumber": "2.1",
    "title": "Vocabulary: Foreign Words and Phrases, British and American English",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 11,
    "lessonId": "eng-11-7-7-1",
    "lessonNumber": "7.1",
    "title": "Prose & Poetry: The Portrait of a Lady & Once Upon a Time",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 11,
    "lessonId": "eng-11-7-7-2",
    "lessonNumber": "7.2",
    "title": "Prose & Poetry: The Queen of Boxing & Tight Corners",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 1,
    "standard": 12,
    "lessonId": "eng-12-1-1-1",
    "lessonNumber": "1.1",
    "title": "Grammar: Sentence Patterns (SVO, SVIODO, SVOC), Concord & Error Correction",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 2,
    "standard": 12,
    "lessonId": "eng-12-2-2-1",
    "lessonNumber": "2.1",
    "title": "Vocabulary: Figures of Speech (Metaphor, Simile, Personification, Oxymoron)",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 12,
    "lessonId": "eng-12-7-7-1",
    "lessonNumber": "7.1",
    "title": "Prose & Poetry: Two Gentlemen of Verona & The Castle",
    "term": "Full Year",
    "mappedSubject": "English"
  },
  {
    "subjectId": "general-english",
    "unitId": 7,
    "standard": 12,
    "lessonId": "eng-12-7-7-2",
    "lessonNumber": "7.2",
    "title": "Prose & Poetry: In Celebration of Being Alive & All the World's a Stage",
    "term": "Full Year",
    "mappedSubject": "English"
  }
];

export function getCanonicalLessons(
  subjectId: string,
  standardId: number,
  unitId: number,
  term?: string
): CanonicalLesson[] {
  const normSub = String(subjectId || '').toLowerCase().trim();
  const targetStd = Number(standardId) || 6;
  const targetUnit = Number(unitId) || 1;
  const normTerm = term ? String(term).trim().toLowerCase() : '';

  return CANONICAL_SYLLABUS_LESSONS.filter((l) => {
    if (l.subjectId.toLowerCase() !== normSub) return false;
    if (l.standard !== targetStd) return false;
    if (l.unitId !== targetUnit) return false;

    if (normTerm && normTerm !== 'all' && normTerm !== 'not applicable') {
      const lessonTerm = String(l.term || '').trim().toLowerCase();
      if (targetStd >= 10 && (lessonTerm === 'full year' || normTerm === 'full year')) {
        return true;
      }
      return lessonTerm.includes(normTerm) || normTerm.includes(lessonTerm);
    }

    return true;
  });
}
