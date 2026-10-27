const fs = require('fs');
const path = require('path');

const unit1Defs = require('./curriculum_defs.cjs'); // has 1-* keys
const unit2Defs = require('./unit2_defs.cjs');
const unit3Defs = require('./unit3_defs.cjs');
const unit4Defs = require('./unit4_defs.cjs');
const unit5Defs = require('./unit5_defs.cjs');
const unit6Defs = require('./unit6_defs.cjs');
const unit7Defs = require('./unit7_defs.cjs');

// Combine all definitions
const allDefs = {
  ...unit1Defs,
  ...unit2Defs,
  ...unit3Defs,
  ...unit4Defs,
  ...unit5Defs,
  ...unit6Defs,
  ...unit7Defs
};

console.log(`Loaded ${Object.keys(allDefs).length} total term lessons across units 1 to 7.`);

const units = [
  { id: 1, num: 'அலகு I', title: 'இலக்கணம் (Grammar)', qCount: 25 },
  { id: 2, num: 'அலகு II', title: 'செய்யுள் & சங்க இலக்கியம் (Ancient & Classical Tamil Literature)', qCount: 20 },
  { id: 3, num: 'அலகு III', title: 'அற இலக்கியங்கள் & காப்பியங்கள் (Ethical Literature & Epics)', qCount: 15 },
  { id: 4, num: 'அலகு IV', title: 'பக்தி இலக்கியம் & சிற்றிலக்கியங்கள் (Devotional Literature & Minor Epics)', qCount: 10 },
  { id: 5, num: 'அலகு V', title: 'நவீன இலக்கியம் & உரைநடை (Modern Literature & Prose)', qCount: 10 },
  { id: 6, num: 'அலகு VI', title: 'தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும் (Tamil Scholars & Contribution to Tamil)', qCount: 10 },
  { id: 7, num: 'அலகு VII', title: 'கடித இலக்கியம், நாட்டுப்புறக் கலைகள் & பயன்பாட்டுத் தமிழ் (Epistolary Literature, Folk Arts & Applied Tamil)', qCount: 10 },
];

const standards = [
  { id: 6, label: '6th Standard', tamilName: 'சமச்சீர் கல்வி 6-ஆம் வகுப்பு' },
  { id: 7, label: '7th Standard', tamilName: 'சமச்சீர் கல்வி 7-ஆம் வகுப்பு' },
  { id: 8, label: '8th Standard', tamilName: 'சமச்சீர் கல்வி 8-ஆம் வகுப்பு' },
  { id: 9, label: '9th Standard', tamilName: 'சமச்சீர் கல்வி 9-ஆம் வகுப்பு' },
  { id: 10, label: '10th Standard', tamilName: 'சமச்சீர் கல்வி 10-ஆம் வகுப்பு' },
  { id: 11, label: '11th Standard', tamilName: 'சமச்சீர் கல்வி 11-ஆம் வகுப்பு' },
  { id: 12, label: '12th Standard', tamilName: 'சமச்சீர் கல்வி 12-ஆம் வகுப்பு' },
];

