/**
 * Script de migration pour remplacer user.fullName par getFullName(user)
 * et ajouter les imports nécessaires
 */

const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'routes/auth.js',
  'routes/users.js',
  'routes/subscriptions.js',
  'routes/members.js',
  'services/subscriptionService.js'
];

const rootDir = path.join(__dirname, '..');

// Remplacer user.fullName par getFullName(user) dans les logs et string templates
function replaceFullNameUsage(content) {
  // Remplacer ${user.fullName} par ${getFullName(user)}
  content = content.replace(/\$\{(\w+)\.fullName\}/g, '${getFullName($1)}');
  
  // Remplacer member.fullName par getFullName(member)
  content = content.replace(/\$\{member\.fullName\}/g, '${getFullName(member)}');
  
  // Remplacer requester.fullName par getFullName(requester)
  content = content.replace(/\$\{requester\.fullName\}/g, '${getFullName(requester)}');
  
  // Remplacer memberUser.fullName par getFullName(memberUser)
  content = content.replace(/\$\{memberUser\.fullName\}/g, '${getFullName(memberUser)}');
  
  // Remplacer updatedUser.fullName par getFullName(updatedUser)
  content = content.replace(/\$\{updatedUser\.fullName\}/g, '${getFullName(updatedUser)}');
  
  // Remplacer targetUser.fullName par getFullName(targetUser)
  content = content.replace(/\$\{targetUser\.fullName\}/g, '${getFullName(targetUser)}');
  
  return content;
}

// Ajouter l'import si nécessaire
function addImportIfNeeded(content) {
  // Vérifier si l'import existe déjà
  if (content.includes('getFullName')) {
    return content;
  }
  
  // Trouver la ligne avec les requires
  const lines = content.split('\n');
  let insertIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('require(') && lines[i].includes('utils/')) {
      insertIndex = i + 1;
      break;
    }
  }
  
  if (insertIndex === -1) {
    // Trouver la dernière ligne de require
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('require(')) {
        insertIndex = i + 1;
      }
    }
  }
  
  if (insertIndex > 0) {
    lines.splice(insertIndex, 0, "const { getFullName } = require('../utils/nameUtils');");
    return lines.join('\n');
  }
  
  return content;
}

console.log('🔄 Migration des fichiers pour utiliser firstName/lastName...\n');

filesToUpdate.forEach(filePath => {
  const fullPath = path.join(rootDir, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Fichier ignoré (n'existe pas): ${filePath}`);
    return;
  }
  
  console.log(`📝 Traitement: ${filePath}`);
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  
  // Ajouter l'import
  content = addImportIfNeeded(content);
  
  // Remplacer les usages
  content = replaceFullNameUsage(content);
  
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`   ✅ Modifié\n`);
  } else {
    console.log(`   ⏭️  Aucun changement nécessaire\n`);
  }
});

console.log('✅ Migration terminée!');
console.log('\n⚠️  Notes importantes:');
console.log('   - Les champs fullName dans les objets de réponse API doivent être mis à jour manuellement');
console.log('   - Vérifiez les logs pour voir si des changements inattendus ont été faits');
console.log('   - Testez l\'application après migration');
