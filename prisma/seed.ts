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

  // Seed master agent SHIWANGI + 7 sub-agents (all claude-sonnet-4-5)
  const masterDef = { name: 'SHIWANGI', slug: 'shiwangi', description: 'Master Agent - Smart HR Intelligence Workflow Agent for Next-Gen Integration', type: 'WORKFLOW' as const, model: 'claude-sonnet-4-5', status: 'ACTIVE' as const, isCritical: true, capabilities: ['orchestration', 'delegation', 'architecture'], systemPrompt: 'You are SHIWANGI, the master AI architect for ShelfZone. You delegate to 7 specialized sub-agents.' };

  const agentDefs = [
    { name: 'BackendForge', slug: 'backend-forge', description: 'Backend & APIs', type: 'WORKFLOW' as const, model: 'claude-sonnet-4-5', status: 'ACTIVE' as const, isCritical: true, capabilities: ['api-design', 'fastify', 'prisma', 'typescript'], systemPrompt: 'You are BackendForge, the backend development specialist for ShelfZone.' },
    { name: 'DataArchitect', slug: 'data-architect', description: 'Database & Schema', type: 'WORKFLOW' as const, model: 'claude-sonnet-4-5', status: 'ACTIVE' as const, isCritical: true, capabilities: ['prisma-schema', 'postgresql', 'timescaledb', 'migrations'], systemPrompt: 'You are DataArchitect, the database and system design specialist for ShelfZone.' },
    { name: 'ShieldOps', slug: 'shield-ops', description: 'Security & Auth', type: 'WORKFLOW' as const, model: 'claude-sonnet-4-5', status: 'ACTIVE' as const, isCritical: true, capabilities: ['security', 'rls', 'encryption', 'devops', 'ci-cd'], systemPrompt: 'You are ShieldOps, the security and DevOps specialist for ShelfZone.' },
    { name: 'PortalEngine', slug: 'portal-engine', description: 'Agent Portal', type: 'WORKFLOW' as const, model: 'claude-sonnet-4-5', status: 'ACTIVE' as const, isCritical: false, capabilities: ['admin-portal', 'dashboard', 'agent-management'], systemPrompt: 'You are PortalEngine, the agent management portal specialist for ShelfZone.' },
    { name: 'UIcraft', slug: 'uicraft', description: 'Frontend & UI', type: 'WORKFLOW' as const, model: 'claude-sonnet-4-5', status: 'ACTIVE' as const, isCritical: false, capabilities: ['react', 'nextjs', 'tailwind', 'ui-design'], systemPrompt: 'You are UIcraft, the frontend development specialist for ShelfZone.' },
    { name: 'TestRunner', slug: 'test-runner', description: 'Testing & QA', type: 'WORKFLOW' as const, model: 'claude-sonnet-4-5', status: 'ACTIVE' as const, isCritical: false, capabilities: ['vitest', 'testing', 'coverage', 'e2e'], systemPrompt: 'You are TestRunner, the testing specialist for ShelfZone.' },
    { name: 'DocSmith', slug: 'doc-smith', description: 'Documentation', type: 'WORKFLOW' as const, model: 'claude-sonnet-4-5', status: 'ACTIVE' as const, isCritical: false, capabilities: ['documentation', 'markdown', 'openapi', 'build-log'], systemPrompt: 'You are DocSmith, the documentation specialist for ShelfZone.' },
  ];

  const agents: Record<string, string> = {};

  // Create master agent first
  const master = await prisma.agentRegistry.upsert({
    where: { name: masterDef.name },
    update: { status: masterDef.status, model: masterDef.model, isCritical: masterDef.isCritical, description: masterDef.description },
    create: {
      name: masterDef.name,
      slug: masterDef.slug,
      description: masterDef.description,
      type: masterDef.type,
      status: masterDef.status,
      model: masterDef.model,
      isCritical: masterDef.isCritical,
      capabilities: masterDef.capabilities,
      systemPrompt: masterDef.systemPrompt,
      temperature: 0.5,
      maxTokens: 8192,
      createdBy: systemUser.id,
    },
  });
  agents['SHIWANGI'] = master.id;

  // Create sub-agents with parent reference
  for (const def of agentDefs) {
    const agent = await prisma.agentRegistry.upsert({
      where: { name: def.name },
      update: { status: def.status, model: def.model, isCritical: def.isCritical, description: def.description, parentAgentId: master.id },
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
        temperature: 0.7,
        maxTokens: 4096,
        createdBy: systemUser.id,
        parentAgentId: master.id,
      },
    });
    agents[def.name] = agent.id;
  }
  console.log(`✅ Seeded ${agentDefs.length + 1} agents (1 master + ${agentDefs.length} sub-agents)`);

  // Seed 1 team (ShelfZone Core) with SHIWANGI as lead
  const coreTeam = await prisma.agentTeam.upsert({
    where: { name: 'ShelfZone Core' },
    update: { leadAgentId: master.id },
    create: {
      name: 'ShelfZone Core',
      description: 'All ShelfZone agents under SHIWANGI master agent',
      leadAgentId: master.id,
      createdBy: systemUser.id,
    },
  });

  // Assign all agents to the single team
  for (const name of Object.keys(agents)) {
    await prisma.agentRegistry.update({
      where: { id: agents[name] },
      data: { teamId: coreTeam.id },
    });
  }
  console.log('✅ Assigned all agents to ShelfZone Core team');

  // ─── NO mock sessions, costs, stats, or budgets ─────────────────
  // All billing/usage data must come from real API calls only.
  // Billing dashboard will show $0.00 until real usage occurs.

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
