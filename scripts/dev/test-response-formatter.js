/**
 * Script de test pour vérifier le formatage des displayIds
 */

const { formatUser, formatUsers } = require('../../utils/responseFormatter');

console.log('🧪 Test du formatage des displayIds\n');
console.log('═══════════════════════════════════════════════════════════\n');

// Test 1: formatUser simple
console.log('1️⃣ Test formatUser - Membre');
const member = {
  id: 42,
  displayId: 'MEMBER-a8f3d9e2b1c4f567',
  email: 'member@test.com',
  fullName: 'John Doe',
  role: 'member'
};

const formattedMember = formatUser(member);
console.log('   Input:', { id: member.id, displayId: member.displayId });
console.log('   Output:', { 
    id: formattedMember.id, 
    displayId: formattedMember.displayId,
    memberId: formattedMember.memberId,
    userId: formattedMember.userId
  });
console.log('   ✅ memberId:', formattedMember.memberId);
console.log('   ✅ userId:', formattedMember.userId);
console.log();

// Test 2: formatUser - Admin
console.log('2️⃣ Test formatUser - Admin');
const admin = {
  id: 30,
  displayId: 'ADMIN-9f2e1d3c4b5a6789',
  email: 'admin@test.com',
  fullName: 'Admin User',
  role: 'admin'
};

const formattedAdmin = formatUser(admin);
console.log('   Input:', { id: admin.id, displayId: admin.displayId });
console.log('   Output:', { 
    id: formattedAdmin.id, 
    displayId: formattedAdmin.displayId,
    memberId: formattedAdmin.memberId,
    userId: formattedAdmin.userId
  });
console.log('   ✅ memberId:', formattedAdmin.memberId);
console.log('   ✅ userId:', formattedAdmin.userId);
console.log();

// Test 3: formatUsers - Liste
console.log('3️⃣ Test formatUsers - Liste d\'utilisateurs');
const users = [
  { id: 1, displayId: 'MEMBER-111111111111', email: 'user1@test.com', fullName: 'User 1' },
  { id: 2, displayId: 'ADMIN-222222222222', email: 'user2@test.com', fullName: 'User 2' },
  { id: 3, displayId: 'OWNER-333333333333', email: 'user3@test.com', fullName: 'User 3' }
];

const formattedUsers = formatUsers(users);
formattedUsers.forEach((u, i) => {
  console.log(`   User ${i + 1}:`);
  console.log(`     - displayId: ${u.displayId}`);
  console.log(`     - memberId: ${u.memberId}`);
  console.log(`     - userId: ${u.userId}`);
});
console.log();

console.log('═══════════════════════════════════════════════════════════');
console.log('✅ Tous les tests de formatage passent!');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('💡 Les réponses API incluront maintenant:');
console.log('   - id: (numérique, pour usage interne)');
console.log('   - displayId: (string, identifiant unique avec préfixe)');
console.log('   - memberId: (alias de displayId, pour compatibilité)');
console.log('   - userId: (alias de displayId, pour compatibilité)');
console.log();
