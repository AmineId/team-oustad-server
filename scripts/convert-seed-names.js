/**
 * Script pour convertir fullName en firstName/lastName dans seed.js
 */

const fs = require('fs');
const path = require('path');
const { splitFullName } = require('../utils/nameUtils');

const seedFile = path.join(__dirname, '..', 'prisma', 'seed.js');
let content = fs.readFileSync(seedFile, 'utf8');

// Liste des noms à convertir
const names = [
  'Sarah Johnson',
  'Mike Anderson',
  'Bob Williams',
  'Charlie Brown',
  'Alice Smith',
  'Lisa Martinez',
  'David Chen',
  'Emma Wilson',
  'Frank Moore',
  'Grace Taylor',
  'Henry Davis'
];

console.log('🔄 Conversion des fullName en firstName/lastName dans seed.js...\n');

names.forEach(fullName => {
  const { firstName, lastName } = splitFullName(fullName);
  
  // Pattern: fullName: 'Sarah Johnson',
  const oldPattern = `fullName: '${fullName}',`;
  const newPattern = `firstName: '${firstName}',\n            lastName: '${lastName}',`;
  
  if (content.includes(oldPattern)) {
    content = content.replace(new RegExp(oldPattern, 'g'), newPattern);
    console.log(`✅ ${fullName} → ${firstName} + ${lastName}`);
  }
});

fs.writeFileSync(seedFile, content, 'utf8');
console.log('\n✅ Seed.js mis à jour!');
