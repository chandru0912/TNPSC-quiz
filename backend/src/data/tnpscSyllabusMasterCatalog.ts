/**
 * tnpscSyllabusMasterCatalog.ts
 *
 * Exhaustive, Authoritative Master TNPSC General Studies Syllabus Catalog (Unit I – Unit VI)
 * Exactly derived from official TNPSC specifications.
 * 
 * Total: 156 topics across 6 Units.
 * Zero omissions. Strictly preserves TNPSC syllabus wording.
 */

export interface MasterTopicDefinition {
  id: string;
  unitNumber: number;
  unitTitle: string;
  topicName: string;
  questionCount: number;
  isCurrentAffairs: boolean;
  displayOrder: number;
  targetSubjects: string[];
  searchKeywords: string[];
}

export const TNPSC_MASTER_SYLLABUS: MasterTopicDefinition[] = [
  // =========================================================================
  // UNIT I – GENERAL SCIENCE (5 QUESTIONS)
  // =========================================================================
  {
    id: 'u1-t01-nature-of-universe',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Nature of Universe',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 1,
    targetSubjects: ['Science', 'Physics'],
    searchKeywords: ['universe', 'solarsystem', 'galaxy', 'stars', 'cosmology', 'planet', 'earth', 'space', 'astronomy', 'big bang', 'பேரண்டம்', 'விண்வெளி']
  },
  {
    id: 'u1-t02-measurement-of-physical-quantities',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Measurement of Physical Quantities',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 2,
    targetSubjects: ['Science', 'Physics'],
    searchKeywords: ['measurement', 'units', 'si units', 'physical quantities', 'length', 'mass', 'time', 'verniers', 'screw gauge', 'அளவீட்டியல்', 'அலகுகள்']
  },
  {
    id: 'u1-t03-general-scientific-laws-in-motion',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'General Scientific Laws in Motion',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 3,
    targetSubjects: ['Science', 'Physics'],
    searchKeywords: ['motion', 'laws of motion', 'newton', 'gravitation', 'acceleration', 'velocity', 'momentum', 'inertia', 'விதிகள்', 'இயக்கம்']
  },
  {
    id: 'u1-t04-force-pressure-and-energy',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Force, Pressure and Energy',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 4,
    targetSubjects: ['Science', 'Physics'],
    searchKeywords: ['force', 'pressure', 'energy', 'work', 'power', 'pascal', 'thrust', 'friction', 'kinetic', 'potential', 'விசை', 'அழுத்தம்', 'ஆற்றல்']
  },
  {
    id: 'u1-t05-applications-of-mechanics',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Applications of Mechanics',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 5,
    targetSubjects: ['Science', 'Physics'],
    searchKeywords: ['mechanics', 'simple machines', 'lever', 'pulley', 'buoyancy', 'viscosity', 'surface tension', 'fluid mechanics', 'பயன்பாட்டு இயற்பியல்']
  },
  {
    id: 'u1-t06-electricity',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Electricity',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 6,
    targetSubjects: ['Science', 'Physics'],
    searchKeywords: ['electricity', 'circuits', 'current', 'voltage', 'resistance', 'ohm law', 'conductors', 'insulators', 'electric cell', 'மின்னியல்', 'மின்னோட்டம்']
  },
  {
    id: 'u1-t07-magnetism',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Magnetism',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 7,
    targetSubjects: ['Science', 'Physics'],
    searchKeywords: ['magnetism', 'magnetic field', 'magnets', 'poles', 'electromagnet', 'magnetic compass', 'lorentz force', 'காந்தவியல்', 'காந்தம்']
  },
  {
    id: 'u1-t08-light',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Light',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 8,
    targetSubjects: ['Science', 'Physics'],
    searchKeywords: ['light', 'optics', 'reflection', 'refraction', 'lenses', 'mirrors', 'snell law', 'dispersion', 'spectrum', 'ஒளியியல்', 'ஒளி']
  },
  {
    id: 'u1-t09-sound',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Sound',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 9,
    targetSubjects: ['Science', 'Physics'],
    searchKeywords: ['sound', 'acoustics', 'waves', 'frequency', 'ultrasound', 'sonar', 'echo', 'doppler effect', 'ஒலியியல்', 'ஒலி', 'அலைகள்']
  },
  {
    id: 'u1-t10-heat',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Heat',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 10,
    targetSubjects: ['Science', 'Physics'],
    searchKeywords: ['heat', 'temperature', 'thermodynamics', 'expansion', 'conduction', 'convection', 'radiation', 'calorimetry', 'வெப்பம்', 'வெப்பநிலை']
  },
  {
    id: 'u1-t11-nuclear-physics',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Nuclear Physics',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 11,
    targetSubjects: ['Science', 'Physics', 'Chemistry'],
    searchKeywords: ['nuclear physics', 'radioactivity', 'nuclear fission', 'fusion', 'atoms', 'isotopes', 'alpha beta gamma', 'nuclear reactor', 'அணுக்கரு இயற்பியல்', 'கதிரியக்கம்']
  },
  {
    id: 'u1-t12-elements-and-compounds',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Elements and Compounds',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 12,
    targetSubjects: ['Science', 'Chemistry'],
    searchKeywords: ['elements', 'compounds', 'periodic table', 'matter', 'atoms', 'molecules', 'chemical bonding', 'metals', 'non-metals', 'தனிமங்கள்', 'சேர்மங்கள்']
  },
  {
    id: 'u1-t13-acids-bases-and-salts',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Acids, Bases and Salts',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 13,
    targetSubjects: ['Science', 'Chemistry'],
    searchKeywords: ['acids', 'bases', 'salts', 'ph scale', 'indicators', 'neutralization', 'hydrochloric', 'sodium hydroxide', 'அமிலங்கள்', 'காரங்கள்', 'உப்புகள்']
  },
  {
    id: 'u1-t14-petroleum-products',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Petroleum Products',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 14,
    targetSubjects: ['Science', 'Chemistry'],
    searchKeywords: ['petroleum', 'fossil fuels', 'coal', 'crude oil', 'hydrocarbons', 'fractional distillation', 'natural gas', 'பெட்ரோலியம்', 'எரிபொருட்கள்']
  },
  {
    id: 'u1-t15-fertilizers',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Fertilizers',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 15,
    targetSubjects: ['Science', 'Chemistry', 'Botany'],
    searchKeywords: ['fertilizers', 'npk', 'urea', 'organic manure', 'biofertilizers', 'soil nutrients', ' உரங்கள்', 'வேதியியல் உரங்கள்']
  },
  {
    id: 'u1-t16-pesticides',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Pesticides',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 16,
    targetSubjects: ['Science', 'Chemistry', 'Zoology'],
    searchKeywords: ['pesticides', 'insecticides', 'fungicides', 'weedicides', 'ddt', 'biopesticides', 'pest control', 'பூச்சிக்கொல்லிகள்']
  },
  {
    id: 'u1-t17-metallurgy',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Metallurgy',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 17,
    targetSubjects: ['Science', 'Chemistry'],
    searchKeywords: ['metallurgy', 'ores', 'minerals', 'extraction of metals', 'alloys', 'corrosion', 'smelting', 'refining', 'உலோகவியல்', 'தாதுக்கள்']
  },
  {
    id: 'u1-t18-food-adulteration',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Food Adulteration',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 18,
    targetSubjects: ['Science', 'Chemistry', 'Zoology'],
    searchKeywords: ['food adulteration', 'food safety', 'fssai', 'adulterants', 'food preservation', 'quality standards', 'உணவு கலப்படம்']
  },
  {
    id: 'u1-t19-classification-of-living-organisms',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Classification of Living Organisms',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 19,
    targetSubjects: ['Science', 'Botany', 'Zoology'],
    searchKeywords: ['classification', 'taxonomy', 'five kingdoms', 'linnaeus', 'species', 'vertebrates', 'invertebrates', 'plants', 'animals', 'உயிரின வகைப்பாடு']
  },
  {
    id: 'u1-t20-evolution',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Evolution',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 20,
    targetSubjects: ['Science', 'Botany', 'Zoology'],
    searchKeywords: ['evolution', 'darwin', 'lamarck', 'natural selection', 'origin of species', 'fossils', 'human evolution', 'பரிணாமம்']
  },
  {
    id: 'u1-t21-genetics',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Genetics',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 21,
    targetSubjects: ['Science', 'Botany', 'Zoology'],
    searchKeywords: ['genetics', 'dna', 'rna', 'mendel', 'genes', 'chromosomes', 'heredity', 'mutation', 'genetic engineering', 'மரபியல்']
  },
  {
    id: 'u1-t22-physiology',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Physiology',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 22,
    targetSubjects: ['Science', 'Botany', 'Zoology'],
    searchKeywords: ['physiology', 'digestive', 'circulatory', 'respiratory', 'nervous system', 'endocrine', 'hormones', 'kidney', 'heart', 'உடலியங்கியல்']
  },
  {
    id: 'u1-t23-nutrition',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Nutrition',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 23,
    targetSubjects: ['Science', 'Botany', 'Zoology'],
    searchKeywords: ['nutrition', 'nutrients', 'carbohydrates', 'proteins', 'vitamins', 'minerals', 'balanced diet', 'malnutrition', 'ஊட்டச்சத்து']
  },
  {
    id: 'u1-t24-health-and-hygiene',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Health and Hygiene',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 24,
    targetSubjects: ['Science', 'Zoology'],
    searchKeywords: ['health', 'hygiene', 'cleanliness', 'sanitation', 'mental health', 'community health', 'வளர்சிதை மாற்றம்', 'சுகாதாரம்']
  },
  {
    id: 'u1-t25-human-diseases',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Human Diseases',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 25,
    targetSubjects: ['Science', 'Zoology'],
    searchKeywords: ['human diseases', 'infectious diseases', 'bacteria', 'virus', 'deficiency diseases', 'vaccination', 'antibiotics', 'immunity', 'மனித நோய்கள்']
  },
  {
    id: 'u1-t26-environmental-science',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Environmental Science',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 26,
    targetSubjects: ['Science', 'Botany', 'Social Science'],
    searchKeywords: ['environmental science', 'ecosystem', 'biodiversity', 'pollution', 'conservation', 'global warming', 'waste management', 'சுற்றுச்சூழல் அறிவியல்']
  },
  {
    id: 'u1-t27-latest-inventions-in-science-and-technology',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Latest Inventions in Science and Technology',
    questionCount: 5,
    isCurrentAffairs: true,
    displayOrder: 27,
    targetSubjects: ['Science', 'Physics', 'Chemistry'],
    searchKeywords: ['latest inventions', 'science technology', 'isro', 'satellites', 'ai', 'robotics', 'nanotechnology', 'biotechnology', 'அறிவியல் கண்டுபிடிப்புகள்']
  },
  {
    id: 'u1-t28-current-affairs-science',
    unitNumber: 1,
    unitTitle: 'General Science',
    topicName: 'Current Affairs',
    questionCount: 5,
    isCurrentAffairs: true,
    displayOrder: 28,
    targetSubjects: ['Science'],
    searchKeywords: ['current affairs science', 'nobel prize', 'space missions', 'scientific discoveries', 'நடப்பு நிகழ்வுகள் அறிவியல்']
  },

  // =========================================================================
  // UNIT II – GEOGRAPHY (5 QUESTIONS)
  // =========================================================================
  {
    id: 'u2-t01-earth-location',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Earth Location',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 1,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['earth location', 'latitudes', 'longitudes', 'time zones', 'hemisphere', 'globe', 'equator', 'பூமியின் அமைவிடம்', 'அட்சரேகை', 'தீர்க்கரேகை']
  },
  {
    id: 'u2-t02-physical-features',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Physical Features',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 2,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['physical features', 'himalayas', 'peninsular plateau', 'northern plains', 'coastal plains', 'islands', 'physiography', 'இயற்கை அமைப்புகள்', 'பீடபூமி']
  },
  {
    id: 'u2-t03-monsoon',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Monsoon',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 3,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['monsoon', 'southwest monsoon', 'northeast monsoon', 'retreating monsoon', 'wind patterns', 'பருவக்காற்று', 'தென்மேற்கு பருவக்காற்று']
  },
  {
    id: 'u2-t04-rainfall',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Rainfall',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 4,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['rainfall', 'precipitation', 'rain gauge', 'rainfall distribution', 'orographic rainfall', 'மழைப்பொழிவு']
  },
  {
    id: 'u2-t05-weather-and-climate',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Weather and Climate',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 5,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['weather', 'climate', 'temperature', 'humidity', 'isobars', 'climate zones', 'வானிலை', 'காலநிலை']
  },
  {
    id: 'u2-t06-water-resources',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Water Resources',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 6,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['water resources', 'groundwater', 'irrigation', 'dams', 'canals', 'water conservation', 'நீர்வளங்கள்']
  },
  {
    id: 'u2-t07-rivers',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Rivers',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 7,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['rivers', 'ganga', 'brahmaputra', 'indus', 'cauvery', 'godavari', 'krishna', 'vaigai', 'river systems', 'ஆறுகள்', 'நதிகள்']
  },
  {
    id: 'u2-t08-soil',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Soil',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 8,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['soil', 'alluvial soil', 'black soil', 'red soil', 'laterite soil', 'soil erosion', 'soil conservation', 'மண்', 'மண் வகைகள்']
  },
  {
    id: 'u2-t09-minerals',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Minerals',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 9,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['minerals', 'iron ore', 'bauxite', 'coal', 'mica', 'copper', 'lignite', 'neiveli', 'கனிமங்கள்']
  },
  {
    id: 'u2-t10-natural-resources',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Natural Resources',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 10,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['natural resources', 'renewable energy', 'solar', 'wind power', 'non renewable', 'resource utilization', 'இயற்கை வளங்கள்']
  },
  {
    id: 'u2-t11-forest-and-wildlife',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Forest and Wildlife',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 11,
    targetSubjects: ['Geography', 'Social Science', 'Botany'],
    searchKeywords: ['forest', 'wildlife', 'national parks', 'sanctuaries', 'biosphere reserves', 'tropical rainforest', 'flora and fauna', 'காடுகள்', 'வனவிலங்குகள்']
  },
  {
    id: 'u2-t12-agriculture-pattern',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Agriculture Pattern',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 12,
    targetSubjects: ['Geography', 'Social Science', 'Economics'],
    searchKeywords: ['agriculture pattern', 'cropping seasons', 'kharif', 'rabi', 'zaid', 'food crops', 'cash crops', 'green revolution', 'வேளாண்மை', 'பயிர்கள்']
  },
  {
    id: 'u2-t13-transport',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Transport',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 13,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['transport', 'roadways', 'railways', 'airways', 'waterways', 'national highways', 'ports', 'shipping', 'போக்குவரத்து']
  },
  {
    id: 'u2-t14-communication',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Communication',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 14,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['communication', 'telecommunications', 'mass media', 'internet', 'satellite communication', 'postal system', 'தகவல் தொடர்பு']
  },
  {
    id: 'u2-t15-population-density',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Population Density',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 15,
    targetSubjects: ['Geography', 'Social Science', 'Economics'],
    searchKeywords: ['population density', 'demographics', 'census', 'growth rate', 'sex ratio', 'literacy rate', 'மக்கள் தொகை அடர்த்தி']
  },
  {
    id: 'u2-t16-population-distribution-in-tamil-nadu-and-india',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Population Distribution in Tamil Nadu and India',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 16,
    targetSubjects: ['Geography', 'Social Science', 'Economics'],
    searchKeywords: ['population distribution', 'tamil nadu population', 'urbanization', 'rural population', 'migration', 'மக்கள் பரவல்']
  },
  {
    id: 'u2-t17-calamities',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Calamities',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 17,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['calamities', 'earthquakes', 'cyclones', 'floods', 'tsunami', 'drought', 'landslides', 'பேரிடர்கள்', 'இயற்கை சீற்றங்கள்']
  },
  {
    id: 'u2-t18-disaster-management',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Disaster Management',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 18,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['disaster management', 'ndma', 'mitigation', 'preparedness', 'rescue operations', 'early warning', 'பேரிடர் மேலாண்மை']
  },
  {
    id: 'u2-t19-environment',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Environment',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 19,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['environment', 'ecology', 'biomes', 'human environment', 'ecological balance', 'சுற்றுச்சூழல்']
  },
  {
    id: 'u2-t20-climate-change',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Climate Change',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 20,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['climate change', 'global warming', 'greenhouse effect', 'carbon footprint', 'paris agreement', 'காலநிலை மாற்றம்']
  },
  {
    id: 'u2-t21-geographical-landmarks',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Geographical Landmarks',
    questionCount: 5,
    isCurrentAffairs: false,
    displayOrder: 21,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['geographical landmarks', 'passes', 'peaks', 'plateaus', 'gulf of mannar', 'palk strait', 'western ghats', 'eastern ghats', 'புவியியல் அடையாளங்கள்']
  },
  {
    id: 'u2-t22-current-affairs-geography',
    unitNumber: 2,
    unitTitle: 'Geography',
    topicName: 'Current Affairs',
    questionCount: 5,
    isCurrentAffairs: true,
    displayOrder: 22,
    targetSubjects: ['Geography'],
    searchKeywords: ['current affairs geography', 'environmental summits', 'recent cyclones', 'infrastructure projects', 'நடப்பு நிகழ்வுகள் புவியியல்']
  },

  // =========================================================================
  // UNIT III – HISTORY, CULTURE OF INDIA AND INDIAN NATIONAL MOVEMENT (10 QUESTIONS)
  // =========================================================================
  {
    id: 'u3-t01-indus-valley-civilization',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Indus Valley Civilization',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 1,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['indus valley civilization', 'harappa', 'mohenjodaro', 'lothal', 'town planning', 'great bath', 'citi-life', 'சிந்து சமவெளி நாகரிகம்']
  },
  {
    id: 'u3-t02-guptas',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Guptas',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 2,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['guptas', 'samudragupta', 'chandragupta', 'golden age', 'nalanda', 'aryabhata', 'kalidasa', 'குப்தர்கள்']
  },
  {
    id: 'u3-t03-delhi-sultanate',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Delhi Sultanate',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 3,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['delhi sultanate', 'slave dynasty', 'khilji', 'alauddin', 'tughlaq', 'qutub minar', 'இடில்லி சுல்தான்கள்', 'தில்லி சுல்தானியம்']
  },
  {
    id: 'u3-t04-mughals',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Mughals',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 4,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['mughals', 'babur', 'akbar', 'shah jahan', 'aurangzeb', 'mansabdari', 'din-i-ilahi', 'taj mahal', 'முகலாயர்கள்']
  },
  {
    id: 'u3-t05-marathas',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Marathas',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 5,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['marathas', 'shivaji', 'peshwas', 'ashtapradhan', 'chauth', 'sardeshmukhi', 'மராத்தியர்கள்', 'சிவாஜி']
  },
  {
    id: 'u3-t06-south-indian-history',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'South Indian History',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 6,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['south indian history', 'cholas', 'pallavas', 'pandyas', 'cheras', 'vijayanagar', 'bahmani', 'brihadeeswarar', 'தென்னிந்திய வரலாறு', 'சோழர்கள்']
  },
  {
    id: 'u3-t07-national-renaissance',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'National Renaissance',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 7,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['national renaissance', 'socio-religious reform', 'brahmo samaj', 'arya samaj', 'raja ram mohan roy', 'dayananda saraswati', 'தேசிய மறுமலர்ச்சி']
  },
  {
    id: 'u3-t08-early-uprisings-against-british-rule',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Early Uprisings against British Rule',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 8,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['early uprisings', 'poligar rebellion', 'veerapandiya kattabomman', 'pulithevar', 'velu nachiyar', 'vellore mutiny 1806', 'revolt of 1857', 'ஆரம்பகால கிளர்ச்சிகள்']
  },
  {
    id: 'u3-t09-indian-national-congress',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Indian National Congress',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 9,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['indian national congress', 'inc 1885', 'a o hume', 'moderates', 'extremists', 'surat split', 'bengal partition', 'இந்திய தேசிய காங்கிரஸ்']
  },
  {
    id: 'u3-t10-emergence-of-national-leaders',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Emergence of National Leaders',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 10,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['emergence of national leaders', 'freedom fighters', 'swadeshi movement', 'satyagraha', 'தேசிய தலைவர்கள் எழுச்சி']
  },
  {
    id: 'u3-t11-br-ambedkar',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'B.R. Ambedkar',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 11,
    targetSubjects: ['History', 'Social Science', 'Polity'],
    searchKeywords: ['ambedkar', 'b.r. ambedkar', 'drafting committee', 'constitution father', 'bahishkrit hitakarini', 'mahad satyagraha', 'அம்பேத்கர்']
  },
  {
    id: 'u3-t12-bhagat-singh',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Bhagat Singh',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 12,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['bhagat singh', 'hsra', 'lahore conspiracy', 'naujawan bharat sabha', 'inquilab zindabad', 'பகத் சிங்']
  },
  {
    id: 'u3-t13-bharathiar',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Bharathiar',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 13,
    targetSubjects: ['History', 'Tamil', 'Social Science'],
    searchKeywords: ['bharathiar', 'subramania bharati', 'national poet', 'swadesamitran', 'india newspaper', 'பாஞ்சாலி சபதம்', 'பாரதியார்']
  },
  {
    id: 'u3-t14-vo-chidambaranar',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'V.O. Chidambaranar',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 14,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['v.o. chidambaranar', 'kappalottiya thamizhan', 'swadeshi steam navigation company', 'thoothukudi', 'வ.உ.சி', 'சிதம்பரனார்']
  },
  {
    id: 'u3-t15-thanthai-periyar',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Thanthai Periyar',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 15,
    targetSubjects: ['History', 'Social Science', 'Polity'],
    searchKeywords: ['periyar', 'thanthai periyar', 'e.v. ramasamy', 'self-respect movement', 'dravidar kazhagam', 'vaikom satyagraha', 'குடி அரசு', 'பெரியார்']
  },
  {
    id: 'u3-t16-jawaharlal-nehru',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Jawaharlal Nehru',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 16,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['nehru', 'jawaharlal nehru', 'first prime minister', 'non-aligned movement', 'five year plans', 'discovery of india', 'நேரு']
  },
  {
    id: 'u3-t17-rabindranath-tagore',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Rabindranath Tagore',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 17,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['tagore', 'rabindranath tagore', 'gitanjali', 'shantiniketan', 'national anthem', 'nobel prize', 'தாகூர்']
  },
  {
    id: 'u3-t18-kamarajar',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Kamarajar',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 18,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['kamaraj', 'kamarajar', 'kingmaker', 'midday meal scheme', 'k-plan', 'education reformer', 'காமராஜர்']
  },
  {
    id: 'u3-t19-mahatma-gandhi',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Mahatma Gandhi',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 19,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['gandhi', 'mahatma gandhi', 'ahimsa', 'non-cooperation', 'civil disobedience', 'dandi march', 'quit india', 'காந்தி']
  },
  {
    id: 'u3-t20-maulana-abul-kalam-azad',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Maulana Abul Kalam Azad',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 20,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['abul kalam azad', 'maulana azad', 'first education minister', 'al-hilal', 'india wins freedom', 'மௌலானா அபுல் கலாம் ஆசாத்']
  },
  {
    id: 'u3-t21-rajaji',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Rajaji',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 21,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['rajaji', 'c. rajagopalachari', 'vedaranyam salt satyagraha', 'first indian governor general', 'swatantra party', 'ராஜாஜி']
  },
  {
    id: 'u3-t22-subhash-chandra-bose',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Subhash Chandra Bose',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 22,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['netaji', 'subhash chandra bose', 'ina', 'indian national army', 'forward bloc', 'dilli chalo', 'நேதாஜி சுபாஷ் சந்திர போஸ்']
  },
  {
    id: 'u3-t23-muthulakshmi-ammaiyar',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Muthulakshmi Ammaiyar',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 23,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['muthulakshmi reddy', 'muthulakshmi ammaiyar', 'avvai illam', 'cancer institute adyar', 'devadasi abolition', 'முத்துலட்சுமி அம்மையார்']
  },
  {
    id: 'u3-t24-moovalur-ramamirtham',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Moovalur Ramamirtham',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 24,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['moovalur ramamirtham', 'women rights', 'devadasi movement', 'dasanigal mosavalai', 'மூவலூர் ராமாமிர்தம் அம்மையார்']
  },
  {
    id: 'u3-t25-other-national-leaders',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Other National Leaders',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 25,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['national leaders', 'sardar patel', 'sarojini naidu', 'tilak', 'gokhale', 'lala lajpat rai', 'பல்வேறு தேசிய தலைவர்கள்']
  },
  {
    id: 'u3-t26-tamil-nadu-agitations-and-movements',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Tamil Nadu Agitations and Movements',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 26,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['tamil nadu agitations', 'anti-hindi agitations', 'justice party', 'non-brahmin movement', 'madras mahajana sabha', 'தமிழ்நாடு போராட்டங்கள்']
  },
  {
    id: 'u3-t27-indian-culture',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Indian Culture',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 27,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['indian culture', 'art architecture', 'classical dance', 'music', 'monuments', 'heritage', 'இந்திய கலாச்சாரம்']
  },
  {
    id: 'u3-t28-unity-in-diversity',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Unity in Diversity',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 28,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['unity in diversity', 'composite culture', 'national integration', 'வேற்றுமையில் ஒற்றுமை']
  },
  {
    id: 'u3-t29-race',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Race',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 29,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['race', 'ethnic diversity', 'tribes', 'anthropology', 'இனம்']
  },
  {
    id: 'u3-t30-language',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Language',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 30,
    targetSubjects: ['History', 'Social Science', 'Tamil'],
    searchKeywords: ['language', 'classical languages', 'eighth schedule', 'dravidian languages', 'indo-aryan', 'மொழி']
  },
  {
    id: 'u3-t31-customs',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'Customs',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 31,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['customs', 'traditions', 'festivals', 'rituals', 'social customs', 'பழக்கவழக்கங்கள்']
  },
  {
    id: 'u3-t32-india-as-a-secular-state',
    unitNumber: 3,
    unitTitle: 'History & Culture of India and INM',
    topicName: 'India as a Secular State',
    questionCount: 10,
    isCurrentAffairs: false,
    displayOrder: 32,
    targetSubjects: ['History', 'Social Science', 'Polity'],
    searchKeywords: ['secular state', 'secularism', 'freedom of religion', 'tolerance', 'மதச்சார்பற்ற நாடு']
  },

  // =========================================================================
  // UNIT IV – INDIAN POLITY (15 QUESTIONS)
  // =========================================================================
  {
    id: 'u4-t01-constitution-of-india',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Constitution of India',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 1,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['constitution of india', 'constituent assembly', 'drafting committee', 'making of constitution', 'இந்திய அரசியலமைப்பு']
  },
  {
    id: 'u4-t02-preamble',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Preamble',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 2,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['preamble', 'sovereign', 'socialist', 'secular', 'democratic', 'republic', 'justice liberty equality', 'முகப்புரை']
  },
  {
    id: 'u4-t03-salient-features-of-constitution',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Salient Features of Constitution',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 3,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['salient features', 'written constitution', 'rigidity flexibility', 'single citizenship', 'universal adult suffrage', 'அரசியலமைப்பின் சிறப்பியல்புகள்']
  },
  {
    id: 'u4-t04-union-state-and-union-territories',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Union, State and Union Territories',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 4,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['union state union territories', 'part 1', 'reorganization of states', 'delhi puducherry', 'மத்திய மாநில யூனியன் பிரதேசங்கள்']
  },
  {
    id: 'u4-t05-citizenship',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Citizenship',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 5,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['citizenship', 'citizenship act 1955', 'acquisition', 'loss of citizenship', 'articles 5-11', 'குடியுரிமை']
  },
  {
    id: 'u4-t06-fundamental-rights',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Fundamental Rights',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 6,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['fundamental rights', 'part iii', 'articles 12-35', 'equality', 'freedom', 'writs', 'habeas corpus', 'அடிப்படை உரிமைகள்']
  },
  {
    id: 'u4-t07-fundamental-duties',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Fundamental Duties',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 7,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['fundamental duties', 'part iv a', 'article 51a', 'swaran singh committee', '42nd amendment', 'அடிப்படை கடமைகள்']
  },
  {
    id: 'u4-t08-directive-principles-of-state-policy',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Directive Principles of State Policy',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 8,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['directive principles', 'dpsp', 'part iv', 'articles 36-51', 'socialistic gandhian liberal', 'அரசு வழிகாட்டு நெறிமுறைகள்']
  },
  {
    id: 'u4-t09-union-executive',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Union Executive',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 9,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['union executive', 'president', 'vice-president', 'prime minister', 'council of ministers', 'மத்திய நிர்வாகம்']
  },
  {
    id: 'u4-t10-union-legislature',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Union Legislature',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 10,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['union legislature', 'parliament', 'lok sabha', 'rajya sabha', 'speaker', 'bills', 'நாடாளுமன்றம்']
  },
  {
    id: 'u4-t11-state-executive',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'State Executive',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 11,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['state executive', 'governor', 'chief minister', 'council of ministers', 'மாநில நிர்வாகம்', 'ஆளுநர்', 'முதலமைச்சர்']
  },
  {
    id: 'u4-t12-state-legislature',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'State Legislature',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 12,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['state legislature', 'legislative assembly', 'legislative council', 'mla', 'மாநில சட்டமன்றம்']
  },
  {
    id: 'u4-t13-local-governments',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Local Governments',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 13,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['local governments', 'municipalities', 'corporations', 'local administration', 'உள்ளாட்சி அமைப்புகள்']
  },
  {
    id: 'u4-t14-panchayat-raj',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Panchayat Raj',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 14,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['panchayat raj', '73rd amendment', '74th amendment', 'balwant rai mehta', 'gram sabha', 'பஞ்சாயத்து ராஜ்']
  },
  {
    id: 'u4-t15-federalism',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Federalism',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 15,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['federalism', 'quasi-federal', 'union-state balance', 'கூட்டாட்சி']
  },
  {
    id: 'u4-t16-centre-state-relations',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Centre-State Relations',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 16,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['centre-state relations', 'legislative administrative financial', 'union list state list concurrent list', 'sarkaria commission', 'மத்திய மாநில உறவுகள்']
  },
  {
    id: 'u4-t17-elections',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Elections',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 17,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['elections', 'election commission of india', 'article 324', 'electoral reforms', 'evm', 'தேர்தல்கள்', 'தேர்தல் ஆணையம்']
  },
  {
    id: 'u4-t18-judiciary',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Judiciary',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 18,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['judiciary', 'supreme court', 'high court', 'subordinate courts', 'judicial review', 'judicial activism', 'நீதித்துறை']
  },
  {
    id: 'u4-t19-rule-of-law',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Rule of Law',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 19,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['rule of law', 'dicey', 'equality before law', 'due process of law', 'சட்டத்தின் ஆட்சி']
  },
  {
    id: 'u4-t20-corruption-in-public-life',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Corruption in Public Life',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 20,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['corruption in public life', 'santhanan committee', 'cbi', 'cvc', 'ஊழல்']
  },
  {
    id: 'u4-t21-anti-corruption-measures',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Anti-Corruption Measures',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 21,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['anti-corruption measures', 'prevention of corruption act', 'whistle blowers', 'ஊழல் தடுப்பு நடவடிக்கைகள்']
  },
  {
    id: 'u4-t22-lokpal-and-lokayukta',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Lokpal and Lokayukta',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 22,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['lokpal', 'lokayukta', 'ombudsman', 'lokpal act 2013', 'லோக்பால்', 'லோக் ஆயுக்தா']
  },
  {
    id: 'u4-t23-right-to-information',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Right to Information',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 23,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['right to information', 'rti act 2005', 'central information commission', 'transparency', 'தகவல் அறியும் உரிமைச் சட்டம்']
  },
  {
    id: 'u4-t24-women-empowerment',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Women Empowerment',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 24,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['women empowerment', 'gender equality', 'women welfare schemes', 'national commission for women', 'பெண்கள் மேம்பாடு']
  },
  {
    id: 'u4-t25-consumer-protection-forums',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Consumer Protection Forums',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 25,
    targetSubjects: ['Social Science', 'Civics', 'Economics'],
    searchKeywords: ['consumer protection', 'copra 1986', 'copra 2019', 'consumer rights', 'district forum', 'நுகர்வோர் பாதுகாப்பு']
  },
  {
    id: 'u4-t26-human-rights-charter',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Human Rights Charter',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 26,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['human rights charter', 'nhrc', 'shrc', 'universal declaration of human rights', 'மனித உரிமைகள்']
  },
  {
    id: 'u4-t27-political-parties',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Political Parties',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 27,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['political parties', 'national parties', 'regional parties', 'recognition criteria', 'அரசியல் கட்சிகள்']
  },
  {
    id: 'u4-t28-political-system-in-tamil-nadu-and-india',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Political System in Tamil Nadu and India',
    questionCount: 15,
    isCurrentAffairs: false,
    displayOrder: 28,
    targetSubjects: ['Social Science', 'Civics', 'Political Science'],
    searchKeywords: ['political system', 'dravidian governance', 'coalition politics', 'party system in tamil nadu', 'அரசியல் அமைப்பு']
  },
  {
    id: 'u4-t29-current-affairs-polity',
    unitNumber: 4,
    unitTitle: 'Indian Polity',
    topicName: 'Current Affairs',
    questionCount: 15,
    isCurrentAffairs: true,
    displayOrder: 29,
    targetSubjects: ['Social Science', 'Civics'],
    searchKeywords: ['current affairs polity', 'constitutional amendments', 'supreme court judgments', 'recent bills', 'நடப்பு நிகழ்வுகள் அரசியல்']
  },

  // =========================================================================
  // UNIT V – INDIAN ECONOMY AND DEVELOPMENT ADMINISTRATION IN TAMIL NADU (20 QUESTIONS)
  // =========================================================================
  {
    id: 'u5-t01-nature-of-indian-economy',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Nature of Indian Economy',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 1,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['nature of indian economy', 'mixed economy', 'developing economy', 'gdp', 'national income', 'இந்தியப் பொருளாதாரத்தின் இயல்புகள்']
  },
  {
    id: 'u5-t02-five-year-plan-models',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Five-Year Plan Models',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 2,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['five-year plan models', 'harrod-domar', 'mahalanobis', 'gadgil', 'plans 1 to 12', 'ஐந்தாண்டு திட்டங்கள்']
  },
  {
    id: 'u5-t03-planning-commission',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Planning Commission',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 3,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['planning commission', 'ndc', 'history of planning', 'திட்டக்குழு']
  },
  {
    id: 'u5-t04-niti-aayog',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'NITI Aayog',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 4,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['niti aayog', 'think tank', 'cooperative federalism', 'sdg index', 'நிதி ஆயோக்']
  },
  {
    id: 'u5-t05-sources-of-revenue',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Sources of Revenue',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 5,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['sources of revenue', 'direct taxes', 'indirect taxes', 'public revenue', 'budget', 'வருவாய் ஆதாரங்கள்']
  },
  {
    id: 'u5-t06-reserve-bank-of-india',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Reserve Bank of India',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 6,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['reserve bank of india', 'rbi', 'monetary policy', 'repo rate', 'banking regulation', 'ரிசர்வ் வங்கி']
  },
  {
    id: 'u5-t07-finance-commission',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Finance Commission',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 7,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['finance commission', 'article 280', 'tax devolution', 'grants-in-aid', 'நிதி ஆணையம்']
  },
  {
    id: 'u5-t08-resource-sharing-between-union-and-state-governments',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Resource Sharing between Union and State Governments',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 8,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['resource sharing', 'fiscal federalism', 'cess and surcharge', 'மத்திய மாநில நிதிப் பகிர்வு']
  },
  {
    id: 'u5-t09-goods-and-services-tax',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Goods and Services Tax',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 9,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['gst', 'goods and services tax', 'gst council', '101st amendment', 'சரக்கு மற்றும் சேவை வரி']
  },
  {
    id: 'u5-t10-economic-trends',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Economic Trends',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 10,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['economic trends', 'lpg reforms 1991', 'inflation', 'balance of payments', 'பொருளாதார போக்குகள்']
  },
  {
    id: 'u5-t11-employment-generation',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Employment Generation',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 11,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['employment generation', 'mgnrega', 'skill india', 'unemployment types', 'வேலைவாய்ப்பு உருவாக்கம்']
  },
  {
    id: 'u5-t12-land-reforms',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Land Reforms',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 12,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['land reforms', 'abolition of zamindari', 'tenancy reforms', 'land ceiling', 'நிலச் சீர்திருத்தங்கள்']
  },
  {
    id: 'u5-t13-agriculture',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Agriculture',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 13,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['agriculture economy', 'cropland', 'msp', 'farm production', 'வேளாண்மைப் பொருளாதாரம்']
  },
  {
    id: 'u5-t14-science-and-technology-in-agriculture',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Science and Technology in Agriculture',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 14,
    targetSubjects: ['Social Science', 'Science', 'Economics'],
    searchKeywords: ['science and technology in agriculture', 'biotechnology in crops', 'precision farming', 'வேளாண்மையில் அறிவியல்']
  },
  {
    id: 'u5-t15-industrial-growth',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Industrial Growth',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 15,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['industrial growth', 'msme', 'make in india', 'industrial corridors', 'sidco', 'sipcot', 'தொழில் வளர்ச்சி']
  },
  {
    id: 'u5-t16-rural-welfare-programmes',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Rural Welfare Programmes',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 16,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['rural welfare programmes', 'pm-kisan', 'rural sanitation', 'housing schemes', 'ஊரக நலத் திட்டங்கள்']
  },
  {
    id: 'u5-t17-population',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Population',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 17,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['population economy', 'demographic dividend', 'family welfare', 'மக்கள் தொகை']
  },
  {
    id: 'u5-t18-education',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Education',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 18,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['education economy', 'sarva shiksha abhiyan', 'rusa', 'gross enrollment ratio', 'கல்வி']
  },
  {
    id: 'u5-t19-health',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Health',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 19,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['health economy', 'national health mission', 'ayushman bharat', 'health indicators', 'சுகாதாரம்']
  },
  {
    id: 'u5-t20-employment',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Employment',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 20,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['employment', 'labor force participation', 'formal and informal sectors', 'வேலைவாய்ப்பு']
  },
  {
    id: 'u5-t21-poverty',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Poverty',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 21,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['poverty', 'poverty line', 'tendulkar committee', 'multidimensional poverty', 'வறுமை']
  },
  {
    id: 'u5-t22-social-justice',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Social Justice',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 22,
    targetSubjects: ['Social Science', 'Economics', 'Polity'],
    searchKeywords: ['social justice', 'affirmative action', 'reservation system in tamil nadu 69%', 'சமூக நீதி']
  },
  {
    id: 'u5-t23-social-harmony',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Social Harmony',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 23,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['social harmony', 'inclusive development', 'communal harmony', 'சமூக நல்லிணக்கம்']
  },
  {
    id: 'u5-t24-education-system-in-tamil-nadu',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Education System in Tamil Nadu',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 24,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['education system in tamil nadu', 'higher education ger', 'naan mudhalvan', 'illam thedi kalvi', 'தமிழ்நாட்டு கல்வி முறை']
  },
  {
    id: 'u5-t25-health-system-in-tamil-nadu',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Health System in Tamil Nadu',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 25,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['health system in tamil nadu', 'makkalai thedi maruthuvam', 'innuyir kaappom', 'primary health centres', 'தமிழ்நாட்டு நல்வாழ்வு முறை']
  },
  {
    id: 'u5-t26-geography-of-tamil-nadu',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Geography of Tamil Nadu',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 26,
    targetSubjects: ['Geography', 'Social Science'],
    searchKeywords: ['geography of tamil nadu', 'physiography of tn', 'rivers of tn', 'climate of tn', 'தமிழ்நாட்டு புவியியல்']
  },
  {
    id: 'u5-t27-government-welfare-schemes',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Government Welfare Schemes',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 27,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['government welfare schemes', 'kalignar mahalir urimai thogai', 'pudhumai penn', 'pension schemes', 'அரசு நலத்திட்டங்கள்']
  },
  {
    id: 'u5-t28-current-socio-economic-issues',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Current Socio-Economic Issues',
    questionCount: 20,
    isCurrentAffairs: true,
    displayOrder: 28,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['current socio-economic issues', 'regional disparities', 'urban migration', 'தற்போதைய சமூகப் பொருளாதார பிரச்சனைகள்']
  },
  {
    id: 'u5-t29-current-affairs-economy',
    unitNumber: 5,
    unitTitle: 'Indian Economy & TN Admin',
    topicName: 'Current Affairs',
    questionCount: 20,
    isCurrentAffairs: true,
    displayOrder: 29,
    targetSubjects: ['Social Science', 'Economics'],
    searchKeywords: ['current affairs economy', 'union budget', 'tamil nadu budget', 'economic survey', 'நடப்பு நிகழ்வுகள் பொருளாதாரம்']
  },

  // =========================================================================
  // UNIT VI – HISTORY, CULTURE, HERITAGE AND SOCIO-POLITICAL MOVEMENTS OF TAMIL NADU (20 QUESTIONS)
  // =========================================================================
  {
    id: 'u6-t01-history-of-tamil-society',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'History of Tamil Society',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 1,
    targetSubjects: ['History', 'Tamil', 'Social Science'],
    searchKeywords: ['history of tamil society', 'sangam age', 'muvendhar', 'ainthinai', 'ancient tamil society', 'தமிழ் சமுதாய வரலாறு']
  },
  {
    id: 'u6-t02-archaeological-discoveries',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Archaeological Discoveries',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 2,
    targetSubjects: ['History', 'Tamil', 'Social Science'],
    searchKeywords: ['archaeological discoveries', 'keeladi', 'adichanallur', 'kodumanal', 'porkalai', 'sivagalai', 'porunai', 'தொல்லியல் கண்டுபிடிப்புகள்', 'கீழடி']
  },
  {
    id: 'u6-t03-tamil-literature-from-sangam-age-to-contemporary-times',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Tamil Literature from Sangam Age to Contemporary Times',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 3,
    targetSubjects: ['Tamil', 'History', 'Social Science'],
    searchKeywords: ['tamil literature', 'sangam literature', 'pathinenkeelkanakku', 'pathinenmelkanakku', 'silappathikaram', 'manimekalai', 'bhakti literature', 'தமிழ் இலக்கிய வரலாறு']
  },
  {
    id: 'u6-t04-thirukkural',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Thirukkural',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 4,
    targetSubjects: ['Tamil', 'Social Science'],
    searchKeywords: ['thirukkural', 'thiruvalluvar', 'aram porul inbam', 'kurals', 'திருக்குறள்', 'திருவள்ளுவர்']
  },
  {
    id: 'u6-t05-secular-literature',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Secular Literature',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 5,
    targetSubjects: ['Tamil', 'Social Science'],
    searchKeywords: ['secular literature', 'non-religious nature of thirukkural', 'ethics', 'மதச்சார்பற்ற இலக்கியம்']
  },
  {
    id: 'u6-t06-relevance-to-everyday-life',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Relevance to Everyday Life',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 6,
    targetSubjects: ['Tamil', 'Social Science'],
    searchKeywords: ['relevance to everyday life', 'daily life applications of thirukkural', 'குடும்ப நெறிமுறைகள்']
  },
  {
    id: 'u6-t07-impact-of-thirukkural-on-humanity',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Impact of Thirukkural on Humanity',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 7,
    targetSubjects: ['Tamil', 'Social Science'],
    searchKeywords: ['impact of thirukkural on humanity', 'global human values', 'மனிதநேயம்']
  },
  {
    id: 'u6-t08-universal-values',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Universal Values',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 8,
    targetSubjects: ['Tamil', 'Social Science'],
    searchKeywords: ['universal values', 'equality', 'brotherhood', 'universal ethics', 'உலகளாவிய விழுமியங்கள்']
  },
  {
    id: 'u6-t09-socio-political-economic-relevance',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Socio-Political-Economic Relevance',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 9,
    targetSubjects: ['Tamil', 'Social Science', 'Economics', 'Polity'],
    searchKeywords: ['socio-political-economic relevance', 'statecraft in thirukkural', 'porutpaal', 'அரசியல் பொருளியல் கருத்துக்கள்']
  },
  {
    id: 'u6-t10-philosophical-content-in-thirukkural',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Philosophical Content in Thirukkural',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 10,
    targetSubjects: ['Tamil', 'Social Science'],
    searchKeywords: ['philosophical content in thirukkural', 'tamil philosophy', 'மெய்யியல் கருத்துக்கள்']
  },
  {
    id: 'u6-t11-role-of-tamil-nadu-in-freedom-struggle',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Role of Tamil Nadu in Freedom Struggle',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 11,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['role of tamil nadu in freedom struggle', 'madras presidency', 'swadeshi in tamil nadu', 'விடுதலைப் போராட்டத்தில் தமிழ்நாட்டின் பங்கு']
  },
  {
    id: 'u6-t12-early-agitations-against-british-rule',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Early Agitations against British Rule',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 12,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['early agitations against british rule', 'palayakkarar rebellion', 'maruthu brothers', 'dheeran chinnamalai', 'ஆங்கிலேயருக்கு எதிரான தொடக்க கால கிளர்ச்சிகள்']
  },
  {
    id: 'u6-t13-role-of-women-in-freedom-struggle',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Role of Women in Freedom Struggle',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 13,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['role of women in freedom struggle', 'velu nachiyar', 'kuyili', 'anjalai ammal', 'ambujathammal', 'விடுதலைப் போராட்டத்தில் பெண்கள்']
  },
  {
    id: 'u6-t14-social-reformers',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Social Reformers',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 14,
    targetSubjects: ['History', 'Social Science', 'Tamil'],
    searchKeywords: ['social reformers', 'vallalar', 'ramalinga adigal', 'ayothee thass', 'rettamalai srinivasan', 'mc rajah', 'சமூக சீர்திருத்தவாதிகள்']
  },
  {
    id: 'u6-t15-social-reform-movements',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Social Reform Movements',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 15,
    targetSubjects: ['History', 'Social Science'],
    searchKeywords: ['social reform movements', 'samarasa suddha sanmarga sangam', 'dravida mahajana sabha', 'self-respect movement', 'சமூக சீர்திருத்த இயக்கங்கள்']
  },
  {
    id: 'u6-t16-social-transformation-of-tamil-nadu',
    unitNumber: 6,
    unitTitle: 'History, Culture & Heritage of Tamil Nadu',
    topicName: 'Social Transformation of Tamil Nadu',
    questionCount: 20,
    isCurrentAffairs: false,
    displayOrder: 16,
    targetSubjects: ['History', 'Social Science', 'Polity'],
    searchKeywords: ['social transformation of tamil nadu', 'justice party rule', 'communal g.o.', 'social change in modern tamil nadu', 'தமிழ்நாட்டின் சமூக மாற்றங்கள்']
  }
];

export function getMasterTopicsForUnit(unitNumber: number): MasterTopicDefinition[] {
  return TNPSC_MASTER_SYLLABUS.filter((t) => t.unitNumber === unitNumber);
}

export function getAllMasterUnits(): Array<{ unitNumber: number; unitTitle: string; questionCount: number; topicsCount: number }> {
  const unitsMap = new Map<number, { unitNumber: number; unitTitle: string; questionCount: number; topicsCount: number }>();
  for (const t of TNPSC_MASTER_SYLLABUS) {
    if (!unitsMap.has(t.unitNumber)) {
      unitsMap.set(t.unitNumber, {
        unitNumber: t.unitNumber,
        unitTitle: t.unitTitle,
        questionCount: t.questionCount,
        topicsCount: 0,
      });
    }
    unitsMap.get(t.unitNumber)!.topicsCount++;
  }
  return Array.from(unitsMap.values()).sort((a, b) => a.unitNumber - b.unitNumber);
}

