const fs = require('fs');

// 1. Read existing bilingualSyllabus.ts to extract topics and lessons that already had Tamil
const currentSyllabus = fs.readFileSync('src/utils/bilingualSyllabus.ts', 'utf8');

// Extract current topic translations
const startTopics = currentSyllabus.indexOf('export const EXACT_TOPIC_TRANSLATIONS: Record<string, string> = {');
const endTopics = currentSyllabus.indexOf('export const EXACT_LESSON_TITLES');
const sliceTopics = currentSyllabus.substring(startTopics, endTopics);
const existingTamilTopics = {};
sliceTopics.split('\n').forEach(line => {
  const match = line.match(/^\s*"([^"]+)":\s*"([^"]+)"/);
  if (match) {
    const [_, k, v] = match;
    if (/[\u0B80-\u0BFF]/.test(v)) {
      existingTamilTopics[k] = v;
    }
  }
});

// Extract current lesson translations
const endLessons = currentSyllabus.indexOf('export const TOPIC_PHRASE_MAPPINGS');
const sliceLessons = currentSyllabus.substring(endTopics, endLessons);
const existingTamilLessons = {};
sliceLessons.split('\n').forEach(line => {
  const match = line.match(/^\s*"([^"]+)":\s*"([^"]+)"/);
  if (match) {
    const [_, k, v] = match;
    if (/[\u0B80-\u0BFF]/.test(v)) {
      existingTamilLessons[k] = v;
    }
  }
});

console.log('Existing Tamil topics:', Object.keys(existingTamilTopics).length);
console.log('Existing Tamil lessons:', Object.keys(existingTamilLessons).length);

// 2. Load verified topics
const verifiedTopics = JSON.parse(fs.readFileSync('scripts/verified_topics.json', 'utf8'));

// 3. Load lesson sources
// From testLessons.cjs (Science & early Samacheer lessons)
const testLessonsContent = fs.readFileSync('scripts/testLessons.cjs', 'utf8');
const testLessonsMatch = testLessonsContent.match(/const lessonTranslations = ({[\s\S]*?\n\};)/);
const lessonTranslations103 = eval('(' + testLessonsMatch[1].replace(/;$/, '') + ')');

// From buildAllRemainingLessons.cjs (Social science, Polity, TN History, etc.)
const remLessonsContent = fs.readFileSync('scripts/buildAllRemainingLessons.cjs', 'utf8');
const remLessonsMatch = remLessonsContent.match(/const lessonBatch = ({[\s\S]*?\n\};)/);
const lessonBatch = eval('(' + remLessonsMatch[1].replace(/;$/, '') + ')');

// From solveAllLessons.cjs / lesson_mappings_patch.json
const patchLessons = JSON.parse(fs.readFileSync('scripts/lesson_mappings_patch.json', 'utf8'));

// Combine all topics
const ALL_TOPICS = {
  ...existingTamilTopics,
  ...verifiedTopics,
};

// Combine all lessons
const ALL_LESSONS = {
  ...existingTamilLessons,
  ...patchLessons,
  ...lessonTranslations103,
  ...lessonBatch,
  // Add single missing if needed
  "Fundamentals of Physical Geography & Earth Movements": "இயற்கை புவியியலின் அடிப்படைகளும் புவி அசைவுகளும்",
  "Physical Geography of Tamil Nadu": "தமிழ்நாட்டின் இயற்கை புவியியல்",
  "Biogeography: Soil Horizons and Natural Vegetation": "உயிர்ப்புவியியல்: மண் அடுக்குகள் மற்றும் இயற்கை தாவரங்கள்",
  "Natural Hazards & Disaster Management in India": "இந்தியாவில் இயற்கை இடர்களும் பேரிடர் மேலாண்மையும்",
  "Population Geography: Distribution, Density & Growth": "மக்கள் தொகை புவியியல்: பரவல், அடர்த்தி & வளர்ச்சி",
  "Human Settlements: Urban Systems & Conurbations": "மனித குடியிருப்புகள்: நகர்ப்புற அமைப்புகளும் நகர ஒருங்கிணைப்புகளும்",
  "Resource Distribution & Green Energy Transition": "வளப் பரவலும் பசுமை ஆற்றல் மாற்றமும்",
  "Transport, Communication and International Trade": "போக்குவரத்து, தகவல் தொடர்பு மற்றும் சர்வதேச வணிகம்",
  "Sustainable Development, Geo-informatics & Remote Sensing": "நிலையான வளர்ச்சி, புவி-தகவலியல் & தொலை உணர்வு",
  "Indus Valley Civilization": "சிந்து சமவெளி நாகரிகம்",
  "Vedic Culture, Jainism & Buddhism": "வேத பண்பாடு, சமணம் & பௌத்தம்",
  "From Chiefdoms to Empires: Mauryan Dynasty": "தலைமைத்துவத்திலிருந்து பேரரசு வரை: மௌரிய வம்சம்",
  "The Mughal Empire: Administration, Economy & Culture": "முகலாயப் பேரரசு: நிர்வாகம், பொருளாதாரம் & பண்பாடு",
  "Indus Valley Civilization: Urban Planning, Society & Culture": "சிந்து சமவெளி நாகரிகம்: நகரத் திட்டமிடல், சமூகம் & பண்பாடு",
  "Union Executive: President, Vice-President, PM & Cabinet": "மத்திய நிர்வாகம்: குடியரசுத் தலைவர், துணைக் குடியரசுத் தலைவர், பிரதமர் & அமைச்சரவை"
};

