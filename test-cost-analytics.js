// Direct test of cost analytics endpoint
import { prisma } from './src/lib/prisma.js';
import { costAnalyticsService } from './src/modules/command-center/cost-analytics.service.js';

async function testCostAnalytics() {
  try {
    console.log('🔍 Testing Cost Analytics Endpoint...\n');

    const userId = 'seed-admin-001';

    // 1. Check if user has tabs
    console.log('1. Checking user tabs...');
    const tabs = await prisma.conversationTab.findMany({
      where: { userId },
      select: { id: true, title: true, isActive: true },
    });
    
    console.log(`✅ Found ${tabs.length} tabs`);
    tabs.forEach(tab => {
      console.log(`   - ${tab.title} (${tab.id}) ${tab.isActive ? '← ACTIVE' : ''}`);
    });

    // 2. Get active tab
    console.log('\n2. Getting active tab...');
    const activeTab = await prisma.conversationTab.findFirst({
      where: { userId, isActive: true },
    });
    
    if (activeTab) {
      console.log('✅ Active tab:', activeTab.title);
    } else {
      console.log('⚠️  No active tab');
    }

    // 3. Test getTabCostBreakdown with active tab
    console.log('\n3. Testing cost breakdown for active tab...');
    try {
      const breakdown = await costAnalyticsService.getTabCostBreakdown(
        userId,
        activeTab?.id || null
      );
      
      console.log('✅ Cost breakdown retrieved successfully!');
      console.log('\n📊 Results:');
      console.log('   Tab:', breakdown.tabName || '(no tab)');
      console.log('   Total Cost: $' + breakdown.totalCost.toFixed(6));
      console.log('   Agents:', breakdown.agents.length);
      console.log('   Conversations:', breakdown.conversations.length);
      
      if (breakdown.agents.length > 0) {
        console.log('\n   Top agents by cost:');
        breakdown.agents.slice(0, 3).forEach(agent => {
          console.log(`   - ${agent.agentName}: $${agent.totalCost.toFixed(6)} (${agent.messageCount} messages)`);
        });
      }
      
    } catch (err) {
      console.error('❌ Cost breakdown failed:', err.message);
      console.error('   Stack:', err.stack);
      process.exit(1);
    }

    // 4. Test all tabs
    console.log('\n4. Testing all tabs cost breakdown...');
    try {
      const allBreakdowns = await costAnalyticsService.getAllTabsCostBreakdown(userId);
      console.log('✅ All tabs breakdown retrieved successfully!');
      console.log('   Total tabs with costs:', allBreakdowns.length);
      
    } catch (err) {
      console.error('❌ All tabs breakdown failed:', err.message);
      process.exit(1);
    }

    console.log('\n✅ All cost analytics tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testCostAnalytics();
