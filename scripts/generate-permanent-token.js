const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Charger les variables d'environnement
// Essayer d'abord .env.preprod, puis .env
if (require('fs').existsSync('.env.preprod')) {
  dotenv.config({ path: '.env.preprod' });
  console.log('📋 Utilisation de .env.preprod');
} else {
  dotenv.config();
  console.log('📋 Utilisation de .env');
}

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || "replace_this_with_a_strong_secret";

// User admin@team-oustad.com
const adminUser = {
  sub: 1, // User ID (ajustez si nécessaire)
  email: 'admin@team-oustad.com',
  type: 'owner', // Role: owner pour tous les droits
  purpose: 'ota-upload' // Indicateur du but du token
};

// Générer un token avec très longue durée (10 ans)
const token = jwt.sign(adminUser, JWT_SECRET, { 
  expiresIn: '3650d' // 10 ans
});

console.log('═══════════════════════════════════════════════════════════════');
console.log('   🔐 TOKEN API PERMANENT - admin@team-oustad.com');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('📧 Email:', adminUser.email);
console.log('🎭 Role:', adminUser.type);
console.log('🆔 User ID:', adminUser.sub);
console.log('⏰ Expiration:', '10 ans (3650 jours)');
console.log('🎯 Purpose:', adminUser.purpose);
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('   🎫 BEARER TOKEN');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log(token);
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('   📋 UTILISATION');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('1️⃣  Avec cURL:');
console.log('');
console.log(`curl -X POST "https://app.team-oustad.com/android/upload" \\`);
console.log(`  -H "Authorization: Bearer ${token}" \\`);
console.log(`  -F "apk=@app-release.apk" \\`);
console.log(`  -F "version_code=2" \\`);
console.log(`  -F "version_name=1.0.1" \\`);
console.log(`  -F "changelog=Bug fixes" \\`);
console.log(`  -F "channel=production"`);
console.log('');
console.log('2️⃣  Avec le script upload-apk.sh:');
console.log('');
console.log(`./scripts/upload-apk.sh app.apk 2 "1.0.1" "Bug fixes" production "${token}"`);
console.log('');
console.log('3️⃣  Dans GitHub Actions (Secrets):');
console.log('');
console.log('Nom du secret: OTA_API_TOKEN');
console.log('Valeur:');
console.log(token);
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('   ⚠️  SÉCURITÉ');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('• Gardez ce token en sécurité');
console.log('• Ne le partagez pas publiquement');
console.log('• Ne le commitez pas dans Git');
console.log('• Utilisez des variables d\'environnement');
console.log('• Ce token est valide pendant 10 ans');
console.log('');
console.log('═══════════════════════════════════════════════════════════════');

// Sauvegarder dans un fichier
const fs = require('fs');
const content = `# Token API permanent pour admin@team-oustad.com
# Généré le: ${new Date().toISOString()}
# Expiration: ${new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString()}
# Role: owner
# 
# ⚠️ GARDEZ CE FICHIER SÉCURISÉ - NE PAS COMMITER DANS GIT
#

OTA_API_TOKEN=${token}
OTA_USER_EMAIL=admin@team-oustad.com
OTA_USER_ROLE=owner

# Usage avec scripts:
# source .env.ota-token
# ./scripts/upload-apk.sh app.apk 2 "1.0.1" "..." production "$OTA_API_TOKEN"
`;

fs.writeFileSync('.env.ota-token', content);
console.log('✅ Token sauvegardé dans: .env.ota-token');
console.log('');
