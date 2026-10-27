const fs = require('fs');
const path = require('path');

// Complete curriculum definition for all 49 combinations (7 units x 7 standards)
// With strictly isolated Term 1, Term 2, and Term 3 lessons

const unitsData = [
  {
    id: 1,
    unitNumber: 'அலகு I',
    unitTitle: 'இலக்கணம் (Grammar)',
    topicsPrefix: 'இலக்கணம்',
  },
  {
    id: 2,
    unitNumber: 'அலகு II',
    unitTitle: 'செய்யுள் & சங்க இலக்கியம் (Ancient & Classical Tamil Literature)',
    topicsPrefix: 'சங்க இலக்கியம் & செய்யுள்',
  },
  {
    id: 3,
    unitNumber: 'அலகு III',
    unitTitle: 'அற இலக்கியங்கள் & காப்பியங்கள் (Ethical Literature & Epics)',
    topicsPrefix: 'அற இலக்கியம் & காப்பியம்',
  },
  {
    id: 4,
    unitNumber: 'அலகு IV',
    unitTitle: 'பக்தி இலக்கியம் & சிற்றிலக்கியங்கள் (Devotional Literature & Minor Epics)',
    topicsPrefix: 'பக்தி இலக்கியம் & சிற்றிலக்கியம்',
  },
  {
    id: 5,
    unitNumber: 'அலகு V',
    unitTitle: 'நவீன இலக்கியம் & உரைநடை (Modern Literature & Prose)',
    topicsPrefix: 'நவீன இலக்கியம் & உரைநடை',
  },
  {
    id: 6,
    unitNumber: 'அலகு VI',
    unitTitle: 'தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும் (Tamil Scholars & Contribution to Tamil)',
    topicsPrefix: 'தமிழறிஞர்கள் & தமிழ்த்தொண்டு',
  },
  {
    id: 7,
    unitNumber: 'அலகு VII',
    unitTitle: 'கடித இலக்கியம், நாட்டுப்புறக் கலைகள் & பயன்பாட்டுத் தமிழ் (Epistolary Literature, Folk Arts & Applied Tamil)',
    topicsPrefix: 'பயன்பாட்டுத் தமிழ் & கலைகள்',
  },
];

const standardsData = [
  { id: 6, label: '6th Standard', tamilName: 'சமச்சீர் கல்வி 6-ஆம் வகுப்பு' },
  { id: 7, label: '7th Standard', tamilName: 'சமச்சீர் கல்வி 7-ஆம் வகுப்பு' },
  { id: 8, label: '8th Standard', tamilName: 'சமச்சீர் கல்வி 8-ஆம் வகுப்பு' },
  { id: 9, label: '9th Standard', tamilName: 'சமச்சீர் கல்வி 9-ஆம் வகுப்பு' },
  { id: 10, label: '10th Standard', tamilName: 'சமச்சீர் கல்வி 10-ஆம் வகுப்பு' },
  { id: 11, label: '11th Standard', tamilName: 'சமச்சீர் கல்வி 11-ஆம் வகுப்பு' },
  { id: 12, label: '12th Standard', tamilName: 'சமச்சீர் கல்வி 12-ஆம் வகுப்பு' },
];

console.log('Building curriculum table...');
