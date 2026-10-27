const fs = require('fs');

const filePath = 'src/data/group4SyllabusData.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Find start of group4GeneralEnglishSubject
const startGe = content.indexOf('export const group4GeneralEnglishSubject');
if (startGe !== -1) {
  let before = content.slice(0, startGe);
  let gePart = content.slice(startGe);

  // Remove tamilTitle from gePart
  gePart = gePart.replace(/\s*tamilTitle:\s*'[^']+',?/g, '');
  
  // Replace unit numbers in gePart
  gePart = gePart.replace(/unitNumber:\s*'Unit I'/g, "unitNumber: 'Unit 1'");
  gePart = gePart.replace(/unitNumber:\s*'Unit II'/g, "unitNumber: 'Unit 2'");
  gePart = gePart.replace(/unitNumber:\s*'Unit III'/g, "unitNumber: 'Unit 3'");
  gePart = gePart.replace(/unitNumber:\s*'Unit IV'/g, "unitNumber: 'Unit 4'");
  gePart = gePart.replace(/unitNumber:\s*'Unit V'/g, "unitNumber: 'Unit 5'");
  gePart = gePart.replace(/unitNumber:\s*'Unit VI'/g, "unitNumber: 'Unit 6'");
  gePart = gePart.replace(/unitNumber:\s*'Unit VII'/g, "unitNumber: 'Unit 7'");

  content = before + gePart;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully cleaned group4GeneralEnglishSubject in group4SyllabusData.ts');
} else {
  console.log('Could not find group4GeneralEnglishSubject');
}
