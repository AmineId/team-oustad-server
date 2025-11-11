const axios = require('axios');

async function testLoginWithNullByte() {
  console.log('🧪 Testing login with null byte in email...\n');
  
  const baseURL = 'http://localhost:3000'\;
  
  // Test cases
  const testCases = [
    {
      name: 'Normal email',
      email: 'bob@example.com',
      password: 'password123'
    },
    {
      name: 'Email with null byte at end',
      email: 'bob@example.com\x00',
      password: 'password123'
    },
    {
      name: 'Email with null byte in middle',
      email: 'bob\x00@example.com',
      password: 'password123'
    },
    {
      name: 'Email with control characters',
      email: 'bob@example.com\x01\x02',
      password: 'password123'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`📧 Test: ${testCase.name}`);
    console.log(`   Email hex: ${Buffer.from(testCase.email).toString('hex')}`);
    
    try {
      const response = await axios.post(`${baseURL}/auth/login`, {
        email: testCase.email,
        password: testCase.password
      });
      
      if (response.status === 200) {
        console.log(`   ✅ Login successful`);
        console.log(`   Token: ${response.data.token.substring(0, 20)}...`);
      } else {
        console.log(`   ⚠️  Unexpected status: ${response.status}`);
      }
    } catch (error) {
      if (error.response) {
        console.log(`   ❌ Login failed: ${error.response.status} - ${error.response.data.error}`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`   ❌ Server not running`);
        return;
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    console.log();
  }
}

testLoginWithNullByte().catch(console.error);
