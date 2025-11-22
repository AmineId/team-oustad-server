const prisma = require('../../utils/prismaClient');

async function fixEncodingIssues() {
  console.log('🔍 Checking for encoding issues in user emails...\n');
  
  try {
    // Get all users using raw query to avoid encoding errors
    const users = await prisma.$queryRaw`
      SELECT id, email, "fullName", role 
      FROM "User"
    `;
    
    console.log(`Found ${users.length} users\n`);
    
    let fixedCount = 0;
    
    for (const user of users) {
      // Check if email contains null bytes or invalid characters
      if (user.email && (user.email.includes('\0') || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(user.email))) {
        console.log(`⚠️  Found invalid characters in email for user ID ${user.id}`);
        console.log(`   Original email: ${JSON.stringify(user.email)}`);
        
        // Clean the email by removing null bytes and control characters
        const cleanEmail = user.email.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        
        console.log(`   Cleaned email: ${cleanEmail}`);
        
        // Update the email
        await prisma.$executeRaw`
          UPDATE "User" 
          SET email = ${cleanEmail}
          WHERE id = ${user.id}
        `;
        
        console.log(`✅ Fixed email for user ID ${user.id}\n`);
        fixedCount++;
      }
    }
    
    if (fixedCount === 0) {
      console.log('✨ No encoding issues found in user emails');
    } else {
      console.log(`\n✅ Fixed ${fixedCount} user(s) with encoding issues`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    // await prisma.$disconnect();
  }
}

fixEncodingIssues()
  .catch(console.error);
