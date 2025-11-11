const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBobLogin() {
  console.log('🔍 Testing bob@example.com login issue...\n');
  
  try {
    // Try to find user with raw query to bypass encoding issues
    const users = await prisma.$queryRaw`
      SELECT id, email, "fullName", role, 
             length(email) as email_length,
             octet_length(email) as email_bytes
      FROM "User"
      WHERE email LIKE '%bob%'
    `;
    
    console.log('Users with "bob" in email:');
    console.log(JSON.stringify(users, null, 2));
    
    if (users.length > 0) {
      console.log('\n📧 Email details:');
      users.forEach(user => {
        const emailHex = Buffer.from(user.email).toString('hex');
        console.log(`\nUser ID: ${user.id}`);
        console.log(`Email: "${user.email}"`);
        console.log(`Email length: ${user.email_length}`);
        console.log(`Email bytes: ${user.email_bytes}`);
        console.log(`Email hex: ${emailHex}`);
        console.log(`Contains null byte: ${emailHex.includes('00')}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testBobLogin();