// Check against untranslated lists
const untranslatedTopics = JSON.parse(fs.readFileSync('scripts/untranslated_topics.json', 'utf8'));
const untranslatedLessons = JSON.parse(fs.readFileSync('scripts/untranslated_lessons.json', 'utf8'));

let missingTopics = 0;
untranslatedTopics.forEach(t => {
  if (!ALL_TOPICS[t] || !(/[\u0B80-\u0BFF]/.test(ALL_TOPICS[t]))) {
    console.error('Missing topic:', t);
    missingTopics++;
  }
});

let missingLessons = 0;
untranslatedLessons.forEach(l => {
  if (!ALL_LESSONS[l] || !(/[\u0B80-\u0BFF]/.test(ALL_LESSONS[l]))) {
    console.error('Missing lesson:', l);
    missingLessons++;
  }
});

console.log(`Summary: Missing topics = ${missingTopics}, Missing lessons = ${missingLessons}`);

if (missingTopics === 0 && missingLessons === 0) {
  console.log('SUCCESS! 100% of topics and lessons are fully translated into Tamil.');

  // Now generate new bilingualSyllabus.ts
  const template = `// Autogenerated comprehensive bilingual syllabus dictionary
import type { Language } from '../context/LanguageContext'

export const EXACT_TOPIC_TRANSLATIONS: Record<string, string> = ${JSON.stringify(ALL_TOPICS, null, 2)};

export const EXACT_LESSON_TITLES: Record<string, string> = ${JSON.stringify(ALL_LESSONS, null, 2)};

export const TOPIC_PHRASE_MAPPINGS: [RegExp, string][] = [
  [/General Scientific Laws/gi, 'பொது அறிவியல் விதிகள்'],
  [/Mechanics/gi, 'இயக்கவியல்'],
  [/Properties of Matter/gi, 'பருப்பொருளின் பண்புகள்'],
  [/Force, Motion and Energy/gi, 'விசை, இயக்கம் மற்றும் ஆற்றல்'],
  [/Everyday application of the basic principles of mechanics/gi, 'இயக்கவியலின் அடிப்படைத் தத்துவங்களின் அன்றாட வாழ்வியல் பயன்பாடு'],
  [/Electricity and Magnetism/gi, 'மின்னியலும் காந்தவியலும்'],
  [/Light, Sound, Heat, Nuclear Physics/gi, 'ஒளி, ஒலி, வெப்பம், அணு இயற்பியல்'],
  [/Elements and Compounds/gi, 'தனிமங்களும் சேர்மங்களும்'],
  [/Acids, Bases, Salts/gi, 'அமிலங்கள், காரங்கள், உப்புகள்'],
  [/Petroleum Products, Fertilizers, Pesticides/gi, 'பெட்ரோலியப் பொருட்கள், உரங்கள், பூச்சிக்கொல்லிகள்'],
  [/Main concepts of Life Science/gi, 'உயிர் அறிவியலின் முக்கியக் கருத்துகள்'],
  [/Classification of Living Organisms/gi, 'உயிரினங்களின் வகைப்பாடு'],
  [/Evolution, Genetics, Physiology/gi, 'பரிணாமம், மரபியல், உடலியல்'],
  [/Nutrition, Health and Hygiene/gi, 'ஊட்டச்சத்து, உடல் நலம் மற்றும் சுகாதாரம்'],
  [/Human diseases/gi, 'மனித நோய்கள்'],
  [/Environmental Ecology/gi, 'சுற்றுச்சூழல் மற்றும் சூழலியல்'],
  [/Location – Physical features/gi, 'அமைவிடம் – இயற்கை அமைப்புகள்'],
  [/Monsoon, rainfall, weather and climate/gi, 'பருவமழை, மழைப்பொழிவு, வானிலை மற்றும் காலநிலை'],
  [/Water resources – Rivers in India/gi, 'நீர்வளங்கள் – இந்திய ஆறுகள்'],
  [/Soil, minerals and natural resources/gi, 'மண், கனிமங்கள் மற்றும் இயற்கை வளங்கள்'],
  [/Forest and wildlife/gi, 'காடுகள் மற்றும் வனவிலங்குகள்'],
  [/Agricultural pattern/gi, 'வேளாண் முறைகள்'],
  [/Transport – Communication/gi, 'போக்குவரத்து – தகவல் தொடர்பு'],
  [/Social geography/gi, 'சமூகப் புவியியல்'],
  [/Population density and distribution/gi, 'மக்கள் தொகை அடர்த்தி மற்றும் பரவல்'],
  [/Racial, linguistic groups and major tribes/gi, 'இன, மொழி குழுக்கள் மற்றும் முக்கிய பழங்குடியினர்'],
  [/Natural calamity – Disaster Management/gi, 'இயற்கைப் பேரிடர் – பேரிடர் மேலாண்மை'],
  [/Environmental pollution: Reasons and preventive measures/gi, 'சுற்றுச்சூழல் மாசுபாடு: காரணங்களும் தடுப்பு முறைகளும்'],
  [/Climate change – Green energy/gi, 'காலநிலை மாற்றம் – பசுமை ஆற்றல்'],
  [/Indus Valley Civilization/gi, 'சிந்து சமவெளி நாகரிகம்'],
  [/Guptas, Delhi Sultans, Mughals and Marathas/gi, 'குப்தர்கள், தில்லி சுல்தான்கள், முகலாயர்கள் மற்றும் மராத்தியர்கள்'],
  [/Age of Vijayanagaram and Bahmani Kingdoms/gi, 'விஜயநகர மற்றும் பாமினி அரசுகளின் காலம்'],
  [/South Indian History/gi, 'தென்னிந்திய வரலாறு'],
  [/Change and Continuity in the Socio-Cultural History of India/gi, 'இந்திய சமூக-பண்பாட்டு வரலாற்றில் மாற்றங்களும் தொடர்ச்சியும்'],
  [/Characteristics of Indian Culture, Unity in Diversity/gi, 'இந்தியப் பண்பாட்டின் இயல்புகள், வேற்றுமையில் ஒற்றுமை'],
  [/India as a Secular State/gi, 'இந்தியா ஒரு சமயச்சார்பற்ற நாடு'],
  [/Social Harmony/gi, 'சமூக நல்லிணக்கம்'],
  [/Constitution of India/gi, 'இந்திய அரசியலமைப்பு'],
  [/Preamble to the Constitution/gi, 'அரசியலமைப்பின் முகப்புரை'],
  [/Salient features of the Constitution/gi, 'அரசியலமைப்பின் முக்கிய கூறுகள்'],
  [/Union, State and Union Territory/gi, 'ஒன்றியம், மாநிலம் மற்றும் யூனியன் பிரதேசம்'],
  [/Citizenship, Fundamental Rights, Fundamental Duties/gi, 'குடியுரிமை, அடிப்படை உரிமைகள், அடிப்படைக் கடமைகள்'],
  [/Directive Principles of State Policy/gi, 'அரசு வழிகாட்டு நெறிமுறைகள்'],
  [/Union Executive, Union Legislature/gi, 'மத்திய நிர்வாகம், மத்திய சட்டமன்றம்'],
  [/State Executive, State Legislature/gi, 'மாநில நிர்வாகம், மாநில சட்டமன்றம்'],
  [/Local Governments, Panchayat Raj/gi, 'உள்ளாட்சி அமைப்புகள், பஞ்சாயத்து ராஜ்'],
  [/Spirit of Federalism: Centre – State Relationships/gi, 'கூட்டாட்சியின் தத்துவம்: மத்திய – மாநில உறவுகள்'],
  [/Judiciary in India – Rule of Law/gi, 'இந்திய நீதித்துறை – சட்டத்தின் ஆட்சி'],
  [/Elections – Official Language and Schedule-VIII/gi, 'தேர்தல்கள் – அலுவலக மொழி மற்றும் எட்டாவது அட்டவணை'],
  [/Corruption in public life – Anti-corruption measures/gi, 'பொதுவாழ்வில் ஊழல் – ஊழல் தடுப்பு நடவடிக்கைகள்'],
  [/Lokpal and Lok Ayukta/gi, 'லோக்பால் மற்றும் லோக் ஆயுக்தா'],
  [/Right to Information/gi, 'தகவல் அறியும் உரிமைச் சட்டம்'],
  [/Empowerment of Women/gi, 'பெண்கள் மேம்பாடு'],
  [/Consumer Protection Forums, Human Rights Charter/gi, 'நுகர்வோர் பாதுகாப்பு அமைப்புகள், மனித உரிமைகள் சாசனம்'],
  [/Nature of Indian Economy/gi, 'இந்தியப் பொருளாதாரத்தின் இயல்பு'],
  [/Five year plan models – an assessment/gi, 'ஐந்தாண்டு திட்ட மாதிரிகள் – ஓர் மதிப்பீடு'],
  [/Planning Commission and Niti Ayog/gi, 'திட்டக்குழு மற்றும் நிதி ஆயோக்'],
  [/Sources of revenue – Reserve Bank of India/gi, 'வருவாய் ஆதாரங்கள் – இந்திய ரிசர்வ் வங்கி'],
  [/Fiscal Policy and Monetary Policy/gi, 'நிதிக் கொள்கை மற்றும் பணவியல் கொள்கை'],
  [/Finance Commission – Resource sharing between Union and State Governments/gi, 'நிதி ஆணையம் – மத்திய மற்றும் மாநில அரசுகளுக்கிடையேயான நிதிப் பகிர்வு'],
  [/Goods and Services Tax/gi, 'சரக்கு மற்றும் சேவை வரி (GST)'],
  [/Structure of Indian Economy and Employment Generation/gi, 'இந்தியப் பொருளாதாரத்தின் கட்டமைப்பு மற்றும் வேலைவாய்ப்பு உருவாக்கம்'],
  [/Land Reforms and Agriculture/gi, 'நிலச் சீர்திருத்தங்கள் மற்றும் வேளாண்மை'],
  [/Application of Science and Technology in Agriculture/gi, 'வேளாண்மையில் அறிவியல் மற்றும் தொழில்நுட்பத்தின் பயன்பாடு'],
  [/Industrial growth/gi, 'தொழில் வளர்ச்சி'],
  [/Rural welfare oriented programmes/gi, 'ஊரக நலம் சார்ந்த திட்டங்கள்'],
  [/Social problems – Population, Education, Health, Employment, Poverty/gi, 'சமூகப் பிரச்சனைகள் – மக்கள் தொகை, கல்வி, நல்வாழ்வு, வேலைவாய்ப்பு, வறுமை'],
  [/National Renaissance/gi, 'தேசிய மறுமலர்ச்சி'],
  [/Early uprising against British rule/gi, 'ஆங்கிலேயர் ஆட்சிக்கு எதிரான தொடக்ககால எழுச்சிகள்'],
  [/Indian National Congress/gi, 'இந்திய தேசிய காங்கிரஸ்'],
  [/Emergence of leaders/gi, 'தலைவர்கள் உருவாதல்'],
  [/Different modes of agitations/gi, 'போராட்டத்தின் பல்வேறு வடிவங்கள்'],
  [/Growth of Satyagraha and Militant Movements/gi, 'சத்தியாகிரகம் மற்றும் புரட்சிகர இயக்கங்களின் வளர்ச்சி'],
  [/Communalism and partition/gi, 'வகுப்புவாதம் மற்றும் பிரிவினை'],
  [/History of Tamil Society, related Archaeological discoveries/gi, 'தமிழ் சமூக வரலாறு, தொடர்பான தொல்லியல் கண்டுபிடிப்புகள்'],
  [/Tamil Literature from Sangam age till contemporary times/gi, 'சங்க காலம் முதல் சமகாலம் வரையிலான தமிழ் இலக்கியம்'],
  [/Thirukkural/gi, 'திருக்குறள்'],
  [/Significance as a Secular literature/gi, 'மதச்சார்பற்ற இலக்கியம் என்ற முக்கியத்துவம்'],
  [/Relevance to Everyday Life/gi, 'அன்றாட வாழ்வியலோடு தொடர்பு'],
  [/Impact of Thirukkural on Humanity/gi, 'மனிதகுலத்தின் மீதான திருக்குறளின் தாக்கம்'],
  [/Thirukkural and Universal Values/gi, 'திருக்குறளும் உலகளாவிய விழுமியங்களும்'],
  [/Relevance to Socio – Politico – Economic affairs/gi, 'சமூக – அரசியல் – பொருளாதார நிகழ்வுகளில் திருக்குறளின் பொருத்தம்'],
  [/Philosophical content in Thirukkural/gi, 'திருக்குறளின் தத்துவக் கோட்பாடுகள்'],
  [/Early agitations against British Rule/gi, 'பிரிட்டிஷ் ஆட்சிக்கு எதிரான தொடக்ககால போராட்டங்கள்'],
  [/Role of Tamil Nadu in freedom struggle/gi, 'விடுதலைப் போராட்டத்தில் தமிழ்நாட்டின் பங்கு'],
  [/Women in freedom struggle/gi, 'விடுதலைப் போராட்டத்தில் பெண்கள்'],
  [/Evolution of 19th and 20th Century Socio-Political movements in Tamil Nadu/gi, 'தமிழ்நாட்டில் 19 மற்றும் 20-ஆம் நூற்றாண்டு சமூக-அரசியல் இயக்கங்களின் பரிணாமம்'],
  [/Justice Party/gi, 'நீதிக்கட்சி'],
  [/Growth of Rationalism/gi, 'பகுத்தறிவின் வளர்ச்சி'],
  [/Self Respect Movement/gi, 'சுயமரியாதை இயக்கம்'],
  [/Dravidian movement and Principles/gi, 'திராவிட இயக்கம் மற்றும் அதன் கொள்கைகள்'],
  [/Contributions of Thanthai Periyar and Perarignar Anna/gi, 'தந்தை பெரியார் மற்றும் பேரறிஞர் அண்ணாவின் பங்களிப்புகள்'],
  [/Human Development Indicators in Tamil Nadu/gi, 'தமிழ்நாட்டின் மனித மேம்பாட்டுக் குறியீடுகள்'],
  [/Impact of Social Reform movements in the Socio - Economic Development of Tamil Nadu/gi, 'தமிழ்நாட்டின் சமூக-பொருளாதார வளர்ச்சியில் சமூக சீர்திருத்த இயக்கங்களின் தாக்கம்'],
  [/Political parties and Welfare schemes for various sections of people/gi, 'அரசியல் கட்சிகளும் பல்வேறு தரப்பு மக்களுக்கான நலத்திட்டங்களும்'],
  [/Rationale behind Reservation Policy and access to Social Resources/gi, 'இடஒதுக்கீட்டுக் கொள்கையின் பின்னணியும் சமூக வளங்களுக்கான அணுகலும்'],
  [/Economic trends in Tamil Nadu/gi, 'தமிழ்நாட்டின் பொருளாதாரப் போக்குகள்'],
  [/Role and impact of social welfare schemes in the Socio - Economic Development of Tamil Nadu/gi, 'தமிழ்நாட்டின் சமூக-பொருளாதார வளர்ச்சியில் சமூக நலத்திட்டங்களின் பங்கும் தாக்கமும்'],
  [/Social Justice and Social Harmony as the Cornerstones of Socio - Economic development/gi, 'சமூக-பொருளாதார வளர்ச்சியின் அடித்தளமாக சமூக நீதியும் சமூக நல்லிணக்கமும்'],
  [/Education and Health systems in Tamil Nadu/gi, 'தமிழ்நாட்டின் கல்வி மற்றும் நலவாழ்வு அமைப்புகள்'],
  [/Geography of Tamil Nadu and its impact on Economic growth/gi, 'தமிழ்நாட்டின் புவியியல் மற்றும் பொருளாதார வளர்ச்சியில் அதன் தாக்கம்'],
  [/Achievements of Tamil Nadu in various fields/gi, 'பல்வேறு துறைகளில் தமிழ்நாட்டின் சாதனைகள்'],
  [/e-governance in Tamil Nadu/gi, 'தமிழ்நாட்டில் மின்னாளுமை'],
  [/Simplification/gi, 'சுருக்குதல்'],
  [/Percentage/gi, 'விழுக்காடு'],
  [/Highest Common Factor \\(HCF\\)/gi, 'மீப்பெரு பொது காரணி (HCF)'],
  [/Lowest Common Multiple \\(LCM\\)/gi, 'மீச்சிறு பொது மடங்கு (LCM)'],
  [/Ratio and Proportion/gi, 'விகிதம் மற்றும் விகிதாச்சாரம்'],
  [/Simple interest/gi, 'தனிவட்டி'],
  [/Compound interest/gi, 'கூட்டுவட்டி'],
  [/Area/gi, 'பரப்பளவு'],
  [/Volume/gi, 'கொள்ளளவு / கன அளவு'],
  [/Time and Work/gi, 'காலம் மற்றும் வேலை'],
  [/Logical reasoning/gi, 'தர்க்க அறிவு'],
  [/Visual reasoning/gi, 'காட்சி தர்க்க அறிவு'],
  [/Puzzles/gi, 'புதிர்கள்'],
  [/Dice/gi, 'பகடை'],
  [/Number series/gi, 'எண் தொடர்']
];

/**
 * Translates a syllabus topic chip into authentic Tamil.
 */
export function translateTopic(topic: string, lang: Language): string {
  if (lang !== 'ta') return topic
  if (EXACT_TOPIC_TRANSLATIONS[topic]) {
    return EXACT_TOPIC_TRANSLATIONS[topic]
  }

  // Fallback: replace known phrases systematically
  let translated = topic
  for (const [pattern, replacement] of TOPIC_PHRASE_MAPPINGS) {
    translated = translated.replace(pattern, replacement)
  }
  return translated
}

/**
 * Translates a lesson title.
 */
export function translateLessonTitle(title: string, lang: Language): string {
  if (lang !== 'ta') return title
  if (EXACT_LESSON_TITLES[title]) {
    return EXACT_LESSON_TITLES[title]
  }
  if (EXACT_TOPIC_TRANSLATIONS[title]) {
    return EXACT_TOPIC_TRANSLATIONS[title]
  }

  let translated = title
  for (const [pattern, replacement] of TOPIC_PHRASE_MAPPINGS) {
    translated = translated.replace(pattern, replacement)
  }
  return translated
}

/**
 * Translates a lesson description.
 */
export function translateLessonDescription(desc: string | undefined, lang: Language): string | undefined {
  if (!desc || lang !== 'ta') return desc

  let translated = desc
  for (const [pattern, replacement] of TOPIC_PHRASE_MAPPINGS) {
    translated = translated.replace(pattern, replacement)
  }
  return translated
}

/**
 * Translates term names ("Term 1" -> "பருவம் 1")
 */
export function translateTerm(term: string | undefined, lang: Language): string | undefined {
  if (!term || lang !== 'ta') return term
  return term
    .replace(/Term 1/gi, 'பருவம் 1')
    .replace(/Term 2/gi, 'பருவம் 2')
    .replace(/Term 3/gi, 'பருவம் 3')
}

/**
 * Translates lesson status ("Available" -> "கிடைக்கக்கூடியவை", "Coming Soon" -> "விரைவில் வரும்")
 */
export function translateStatus(status: string | undefined, lang: Language): string {
  if (!status || lang !== 'ta') return status || ''
  if (status === 'Available') return 'கிடைக்கக்கூடியவை'
  if (status === 'Coming Soon') return 'விரைவில் வரும்'
  return status
}

/**
 * Translates School Standard ("6th Standard" -> "6-ஆம் வகுப்பு")
 */
export function translateClassTitle(classTitleOrId: string | number | undefined, lang: Language): string {
  if (classTitleOrId === undefined || classTitleOrId === null) return ''
  if (lang !== 'ta') return typeof classTitleOrId === 'number' ? \`\${classTitleOrId}th Standard\` : String(classTitleOrId)

  const str = String(classTitleOrId)
  const numMatch = str.match(/\\d+/)
  if (numMatch) {
    return \`\${numMatch[0]}-ஆம் வகுப்பு\`
  }
  return str.replace(/Standard/gi, 'வகுப்பு')
}

/**
 * Translates General Studies Unit Titles
 */
export function translateUnitTitle(unitId: number | string | undefined, fallbackTitle: string, lang: Language): string {
  if (lang !== 'ta') return fallbackTitle
  const id = typeof unitId === 'string' ? parseInt(unitId, 10) : unitId

  switch (id) {
    case 1:
      return 'பொது அறிவியல்'
    case 2:
      return 'இந்தியப் புவியியல்'
    case 3:
      return 'இந்தியாவின் வரலாறும் பண்பாடும்'
    case 4:
      return 'இந்திய ஆட்சியியல்'
    case 5:
      return 'இந்தியப் பொருளாதாரம்'
    case 6:
      return 'இந்திய தேசிய இயக்கம்'
    case 7:
      return 'தமிழ்நாட்டின் வரலாறு, பண்பாடு, மரபு மற்றும் சமூக-அரசியல் இயக்கங்கள்'
    case 8:
      return 'தமிழ்நாட்டில் வளர்ச்சி நிர்வாகம்'
    case 9:
      return 'திறனறிவும் மனக்கணக்கு நுண்ணறிவும்'
    case 10:
      return 'திறனறிவும் மனக்கணக்கு நுண்ணறிவும்'
    default:
      return fallbackTitle || \`அலகு \${unitId}\`
  }
}

/**
 * Translates Unit Number (e.g. "Unit 1" -> "அலகு 1", "Unit I" -> "அலகு 1")
 */
export function translateUnitNumber(unitNumber: string | number, lang: Language): string {
  if (lang !== 'ta') return String(unitNumber)
  const str = String(unitNumber)
  const numMatch = str.match(/\\d+/)
  if (numMatch) {
    return \`அலகு \${numMatch[0]}\`
  }
  if (str.includes('VI')) return 'அலகு 6'
  if (str.includes('IV')) return 'அலகு 4'
  if (str.includes('V')) return 'அலகு 5'
  if (str.includes('III')) return 'அலகு 3'
  if (str.includes('II')) return 'அலகு 2'
  if (str.includes('I')) return 'அலகு 1'
  return str.replace(/Unit/gi, 'அலகு')
}

/**
 * Translates School Subject Name
 */
export function translateSubjectName(name: string, lang: Language): string {
  if (lang !== 'ta') return name
  if (name.includes('Science')) return 'அறிவியல் (சமச்சீர் கல்வி)'
  if (name.includes('Geography')) return 'சமூக அறிவியல் - புவியியல்'
  if (name.includes('History')) return 'சமூக அறிவியல் - வரலாறு'
  if (name.includes('Civics') || name.includes('Polity')) return 'குடிமையியல் / இந்திய ஆட்சியியல்'
  if (name.includes('Economics')) return 'சமூக அறிவியல் - பொருளாதாரம்'
  return name.replace('Samacheer Kalvi', 'சமச்சீர் கல்வி')
}

/**
 * Helper to translate generic school lesson object
 */
export function translateLesson<T extends {
  title: string
  description?: string
  term?: string
  status?: string
  keyConcepts?: string[]
  studyNotes?: string[]
}>(
  lesson: T,
  lang: Language
): T {
  if (lang !== 'ta') return lesson
  return {
    ...lesson,
    title: translateLessonTitle(lesson.title, lang),
    description: translateLessonDescription(lesson.description, lang),
    term: translateTerm(lesson.term, lang),
    status: translateStatus(lesson.status, lang) as any,
    keyConcepts: lesson.keyConcepts ? lesson.keyConcepts.map((k) => translateTopic(k, lang)) : undefined,
    studyNotes: lesson.studyNotes ? lesson.studyNotes.map((n) => translateTopic(n, lang)) : undefined,
  }
}
`;

  fs.writeFileSync('src/utils/bilingualSyllabus.ts', template);
  console.log('Successfully wrote src/utils/bilingualSyllabus.ts!');
}