function getTopicsFor(unitId, stdId) {
  const stdLabel = `${stdId}-ஆம் வகுப்பு`;
  switch(unitId) {
    case 1:
      return [
        `${stdLabel}: தமிழ் எழுத்து இலக்கணம், வகை, தொகை & மாத்திரை`,
        `${stdLabel}: சந்திப்பிழை நீக்குதல் – வல்லினம் மிகும் மிகா இடங்கள்`,
        `${stdLabel}: மயங்கொலி வேறுபாடுகள் (ல-ள-ழ, ன-ண, ர-ற)`,
        `${stdLabel}: வேர்ச்சொல் அறிதல் & வினைமுற்று-எச்ச வகைகள்`,
        `${stdLabel}: ஒருமைப் பன்மை பிழை திருத்தம் & தொடரமைப்பு விதிகள்`
      ];
    case 2:
      return [
        `${stdLabel}: சங்க இலக்கிய நூல்கள் (எட்டுத்தொகை, பத்துப்பாட்டு)`,
        `${stdLabel}: அகநானூறு, புறநானூறு, நற்றிணை, குறுந்தொகை சிறப்புகள்`,
        `${stdLabel}: பாடல் மேற்கோள்கள், ஆசிரியர் குறிப்புகள் & திணை மரபுகள்`,
        `${stdLabel}: சங்க காலத் தமிழர் வீரம், கொடை, காதல் மற்றும் பண்பாடு`,
        `${stdLabel}: செய்யுள் நயங்கள், சொல்லும் பொருளும் & வினா-விடைப் பயிற்சி`
      ];
    case 3:
      return [
        `${stdLabel}: திருக்குறள் (அறத்துப்பால், பொருட்பால், காமத்துப்பால் சிறப்புகள்)`,
        `${stdLabel}: பதினெண்கீழ்க்கணக்கு அற நூல்கள் (நாலடியார், திரிகடுகம், பழமொழி)`,
        `${stdLabel}: ஐம்பெருங்காப்பியங்கள் (சிலப்பதிகாரம், மணிமேகலை, சீவக சிந்தாமணி)`,
        `${stdLabel}: ஐஞ்சிறுங்காப்பியங்கள் (நீலகேசி, யசோதர காவியம்) & பாத்திரப் படைப்புகள்`,
        `${stdLabel}: வாழ்வியல் விழுமியங்கள், அறநெறிகள் & தேர்வு நோக்கிலான வினாக்கள்`
      ];
    case 4:
      return [
        `${stdLabel}: பன்னிரு திருமுறைகள் (தேவாரம், திருவாசகம், திருத்தொண்டர் புராணம்)`,
        `${stdLabel}: நாலாயிரத் திவ்வியப் பிரபந்தம் (திருப்பாவை, நாச்சியார் திருமொழி)`,
        `${stdLabel}: சிற்றிலக்கியங்கள் 96 வகைகள் (பரணி, கலம்பகம், பிள்ளைத்தமிழ், தூது)`,
        `${stdLabel}: குற்றாலக் குறவஞ்சி, பள்ளு, அந்தாதி, சதகம் & கலிவெண்பா`,
        `${stdLabel}: இஸ்லாமிய, கிறித்தவ பக்தி இலக்கியங்கள் (சீறாப்புராணம், தேம்பாவணி)`
      ];
    case 5:
      return [
        `${stdLabel}: மகாகவி பாரதியார், புரட்சிக்கவிஞர் பாரதிதாசன் கவிதைகள்`,
        `${stdLabel}: கவிமணி தேசிக விநாயகம், நாமக்கல் கவிஞர், பட்டுக்கோட்டையார் பாடல்கள்`,
        `${stdLabel}: நவீன உரைநடை வளர்ச்சி & மரபுக்கவிதை vs புதுக்கவிதை`,
        `${stdLabel}: சிறுகதை, புதினம், நாடகம் முன்னோடிகள் & படைப்புகள்`,
        `${stdLabel}: கவிக்கோ அப்துல் ரகுமான், சிற்பி, மு.மேத்தா, வைரமுத்து கவிதைகள்`
      ];
    case 6:
      return [
        `${stdLabel}: தமிழ்த்தாத்தா உ.வே.சா, பரிதிமாற்கலைஞர் தமிழ்த் தொண்டு`,
        `${stdLabel}: மொழிஞாயிறு தேவநேயப் பாவாணர், மறைமலையடிகள் தனித்தமிழ்ப் பணி`,
        `${stdLabel}: ஜி.யு.போப், வீரமாமுனிவர், கால்டுவெல் மொழிபெயர்ப்பு & ஆய்வுகள்`,
        `${stdLabel}: தந்தை பெரியார், பேரறிஞர் அண்ணா, காமராசர், அம்பேத்கர் சீர்திருத்தங்கள்`,
        `${stdLabel}: மகளிர் ஆளுமைகள்: வேலுநாச்சியார், முத்துலட்சுமி ரெட்டி, மூவலூர் ராமாமிர்தம்`
      ];
    case 7:
      return [
        `${stdLabel}: கடித இலக்கியம் (நேரு, அண்ணா, காந்தி, பாரதியார் கடிதங்கள்)`,
        `${stdLabel}: நாட்டுப்புறக் கலைகள் (கரகாட்டம், ஒயிலாட்டம், பொம்மலாட்டம், தெருக்கூத்து)`,
        `${stdLabel}: பயண இலக்கியம் & தமிழ் இதழியல் வரலாற்று வளர்ச்சி`,
        `${stdLabel}: கலைச்சொல்லாக்கம், கணினித் தமிழ் & மொழிபெயர்ப்பு நெறிமுறைகள்`,
        `${stdLabel}: கல்வெட்டுகள், செப்பேடுகள் & ஆட்சிமொழித் தமிழ் பயன்பாடுகள்`
      ];
    default:
      return [`${stdLabel}: பொதுத்தமிழ் பாடங்கள்`];
  }
}

let out = `// TNPSC Group 2 & 2A General Tamil (பொதுத் தமிழ்) Samacheer Kalvi Mapping
// 100% Comprehensive Mapping across Units 1 to 7 and Standards 6 to 12
// Official Syllabus Code: 495 / SSLC Standard (100 Questions)
// Source: Tamil Nadu State Board (Samacheer Kalvi) Textbooks
// Strictly structured by Standard -> Term (Term 1, Term 2, Term 3) -> Lessons

import type { Group2UnitClassData } from './group2ClassSyllabusData'

export const group2TamilRegistry: Record<string, Group2UnitClassData> = {
`;

let keyCount = 0;
let lessonCount = 0;

for (const unit of units) {
  for (const std of standards) {
    keyCount++;
    const key = `general-tamil-${unit.id}-${std.id}`;
    const topics = getTopicsFor(unit.id, std.id);

    const lessons = [];
    for (let termNum = 1; termNum <= 3; termNum++) {
      const defKey = `${unit.id}-${std.id}-${termNum}`;
      const def = allDefs[defKey];
      if (def) {
        lessonCount++;
        lessons.push({
          id: `gt-${unit.id}-${std.id}-t${termNum}-l1`,
          lessonNumber: `${unit.id}.${termNum}`,
          term: `Term ${termNum}`,
          title: def.title,
          description: def.desc,
          status: 'Available',
          keyConcepts: def.concepts,
          studyNotes: def.notes,
          practiceMCQs: [
            {
              id: `mcq-gt-${unit.id}-${std.id}-t${termNum}-1`,
              question: def.q,
              options: def.opts,
              correctAnswer: def.ans,
              explanation: def.exp,
            }
          ]
        });
      }
    }

    const entry = {
      subjectId: 'general-tamil',
      unitId: unit.id,
      classId: std.id,
      subjectTitle: 'பொதுத் தமிழ்',
      unitTitle: unit.title,
      unitNumber: unit.num,
      classTitle: std.label,
      standardNumber: std.id,
      subjectName: `தமிழ் (${std.tamilName})`,
      topics: topics,
      lessons: lessons,
    };

    out += `  "${key}": ${JSON.stringify(entry, null, 2)},\n`;
  }
}

out += `};\n`;

fs.writeFileSync('./src/data/group2TamilData.ts', out, 'utf8');
console.log(`Successfully generated group2TamilData.ts with ${keyCount} registry keys and ${lessonCount} total lessons!`);
