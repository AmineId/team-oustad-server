/**
 * Script pour mettre à jour les objets de réponse API
 * Remplace fullName: user.fullName par les 3 champs firstName, lastName, fullName calculé
 */

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'routes', 'auth.js');
let content = fs.readFileSync(file, 'utf8');

// Pattern pour trouver fullName: user.fullName, member.fullName etc
const patterns = [
  {
    search: /fullName: user\.fullName,/g,
    replace: 'firstName: user.firstName,\n          lastName: user.lastName,\n          fullName: getFullName(user),'
  },
  {
    search: /fullName: member\.fullName,/g,
    replace: 'firstName: member.firstName,\n          lastName: member.lastName,\n          fullName: getFullName(member),'
  },
  {
    search: /fullName: updatedUser\.fullName,/g,
    replace: 'firstName: updatedUser.firstName,\n          lastName: updatedUser.lastName,\n          fullName: getFullName(updatedUser),'
  }
];

console.log('🔄 Mise à jour des objets de réponse API...\n');

let changesMade = 0;

patterns.forEach(pattern => {
  const matches = content.match(pattern.search);
  if (matches) {
    console.log(`✅ Remplacement de ${matches.length} occurrence(s) de: ${pattern.search}`);
    content = content.replace(pattern.search, pattern.replace);
    changesMade += matches.length;
  }
});

if (changesMade > 0) {
  fs.writeFileSync(file, content, 'utf8');
  console.log(`\n✅ ${changesMade} changements effectués dans auth.js`);
} else {
  console.log('\n⏭️  Aucun changement nécessaire');
}
