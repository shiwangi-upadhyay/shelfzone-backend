import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ADMIN_ID = 'seed-admin-001';

// Hardcoded UUIDs for deterministic seeding
const IDS = {
  shiwangi:      'a0000001-0001-4000-8000-000000000001',
  backendForge:  'a0000001-0002-4000-8000-000000000002',
  dataArchitect: 'a0000001-0003-4000-8000-000000000003',
  shieldOps:     'a0000001-0004-4000-8000-000000000004',
  portalEngine:  'a0000001-0005-4000-8000-000000000005',
  uicraft:       'a0000001-0006-4000-8000-000000000006',
  testRunner:    'a0000001-0007-4000-8000-000000000007',
  docSmith:      'a0000001-0008-4000-8000-000000000008',
  team:          'b0000001-0001-4000-8000-000000000001',
  taskTrace:     'c0000001-0001-4000-8000-000000000001',
  // Sessions
  sessShiwangi:      'd0000001-0001-4000-8000-000000000001',
  sessDataArchitect: 'd0000001-0002-4000-8000-000000000002',
  sessShieldOps:     'd0000001-0003-4000-8000-000000000003',
  sessBackendForge:  'd0000001-0004-4000-8000-000000000004',
  sessUicraft:       'd0000001-0005-4000-8000-000000000005',
  sessDocSmith:      'd0000001-0006-4000-8000-000000000006',
  sessTestRunner:    'd0000001-0007-4000-8000-000000000007',
};

const t = (iso: string) => new Date(iso);

