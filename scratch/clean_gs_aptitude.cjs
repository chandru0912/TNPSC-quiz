// scratch/clean_gs_aptitude.cjs
const fs = require('fs');
const path = require('path');

// 1. Process group2SyllabusData.ts
const g2Path = path.resolve(__dirname, '../src/data/group2SyllabusData.ts');
let g2Content = fs.readFileSync(g2Path, 'utf8');

const g2Lines = g2Content.split('\n');
const tamilRegex = /[\u0B80-\u0BFF]/;

let inTargetSection = false;
let updatedLinesG2 = [];

for (let i = 0; i < g2Lines.length; i++) {
  const line = g2Lines[i];
  if (line.includes('const generalStudiesSubject: Group2Subject = {')) {
    inTargetSection = true;
  } else if (line.includes('const generalEnglishSubject: Group2Subject = {')) {
    inTargetSection = false;
  }

  if (inTargetSection) {
    if (line.includes('tamilTitle:') && tamilRegex.test(line)) {
      continue;
    }
    let updatedLine = line;
    if (line.trim().startsWith("unitNumber: 'Unit I'")) {
      updatedLine = line.replace("'Unit I'", "'Unit 1'");
    } else if (line.trim().startsWith("unitNumber: 'Unit II'")) {
      updatedLine = line.replace("'Unit II'", "'Unit 2'");
    } else if (line.trim().startsWith("unitNumber: 'Unit III'")) {
      updatedLine = line.replace("'Unit III'", "'Unit 3'");
    } else if (line.trim().startsWith("unitNumber: 'Unit IV'")) {
      updatedLine = line.replace("'Unit IV'", "'Unit 4'");
    } else if (line.trim().startsWith("unitNumber: 'Unit V'")) {
      updatedLine = line.replace("'Unit V'", "'Unit 5'");
    } else if (line.trim().startsWith("unitNumber: 'Unit VI'")) {
      updatedLine = line.replace("'Unit VI'", "'Unit 6'");
    }
    updatedLinesG2.push(updatedLine);
  } else {
    updatedLinesG2.push(line);
  }
}

fs.writeFileSync(g2Path, updatedLinesG2.join('\n'), 'utf8');
console.log('Successfully updated group2SyllabusData.ts');

// 2. Process group4SyllabusData.ts
const g4Path = path.resolve(__dirname, '../src/data/group4SyllabusData.ts');
let g4Content = fs.readFileSync(g4Path, 'utf8');
const g4Lines = g4Content.split('\n');

let inTargetG4 = false;
let updatedLinesG4 = [];

for (let i = 0; i < g4Lines.length; i++) {
  const line = g4Lines[i];
  if (line.includes('export const group4GeneralStudiesSubject: Group4Subject = {')) {
    inTargetG4 = true;
  } else if (line.includes('export const group4GeneralTamilSubject: Group4Subject = {')) {
    inTargetG4 = false;
  }

  if (inTargetG4) {
    if (line.includes('tamilTitle:') && tamilRegex.test(line)) {
      continue;
    }
    let updatedLine = line;
    if (line.trim().startsWith("unitNumber: 'Unit I'")) {
      updatedLine = line.replace("'Unit I'", "'Unit 1'");
    } else if (line.trim().startsWith("unitNumber: 'Unit II'")) {
      updatedLine = line.replace("'Unit II'", "'Unit 2'");
    } else if (line.trim().startsWith("unitNumber: 'Unit III'")) {
      updatedLine = line.replace("'Unit III'", "'Unit 3'");
    } else if (line.trim().startsWith("unitNumber: 'Unit IV'")) {
      updatedLine = line.replace("'Unit IV'", "'Unit 4'");
    } else if (line.trim().startsWith("unitNumber: 'Unit V'")) {
      updatedLine = line.replace("'Unit V'", "'Unit 5'");
    } else if (line.trim().startsWith("unitNumber: 'Unit VI'")) {
      updatedLine = line.replace("'Unit VI'", "'Unit 6'");
    }
    updatedLinesG4.push(updatedLine);
  } else {
    updatedLinesG4.push(line);
  }
}

fs.writeFileSync(g4Path, updatedLinesG4.join('\n'), 'utf8');
console.log('Successfully updated group4SyllabusData.ts');
