const fs = require('fs');
const path = require('path');

// Master script to generate all 49 keys with Term 1, Term 2, Term 3
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

console.log('Master generator script ready to write...');
