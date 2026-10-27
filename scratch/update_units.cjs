const fs = require('fs');

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.log('Skipping missing file:', filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', filePath);
  } else {
    console.log('No matches in:', filePath);
  }
}

// 1. group2ClassSyllabusData.ts
replaceInFile('src/data/group2ClassSyllabusData.ts', [
  ["unitNumber: 'Unit I',", "unitNumber: 'Unit 1',"],
  ["unitNumber: 'Unit II',", "unitNumber: 'Unit 2',"],
]);

// 2. group2Unit3Data.ts
replaceInFile('src/data/group2Unit3Data.ts', [
  ["unitNumber: 'Unit III',", "unitNumber: 'Unit 3',"],
]);

// 3. group2Unit4Data.ts
replaceInFile('src/data/group2Unit4Data.ts', [
  ["unitNumber: 'Unit IV',", "unitNumber: 'Unit 4',"],
]);

// 4. group2Unit5Data.ts
replaceInFile('src/data/group2Unit5Data.ts', [
  ["unitNumber: 'Unit V',", "unitNumber: 'Unit 5',"],
]);

// 5. group2Unit6Data.ts
replaceInFile('src/data/group2Unit6Data.ts', [
  ["unitNumber: 'Unit VI',", "unitNumber: 'Unit 6',"],
]);

// 6. group2LanguageData.ts
replaceInFile('src/data/group2LanguageData.ts', [
  ["unitNumber: 'Unit I',", "unitNumber: 'Unit 1',"],
  ["unitNumber: 'Unit II',", "unitNumber: 'Unit 2',"],
]);

// 7. group4ClassSyllabusData.ts
replaceInFile('src/data/group4ClassSyllabusData.ts', [
  ["unitNumber: 'Unit I',", "unitNumber: 'Unit 1',"],
]);

// 8. group1ClassSyllabusData.ts
replaceInFile('src/data/group1ClassSyllabusData.ts', [
  ["unitNumber: 'Unit I',", "unitNumber: 'Unit 1',"],
  ["unitNumber: 'Unit II',", "unitNumber: 'Unit 2',"],
  ["unitNumber: 'Unit III',", "unitNumber: 'Unit 3',"],
  ["unitNumber: 'Unit IV',", "unitNumber: 'Unit 4',"],
  ["unitNumber: 'Unit V',", "unitNumber: 'Unit 5',"],
  ["unitNumber: 'Unit VI',", "unitNumber: 'Unit 6',"],
]);

// 9. unifiedSyllabusRegistry.ts
replaceInFile('src/data/unifiedSyllabusRegistry.ts', [
  ["unitNumber: 'Unit I',", "unitNumber: 'Unit 1',"],
  ["unitNumber: 'Unit II',", "unitNumber: 'Unit 2',"],
  ["unitNumber: 'Unit III',", "unitNumber: 'Unit 3',"],
  ["unitNumber: 'Unit IV',", "unitNumber: 'Unit 4',"],
  ["unitNumber: 'Unit V',", "unitNumber: 'Unit 5',"],
  ["unitNumber: 'Unit VI',", "unitNumber: 'Unit 6',"],
]);
