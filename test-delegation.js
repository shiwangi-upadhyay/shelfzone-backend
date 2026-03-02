// Quick delegation test script
import { prisma } from './src/lib/prisma.js';
import { DelegationService } from './src/modules/command-center/delegation.service.js';
import { decrypt } from './src/lib/encryption.js';

async function testDelegation() {
  try {
    console.log('🔍 Testing Phase 3 Delegation System...\n');

    // 1. Check if SHIWANGI exists
    console.log('1. Checking if SHIWANGI agent exists...');
    const shiwangi = await prisma.agentRegistry.findFirst({
      where: { name: 'SHIWANGI' },
    });
    
    if (!shiwangi) {
      console.error('❌ SHIWANGI agent not found!');
      process.exit(1);
    }
    console.log('✅ SHIWANGI found:', shiwangi.id);

    // 2. Check if user has API key
    console.log('\n2. Checking for user API key...');
    const userApiKey = await prisma.userApiKey.findFirst({
      where: { userId: 'seed-admin-001' },
    });
    
    if (!userApiKey) {
      console.error('❌ No API key found for admin user!');
      process.exit(1);
    }
    console.log('✅ API key found');

    // 3. Decrypt API key
    console.log('\n3. Decrypting API key...');
    let decryptedKey;
    try {
      decryptedKey = decrypt(userApiKey.encryptedKey);
      console.log('✅ API key decrypted:', decryptedKey.substring(0, 10) + '...');
    } catch (err) {
      console.error('❌ Failed to decrypt API key:', err.message);
      process.exit(1);
    }

    // 4. Test delegation service
    console.log('\n4. Testing delegation service...');
    const delegationService = new DelegationService(
      decryptedKey,
      'seed-admin-001',
      null
    );

    console.log('✅ DelegationService instantiated');

    // 5. Try a simple delegation
    console.log('\n5. Testing delegation to DocSmith (cheapest agent)...');
    try {
      const result = await delegationService.delegateToAgent(
        'DocSmith',
        'Write a brief README file explaining what this system does',
        'Testing delegation functionality'
      );
      
      console.log('✅ Delegation successful!');
      console.log('\n📊 Result:');
      console.log('  - Agent:', result.agentName);
      console.log('  - Success:', result.success);
      console.log('  - Cost: $' + result.cost.toFixed(6));
      console.log('  - Tokens:', result.tokensUsed.total);
      console.log('  - Duration:', result.durationMs + 'ms');
      console.log('\n📝 Output preview:');
      console.log(result.result.substring(0, 200) + '...');
      
    } catch (err) {
      console.error('❌ Delegation failed:', err.message);
      console.error('   Stack:', err.stack);
      process.exit(1);
    }

    console.log('\n✅ All tests passed! Delegation system is working.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDelegation();
