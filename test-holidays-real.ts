import jwt from 'jsonwebtoken';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-access-secret-change-in-production';

// Generate a proper access token
const token = jwt.sign(
  {
    userId: 'prabal_896589ab4a1cb514',
    email: 'test@shelfzone.com',
    role: 'SUPER_ADMIN'
  },
  JWT_ACCESS_SECRET,
  { expiresIn: '24h' }
);

console.log('✅ Generated Access Token\n');

// Test Holiday Endpoints
async function testHolidaysAPI() {
  const baseURL = 'http://localhost:3001';
  
  console.log('=== TESTING PHASE 2: HOLIDAY ENDPOINTS ===\n');
  
  // Test 1: GET /api/holidays
  console.log('📌 Test 1: GET /api/holidays');
  try {
    const res = await fetch(`${baseURL}/api/holidays`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (res.status === 200) {
      console.log('✅ PASS - Status:', res.status);
      console.log('   Total holidays:', data.data?.length);
      if (data.data?.[0]) {
        console.log('   Sample:', data.data[0].name, '-', new Date(data.data[0].date).toLocaleDateString());
      }
    } else {
      console.log('❌ FAIL - Status:', res.status);
      console.log('   Error:', data);
    }
  } catch (err: any) {
    console.log('❌ FAIL - Exception:', err.message);
  }
  
  // Test 2: GET /api/holidays?year=2026
  console.log('\n📌 Test 2: GET /api/holidays?year=2026');
  try {
    const res = await fetch(`${baseURL}/api/holidays?year=2026`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (res.status === 200) {
      console.log('✅ PASS - Status:', res.status);
      console.log('   2026 Holidays:', data.data?.length);
      
      // Store for later tests
      const holidays2026 = data.data;
      
      // Test 2a: Verify Holi (March 4, 2026)
      console.log('\n   🔍 Sub-test: Verify Holi date');
      const holi = holidays2026?.find((h: any) => h.name === 'Holi');
      if (holi) {
        const holiDate = new Date(holi.date);
        const expected = 'Wed Mar 04 2026';
        const actual = holiDate.toDateString();
        if (actual === expected) {
          console.log('   ✅ Holi correct:', actual);
        } else {
          console.log('   ❌ Holi wrong date!');
          console.log('      Expected:', expected);
          console.log('      Actual:', actual);
        }
      } else {
        console.log('   ❌ Holi not found!');
      }
      
      // Test 2b: Verify major holidays exist
      console.log('\n   🔍 Sub-test: Verify major holidays');
      const required = ['Republic Day', 'Holi', 'Independence Day', 'Diwali', 'Christmas'];
      const found = required.map(name => {
        const exists = holidays2026?.some((h: any) => h.name === name);
        console.log('   ' + (exists ? '✅' : '❌'), name);
        return exists;
      });
      
      if (found.every(Boolean)) {
        console.log('   ✅ All major holidays present');
      } else {
        console.log('   ❌ Missing some major holidays');
      }
    } else {
      console.log('❌ FAIL - Status:', res.status);
    }
  } catch (err: any) {
    console.log('❌ FAIL - Exception:', err.message);
  }
  
  // Test 3: GET /api/holidays/upcoming
  console.log('\n📌 Test 3: GET /api/holidays/upcoming (next 5)');
  try {
    const res = await fetch(`${baseURL}/api/holidays/upcoming`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (res.status === 200) {
      console.log('✅ PASS - Status:', res.status);
      console.log('   Upcoming count:', data.data?.length);
      
      if (data.data && data.data.length > 0) {
        console.log('   Next holiday:', data.data[0].name, '-', new Date(data.data[0].date).toLocaleDateString());
        
        if (data.data.length === 5) {
          console.log('   ✅ Returns exactly 5 holidays (as per spec)');
        } else {
          console.log('   ⚠️  Returns', data.data.length, 'holidays (spec says 5)');
        }
      }
    } else {
      console.log('❌ FAIL - Status:', res.status);
    }
  } catch (err: any) {
    console.log('❌ FAIL - Exception:', err.message);
  }
  
  // Test 4: POST /api/holidays (admin create)
  console.log('\n📌 Test 4: POST /api/holidays (admin create)');
  try {
    const newHoliday = {
      name: 'Test Holiday',
      date: '2026-12-31',
      type: 'COMPANY',
      description: 'Test holiday for API verification'
    };
    
    const res = await fetch(`${baseURL}/api/holidays`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newHoliday)
    });
    const data = await res.json();
    
    if (res.status === 201) {
      console.log('✅ PASS - Status:', res.status, '(Created)');
      console.log('   Created holiday ID:', data.data?.id);
      
      // Clean up - delete test holiday
      if (data.data?.id) {
        const delRes = await fetch(`${baseURL}/api/holidays/${data.data.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (delRes.status === 204) {
          console.log('   ✅ Cleanup: Test holiday deleted');
        }
      }
    } else {
      console.log('❌ FAIL - Status:', res.status);
      console.log('   Response:', data);
    }
  } catch (err: any) {
    console.log('❌ FAIL - Exception:', err.message);
  }
  
  console.log('\n=== PHASE 2 API TESTS COMPLETE ===');
}

testHolidaysAPI().catch(console.error);
