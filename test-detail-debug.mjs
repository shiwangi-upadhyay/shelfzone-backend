import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testAgentDetail() {
  try {
    const idOrSlug = 'main-001';
    
    // Try lookup by ID first
    let agent = await prisma.agentRegistry.findUnique({
      where: { id: idOrSlug },
      include: {
        team: { select: { id: true, name: true } },
        configLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!agent) {
      console.log('Agent not found');
      process.exit(1);
    }

    console.log('Agent found:', agent.name);
    console.log('Config logs count:', agent.configLogs.length);

    // Manually fetch changers for config logs, filtering out null changedBy values
    const changedByIds = agent.configLogs
      .map(log => log.changedBy)
      .filter(id => id !== null);
    
    console.log('Changed by IDs:', changedByIds);
    
    // Only query if there are valid IDs to fetch
    const changers = changedByIds.length > 0 
      ? await prisma.user.findMany({
          where: { id: { in: changedByIds } },
          select: { id: true, email: true },
        })
      : [];

    console.log('Changers found:', changers.length);

    const changerMap = new Map(changers.map(c => [c.id, c]));

    // Enrich config logs with changer data
    const enrichedConfigLogs = agent.configLogs.map(log => ({
      ...log,
      changer: log.changedBy ? changerMap.get(log.changedBy) || null : null,
    }));

    console.log('✅ Test passed! Enriched logs:', enrichedConfigLogs.length);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testAgentDetail();
