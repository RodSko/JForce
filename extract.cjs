const fs = require('fs');
const path = require('path');

const historyFile = './migrated_prompt_history/prompt_2026-02-12T20:59:13.901Z.json';
const data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));

const filesToExtract = [
  'components/DailyOperations.tsx',
  'components/TeamManagement.tsx',
  'components/Reports.tsx',
  'components/GenerateReport.tsx',
  'components/ManagementReport.tsx',
  'components/SecondaryTrips.tsx',
  'components/EpiControl.tsx'
];

const extracted = {};

data.forEach(entry => {
  if (entry.payload && entry.payload.type === 'generationTable') {
    entry.payload.entries.forEach(gen => {
      if (filesToExtract.includes(gen.path) && gen.replacement) {
        extracted[gen.path] = gen.replacement;
      }
    });
  }
});

for (const [filePath, content] of Object.entries(extracted)) {
  fs.writeFileSync(path.join(__dirname, filePath), content);
  console.log('Extracted', filePath);
}
