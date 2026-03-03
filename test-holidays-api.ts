import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '5f3e4d2a1b9c8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f';

// Generate a test token for admin user
const token = jwt.sign(
  {
    userId: 'prabal_896589ab4a1cb514',
    email: 'test@shelfzone.com',
    role: 'SUPER_ADMIN'
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('JWT Token:', token);

// Test GET /api/holidays
async function testHolidaysAPI() {
  const baseURL = 'http://localhost:3001';
  
  console.log('\n=== Testing Holiday Endpoints ===\n');
  
  // Test 1: GET /api/holidays
  console.log('Test 1: GET /api/holidays');
  const res1 = await fetch(`${baseURL}/api/holidays`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data1 = await res1.json();
  console.log('Status:', res1.status);
  console.log('Holidays count:', data1.data?.length);
  console.log('Sample holiday:', data1.data?.[0]);
  
  // Test 2: GET /api/holidays?year=2026
  console.log('\nTest 2: GET /api/holidays?year=2026');
  const res2 = await fetch(`${baseURL}/api/holidays?year=2026`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data2 = await res2.json();
  console.log('Status:', res2.status);
  console.log('2026 Holidays:', data2.data?.length);
  
  // Test 3: GET /api/holidays/upcoming
  console.log('\nTest 3: GET /api/holidays/upcoming');
  const res3 = await fetch(`${baseURL}/api/holidays/upcoming`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data3 = await res3.json();
  console.log('Status:', res3.status);
  console.log('Upcoming holidays:', data3.data?.length);
  console.log('Next holiday:', data3.data?.[0]?.name, '-', data3.data?.[0]?.date);
  
  // Test 4: Check if Holi exists in March 2026
  console.log('\nTest 4: Verify Holi in March 2026');
  const holi = data2.data?.find((h: any) => h.name === 'Holi');
  if (holi) {
    const holiDate = new Date(holi.date);
    console.log('✅ Holi found:', holiDate.toDateString());
    console.log('   Expected: Mar 4, 2026 | Actual:', holiDate.toLocaleDateString());
  } else {
    console.log('❌ Holi not found in 2026 holidays');
  }
  
  console.log('\n=== Tests Complete ===');
}

testHolidaysAPI().catch(console.error);
