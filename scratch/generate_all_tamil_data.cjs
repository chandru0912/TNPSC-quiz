// Generator script for complete TNPSC Group 2/2A General Tamil Samacheer Kalvi Mapping
// Generates all 49 keys (Units 1-7 x Standards 6-12)
// Strictly adhering to Term 1, Term 2, and Term 3 separation

const fs = require('fs');
const path = require('path');

const units = [
  { id: 1, number: 'அலகு I', title: 'இலக்கணம் (Grammar)', qCount: 25 },
  { id: 2, number: 'அலகு II', title: 'செய்யுள் & சங்க இலக்கியம் (Ancient & Classical Tamil Literature)', qCount: 20 },
  { id: 3, number: 'அலகு III', title: 'அற இலக்கியங்கள் & காப்பியங்கள் (Ethical Literature & Epics)', qCount: 15 },
  { id: 4, number: 'அலகு IV', title: 'பக்தி இலக்கியம் & சிற்றிலக்கியங்கள் (Devotional Literature & Minor Epics)', qCount: 10 },
  { id: 5, number: 'அலகு V', title: 'நவீன இலக்கியம் & உரைநடை (Modern Literature & Prose)', qCount: 10 },
  { id: 6, number: 'அலகு VI', title: 'தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும் (Tamil Scholars & Contribution to Tamil)', qCount: 10 },
  { id: 7, number: 'அலகு VII', title: 'கடித இலக்கியம், நாட்டுப்புறக் கலைகள் & பயன்பாட்டுத் தமிழ் (Epistolary Literature, Folk Arts & Applied Tamil)', qCount: 10 },
];

const standards = [
  { id: 6, title: '6th Standard', tamilName: 'சமச்சீர் கல்வி 6-ஆம் வகுப்பு' },
  { id: 7, title: '7th Standard', tamilName: 'சமச்சீர் கல்வி 7-ஆம் வகுப்பு' },
  { id: 8, title: '8th Standard', tamilName: 'சமச்சீர் கல்வி 8-ஆம் வகுப்பு' },
  { id: 9, title: '9th Standard', tamilName: 'சமச்சீர் கல்வி 9-ஆம் வகுப்பு' },
  { id: 10, title: '10th Standard', tamilName: 'சமச்சீர் கல்வி 10-ஆம் வகுப்பு' },
  { id: 11, title: '11th Standard', tamilName: 'சமச்சீர் கல்வி 11-ஆம் வகுப்பு' },
  { id: 12, title: '12th Standard', tamilName: 'சமச்சீர் கல்வி 12-ஆம் வகுப்பு' },
];

console.log(`Setting up generator for ${units.length} units x ${standards.length} standards = 49 registry keys.`);
