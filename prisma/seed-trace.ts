import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
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

  for (const name of Object.keys(agents)) {
    await prisma.agentRegistry.update({
      where: { id: agents[name] },
      data: { teamId: team.id },
    });
  }
  console.log('✅ Team "ShelfZone Core" created');

  // Helper for events
  let globalEventIdx = 0;
  const makeEvent = (sessionId: string, type: string, content: string, ts: string, opts: { from?: string; to?: string; tokens?: number; cost?: number; durationMs?: number } = {}) => {
    globalEventIdx++;
    return {
      id: `event-${String(globalEventIdx).padStart(4, '0')}`,
      sessionId,
      type,
      content,
      timestamp: new Date(`2026-02-28T${ts}Z`),
      fromAgentId: opts.from ? agents[opts.from] : null,
      toAgentId: opts.to ? agents[opts.to] : null,
      tokenCount: opts.tokens ?? 0,
      cost: new Prisma.Decimal(opts.cost ?? 0),
      durationMs: opts.durationMs ?? null,
      metadata: {},
    };
  };

  // ═══════════════════════════════════════════════════════════════════
  // TRACE 1: "Build AgentTrace observability platform" (7 agents, $2.78)
  // ═══════════════════════════════════════════════════════════════════
  const trace1Id = 'c0000001-0001-4000-8000-000000000001';
  await prisma.taskTrace.upsert({
    where: { id: trace1Id },
    update: {},
    create: {
      id: trace1Id,
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

  const t1Sessions = [
    { id: 'session-shiwangi', agent: 'SHIWANGI', parent: null, cost: 0.25, tokensIn: 15000, tokensOut: 5000, start: '10:48:00', end: '11:05:00', instruction: 'Orchestrate: Build AgentTrace observability platform' },
    { id: 'session-data', agent: 'DataArchitect', parent: 'session-shiwangi', cost: 0.15, tokensIn: 9000, tokensOut: 2800, start: '10:48:10', end: '10:48:59', instruction: 'Design and migrate AgentTrace schema (TaskTrace, TraceSession, SessionEvent)' },
    { id: 'session-shield', agent: 'ShieldOps', parent: 'session-shiwangi', cost: 0.45, tokensIn: 19000, tokensOut: 9200, start: '10:49:00', end: '10:51:22', instruction: 'Add RLS policies and security audit for AgentTrace tables' },
    { id: 'session-backend', agent: 'BackendForge', parent: 'session-shiwangi', cost: 1.20, tokensIn: 43000, tokensOut: 22500, start: '10:49:05', end: '10:54:44', instruction: 'Build AgentTrace REST API routes and services' },
    { id: 'session-ui', agent: 'UIcraft', parent: 'session-shiwangi', cost: 0.35, tokensIn: 45000, tokensOut: 26300, start: '10:50:00', end: '10:56:13', instruction: 'Build AgentTrace dashboard UI components' },
    { id: 'session-doc', agent: 'DocSmith', parent: 'session-shiwangi', cost: 0.08, tokensIn: 54000, tokensOut: 24300, start: '10:56:20', end: '10:59:29', instruction: 'Document AgentTrace API and update build log' },
    { id: 'session-test', agent: 'TestRunner', parent: 'session-shiwangi', cost: 0.30, tokensIn: 53000, tokensOut: 20100, start: '10:55:00', end: '10:59:49', instruction: 'Write integration tests for AgentTrace endpoints' },
  ];

  for (const s of t1Sessions) {
    await prisma.traceSession.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        taskTraceId: trace1Id,
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

  const t1Events = [
    makeEvent('session-shiwangi', 'instruction', 'Owner requested: Build AgentTrace observability platform with full trace hierarchy, session events, and dashboard UI.', '10:48:00', { tokens: 500 }),
    makeEvent('session-shiwangi', 'thinking', 'Planning task decomposition: schema design → security → API routes → UI → tests → docs. DataArchitect first for schema, then parallel work.', '10:48:02', { tokens: 800 }),
    makeEvent('session-shiwangi', 'delegation', 'Delegating schema design to DataArchitect', '10:48:05', { from: 'SHIWANGI', to: 'DataArchitect' }),
    makeEvent('session-shiwangi', 'delegation', 'Delegating security audit to ShieldOps', '10:48:55', { from: 'SHIWANGI', to: 'ShieldOps' }),
    makeEvent('session-shiwangi', 'delegation', 'Delegating API routes to BackendForge', '10:49:00', { from: 'SHIWANGI', to: 'BackendForge' }),
    makeEvent('session-shiwangi', 'delegation', 'Delegating dashboard UI to UIcraft', '10:49:50', { from: 'SHIWANGI', to: 'UIcraft' }),
    makeEvent('session-shiwangi', 'delegation', 'Delegating tests to TestRunner', '10:54:50', { from: 'SHIWANGI', to: 'TestRunner' }),
    makeEvent('session-shiwangi', 'delegation', 'Delegating documentation to DocSmith', '10:56:15', { from: 'SHIWANGI', to: 'DocSmith' }),
    makeEvent('session-shiwangi', 'message_in', 'DataArchitect reports: Schema migration complete — 3 tables, 9 indexes', '10:49:00', { from: 'DataArchitect', to: 'SHIWANGI' }),
    makeEvent('session-shiwangi', 'message_in', 'ShieldOps reports: RLS policies applied, audit columns verified', '10:51:25', { from: 'ShieldOps', to: 'SHIWANGI' }),
    makeEvent('session-shiwangi', 'message_in', 'BackendForge reports: 12 API endpoints live — traces, sessions, events CRUD', '10:54:50', { from: 'BackendForge', to: 'SHIWANGI' }),
    makeEvent('session-shiwangi', 'tool_call', 'Running: npx tsc --noEmit to verify full project compiles', '10:55:00', { durationMs: 8200 }),
    makeEvent('session-shiwangi', 'error', 'TS2345: Argument of type string not assignable to Decimal — in trace.service.ts line 47', '10:55:10'),
    makeEvent('session-shiwangi', 'tool_call', 'Fixing: replaced string literal with new Prisma.Decimal() in trace.service.ts', '10:55:20', { durationMs: 3100 }),
    makeEvent('session-shiwangi', 'message_in', 'UIcraft reports: Dashboard with trace timeline, session tree, event log deployed', '10:56:15', { from: 'UIcraft', to: 'SHIWANGI' }),
    makeEvent('session-shiwangi', 'message_in', 'TestRunner reports: 24 tests passing, 92% coverage on trace module', '10:59:50', { from: 'TestRunner', to: 'SHIWANGI' }),
    makeEvent('session-shiwangi', 'message_in', 'DocSmith reports: API docs updated, build log entry added', '10:59:35', { from: 'DocSmith', to: 'SHIWANGI' }),
    makeEvent('session-shiwangi', 'completion', 'AgentTrace observability platform complete. 3 tables, 12 endpoints, dashboard UI, 24 tests, full docs.', '11:05:00', { tokens: 1200, cost: 0.05 }),

    // DataArchitect session
    makeEvent('session-data', 'instruction', 'Design and migrate AgentTrace schema: TaskTrace, TraceSession, SessionEvent with proper relations', '10:48:10', { from: 'SHIWANGI', tokens: 400 }),
    makeEvent('session-data', 'thinking', 'Need 3 models: TaskTrace (top-level), TraceSession (per-agent, self-referential for hierarchy), SessionEvent (granular events). Decimal for costs, Text for content.', '10:48:12', { tokens: 600 }),
    makeEvent('session-data', 'tool_call', 'Writing schema additions to prisma/schema.prisma — 3 models, 6 relations, 9 indexes', '10:48:20', { durationMs: 5200 }),
    makeEvent('session-data', 'tool_call', 'Running: npx prisma migrate dev --name add-agent-trace', '10:48:35', { durationMs: 18000 }),
    makeEvent('session-data', 'tool_call', 'Running: npx prisma generate', '10:48:50', { durationMs: 4500 }),
    makeEvent('session-data', 'completion', 'Schema migration complete. 3 tables created: task_traces, trace_sessions, session_events. 9 indexes, self-referential session hierarchy.', '10:48:59', { tokens: 300, cost: 0.02 }),

    // ShieldOps session
    makeEvent('session-shield', 'instruction', 'Audit and secure AgentTrace tables: RLS, input validation, rate limits', '10:49:00', { from: 'SHIWANGI', tokens: 350 }),
    makeEvent('session-shield', 'thinking', 'Trace data is sensitive — need RLS for multi-tenant isolation, ensure ownerId checks, validate event types against allowlist.', '10:49:05', { tokens: 700 }),
    makeEvent('session-shield', 'tool_call', 'Adding RLS policies: task_traces owner-only, trace_sessions via task owner, session_events via session chain', '10:49:30', { durationMs: 25000 }),
    makeEvent('session-shield', 'tool_call', 'Adding Zod validation schemas for trace API inputs', '10:50:10', { durationMs: 15000 }),
    makeEvent('session-shield', 'error', 'RLS policy conflict: existing policy on agent_registry blocks join. Need CASCADE approach.', '10:50:30'),
    makeEvent('session-shield', 'fix', 'Rewrote RLS to use security_invoker with proper role checks. All policies pass.', '10:50:50', { durationMs: 12000 }),
    makeEvent('session-shield', 'tool_call', 'Adding rate limit middleware for trace creation: 100 req/min per user', '10:51:00', { durationMs: 8000 }),
    makeEvent('session-shield', 'completion', 'Security audit complete. 6 RLS policies, Zod schemas, rate limiting applied.', '10:51:22', { tokens: 400, cost: 0.03 }),

    // BackendForge session
    makeEvent('session-backend', 'instruction', 'Build full REST API for AgentTrace: CRUD for traces, sessions, events. Fastify routes with proper typing.', '10:49:05', { from: 'SHIWANGI', tokens: 500 }),
    makeEvent('session-backend', 'thinking', 'Need: trace.routes.ts, trace.service.ts, trace.schemas.ts. Endpoints: GET/POST traces, GET/POST sessions, GET/POST events, GET trace/:id/tree for full hierarchy.', '10:49:10', { tokens: 900 }),
    makeEvent('session-backend', 'tool_call', 'Writing src/modules/trace/trace.service.ts — 8 service methods', '10:49:30', { durationMs: 45000 }),
    makeEvent('session-backend', 'tool_call', 'Writing src/modules/trace/trace.routes.ts — 12 Fastify endpoints', '10:50:45', { durationMs: 38000 }),
    makeEvent('session-backend', 'tool_call', 'Writing src/modules/trace/trace.schemas.ts — Zod + JSON Schema definitions', '10:52:00', { durationMs: 22000 }),
    makeEvent('session-backend', 'error', 'Type error: Prisma Decimal not compatible with JSON serialization in trace tree endpoint', '10:53:10'),
    makeEvent('session-backend', 'fix', 'Added .toNumber() conversion in trace tree serializer. All endpoints type-check.', '10:53:30', { durationMs: 15000 }),
    makeEvent('session-backend', 'tool_call', 'Registering trace routes in app.ts, running smoke test', '10:54:00', { durationMs: 12000 }),
    makeEvent('session-backend', 'completion', 'API complete: 12 endpoints for traces, sessions, events. Full trace tree endpoint with recursive session loading.', '10:54:44', { tokens: 600, cost: 0.08 }),

    // UIcraft session
    makeEvent('session-ui', 'instruction', 'Build AgentTrace dashboard: trace list, trace detail with session tree, event timeline', '10:50:00', { from: 'SHIWANGI', tokens: 450 }),
    makeEvent('session-ui', 'thinking', 'Components needed: TraceList (table), TraceDetail (layout), SessionTree (collapsible tree), EventTimeline (vertical timeline with icons per event type). Use shadcn + Tailwind.', '10:50:05', { tokens: 800 }),
    makeEvent('session-ui', 'tool_call', 'Writing components/trace/TraceList.tsx — sortable table with status badges and cost display', '10:50:30', { durationMs: 52000 }),
    makeEvent('session-ui', 'tool_call', 'Writing components/trace/SessionTree.tsx — recursive tree with agent icons, duration bars, token counts', '10:52:00', { durationMs: 65000 }),
    makeEvent('session-ui', 'tool_call', 'Writing components/trace/EventTimeline.tsx — vertical timeline, color-coded by event type, expandable content', '10:53:30', { durationMs: 48000 }),
    makeEvent('session-ui', 'tool_call', 'Writing pages/traces/[id].tsx — detail page wiring tree + timeline + stats summary', '10:55:00', { durationMs: 35000 }),
    makeEvent('session-ui', 'completion', 'Dashboard complete: trace list, session tree, event timeline. Responsive, dark mode ready.', '10:56:13', { tokens: 500, cost: 0.04 }),

    // DocSmith session
    makeEvent('session-doc', 'instruction', 'Document AgentTrace API endpoints and update build log with implementation details', '10:56:20', { from: 'SHIWANGI', tokens: 300 }),
    makeEvent('session-doc', 'thinking', 'Need to document 12 endpoints with request/response schemas. Update docs/build-log.md with trace platform entry.', '10:56:25', { tokens: 500 }),
    makeEvent('session-doc', 'tool_call', 'Writing docs/api/agent-trace.md — full endpoint documentation with examples', '10:56:40', { durationMs: 65000 }),
    makeEvent('session-doc', 'tool_call', 'Updating docs/build-log.md — adding AgentTrace platform build entry', '10:58:20', { durationMs: 30000 }),
    makeEvent('session-doc', 'tool_call', 'Updating README.md — adding AgentTrace section to feature list', '10:59:00', { durationMs: 15000 }),
    makeEvent('session-doc', 'completion', 'Documentation complete. API docs, build log, README all updated.', '10:59:29', { tokens: 200, cost: 0.005 }),

    // TestRunner session
    makeEvent('session-test', 'instruction', 'Write integration tests for all AgentTrace endpoints. Target 90%+ coverage.', '10:55:00', { from: 'SHIWANGI', tokens: 400 }),
    makeEvent('session-test', 'thinking', 'Test plan: trace CRUD (create, list, get, tree), session CRUD, event CRUD. Need test fixtures with proper hierarchy. Mock Prisma or use test DB.', '10:55:05', { tokens: 700 }),
    makeEvent('session-test', 'tool_call', 'Writing tests/trace/trace.integration.test.ts — 12 test cases for trace endpoints', '10:55:30', { durationMs: 72000 }),
    makeEvent('session-test', 'tool_call', 'Writing tests/trace/session.integration.test.ts — 8 test cases for session endpoints', '10:57:20', { durationMs: 55000 }),
    makeEvent('session-test', 'error', 'Test failure: trace tree endpoint returns empty sessions array — missing include in Prisma query', '10:58:30'),
    makeEvent('session-test', 'fix', 'Reported to SHIWANGI. BackendForge patched the include. Tests now pass.', '10:58:50', { durationMs: 20000 }),
    makeEvent('session-test', 'tool_call', 'Running full test suite: npx vitest run --coverage', '10:59:10', { durationMs: 25000 }),
    makeEvent('session-test', 'completion', 'All tests green. 24 integration tests, 92% coverage.', '10:59:49', { tokens: 200, cost: 0.01 }),
  ];

  for (const e of t1Events) {
    await prisma.sessionEvent.upsert({
      where: { id: e.id },
      update: {},
      create: e,
    });
  }
  console.log(`✅ Trace 1: ${t1Events.length} SessionEvents created`);

  // ═══════════════════════════════════════════════════════════════════
  // TRACE 2: "Fix employee CRUD pagination bug"
  // Quick task, BackendForge only, ~$0.45, ~3 minutes
  // ═══════════════════════════════════════════════════════════════════
  const trace2Id = 'c0000002-0002-4000-8000-000000000002';
  await prisma.taskTrace.upsert({
    where: { id: trace2Id },
    update: {},
    create: {
      id: trace2Id,
      ownerId: ADMIN_ID,
      masterAgentId: agents['SHIWANGI'],
      instruction: 'Fix employee CRUD pagination bug',
      status: 'completed',
      totalCost: 0.45,
      totalTokens: 28500,
      agentsUsed: 1,
      startedAt: new Date('2026-02-28T12:00:00Z'),
      completedAt: new Date('2026-02-28T12:03:12Z'),
    },
  });

  const t2Sessions = [
    { id: 'session-t2-shiwangi', agent: 'SHIWANGI', parent: null, cost: 0.08, tokensIn: 3200, tokensOut: 1100, start: '12:00:00', end: '12:03:12', instruction: 'Orchestrate: Fix employee CRUD pagination bug — GET /api/employees returns all rows, ignoring page/limit query params' },
    { id: 'session-t2-backend', agent: 'BackendForge', parent: 'session-t2-shiwangi', cost: 0.37, tokensIn: 16800, tokensOut: 7400, start: '12:00:08', end: '12:03:00', instruction: 'Fix pagination in employee list endpoint — skip/take not being passed to Prisma findMany in employee.service.ts' },
  ];

  for (const s of t2Sessions) {
    await prisma.traceSession.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        taskTraceId: trace2Id,
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

  const t2Events = [
    // SHIWANGI orchestration
    makeEvent('session-t2-shiwangi', 'instruction', 'Bug report: GET /api/employees?page=2&limit=10 returns all 847 employees instead of paginated results. The page and limit query params are being parsed in employee.routes.ts but not applied to the database query.', '12:00:00', { tokens: 350 }),
    makeEvent('session-t2-shiwangi', 'thinking', 'This is a backend-only fix. The employee.service.ts listEmployees method likely calls prisma.employee.findMany without skip/take. Straightforward Prisma fix — delegating to BackendForge.', '12:00:03', { tokens: 420 }),
    makeEvent('session-t2-shiwangi', 'delegation', 'Delegating pagination fix to BackendForge', '12:00:08', { from: 'SHIWANGI', to: 'BackendForge' }),
    makeEvent('session-t2-shiwangi', 'message_in', 'BackendForge reports: Pagination fixed and tested. Added skip/take to Prisma findMany, updated route handler for paginated response shape, wrote 2 integration tests.', '12:03:00', { from: 'BackendForge', to: 'SHIWANGI' }),
    makeEvent('session-t2-shiwangi', 'completion', 'Employee CRUD pagination bug fixed. BackendForge patched employee.service.ts and employee.routes.ts — all tests passing.', '12:03:12', { tokens: 280, cost: 0.02 }),

    // BackendForge does the actual work
    makeEvent('session-t2-backend', 'instruction', 'Fix pagination in GET /api/employees. The page and limit query params are parsed in employee.routes.ts but employee.service.ts findMany call does not use skip/take.', '12:00:08', { from: 'SHIWANGI', tokens: 480 }),
    makeEvent('session-t2-backend', 'thinking', 'Need to check src/modules/employee/employee.service.ts — the listEmployees method. It probably calls prisma.employee.findMany({where, orderBy}) without skip/take. The route handler parses page/limit from querystring but the service ignores them.', '12:00:12', { tokens: 620 }),
    makeEvent('session-t2-backend', 'tool_call', 'read src/modules/employee/employee.service.ts\n\nFound at line 23:\nasync listEmployees(filters: EmployeeFilters) {\n  return prisma.employee.findMany({\n    where: buildWhereClause(filters),\n    orderBy: { createdAt: \'desc\' },\n    include: { department: true, designation: true }\n  });\n}\n\nBUG CONFIRMED: No skip/take despite filters having page and limit fields', '12:00:18', { durationMs: 1200 }),
    makeEvent('session-t2-backend', 'tool_call', 'edit src/modules/employee/employee.service.ts — replacing listEmployees:\n\nasync listEmployees(filters: EmployeeFilters) {\n  const page = filters.page ?? 1;\n  const limit = filters.limit ?? 20;\n  const [data, total] = await Promise.all([\n    prisma.employee.findMany({\n      where: buildWhereClause(filters),\n      orderBy: { createdAt: \'desc\' },\n      include: { department: true, designation: true },\n      skip: (page - 1) * limit,\n      take: limit,\n    }),\n    prisma.employee.count({ where: buildWhereClause(filters) }),\n  ]);\n  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };\n}', '12:00:45', { durationMs: 3800 }),
    makeEvent('session-t2-backend', 'error', 'TypeScript error TS2339: Property \'total\' does not exist on type \'Employee[]\'. The route handler at employee.routes.ts:41 destructures the old array return type. Need to update the handler to match the new paginated response shape.', '12:01:10'),
    makeEvent('session-t2-backend', 'tool_call', 'edit src/modules/employee/employee.routes.ts line 38-42:\n\n// Before: const employees = await employeeService.listEmployees(filters);\n//         reply.send(employees);\n// After:\nconst result = await employeeService.listEmployees(filters);\nreply.send({ data: result.data, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });', '12:01:30', { durationMs: 2500 }),
    makeEvent('session-t2-backend', 'fix', 'Updated route handler to use new paginated response shape { data, meta }. npx tsc --noEmit passes cleanly.', '12:01:45', { durationMs: 1800 }),
    makeEvent('session-t2-backend', 'tool_call', 'write tests/employee/employee-pagination.test.ts:\n\ndescribe(\'GET /api/employees pagination\', () => {\n  it(\'returns paginated results with correct meta\', async () => {\n    const res = await app.inject({ method: \'GET\', url: \'/api/employees?page=1&limit=5\', headers: authHeaders });\n    expect(res.statusCode).toBe(200);\n    const body = res.json();\n    expect(body.data).toHaveLength(5);\n    expect(body.meta.page).toBe(1);\n    expect(body.meta.totalPages).toBeGreaterThanOrEqual(1);\n  });\n\n  it(\'returns second page with offset data\', async () => {\n    const page1 = await app.inject({ method: \'GET\', url: \'/api/employees?page=1&limit=5\', headers: authHeaders });\n    const page2 = await app.inject({ method: \'GET\', url: \'/api/employees?page=2&limit=5\', headers: authHeaders });\n    expect(page1.json().data[0].id).not.toBe(page2.json().data[0].id);\n  });\n});', '12:02:20', { durationMs: 5200 }),
    makeEvent('session-t2-backend', 'tool_call', 'exec: npx vitest run tests/employee/employee-pagination.test.ts\n\n✓ returns paginated results with correct meta (42ms)\n✓ returns second page with offset data (38ms)\n\nTest Files  1 passed (1)\nTests       2 passed (2)', '12:02:50', { durationMs: 8500 }),
    makeEvent('session-t2-backend', 'completion', 'Pagination fix complete. Root cause: employee.service.ts listEmployees() called findMany without skip/take. Fixed service to return { data, total, page, limit, totalPages }, updated route handler, wrote 2 integration tests — all passing.', '12:03:00', { tokens: 380, cost: 0.04 }),
  ];

  for (const e of t2Events) {
    await prisma.sessionEvent.upsert({
      where: { id: e.id },
      update: {},
      create: e,
    });
  }
  console.log(`✅ Trace 2: ${t2Events.length} SessionEvents created`);

  // ═══════════════════════════════════════════════════════════════════
  // TRACE 3: "Build payroll module"
  // Medium task, 3 agents (DataArchitect, BackendForge, UIcraft), ~$1.85, ~12 min
  // ═══════════════════════════════════════════════════════════════════
  const trace3Id = 'c0000003-0003-4000-8000-000000000003';
  await prisma.taskTrace.upsert({
    where: { id: trace3Id },
    update: {},
    create: {
      id: trace3Id,
      ownerId: ADMIN_ID,
      masterAgentId: agents['SHIWANGI'],
      instruction: 'Build payroll module',
      status: 'completed',
      totalCost: 1.85,
      totalTokens: 112000,
      agentsUsed: 3,
      startedAt: new Date('2026-02-28T13:00:00Z'),
      completedAt: new Date('2026-02-28T13:12:18Z'),
    },
  });

  const t3Sessions = [
    { id: 'session-t3-shiwangi', agent: 'SHIWANGI', parent: null, cost: 0.18, tokensIn: 8500, tokensOut: 3200, start: '13:00:00', end: '13:12:18', instruction: 'Orchestrate: Build payroll module — schema, APIs, and UI for salary calculation, payslip generation, and payroll history' },
    { id: 'session-t3-data', agent: 'DataArchitect', parent: 'session-t3-shiwangi', cost: 0.32, tokensIn: 14200, tokensOut: 6800, start: '13:00:10', end: '13:03:45', instruction: 'Design payroll schema: PayrollRun, PayrollItem, SalaryStructure, SalaryComponent tables with relations to Employee and Department' },
    { id: 'session-t3-backend', agent: 'BackendForge', parent: 'session-t3-shiwangi', cost: 0.95, tokensIn: 38000, tokensOut: 18500, start: '13:03:50', end: '13:09:30', instruction: 'Build payroll REST APIs: salary structure CRUD, payroll run with calculation engine, payroll history with filters' },
    { id: 'session-t3-ui', agent: 'UIcraft', parent: 'session-t3-shiwangi', cost: 0.40, tokensIn: 52000, tokensOut: 22800, start: '13:06:00', end: '13:11:45', instruction: 'Build payroll UI pages: salary structure config, run payroll wizard, payslip view, payroll history dashboard' },
  ];

  for (const s of t3Sessions) {
    await prisma.traceSession.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        taskTraceId: trace3Id,
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

  const t3Events = [
    // SHIWANGI orchestration
    makeEvent('session-t3-shiwangi', 'instruction', 'Build payroll module for ShelfZone. Requirements: salary structure configuration (basic + HRA + allowances + deductions like PF/ESI), monthly payroll run with auto-calculation per department, payslip generation with earnings/deductions breakdown, payroll history with department/month filters.', '13:00:00', { tokens: 680 }),
    makeEvent('session-t3-shiwangi', 'thinking', 'This needs 3 agents in sequence: DataArchitect for schema first (salary_structures, salary_components, payroll_runs, payslips), then BackendForge for APIs once schema is ready, UIcraft can start in parallel once API contracts are defined after ~3 min. Estimated: schema ~3min, APIs ~6min, UI overlaps after ~3min.', '13:00:04', { tokens: 850 }),
    makeEvent('session-t3-shiwangi', 'delegation', 'Delegating payroll schema design to DataArchitect', '13:00:10', { from: 'SHIWANGI', to: 'DataArchitect' }),
    makeEvent('session-t3-shiwangi', 'message_in', 'DataArchitect reports: Payroll schema migrated — 4 tables (salary_structures, salary_components, payroll_runs, payslips), 7 indexes, FK relations to employees and departments.', '13:03:45', { from: 'DataArchitect', to: 'SHIWANGI' }),
    makeEvent('session-t3-shiwangi', 'delegation', 'Delegating payroll APIs to BackendForge', '13:03:50', { from: 'SHIWANGI', to: 'BackendForge' }),
    makeEvent('session-t3-shiwangi', 'message_in', 'BackendForge reports: Found schema issue — salary_components.amount is Int but needs Decimal(10,2) for percentage-based deductions (PF at 12%, ESI at 0.75%). Requesting DataArchitect hotfix.', '13:05:30', { from: 'BackendForge', to: 'SHIWANGI' }),
    makeEvent('session-t3-shiwangi', 'error', 'Delegation chain error: DataArchitect schema used Int for salary_components.amount, but BackendForge caught that percentage-based components like PF (12%) and ESI (0.75%) need Decimal precision. Routing fix back to DataArchitect.', '13:05:35'),
    makeEvent('session-t3-shiwangi', 'tool_call', 'Notifying DataArchitect: salary_components.amount must be Decimal(10,2), add isPercentage Boolean field for percentage vs flat amount distinction', '13:05:40', { durationMs: 500 }),
    makeEvent('session-t3-shiwangi', 'message_in', 'DataArchitect reports: Schema hotfix applied — salary_components.amount now Decimal(10,2), added is_percentage Boolean default false. Migration: alter-salary-component-type.', '13:06:30', { from: 'DataArchitect', to: 'SHIWANGI' }),
    makeEvent('session-t3-shiwangi', 'delegation', 'Delegating payroll UI pages to UIcraft', '13:06:00', { from: 'SHIWANGI', to: 'UIcraft' }),
    makeEvent('session-t3-shiwangi', 'message_in', 'BackendForge reports: 9 payroll API endpoints complete. Payroll run engine calculates gross/deductions/net per employee using salary structure components, handles both flat and percentage-based amounts.', '13:09:30', { from: 'BackendForge', to: 'SHIWANGI' }),
    makeEvent('session-t3-shiwangi', 'message_in', 'UIcraft reports: 4 payroll pages ready — salary structure config with dynamic component rows, 3-step run wizard, print-ready payslip view, history dashboard with recharts bar chart.', '13:11:45', { from: 'UIcraft', to: 'SHIWANGI' }),
    makeEvent('session-t3-shiwangi', 'completion', 'Payroll module complete. 4 DB tables, 9 API endpoints, 4 UI pages. Salary structure config, automated payroll run with calculation engine, payslip generation, history dashboard. Schema issue (Int→Decimal) caught by BackendForge and fixed by DataArchitect mid-build.', '13:12:18', { tokens: 520, cost: 0.06 }),

    // DataArchitect session — initial schema
    makeEvent('session-t3-data', 'instruction', 'Design payroll schema for ShelfZone. Tables needed: SalaryStructure (named configs), SalaryComponent (individual components like Basic, HRA, PF), PayrollRun (monthly run per department), Payslip (per-employee per-run with breakdown). Must relate to existing Employee and Department models.', '13:00:10', { from: 'SHIWANGI', tokens: 580 }),
    makeEvent('session-t3-data', 'thinking', 'Schema design:\n- SalaryStructure: id, name, isActive — groups components into named packages\n- SalaryComponent: id, structureId, name, type(EARNING|DEDUCTION), amount — each line item\n- PayrollRun: id, month, year, departmentId, status(DRAFT|PROCESSING|COMPLETED), totalGross, totalNet\n- Payslip: id, runId, employeeId, gross, deductions, net, components(JSON breakdown)\nFKs: Payslip→Employee, PayrollRun→Department, SalaryComponent→SalaryStructure', '13:00:15', { tokens: 920 }),
    makeEvent('session-t3-data', 'tool_call', 'Writing prisma/schema.prisma additions — 4 models with relations:\n\nmodel SalaryStructure {\n  id         String @id @default(cuid())\n  name       String @unique\n  isActive   Boolean @default(true)\n  components SalaryComponent[]\n  ...\n}\n\nmodel SalaryComponent {\n  id          String @id @default(cuid())\n  structureId String\n  name        String  // "Basic", "HRA", "PF", "ESI"\n  type        String  // "EARNING" | "DEDUCTION"\n  amount      Int\n  structure   SalaryStructure @relation(...)\n}', '13:00:40', { durationMs: 12000 }),
    makeEvent('session-t3-data', 'tool_call', 'Running: npx prisma migrate dev --name add-payroll-module\nApplying migration 0012_add_payroll_schema...\n4 tables created: salary_structures, salary_components, payroll_runs, payslips\n7 indexes added on foreign keys and lookup fields', '13:02:00', { durationMs: 22000 }),
    makeEvent('session-t3-data', 'tool_call', 'Running: npx prisma generate — Prisma client regenerated with PayrollRun, Payslip, SalaryStructure, SalaryComponent models', '13:03:20', { durationMs: 5000 }),
    makeEvent('session-t3-data', 'completion', 'Payroll schema complete. 4 tables: salary_structures, salary_components, payroll_runs, payslips. 7 indexes, FK relations to employees and departments established.', '13:03:45', { tokens: 340, cost: 0.03 }),

    // DataArchitect hotfix
    makeEvent('session-t3-data', 'instruction', 'HOTFIX: salary_components.amount must be Decimal(10,2) not Int — needed for percentage-based components like PF (12%) and ESI (0.75%). Also add isPercentage Boolean to distinguish flat amounts from percentages.', '13:05:45', { from: 'SHIWANGI', tokens: 280 }),
    makeEvent('session-t3-data', 'thinking', 'BackendForge is right — Int cannot represent 0.75 for ESI percentage. Need ALTER COLUMN to Decimal(10,2) and ADD COLUMN is_percentage Boolean. Quick migration.', '13:05:50', { tokens: 350 }),
    makeEvent('session-t3-data', 'tool_call', 'Running migration: npx prisma migrate dev --name alter-salary-component-type\n\nALTER TABLE salary_components ALTER COLUMN amount TYPE DECIMAL(10,2) USING amount::DECIMAL(10,2);\nALTER TABLE salary_components ADD COLUMN is_percentage BOOLEAN NOT NULL DEFAULT false;\n\nnpx prisma generate — client updated', '13:06:10', { durationMs: 12000 }),
    makeEvent('session-t3-data', 'fix', 'Schema hotfix applied. salary_components.amount now Decimal(10,2), added isPercentage Boolean default false. Prisma client regenerated. BackendForge can proceed.', '13:06:30', { tokens: 180, cost: 0.01 }),

    // BackendForge session — payroll APIs
    makeEvent('session-t3-backend', 'instruction', 'Build payroll REST APIs. Endpoints: CRUD for salary structures + components, POST /payroll/run (calculate all active employees in a department for given month), GET /payroll/history (list runs with filters), GET /payroll/:runId/payslips, GET /payroll/payslip/:id. Use the SalaryStructure, SalaryComponent, PayrollRun, Payslip Prisma models.', '13:03:50', { from: 'SHIWANGI', tokens: 640 }),
    makeEvent('session-t3-backend', 'thinking', 'Service layer plan:\n1. salary-structure.service.ts — CRUD with nested component upsert\n2. payroll.service.ts — runPayroll(deptId, month, year): fetch active employees → for each, get salary structure → sum EARNING components for gross → calculate DEDUCTION components (handle flat vs percentage via isPercentage flag) → net = gross - deductions → create Payslip records\n3. payroll.routes.ts — 9 Fastify endpoints with Zod schemas\n\nKey calculation: deduction amount = isPercentage ? (gross * component.amount / 100) : component.amount', '13:03:55', { tokens: 1100 }),
    makeEvent('session-t3-backend', 'tool_call', 'Writing src/modules/payroll/salary-structure.service.ts:\n\nexport class SalaryStructureService {\n  async create(data: CreateSalaryStructureDto) {\n    return prisma.salaryStructure.create({\n      data: { name: data.name, components: { create: data.components } },\n      include: { components: true },\n    });\n  }\n  async list() { return prisma.salaryStructure.findMany({ where: { isActive: true }, include: { components: true } }); }\n  async update(id: string, data: UpdateSalaryStructureDto) { ... }\n  async delete(id: string) { return prisma.salaryStructure.update({ where: { id }, data: { isActive: false } }); }\n}', '13:04:15', { durationMs: 18000 }),
    makeEvent('session-t3-backend', 'tool_call', 'Reading prisma schema to verify SalaryComponent.amount type for calculation engine...\nFound: amount Int — this won\'t work for percentage-based deductions like PF (12%) or ESI (0.75%).', '13:05:20', { durationMs: 2000 }),
    makeEvent('session-t3-backend', 'error', 'Schema issue detected: SalaryComponent.amount is Int but payroll calculation needs Decimal precision for percentage-based components. PF is 12% of basic, ESI is 0.75% of gross — Int cannot represent 0.75. Reporting to SHIWANGI for DataArchitect fix before proceeding with calculation engine.', '13:05:28'),
    makeEvent('session-t3-backend', 'tool_call', 'Writing src/modules/payroll/payroll.service.ts — calculation engine (using Decimal after schema fix):\n\nasync runPayroll(departmentId: string, month: number, year: number, userId: string) {\n  const employees = await prisma.employee.findMany({\n    where: { departmentId, isActive: true },\n    include: { department: true },\n  });\n\n  const structure = await prisma.salaryStructure.findFirst({\n    where: { isActive: true },\n    include: { components: true },\n  });\n\n  const run = await prisma.payrollRun.create({\n    data: { month, year, departmentId, status: \'PROCESSING\', runBy: userId, totalGross: 0, totalNet: 0 },\n  });\n\n  let totalGross = 0, totalNet = 0;\n  for (const emp of employees) {\n    const earnings = structure.components.filter(c => c.type === \'EARNING\');\n    const deductions = structure.components.filter(c => c.type === \'DEDUCTION\');\n    const gross = earnings.reduce((s, c) => s + c.amount.toNumber(), 0);\n    const ded = deductions.reduce((s, c) => s + (c.isPercentage ? gross * c.amount.toNumber() / 100 : c.amount.toNumber()), 0);\n    const net = gross - ded;\n    await prisma.payslip.create({ data: { runId: run.id, employeeId: emp.id, gross, deductions: ded, net, components: { earnings, deductions } } });\n    totalGross += gross; totalNet += net;\n  }\n  return prisma.payrollRun.update({ where: { id: run.id }, data: { status: \'COMPLETED\', totalGross, totalNet } });\n}', '13:06:40', { durationMs: 42000 }),
    makeEvent('session-t3-backend', 'tool_call', 'Writing src/modules/payroll/payroll.routes.ts — 9 endpoints:\n\nGET  /api/salary-structures        → list all active structures\nPOST /api/salary-structures        → create structure with components\nGET  /api/salary-structures/:id     → get structure detail\nPUT  /api/salary-structures/:id     → update structure\nDEL  /api/salary-structures/:id     → soft delete\nPOST /api/payroll/run               → execute payroll calculation\nGET  /api/payroll/history            → list runs with dept/month filters\nGET  /api/payroll/:runId/payslips   → list payslips for a run\nGET  /api/payroll/payslip/:id       → individual payslip detail', '13:08:10', { durationMs: 32000 }),
    makeEvent('session-t3-backend', 'tool_call', 'Registering payroll routes in app.ts, running npx tsc --noEmit\nCompilation successful — 0 errors, 0 warnings.', '13:09:10', { durationMs: 8000 }),
    makeEvent('session-t3-backend', 'completion', 'Payroll APIs complete. 9 endpoints: salary structure CRUD (5), payroll run (1), history (1), payslips list (1), payslip detail (1). Calculation engine correctly handles flat amounts and percentage-based deductions (PF 12%, ESI 0.75%) using Decimal after DataArchitect schema fix.', '13:09:30', { tokens: 480, cost: 0.07 }),

    // UIcraft session — payroll pages
    makeEvent('session-t3-ui', 'instruction', 'Build payroll UI pages for ShelfZone. 4 pages needed: 1) Salary structure config — create/edit structures with dynamic component rows (name, type, amount, isPercentage toggle), 2) Run payroll wizard — 3-step: select department+month → preview calculations → confirm and run, 3) Payslip view — print-ready individual payslip with company header and earnings/deductions breakdown, 4) Payroll history — DataTable with department/month filters and recharts BarChart of monthly costs.', '13:06:00', { from: 'SHIWANGI', tokens: 720 }),
    makeEvent('session-t3-ui', 'thinking', 'Component plan:\n- SalaryStructureConfig: form with useFieldArray for dynamic component rows, each row has name input, type select (EARNING/DEDUCTION), amount input, isPercentage checkbox. shadcn Table + Dialog for edit.\n- RunPayrollWizard: 3-step stepper using shadcn Tabs. Step 1: department select + month picker. Step 2: preview table showing each employee with calculated gross/deductions/net. Step 3: confirm button that POSTs to /api/payroll/run.\n- PayslipView: structured layout with company logo, employee info, earnings table, deductions table, net pay highlight. Print CSS.\n- PayrollHistory: DataTable with column filters + recharts BarChart grouped by department.', '13:06:05', { tokens: 880 }),
    makeEvent('session-t3-ui', 'tool_call', 'Writing pages/payroll/salary-structures.tsx:\n- DataTable listing all structures with component count, status badge\n- Dialog form for create/edit with dynamic component rows via useFieldArray\n- Each component row: name (text), type (select: EARNING|DEDUCTION), amount (number), isPercentage (switch)\n- Delete with confirmation dialog (soft delete)', '13:06:30', { durationMs: 55000 }),
    makeEvent('session-t3-ui', 'tool_call', 'Writing pages/payroll/run.tsx:\n- Step 1: Department select dropdown (fetches from /api/departments) + month/year pickers\n- Step 2: Preview table — calls calculation preview endpoint, shows employee name, basic, HRA, PF, ESI, gross, deductions, net per row, total row at bottom\n- Step 3: Confirm button with summary card (department, month, employee count, total cost), POST /api/payroll/run on confirm, success toast with link to payslips', '13:08:00', { durationMs: 62000 }),
    makeEvent('session-t3-ui', 'tool_call', 'Writing pages/payroll/payslip/[id].tsx:\n- Company header with ShelfZone logo and address\n- Employee details card: name, ID, department, designation, bank account\n- Earnings table: component name + amount for each EARNING component\n- Deductions table: component name + amount (showing percentage calc) for each DEDUCTION\n- Net pay highlight box with large font\n- Print button using window.print() with @media print CSS', '13:09:30', { durationMs: 45000 }),
    makeEvent('session-t3-ui', 'tool_call', 'Writing pages/payroll/history.tsx:\n- DataTable with columns: month, year, department, status, employee count, total gross, total net, actions\n- Column filters for department (multi-select) and date range\n- recharts BarChart below table: monthly payroll cost grouped by department, stacked bars for gross vs deductions\n- Click row to navigate to payslips list for that run', '13:10:45', { durationMs: 38000 }),
    makeEvent('session-t3-ui', 'completion', 'Payroll UI complete. 4 pages: salary structure config with dynamic component editor, 3-step run payroll wizard with preview, print-ready payslip view, history dashboard with department cost bar chart. All pages responsive and dark-mode compatible using shadcn/ui + Tailwind.', '13:11:45', { tokens: 420, cost: 0.03 }),
  ];

  for (const e of t3Events) {
    await prisma.sessionEvent.upsert({
      where: { id: e.id },
      update: {},
      create: e,
    });
  }
  console.log(`✅ Trace 3: ${t3Events.length} SessionEvents created`);

  console.log('\n🎉 AgentTrace seed complete (3 traces)!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
