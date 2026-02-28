import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ADMIN_ID = 'seed-admin-001';

async function main() {
  // Ensure admin user exists
  await prisma.user.upsert({
    where: { id: ADMIN_ID },
    update: {},
    create: {
      id: ADMIN_ID,
      email: 'admin@shelfzone.com',
      passwordHash: '$2b$10$placeholder_admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  // ─── 8 Agents ─────────────────────────────────────────────────────
  const agentDefs = [
    { id: 'agent-shiwangi', name: 'SHIWANGI', slug: 'shiwangi', description: 'Master agent — Smart HR Intelligence Workflow Agent for Next-Gen Integration', model: 'claude-opus-4-6', isCritical: true },
    { id: 'agent-backend', name: 'BackendForge', slug: 'backend-forge', description: 'Backend development agent', model: 'claude-opus-4-6', isCritical: true },
    { id: 'agent-data', name: 'DataArchitect', slug: 'data-architect', description: 'Database & system design agent', model: 'claude-opus-4-6', isCritical: true },
    { id: 'agent-shield', name: 'ShieldOps', slug: 'shield-ops', description: 'Security & DevOps agent', model: 'claude-opus-4-6', isCritical: true },
    { id: 'agent-portal', name: 'PortalEngine', slug: 'portal-engine', description: 'Agent management portal agent', model: 'claude-opus-4-6', isCritical: true },
    { id: 'agent-ui', name: 'UIcraft', slug: 'uicraft', description: 'Frontend development agent', model: 'claude-sonnet-4-5', isCritical: false },
    { id: 'agent-test', name: 'TestRunner', slug: 'test-runner', description: 'Testing agent', model: 'claude-sonnet-4-5', isCritical: false },
    { id: 'agent-doc', name: 'DocSmith', slug: 'doc-smith', description: 'Documentation agent', model: 'claude-haiku-4-5', isCritical: false },
  ];

  const agents: Record<string, string> = {};
  for (const def of agentDefs) {
    const agent = await prisma.agentRegistry.upsert({
      where: { name: def.name },
      update: { model: def.model, isCritical: def.isCritical },
      create: {
        id: def.id,
        name: def.name,
        slug: def.slug,
        description: def.description,
        type: 'WORKFLOW',
        status: 'ACTIVE',
        model: def.model,
        isCritical: def.isCritical,
        systemPrompt: `You are ${def.name}.`,
        temperature: 0.5,
        maxTokens: 8192,
        createdBy: ADMIN_ID,
      },
    });
    agents[def.name] = agent.id;
  }
  console.log('✅ 8 agents upserted');

  // ─── Team ──────────────────────────────────────────────────────────
  const team = await prisma.agentTeam.upsert({
    where: { name: 'ShelfZone Core' },
    update: { leadAgentId: agents['SHIWANGI'] },
    create: {
      name: 'ShelfZone Core',
      description: 'SHIWANGI as lead, all 7 sub-agents as members',
      leadAgentId: agents['SHIWANGI'],
      createdBy: ADMIN_ID,
    },
  });

  // Assign all agents to team
  for (const name of Object.keys(agents)) {
    await prisma.agentRegistry.update({
      where: { id: agents[name] },
      data: { teamId: team.id },
    });
  }
  console.log('✅ Team "ShelfZone Core" created');

  // ─── TaskTrace ─────────────────────────────────────────────────────
  const traceId = 'c0000001-0001-4000-8000-000000000001';
  await prisma.taskTrace.upsert({
    where: { id: traceId },
    update: {},
    create: {
      id: traceId,
      ownerId: ADMIN_ID,
      masterAgentId: agents['SHIWANGI'],
      instruction: 'Build AgentTrace observability platform',
      status: 'completed',
      totalCost: 2.78,
      totalTokens: 189000,
      agentsUsed: 7,
      startedAt: new Date('2026-02-28T10:48:00Z'),
      completedAt: new Date('2026-02-28T11:05:00Z'),
    },
  });
  console.log('✅ TaskTrace created');

  // ─── TraceSessions ─────────────────────────────────────────────────
  const sessionDefs = [
    { id: 'session-shiwangi', agent: 'SHIWANGI', parent: null, cost: 0.25, tokensIn: 15000, tokensOut: 5000, start: '10:48:00', end: '11:05:00', instruction: 'Orchestrate: Build AgentTrace observability platform' },
    { id: 'session-data', agent: 'DataArchitect', parent: 'session-shiwangi', cost: 0.15, tokensIn: 9000, tokensOut: 2800, start: '10:48:10', end: '10:48:59', instruction: 'Design and migrate AgentTrace schema (TaskTrace, TraceSession, SessionEvent)' },
    { id: 'session-shield', agent: 'ShieldOps', parent: 'session-shiwangi', cost: 0.45, tokensIn: 19000, tokensOut: 9200, start: '10:49:00', end: '10:51:22', instruction: 'Add RLS policies and security audit for AgentTrace tables' },
    { id: 'session-backend', agent: 'BackendForge', parent: 'session-shiwangi', cost: 1.20, tokensIn: 43000, tokensOut: 22500, start: '10:49:05', end: '10:54:44', instruction: 'Build AgentTrace REST API routes and services' },
    { id: 'session-ui', agent: 'UIcraft', parent: 'session-shiwangi', cost: 0.35, tokensIn: 45000, tokensOut: 26300, start: '10:50:00', end: '10:56:13', instruction: 'Build AgentTrace dashboard UI components' },
    { id: 'session-doc', agent: 'DocSmith', parent: 'session-shiwangi', cost: 0.08, tokensIn: 54000, tokensOut: 24300, start: '10:56:20', end: '10:59:29', instruction: 'Document AgentTrace API and update build log' },
    { id: 'session-test', agent: 'TestRunner', parent: 'session-shiwangi', cost: 0.30, tokensIn: 53000, tokensOut: 20100, start: '10:55:00', end: '10:59:49', instruction: 'Write integration tests for AgentTrace endpoints' },
  ];

  for (const s of sessionDefs) {
    await prisma.traceSession.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        taskTraceId: traceId,
        agentId: agents[s.agent],
        parentSessionId: s.parent,
        delegatedBy: s.parent ? agents['SHIWANGI'] : null,
        instruction: s.instruction,
        status: 'completed',
        cost: s.cost,
        tokensIn: s.tokensIn,
        tokensOut: s.tokensOut,
        startedAt: new Date(`2026-02-28T${s.start}Z`),
        completedAt: new Date(`2026-02-28T${s.end}Z`),
      },
    });
  }
  console.log('✅ 7 TraceSessions created');

  // ─── SessionEvents ─────────────────────────────────────────────────
  let eventIdx = 0;
  const ev = (sessionId: string, type: string, content: string, ts: string, opts: { from?: string; to?: string; tokens?: number; cost?: number; durationMs?: number } = {}) => {
    eventIdx++;
    return {
      id: `event-${String(eventIdx).padStart(3, '0')}`,
      sessionId,
      type,
      content,
      timestamp: new Date(`2026-02-28T${ts}Z`),
      fromAgentId: opts.from ? agents[opts.from] : null,
      toAgentId: opts.to ? agents[opts.to] : null,
      tokenCount: opts.tokens ?? 0,
      cost: opts.cost ?? 0,
      durationMs: opts.durationMs ?? null,
      metadata: {},
    };
  };

  const events = [
    // SHIWANGI session
    ev('session-shiwangi', 'instruction', 'Owner requested: Build AgentTrace observability platform with full trace hierarchy, session events, and dashboard UI.', '10:48:00', { tokens: 500 }),
    ev('session-shiwangi', 'thinking', 'Planning task decomposition: schema design → security → API routes → UI → tests → docs. DataArchitect first for schema, then parallel work.', '10:48:02', { tokens: 800 }),
    ev('session-shiwangi', 'delegation', 'Delegating schema design to DataArchitect', '10:48:05', { from: 'SHIWANGI', to: 'DataArchitect' }),
    ev('session-shiwangi', 'delegation', 'Delegating security audit to ShieldOps', '10:48:55', { from: 'SHIWANGI', to: 'ShieldOps' }),
    ev('session-shiwangi', 'delegation', 'Delegating API routes to BackendForge', '10:49:00', { from: 'SHIWANGI', to: 'BackendForge' }),
    ev('session-shiwangi', 'delegation', 'Delegating dashboard UI to UIcraft', '10:49:50', { from: 'SHIWANGI', to: 'UIcraft' }),
    ev('session-shiwangi', 'delegation', 'Delegating tests to TestRunner', '10:54:50', { from: 'SHIWANGI', to: 'TestRunner' }),
    ev('session-shiwangi', 'delegation', 'Delegating documentation to DocSmith', '10:56:15', { from: 'SHIWANGI', to: 'DocSmith' }),
    ev('session-shiwangi', 'message_in', 'DataArchitect reports: Schema migration complete — 3 tables, 9 indexes', '10:49:00', { from: 'DataArchitect', to: 'SHIWANGI' }),
    ev('session-shiwangi', 'message_in', 'ShieldOps reports: RLS policies applied, audit columns verified', '10:51:25', { from: 'ShieldOps', to: 'SHIWANGI' }),
    ev('session-shiwangi', 'message_in', 'BackendForge reports: 12 API endpoints live — traces, sessions, events CRUD', '10:54:50', { from: 'BackendForge', to: 'SHIWANGI' }),
    ev('session-shiwangi', 'tool_call', 'Running: npx tsc --noEmit to verify full project compiles', '10:55:00', { durationMs: 8200 }),
    ev('session-shiwangi', 'error', 'TS2345: Argument of type string not assignable to Decimal — in trace.service.ts line 47', '10:55:10'),
    ev('session-shiwangi', 'tool_call', 'Fixing: replaced string literal with new Prisma.Decimal() in trace.service.ts', '10:55:20', { durationMs: 3100 }),
    ev('session-shiwangi', 'message_in', 'UIcraft reports: Dashboard with trace timeline, session tree, event log deployed', '10:56:15', { from: 'UIcraft', to: 'SHIWANGI' }),
    ev('session-shiwangi', 'message_in', 'TestRunner reports: 24 tests passing, 92% coverage on trace module', '10:59:50', { from: 'TestRunner', to: 'SHIWANGI' }),
    ev('session-shiwangi', 'message_in', 'DocSmith reports: API docs updated, build log entry added', '10:59:35', { from: 'DocSmith', to: 'SHIWANGI' }),
    ev('session-shiwangi', 'completion', 'AgentTrace observability platform complete. 3 tables, 12 endpoints, dashboard UI, 24 tests, full docs.', '11:05:00', { tokens: 1200, cost: 0.05 }),

    // DataArchitect session
    ev('session-data', 'instruction', 'Design and migrate AgentTrace schema: TaskTrace, TraceSession, SessionEvent with proper relations', '10:48:10', { from: 'SHIWANGI', tokens: 400 }),
    ev('session-data', 'thinking', 'Need 3 models: TaskTrace (top-level), TraceSession (per-agent, self-referential for hierarchy), SessionEvent (granular events). Decimal for costs, Text for content.', '10:48:12', { tokens: 600 }),
    ev('session-data', 'tool_call', 'Writing schema additions to prisma/schema.prisma — 3 models, 6 relations, 9 indexes', '10:48:20', { durationMs: 5200 }),
    ev('session-data', 'tool_call', 'Running: npx prisma migrate dev --name add-agent-trace', '10:48:35', { durationMs: 18000 }),
    ev('session-data', 'tool_call', 'Running: npx prisma generate', '10:48:50', { durationMs: 4500 }),
    ev('session-data', 'completion', 'Schema migration complete. 3 tables created: task_traces, trace_sessions, session_events. 9 indexes, self-referential session hierarchy.', '10:48:59', { tokens: 300, cost: 0.02 }),

    // ShieldOps session
    ev('session-shield', 'instruction', 'Audit and secure AgentTrace tables: RLS, input validation, rate limits', '10:49:00', { from: 'SHIWANGI', tokens: 350 }),
    ev('session-shield', 'thinking', 'Trace data is sensitive — need RLS for multi-tenant isolation, ensure ownerId checks, validate event types against allowlist.', '10:49:05', { tokens: 700 }),
    ev('session-shield', 'tool_call', 'Adding RLS policies: task_traces owner-only, trace_sessions via task owner, session_events via session chain', '10:49:30', { durationMs: 25000 }),
    ev('session-shield', 'tool_call', 'Adding Zod validation schemas for trace API inputs', '10:50:10', { durationMs: 15000 }),
    ev('session-shield', 'error', 'RLS policy conflict: existing policy on agent_registry blocks join. Need CASCADE approach.', '10:50:30'),
    ev('session-shield', 'fix', 'Rewrote RLS to use security_invoker with proper role checks. All policies pass.', '10:50:50', { durationMs: 12000 }),
    ev('session-shield', 'tool_call', 'Adding rate limit middleware for trace creation: 100 req/min per user', '10:51:00', { durationMs: 8000 }),
    ev('session-shield', 'completion', 'Security audit complete. 6 RLS policies, Zod schemas, rate limiting applied.', '10:51:22', { tokens: 400, cost: 0.03 }),

    // BackendForge session
    ev('session-backend', 'instruction', 'Build full REST API for AgentTrace: CRUD for traces, sessions, events. Fastify routes with proper typing.', '10:49:05', { from: 'SHIWANGI', tokens: 500 }),
    ev('session-backend', 'thinking', 'Need: trace.routes.ts, trace.service.ts, trace.schemas.ts. Endpoints: GET/POST traces, GET/POST sessions, GET/POST events, GET trace/:id/tree for full hierarchy.', '10:49:10', { tokens: 900 }),
    ev('session-backend', 'tool_call', 'Writing src/modules/trace/trace.service.ts — 8 service methods', '10:49:30', { durationMs: 45000 }),
    ev('session-backend', 'tool_call', 'Writing src/modules/trace/trace.routes.ts — 12 Fastify endpoints', '10:50:45', { durationMs: 38000 }),
    ev('session-backend', 'tool_call', 'Writing src/modules/trace/trace.schemas.ts — Zod + JSON Schema definitions', '10:52:00', { durationMs: 22000 }),
    ev('session-backend', 'error', 'Type error: Prisma Decimal not compatible with JSON serialization in trace tree endpoint', '10:53:10'),
    ev('session-backend', 'fix', 'Added .toNumber() conversion in trace tree serializer. All endpoints type-check.', '10:53:30', { durationMs: 15000 }),
    ev('session-backend', 'tool_call', 'Registering trace routes in app.ts, running smoke test', '10:54:00', { durationMs: 12000 }),
    ev('session-backend', 'completion', 'API complete: 12 endpoints for traces, sessions, events. Full trace tree endpoint with recursive session loading.', '10:54:44', { tokens: 600, cost: 0.08 }),

    // UIcraft session
    ev('session-ui', 'instruction', 'Build AgentTrace dashboard: trace list, trace detail with session tree, event timeline', '10:50:00', { from: 'SHIWANGI', tokens: 450 }),
    ev('session-ui', 'thinking', 'Components needed: TraceList (table), TraceDetail (layout), SessionTree (collapsible tree), EventTimeline (vertical timeline with icons per event type). Use shadcn + Tailwind.', '10:50:05', { tokens: 800 }),
    ev('session-ui', 'tool_call', 'Writing components/trace/TraceList.tsx — sortable table with status badges and cost display', '10:50:30', { durationMs: 52000 }),
    ev('session-ui', 'tool_call', 'Writing components/trace/SessionTree.tsx — recursive tree with agent icons, duration bars, token counts', '10:52:00', { durationMs: 65000 }),
    ev('session-ui', 'tool_call', 'Writing components/trace/EventTimeline.tsx — vertical timeline, color-coded by event type, expandable content', '10:53:30', { durationMs: 48000 }),
    ev('session-ui', 'tool_call', 'Writing pages/traces/[id].tsx — detail page wiring tree + timeline + stats summary', '10:55:00', { durationMs: 35000 }),
    ev('session-ui', 'completion', 'Dashboard complete: trace list, session tree, event timeline. Responsive, dark mode ready.', '10:56:13', { tokens: 500, cost: 0.04 }),

    // DocSmith session
    ev('session-doc', 'instruction', 'Document AgentTrace API endpoints and update build log with implementation details', '10:56:20', { from: 'SHIWANGI', tokens: 300 }),
    ev('session-doc', 'thinking', 'Need to document 12 endpoints with request/response schemas. Update docs/build-log.md with trace platform entry.', '10:56:25', { tokens: 500 }),
    ev('session-doc', 'tool_call', 'Writing docs/api/agent-trace.md — full endpoint documentation with examples', '10:56:40', { durationMs: 65000 }),
    ev('session-doc', 'tool_call', 'Updating docs/build-log.md — adding AgentTrace platform build entry', '10:58:20', { durationMs: 30000 }),
    ev('session-doc', 'tool_call', 'Updating README.md — adding AgentTrace section to feature list', '10:59:00', { durationMs: 15000 }),
    ev('session-doc', 'completion', 'Documentation complete. API docs, build log, README all updated.', '10:59:29', { tokens: 200, cost: 0.005 }),

    // TestRunner session
    ev('session-test', 'instruction', 'Write integration tests for all AgentTrace endpoints. Target 90%+ coverage.', '10:55:00', { from: 'SHIWANGI', tokens: 400 }),
    ev('session-test', 'thinking', 'Test plan: trace CRUD (create, list, get, tree), session CRUD, event CRUD. Need test fixtures with proper hierarchy. Mock Prisma or use test DB.', '10:55:05', { tokens: 700 }),
    ev('session-test', 'tool_call', 'Writing tests/trace/trace.integration.test.ts — 12 test cases for trace endpoints', '10:55:30', { durationMs: 72000 }),
    ev('session-test', 'tool_call', 'Writing tests/trace/session.integration.test.ts — 8 test cases for session endpoints', '10:57:20', { durationMs: 55000 }),
    ev('session-test', 'error', 'Test failure: trace tree endpoint returns empty sessions array — missing include in Prisma query', '10:58:30'),
    ev('session-test', 'fix', 'Reported to SHIWANGI. BackendForge patched the include. Tests now pass.', '10:58:50', { durationMs: 20000 }),
    ev('session-test', 'tool_call', 'Running full test suite: npx vitest run --coverage', '10:59:10', { durationMs: 25000 }),
    ev('session-test', 'report', '24/24 tests passing. Coverage: 92.4% statements, 89.1% branches on trace module.', '10:59:45', { tokens: 300, cost: 0.02 }),
    ev('session-test', 'completion', 'All tests green. 24 integration tests, 92% coverage.', '10:59:49', { tokens: 200, cost: 0.01 }),
  ];

  for (const e of events) {
    await prisma.sessionEvent.upsert({
      where: { id: e.id },
      update: {},
      create: e,
    });
  }
  console.log(`✅ ${events.length} SessionEvents created`);

  console.log('\n🎉 AgentTrace seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