async function main() {
  console.log('🌱 Seeding AgentTrace data...');

  // Ensure admin user exists
  await prisma.user.upsert({
    where: { id: ADMIN_ID },
    update: {},
    create: { id: ADMIN_ID, email: 'admin@shelfzone.com', passwordHash: '$2b$10$placeholder', role: 'SUPER_ADMIN' },
  });

  // 1. Upsert agents
  const agentDefs = [
    { id: IDS.shiwangi, name: 'SHIWANGI', slug: 'shiwangi', description: 'Master agent, architect — coordinates all sub-agents', type: 'WORKFLOW' as const, model: 'claude-opus-4-6', isCritical: true },
    { id: IDS.backendForge, name: 'BackendForge', slug: 'backend-forge', description: 'Backend development', type: 'WORKFLOW' as const, model: 'claude-opus-4-6', isCritical: false },
    { id: IDS.dataArchitect, name: 'DataArchitect', slug: 'data-architect', description: 'DB & system design', type: 'WORKFLOW' as const, model: 'claude-opus-4-6', isCritical: false },
    { id: IDS.shieldOps, name: 'ShieldOps', slug: 'shield-ops', description: 'Security & DevOps', type: 'WORKFLOW' as const, model: 'claude-opus-4-6', isCritical: false },
    { id: IDS.portalEngine, name: 'PortalEngine', slug: 'portal-engine', description: 'Agent management portal', type: 'WORKFLOW' as const, model: 'claude-opus-4-6', isCritical: false },
    { id: IDS.uicraft, name: 'UIcraft', slug: 'uicraft', description: 'Frontend development', type: 'WORKFLOW' as const, model: 'claude-sonnet-4-5', isCritical: false },
    { id: IDS.testRunner, name: 'TestRunner', slug: 'test-runner', description: 'Testing', type: 'WORKFLOW' as const, model: 'claude-sonnet-4-5', isCritical: false },
    { id: IDS.docSmith, name: 'DocSmith', slug: 'doc-smith', description: 'Documentation', type: 'WORKFLOW' as const, model: 'claude-haiku-4-5', isCritical: false },
  ];

  const agentIdMap: Record<string, string> = {};
  for (const def of agentDefs) {
    const agent = await prisma.agentRegistry.upsert({
      where: { name: def.name },
      update: { model: def.model, isCritical: def.isCritical, status: 'ACTIVE' },
      create: {
        id: def.id, name: def.name, slug: def.slug, description: def.description,
        type: def.type, status: 'ACTIVE', model: def.model, isCritical: def.isCritical,
        createdBy: ADMIN_ID, temperature: 0.5, maxTokens: 8192,
        systemPrompt: `You are ${def.name}, a specialized agent for ShelfZone.`,
      },
    });
    agentIdMap[def.name] = agent.id;
  }
  // Remap IDS to actual DB IDs
  IDS.shiwangi = agentIdMap['SHIWANGI'];
  IDS.backendForge = agentIdMap['BackendForge'];
  IDS.dataArchitect = agentIdMap['DataArchitect'];
  IDS.shieldOps = agentIdMap['ShieldOps'];
  IDS.portalEngine = agentIdMap['PortalEngine'];
  IDS.uicraft = agentIdMap['UIcraft'];
  IDS.testRunner = agentIdMap['TestRunner'];
  IDS.docSmith = agentIdMap['DocSmith'];
  console.log('✅ 8 agents upserted');

  // 2. Team: "ShelfZone Core"
  await prisma.agentTeam.upsert({
    where: { name: 'ShelfZone Core' },
    update: { leadAgentId: IDS.shiwangi },
    create: {
      id: IDS.team, name: 'ShelfZone Core', description: 'All ShelfZone agents under SHIWANGI',
      leadAgentId: IDS.shiwangi, createdBy: ADMIN_ID,
    },
  });

  // Assign all agents to this team
  const allAgentIds = [IDS.shiwangi, IDS.backendForge, IDS.dataArchitect, IDS.shieldOps, IDS.portalEngine, IDS.uicraft, IDS.testRunner, IDS.docSmith];
  for (const id of allAgentIds) {
    await prisma.agentRegistry.update({ where: { id }, data: { teamId: IDS.team } });
  }
  console.log('✅ Team "ShelfZone Core" created');

  // 3. TaskTrace
  // Delete existing events/sessions/trace for idempotency
  await prisma.sessionEvent.deleteMany({ where: { session: { taskTraceId: IDS.taskTrace } } });
  await prisma.traceSession.deleteMany({ where: { taskTraceId: IDS.taskTrace } });
  await prisma.taskTrace.deleteMany({ where: { id: IDS.taskTrace } });

  await prisma.taskTrace.create({
    data: {
      id: IDS.taskTrace,
      ownerId: ADMIN_ID,
      masterAgentId: IDS.shiwangi,
      instruction: 'Build AgentTrace observability platform',
      status: 'completed',
      totalCost: 2.78,
      totalTokens: 238000 + 89900,
      agentsUsed: 7,
      startedAt: t('2026-02-28T10:48:00Z'),
      completedAt: t('2026-02-28T11:05:00Z'),
    },
  });
  console.log('✅ TaskTrace created');

  // 4. TraceSessions
  const sessions = [
    { id: IDS.sessShiwangi, agentId: IDS.shiwangi, parentSessionId: null, delegatedBy: null, instruction: 'Coordinate Phase 7 build, delegate to all agents', status: 'completed', cost: 0.25, tokensIn: 15000, tokensOut: 5000, startedAt: '2026-02-28T10:48:00Z', completedAt: '2026-02-28T11:05:00Z' },
    { id: IDS.sessDataArchitect, agentId: IDS.dataArchitect, parentSessionId: IDS.sessShiwangi, delegatedBy: IDS.shiwangi, instruction: 'Create AgentTrace schema (TaskTrace, TraceSession, SessionEvent)', status: 'completed', cost: 0.15, tokensIn: 9000, tokensOut: 2800, startedAt: '2026-02-28T10:48:00Z', completedAt: '2026-02-28T10:48:49Z' },
    { id: IDS.sessShieldOps, agentId: IDS.shieldOps, parentSessionId: IDS.sessShiwangi, delegatedBy: IDS.shiwangi, instruction: 'Build security layer: auth, redaction, rate limiting, audit', status: 'completed', cost: 0.45, tokensIn: 19000, tokensOut: 9200, startedAt: '2026-02-28T10:49:00Z', completedAt: '2026-02-28T10:51:22Z' },
    { id: IDS.sessBackendForge, agentId: IDS.backendForge, parentSessionId: IDS.sessShiwangi, delegatedBy: IDS.shiwangi, instruction: 'Build 17 API endpoints + 3 services + SSE streaming', status: 'completed', cost: 1.20, tokensIn: 43000, tokensOut: 22500, startedAt: '2026-02-28T10:49:00Z', completedAt: '2026-02-28T10:54:39Z' },
    { id: IDS.sessUicraft, agentId: IDS.uicraft, parentSessionId: IDS.sessShiwangi, delegatedBy: IDS.shiwangi, instruction: 'Build all 4 UI levels: Agent Map, Detail Panel, Flow, Raw Logs', status: 'completed', cost: 0.35, tokensIn: 45000, tokensOut: 26300, startedAt: '2026-02-28T10:49:00Z', completedAt: '2026-02-28T10:55:13Z' },
    { id: IDS.sessDocSmith, agentId: IDS.docSmith, parentSessionId: IDS.sessShiwangi, delegatedBy: IDS.shiwangi, instruction: 'Write API docs, architecture docs, build log, README', status: 'completed', cost: 0.08, tokensIn: 54000, tokensOut: 24300, startedAt: '2026-02-28T10:57:00Z', completedAt: '2026-02-28T11:00:09Z' },
    { id: IDS.sessTestRunner, agentId: IDS.testRunner, parentSessionId: IDS.sessShiwangi, delegatedBy: IDS.shiwangi, instruction: 'Write integration + security + E2E tests', status: 'completed', cost: 0.30, tokensIn: 53000, tokensOut: 20100, startedAt: '2026-02-28T10:57:00Z', completedAt: '2026-02-28T11:01:49Z' },
  ];

  for (const s of sessions) {
    await prisma.traceSession.create({
      data: {
        id: s.id, taskTraceId: IDS.taskTrace, agentId: s.agentId,
        parentSessionId: s.parentSessionId, delegatedBy: s.delegatedBy,
        instruction: s.instruction, status: s.status, cost: s.cost,
        tokensIn: s.tokensIn, tokensOut: s.tokensOut,
        startedAt: t(s.startedAt), completedAt: t(s.completedAt!),
      },
    });
  }
  console.log('✅ 7 TraceSessions created');

  // 5. SessionEvents
  let eventIdx = 0;
  const evt = (sessionId: string, type: string, content: string, timestamp: string, extra: Partial<{ fromAgentId: string; toAgentId: string; tokenCount: number; cost: number; durationMs: number }> = {}) => {
    eventIdx++;
    return {
      sessionId, type, content, timestamp: t(timestamp),
      fromAgentId: extra.fromAgentId ?? null,
      toAgentId: extra.toAgentId ?? null,
      tokenCount: extra.tokenCount ?? 0,
      cost: extra.cost ?? 0,
      durationMs: extra.durationMs ?? null,
      metadata: {},
    };
  };

  const S = IDS.sessShiwangi;
  const events = [
    // SHIWANGI session
    evt(S, 'instruction', 'Build AgentTrace observability platform', '2026-02-28T10:48:00Z', { tokenCount: 200 }),
    evt(S, 'thinking', 'Need schema first, then parallel backend+security+frontend, then tests+docs', '2026-02-28T10:48:02Z', { durationMs: 1800 }),
    evt(S, 'delegation', 'Create 3 tables: TaskTrace, TraceSession, SessionEvent', '2026-02-28T10:48:04Z', { fromAgentId: IDS.shiwangi, toAgentId: IDS.dataArchitect }),
    evt(S, 'message_in', 'Schema done. 3 tables migrated, indexes created.', '2026-02-28T10:48:50Z', { fromAgentId: IDS.dataArchitect }),
    evt(S, 'delegation', 'Build 17 API endpoints + 3 services + SSE streaming', '2026-02-28T10:49:00Z', { fromAgentId: IDS.shiwangi, toAgentId: IDS.backendForge }),
    evt(S, 'delegation', 'Build security layer: auth, redaction, rate limiting, audit', '2026-02-28T10:49:01Z', { fromAgentId: IDS.shiwangi, toAgentId: IDS.shieldOps }),
    evt(S, 'delegation', 'Build all 4 UI levels: Agent Map, Detail Panel, Flow, Raw Logs', '2026-02-28T10:49:02Z', { fromAgentId: IDS.shiwangi, toAgentId: IDS.uicraft }),
    evt(S, 'message_in', 'Security layer complete. 23 tests passing.', '2026-02-28T10:51:23Z', { fromAgentId: IDS.shieldOps }),
    evt(S, 'message_in', '17 endpoints built. 28 tests passing.', '2026-02-28T10:54:40Z', { fromAgentId: IDS.backendForge }),
    evt(S, 'thinking', 'BackendForge flagged TS errors in trace-auth.ts. Fixing...', '2026-02-28T10:54:45Z', { durationMs: 2000 }),
    evt(S, 'tool_call', 'Edited trace-auth.ts — fixed field names (createdBy, managerId)', '2026-02-28T10:54:48Z', { durationMs: 3200 }),
    evt(S, 'message_in', 'All 4 UI levels complete. 17 components, 6 hooks.', '2026-02-28T10:55:14Z', { fromAgentId: IDS.uicraft }),
    evt(S, 'thinking', 'Build errors in frontend. Fixing TS issues...', '2026-02-28T10:55:20Z', { durationMs: 1500 }),
    evt(S, 'tool_call', 'Fixed cost-breakdown.tsx, use-attendance.ts, use-live-trace.ts', '2026-02-28T10:55:25Z', { durationMs: 4500 }),
    evt(S, 'delegation', 'Write integration + security + E2E tests', '2026-02-28T10:57:00Z', { fromAgentId: IDS.shiwangi, toAgentId: IDS.testRunner }),
    evt(S, 'delegation', 'Write AgentTrace documentation', '2026-02-28T10:57:01Z', { fromAgentId: IDS.shiwangi, toAgentId: IDS.docSmith }),
    evt(S, 'message_in', 'Integration + E2E tests complete.', '2026-02-28T11:01:50Z', { fromAgentId: IDS.testRunner }),
    evt(S, 'message_in', 'All docs written and pushed.', '2026-02-28T11:00:10Z', { fromAgentId: IDS.docSmith }),
    evt(S, 'completion', 'Phase 7 complete. All agents delivered. Both repos build clean.', '2026-02-28T11:05:00Z', { tokenCount: 300, cost: 0.02 }),

    // DataArchitect session
    evt(IDS.sessDataArchitect, 'instruction', 'Create AgentTrace schema', '2026-02-28T10:48:00Z', { tokenCount: 150 }),
    evt(IDS.sessDataArchitect, 'thinking', 'Need 3 tables with proper relations and indexes', '2026-02-28T10:48:03Z', { durationMs: 1200 }),
    evt(IDS.sessDataArchitect, 'tool_call', 'Read prisma/schema.prisma', '2026-02-28T10:48:08Z', { durationMs: 800 }),
    evt(IDS.sessDataArchitect, 'tool_call', 'Added TaskTrace, TraceSession, SessionEvent models', '2026-02-28T10:48:25Z', { durationMs: 12000, tokenCount: 1800 }),
    evt(IDS.sessDataArchitect, 'tool_call', 'npx prisma migrate dev --name add-agent-trace-tables', '2026-02-28T10:48:40Z', { durationMs: 8000 }),
    evt(IDS.sessDataArchitect, 'completion', '3 tables created and migrated. Pushed to main.', '2026-02-28T10:48:49Z', { tokenCount: 200, cost: 0.01 }),

    // BackendForge session
    evt(IDS.sessBackendForge, 'instruction', 'Build all 17 AgentTrace API endpoints', '2026-02-28T10:49:00Z', { tokenCount: 250 }),
    evt(IDS.sessBackendForge, 'thinking', 'Start with route structure. Need trace-service, cost-service, flow-service.', '2026-02-28T10:49:05Z', { durationMs: 2500 }),
    evt(IDS.sessBackendForge, 'tool_call', 'Created src/modules/agent-trace/trace.routes.ts', '2026-02-28T10:49:30Z', { durationMs: 15000, tokenCount: 3200 }),
    evt(IDS.sessBackendForge, 'tool_call', 'Created trace.controller.ts with Zod validation', '2026-02-28T10:50:15Z', { durationMs: 25000, tokenCount: 4500 }),
    evt(IDS.sessBackendForge, 'tool_call', 'Created trace-service.ts — CRUD, sessions, events', '2026-02-28T10:51:00Z', { durationMs: 35000, tokenCount: 5800 }),
    evt(IDS.sessBackendForge, 'tool_call', 'Created cost-service.ts — aggregation, employee summaries', '2026-02-28T10:52:00Z', { durationMs: 20000, tokenCount: 3400 }),
    evt(IDS.sessBackendForge, 'tool_call', 'Created flow-service.ts — ReactFlow graph builder', '2026-02-28T10:52:40Z', { durationMs: 18000, tokenCount: 2800 }),
    evt(IDS.sessBackendForge, 'error', 'TS error in trace-auth.ts: ownerId doesn\'t exist on AgentRegistryWhereInput', '2026-02-28T10:53:20Z'),
    evt(IDS.sessBackendForge, 'tool_call', 'Created tests — 28 tests', '2026-02-28T10:53:50Z', { durationMs: 30000, tokenCount: 4200 }),
    evt(IDS.sessBackendForge, 'completion', '17 endpoints, 3 services, 28 tests. All passing.', '2026-02-28T10:54:39Z', { tokenCount: 300, cost: 0.08 }),

    // ShieldOps session
    evt(IDS.sessShieldOps, 'instruction', 'Build security layer for AgentTrace', '2026-02-28T10:49:00Z', { tokenCount: 200 }),
    evt(IDS.sessShieldOps, 'thinking', 'Need ownership enforcement, secret redaction, rate limiting', '2026-02-28T10:49:04Z', { durationMs: 2000 }),
    evt(IDS.sessShieldOps, 'tool_call', 'Created trace-auth.ts — canAccessTrace, canAccessSession, getAccessibleAgentIds', '2026-02-28T10:49:30Z', { durationMs: 22000, tokenCount: 3600 }),
    evt(IDS.sessShieldOps, 'tool_call', 'Created redaction-service.ts — JWT, passwords, API keys, PEM blocks', '2026-02-28T10:50:10Z', { durationMs: 18000, tokenCount: 2800 }),
    evt(IDS.sessShieldOps, 'tool_call', 'Created trace-rate-limit.ts — 5 SSE/user, 100 events/min', '2026-02-28T10:50:40Z', { durationMs: 12000, tokenCount: 1900 }),
    evt(IDS.sessShieldOps, 'tool_call', 'Created trace-audit.ts — cross-user views, deletions', '2026-02-28T10:51:00Z', { durationMs: 8000, tokenCount: 1400 }),
    evt(IDS.sessShieldOps, 'tool_call', '23 security tests — all passing', '2026-02-28T10:51:15Z', { durationMs: 6000, tokenCount: 2100 }),
    evt(IDS.sessShieldOps, 'completion', 'Security layer complete. Pushed to main.', '2026-02-28T10:51:22Z', { tokenCount: 200, cost: 0.03 }),

    // UIcraft session
    evt(IDS.sessUicraft, 'instruction', 'Build complete AgentTrace frontend — all 4 UI levels', '2026-02-28T10:49:00Z', { tokenCount: 300 }),
    evt(IDS.sessUicraft, 'thinking', 'Need ReactFlow for flow graph. Install dependencies first.', '2026-02-28T10:49:05Z', { durationMs: 2200 }),
    evt(IDS.sessUicraft, 'tool_call', 'npm install reactflow react-diff-viewer-continued', '2026-02-28T10:49:20Z', { durationMs: 8000 }),
    evt(IDS.sessUicraft, 'tool_call', 'Created 6 hooks: use-traces, use-trace-sessions, use-session-events, use-trace-flow, use-agent-stats, use-live-trace', '2026-02-28T10:50:00Z', { durationMs: 35000, tokenCount: 5200 }),
    evt(IDS.sessUicraft, 'tool_call', 'Created 17 components including event cards, flow nodes, agent map', '2026-02-28T10:52:00Z', { durationMs: 90000, tokenCount: 12000 }),
    evt(IDS.sessUicraft, 'tool_call', 'Created agent-trace/page.tsx — Level 1 Agent Map with view toggle', '2026-02-28T10:53:30Z', { durationMs: 25000, tokenCount: 4200 }),
    evt(IDS.sessUicraft, 'tool_call', 'Created trace/[traceId]/page.tsx — Level 3 flow graph', '2026-02-28T10:54:20Z', { durationMs: 30000, tokenCount: 4800 }),
    evt(IDS.sessUicraft, 'error', 'TS error: Recharts formatter type mismatch in cost-breakdown.tsx', '2026-02-28T10:54:55Z'),
    evt(IDS.sessUicraft, 'completion', 'All 4 UI levels complete. 17 components, 6 hooks, 2 pages.', '2026-02-28T10:55:13Z', { tokenCount: 250, cost: 0.02 }),

    // DocSmith session
    evt(IDS.sessDocSmith, 'instruction', 'Write AgentTrace documentation', '2026-02-28T10:57:00Z', { tokenCount: 180 }),
    evt(IDS.sessDocSmith, 'thinking', 'Need API docs, architecture overview, build log update', '2026-02-28T10:57:04Z', { durationMs: 1500 }),
    evt(IDS.sessDocSmith, 'tool_call', 'Updated docs/build-log.md with Phase 7', '2026-02-28T10:57:30Z', { durationMs: 15000, tokenCount: 6000 }),
    evt(IDS.sessDocSmith, 'tool_call', 'Created docs/agent-trace-api.md (21KB)', '2026-02-28T10:58:15Z', { durationMs: 35000, tokenCount: 9500 }),
    evt(IDS.sessDocSmith, 'tool_call', 'Created docs/agent-trace-architecture.md (37KB)', '2026-02-28T10:59:10Z', { durationMs: 40000, tokenCount: 12000 }),
    evt(IDS.sessDocSmith, 'tool_call', 'Updated README.md', '2026-02-28T10:59:50Z', { durationMs: 8000, tokenCount: 2400 }),
    evt(IDS.sessDocSmith, 'completion', 'All docs written. 58KB+ of documentation.', '2026-02-28T11:00:09Z', { tokenCount: 200, cost: 0.005 }),

    // TestRunner session
    evt(IDS.sessTestRunner, 'instruction', 'Write integration + security + E2E tests', '2026-02-28T10:57:00Z', { tokenCount: 220 }),
    evt(IDS.sessTestRunner, 'thinking', 'Need integration tests for all 17 endpoints, security tests, Playwright E2E', '2026-02-28T10:57:05Z', { durationMs: 2000 }),
    evt(IDS.sessTestRunner, 'tool_call', 'Created agent-trace.test.ts — 17 endpoint tests', '2026-02-28T10:57:40Z', { durationMs: 60000, tokenCount: 8500 }),
    evt(IDS.sessTestRunner, 'tool_call', 'Created agent-trace-security.test.ts — redaction, auth, rate limiting', '2026-02-28T10:59:00Z', { durationMs: 45000, tokenCount: 6200 }),
    evt(IDS.sessTestRunner, 'tool_call', 'Created e2e/agent-trace.spec.ts — Playwright tests', '2026-02-28T11:00:30Z', { durationMs: 50000, tokenCount: 5800 }),
    evt(IDS.sessTestRunner, 'completion', 'All tests created. Integration + security + E2E.', '2026-02-28T11:01:49Z', { tokenCount: 200, cost: 0.02 }),
  ];

  await prisma.sessionEvent.createMany({ data: events });
  console.log(`✅ ${events.length} SessionEvents created`);

  console.log('🎉 AgentTrace seed complete!');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
