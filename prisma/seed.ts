import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding departments and designations...');

  const departments = [
    { name: 'Engineering', description: 'Software development and technical operations' },
    { name: 'HR', description: 'Human resources and people operations' },
    { name: 'Finance', description: 'Financial planning, accounting, and compliance' },
    { name: 'Marketing', description: 'Brand, growth, and communications' },
    { name: 'Operations', description: 'Business operations and logistics' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
  }
  console.log(`✅ Seeded ${departments.length} departments`);

  const designations = [
    { title: 'Junior Engineer', level: 1, description: 'Entry-level engineering role' },
    { title: 'Software Engineer', level: 2, description: 'Mid-level engineering role' },
    { title: 'Senior Engineer', level: 3, description: 'Senior engineering role' },
    { title: 'Team Lead', level: 4, description: 'Team leadership role' },
    { title: 'Engineering Manager', level: 5, description: 'Engineering management and executive role' },
    { title: 'HR Executive', level: 1, description: 'Entry-level HR role' },
    { title: 'HR Manager', level: 4, description: 'HR team leadership role' },
    { title: 'Finance Analyst', level: 2, description: 'Mid-level finance role' },
    { title: 'Finance Manager', level: 4, description: 'Finance team leadership role' },
    { title: 'Marketing Executive', level: 1, description: 'Entry-level marketing role' },
    { title: 'Operations Manager', level: 4, description: 'Operations leadership role' },
  ];

  for (const desig of designations) {
    await prisma.designation.upsert({
      where: { title: desig.title },
      update: {},
      create: desig,
    });
  }
  console.log(`✅ Seeded ${designations.length} designations`);

  // Seed leave policies
  console.log('🌱 Seeding leave policies...');

  const leavePolicies = [
    { leaveType: 'CASUAL' as const, name: 'Casual Leave', description: 'For personal/short-term needs', totalDaysPerYear: 12, maxConsecutiveDays: 3, canCarryForward: false, maxCarryForwardDays: 0 },
    { leaveType: 'SICK' as const, name: 'Sick Leave', description: 'For illness or medical needs', totalDaysPerYear: 12, maxConsecutiveDays: 7, canCarryForward: false, maxCarryForwardDays: 0 },
    { leaveType: 'EARNED' as const, name: 'Earned Leave', description: 'Privilege/earned leave accrued over service', totalDaysPerYear: 15, maxConsecutiveDays: 5, canCarryForward: true, maxCarryForwardDays: 30 },
    { leaveType: 'MATERNITY' as const, name: 'Maternity Leave', description: 'Maternity leave as per statutory requirements', totalDaysPerYear: 182, maxConsecutiveDays: 182, canCarryForward: false, maxCarryForwardDays: 0 },
    { leaveType: 'PATERNITY' as const, name: 'Paternity Leave', description: 'Paternity leave for new fathers', totalDaysPerYear: 15, maxConsecutiveDays: 15, canCarryForward: false, maxCarryForwardDays: 0 },
    { leaveType: 'COMPENSATORY' as const, name: 'Compensatory Off', description: 'Granted for working on holidays/weekends', totalDaysPerYear: 0, maxConsecutiveDays: 3, canCarryForward: false, maxCarryForwardDays: 0 },
    { leaveType: 'UNPAID' as const, name: 'Unpaid Leave', description: 'Leave without pay', totalDaysPerYear: 365, maxConsecutiveDays: 30, canCarryForward: false, maxCarryForwardDays: 0 },
    { leaveType: 'BEREAVEMENT' as const, name: 'Bereavement Leave', description: 'For death of immediate family member', totalDaysPerYear: 5, maxConsecutiveDays: 5, canCarryForward: false, maxCarryForwardDays: 0 },
  ];

  for (const policy of leavePolicies) {
    await prisma.leavePolicy.upsert({
      where: { leaveType: policy.leaveType },
      update: {},
      create: policy,
    });
  }
  console.log(`✅ Seeded ${leavePolicies.length} leave policies`);

  // ─── Agent Management Seed Data ────────────────────────────────────

  console.log('🌱 Seeding agent management data...');

  // Create a system user for agent ownership (upsert)
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@shelfzone.ai' },
    update: {},
    create: {
      email: 'system@shelfzone.ai',
      passwordHash: '$2b$10$placeholder_not_for_login',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  // Seed 7 agents
  const agentDefs = [
    { name: 'BackendForge', slug: 'backend-forge', description: 'Backend development agent — API design, Fastify routes, business logic', type: 'WORKFLOW' as const, model: 'claude-opus-4-6', status: 'ACTIVE' as const, isCritical: true, capabilities: ['api-design', 'fastify', 'prisma', 'typescript'], systemPrompt: 'You are BackendForge, the backend development specialist for ShelfZone.' },
    { name: 'DataArchitect', slug: 'data-architect', description: 'Database and system design agent — schema design, migrations, query optimization', type: 'WORKFLOW' as const, model: 'claude-opus-4-6', status: 'ACTIVE' as const, isCritical: true, capabilities: ['prisma-schema', 'postgresql', 'timescaledb', 'migrations'], systemPrompt: 'You are DataArchitect, the database and system design specialist for ShelfZone.' },
    { name: 'ShieldOps', slug: 'shield-ops', description: 'Security and DevOps agent — RLS policies, encryption, CI/CD, infrastructure', type: 'WORKFLOW' as const, model: 'claude-opus-4-6', status: 'ACTIVE' as const, isCritical: true, capabilities: ['security', 'rls', 'encryption', 'devops', 'ci-cd'], systemPrompt: 'You are ShieldOps, the security and DevOps specialist for ShelfZone.' },
    { name: 'PortalEngine', slug: 'portal-engine', description: 'Agent management portal agent — admin UI, dashboards, agent orchestration', type: 'WORKFLOW' as const, model: 'claude-opus-4-6', status: 'ACTIVE' as const, isCritical: false, capabilities: ['admin-portal', 'dashboard', 'agent-management'], systemPrompt: 'You are PortalEngine, the agent management portal specialist for ShelfZone.' },
    { name: 'UIcraft', slug: 'uicraft', description: 'Frontend development agent — React, Next.js, Tailwind, component design', type: 'WORKFLOW' as const, model: 'claude-sonnet-4-5', status: 'ACTIVE' as const, isCritical: false, capabilities: ['react', 'nextjs', 'tailwind', 'ui-design'], systemPrompt: 'You are UIcraft, the frontend development specialist for ShelfZone.' },
    { name: 'TestRunner', slug: 'test-runner', description: 'Testing agent — unit tests, integration tests, E2E, coverage analysis', type: 'WORKFLOW' as const, model: 'claude-sonnet-4-5', status: 'ACTIVE' as const, isCritical: false, capabilities: ['vitest', 'testing', 'coverage', 'e2e'], systemPrompt: 'You are TestRunner, the testing specialist for ShelfZone.' },
    { name: 'DocSmith', slug: 'doc-smith', description: 'Documentation agent — API docs, build logs, README, architecture docs', type: 'WORKFLOW' as const, model: 'claude-haiku-4-5', status: 'ACTIVE' as const, isCritical: false, capabilities: ['documentation', 'markdown', 'openapi', 'build-log'], systemPrompt: 'You are DocSmith, the documentation specialist for ShelfZone.' },
  ];

  const agents: Record<string, string> = {};

  for (const def of agentDefs) {
    const agent = await prisma.agentRegistry.upsert({
      where: { name: def.name },
      update: { status: def.status, model: def.model, isCritical: def.isCritical },
      create: {
        name: def.name,
        slug: def.slug,
        description: def.description,
        type: def.type,
        status: def.status,
        model: def.model,
        isCritical: def.isCritical,
        capabilities: def.capabilities,
        systemPrompt: def.systemPrompt,
        temperature: def.model.includes('opus') ? 0.5 : 0.7,
        maxTokens: def.model.includes('opus') ? 8192 : 4096,
        createdBy: systemUser.id,
      },
    });
    agents[def.name] = agent.id;
  }
  console.log(`✅ Seeded ${agentDefs.length} agents`);

  // Seed 2 teams
  const coreTeam = await prisma.agentTeam.upsert({
    where: { name: 'Core Engineering' },
    update: {},
    create: {
      name: 'Core Engineering',
      description: 'Core backend, database, security, and portal agents',
      leadAgentId: agents['BackendForge'],
      createdBy: systemUser.id,
    },
  });

  const frontendTeam = await prisma.agentTeam.upsert({
    where: { name: 'Frontend & QA' },
    update: {},
    create: {
      name: 'Frontend & QA',
      description: 'Frontend development, testing, and documentation agents',
      leadAgentId: agents['UIcraft'],
      createdBy: systemUser.id,
    },
  });

  // Assign agents to teams
  const coreAgents = ['BackendForge', 'DataArchitect', 'ShieldOps', 'PortalEngine'];
  const frontendAgents = ['UIcraft', 'TestRunner', 'DocSmith'];

  for (const name of coreAgents) {
    await prisma.agentRegistry.update({
      where: { id: agents[name] },
      data: { teamId: coreTeam.id },
    });
  }
  for (const name of frontendAgents) {
    await prisma.agentRegistry.update({
      where: { id: agents[name] },
      data: { teamId: frontendTeam.id },
    });
  }
  console.log('✅ Seeded 2 teams with agent assignments');

  // ─── Mock Sessions (20 sessions) ──────────────────────────────────

  console.log('🌱 Seeding mock agent sessions...');

  const agentNames = Object.keys(agents);
  const statuses = ['success', 'success', 'success', 'success', 'error', 'timeout'] as const;
  const now = new Date();

  const modelRates: Record<string, { input: number; output: number }> = {
    'claude-opus-4-6': { input: 15.0, output: 75.0 },
    'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
    'claude-haiku-4-5': { input: 0.25, output: 1.25 },
  };

  for (let i = 0; i < 20; i++) {
    const agentName = agentNames[i % agentNames.length];
    const agentId = agents[agentName];
    const agentDef = agentDefs.find((d) => d.name === agentName)!;
    const sessionStatus = statuses[i % statuses.length];
    const inputTokens = 500 + Math.floor(Math.random() * 3000);
    const outputTokens = 200 + Math.floor(Math.random() * 2000);
    const totalTokens = inputTokens + outputTokens;
    const rates = modelRates[agentDef.model];
    const inputCost = (inputTokens / 1_000_000) * rates.input;
    const outputCost = (outputTokens / 1_000_000) * rates.output;
    const totalCost = inputCost + outputCost;
    const latencyMs = 800 + Math.floor(Math.random() * 4000);
    const createdAt = new Date(now.getTime() - Math.floor(Math.random() * 7 * 86400000));

    const session = await prisma.agentSession.create({
      data: {
        agentId,
        userId: systemUser.id,
        inputTokens,
        outputTokens,
        totalTokens,
        latencyMs,
        cost: parseFloat(totalCost.toFixed(6)),
        status: sessionStatus,
        errorMessage: sessionStatus === 'error' ? 'Model returned an unexpected response' : sessionStatus === 'timeout' ? 'Request exceeded 30s timeout' : null,
        inputPreview: `[Session ${i + 1}] Analyze the ShelfZone ${agentName} module...`,
        outputPreview: sessionStatus === 'success' ? `[Response] Analysis complete for ${agentName}...` : null,
        createdAt,
      },
    });

    // Corresponding cost ledger entry
    await prisma.agentCostLedger.create({
      data: {
        agentId,
        sessionId: session.id,
        model: agentDef.model,
        inputTokens,
        outputTokens,
        inputCostRate: rates.input,
        outputCostRate: rates.output,
        inputCost: parseFloat(inputCost.toFixed(6)),
        outputCost: parseFloat(outputCost.toFixed(6)),
        totalCost: parseFloat(totalCost.toFixed(6)),
        createdAt,
      },
    });
  }
  console.log('✅ Seeded 20 agent sessions with cost ledger entries');

  // ─── Daily Stats (last 7 days) ────────────────────────────────────

  console.log('🌱 Seeding daily stats...');

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);

    for (const agentName of agentNames) {
      const agentDef = agentDefs.find((d) => d.name === agentName)!;
      const rates = modelRates[agentDef.model];
      const totalSessions = 5 + Math.floor(Math.random() * 20);
      const errorCount = Math.floor(Math.random() * 3);
      const timeoutCount = Math.floor(Math.random() * 2);
      const successCount = totalSessions - errorCount - timeoutCount;
      const totalInputTokens = totalSessions * (1000 + Math.floor(Math.random() * 2000));
      const totalOutputTokens = totalSessions * (500 + Math.floor(Math.random() * 1500));
      const totalCost = (totalInputTokens / 1_000_000) * rates.input + (totalOutputTokens / 1_000_000) * rates.output;

      await prisma.agentDailyStats.upsert({
        where: { agentId_date: { agentId: agents[agentName], date } },
        update: {},
        create: {
          agentId: agents[agentName],
          date,
          totalSessions,
          successCount,
          errorCount,
          timeoutCount,
          totalInputTokens,
          totalOutputTokens,
          totalCost: parseFloat(totalCost.toFixed(4)),
          avgLatencyMs: 1000 + Math.floor(Math.random() * 2000),
          p95LatencyMs: 3000 + Math.floor(Math.random() * 3000),
          uniqueUsers: 1 + Math.floor(Math.random() * 5),
        },
      });
    }
  }
  console.log('✅ Seeded daily stats for 7 days × 7 agents');

  // ─── Budget Entries (current month) ────────────────────────────────

  console.log('🌱 Seeding budget entries...');

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Per-agent budgets
  const agentBudgetCaps: Record<string, number> = {
    'BackendForge': 50, 'DataArchitect': 50, 'ShieldOps': 50,
    'PortalEngine': 40, 'UIcraft': 30, 'TestRunner': 25, 'DocSmith': 10,
  };

  for (const agentName of agentNames) {
    await prisma.agentBudget.upsert({
      where: { agentId_teamId_month_year: { agentId: agents[agentName], teamId: null, month: currentMonth, year: currentYear } },
      update: {},
      create: {
        agentId: agents[agentName],
        monthlyCapUsd: agentBudgetCaps[agentName] ?? 25,
        currentSpend: parseFloat((Math.random() * (agentBudgetCaps[agentName] ?? 25) * 0.6).toFixed(2)),
        month: currentMonth,
        year: currentYear,
      },
    });
  }

  // Team budgets
  await prisma.agentBudget.upsert({
    where: { agentId_teamId_month_year: { agentId: null, teamId: coreTeam.id, month: currentMonth, year: currentYear } },
    update: {},
    create: {
      teamId: coreTeam.id,
      monthlyCapUsd: 200,
      currentSpend: parseFloat((Math.random() * 120).toFixed(2)),
      month: currentMonth,
      year: currentYear,
    },
  });

  await prisma.agentBudget.upsert({
    where: { agentId_teamId_month_year: { agentId: null, teamId: frontendTeam.id, month: currentMonth, year: currentYear } },
    update: {},
    create: {
      teamId: frontendTeam.id,
      monthlyCapUsd: 75,
      currentSpend: parseFloat((Math.random() * 45).toFixed(2)),
      month: currentMonth,
      year: currentYear,
    },
  });

  console.log('✅ Seeded budget entries for all agents and teams');

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
