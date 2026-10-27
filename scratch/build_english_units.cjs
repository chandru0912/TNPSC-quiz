// scratch/build_english_units.cjs
const fs = require('fs');
const path = require('path');

// We will build all 7 units for Group 2 / 2A General English
const u1 = require('./english_u1.cjs');
const u2 = require('./english_u2.cjs');
const u3 = require('./english_u3.cjs');
const u4 = require('./english_u4.cjs');
const u5 = require('./english_u5.cjs');
const u6 = require('./english_u6.cjs');
const u7 = require('./english_u7.cjs');

const allUnits = [u1, u2, u3, u4, u5, u6, u7];

const fileContent = `// Comprehensive TNPSC Group 2 & 2A General English Syllabus Data
// 100% Comprehensive Coverage across Units 1 to 7 matching the official syllabus
// Official Syllabus Code: 495 / SSLC Standard (100 Questions)
// Covers all lessons, subtopics, study notes, key concepts, and MCQs

import type { Group2Unit } from './group2SyllabusData'

export const group2GeneralEnglishUnits: Group2Unit[] = ${JSON.stringify(allUnits, null, 2)}
`;

const targetPath = path.resolve(__dirname, '../src/data/generalEnglishComprehensiveData.ts');
fs.writeFileSync(targetPath, fileContent, 'utf-8');
console.log('Successfully wrote', targetPath, 'Size:', (fileContent.length / 1024).toFixed(2), 'KB');
