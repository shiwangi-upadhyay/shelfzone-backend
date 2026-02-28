import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shelfzone' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const SHIWANGI_SID = 'd0000001-0001-4000-8000-000000000001';
const DA_SID = 'd0000001-0002-4000-8000-000000000002';
const SO_SID = 'd0000001-0003-4000-8000-000000000003';
const BF_SID = 'd0000001-0004-4000-8000-000000000004';
const UI_SID = 'd0000001-0005-4000-8000-000000000005';
const DS_SID = 'd0000001-0006-4000-8000-000000000006';
const TR_SID = 'd0000001-0007-4000-8000-000000000007';

const SHIWANGI = 'a0000001-0001-4000-8000-000000000001';
const DA = 'cfad37f3-3cd0-4e3b-9e6d-e9d5907262ed';
const SO = '53331c24-7de2-4de3-8211-38483b48e52a';
const BF = 'd12883c4-35b0-4cf2-93a6-cdb019c33aed';
const UC = 'c3ed83e4-80c9-47d7-9307-7dc130387094';
const DSA = 'a2d55ede-40f9-4306-9cd3-eeca7b25bc2e';
const TRA = '367d66bc-41d2-45eb-bca7-f4aeb17835eb';

const BASE = '2026-02-28T';

function ts(time: string) { return new Date(`${BASE}${time}.000Z`); }

type E = {
  sessionId: string; type: string; content: string;
  fromAgentId?: string | null; toAgentId?: string | null;
  metadata?: any; tokenCount?: number; cost?: string;
  durationMs?: number | null; timestamp: Date;
};

type Prisma = { SessionEventCreateManyInput: any };

function ev(sessionId: string, type: string, time: string, content: string, opts: Partial<E> = {}): any {
  return {
    sessionId, type, content, timestamp: ts(time),
    fromAgentId: opts.fromAgentId ?? null,
    toAgentId: opts.toAgentId ?? null,
    metadata: opts.metadata ?? {},
    tokenCount: opts.tokenCount ?? 0,
    cost: opts.cost ?? '0',
    durationMs: opts.durationMs ?? null,
  };
}

const events: any[] = [
  // === SHIWANGI (20 events) ===
  ev(SHIWANGI_SID, 'instruction', '10:48:00', 'Build AgentTrace observability platform — full agent tracing with 4 UI levels, cost tracking, flow visualization. Schema → Backend → Security → Frontend → Tests → Docs.', { toAgentId: SHIWANGI }),
  ev(SHIWANGI_SID, 'thinking', '10:48:02', "Breaking this into phases. DataArchitect goes first — everything depends on the schema. Then BackendForge, ShieldOps, and UIcraft can run in parallel once tables exist. TestRunner and DocSmith go last.", { fromAgentId: SHIWANGI, cost: '0.02' }),
  ev(SHIWANGI_SID, 'delegation', '10:48:05', 'DataArchitect: Create Prisma models for TaskTrace, TraceSession, and SessionEvent. Include proper relations, indexes on ownerId/status/timestamp. Run migration.', { fromAgentId: SHIWANGI, toAgentId: DA }),
  ev(SHIWANGI_SID, 'message_in', '10:48:52', 'Schema landed. 3 tables created: task_traces, trace_sessions, session_events. Migration 20260228104925 applied. Prisma client regenerated. All indexes in place. Pushed to main.', { fromAgentId: DA, toAgentId: SHIWANGI, cost: '0.015' }),
  ev(SHIWANGI_SID, 'thinking', '10:48:55', "Schema is ready. Now launching BackendForge, ShieldOps, and UIcraft in parallel. BackendForge handles the 17 endpoints, ShieldOps handles auth/redaction/rate-limiting, UIcraft handles all 4 UI levels.", { fromAgentId: SHIWANGI }),
  ev(SHIWANGI_SID, 'delegation', '10:49:00', 'BackendForge: Build ALL 17 AgentTrace API endpoints. Trace CRUD, session management, event logging, cost aggregation, org tree overview, flow graph for ReactFlow, SSE streaming. Include trace-service, cost-service, flow-service. Write unit tests.', { fromAgentId: SHIWANGI, toAgentId: BF }),
  ev(SHIWANGI_SID, 'delegation', '10:49:01', 'ShieldOps: Build security layer. Ownership enforcement (owner sees only their traces, SUPER_ADMIN bypasses, HR_ADMIN sees department). Secret redaction for JWTs, passwords, API keys. Rate limiting: 5 SSE/user, 100 events/min. Audit logging.', { fromAgentId: SHIWANGI, toAgentId: SO }),
  ev(SHIWANGI_SID, 'delegation', '10:49:02', 'UIcraft: Build the complete AgentTrace frontend. Level 1: Agent Map with org/agent view toggle. Level 2: Agent Detail side panel with conversation, costs, raw logs tabs. Level 3: Task flow graph with ReactFlow. Level 4: Raw log viewer. Install reactflow. Build 17 components, 6 hooks, 2 pages.', { fromAgentId: SHIWANGI, toAgentId: UC }),
  ev(SHIWANGI_SID, 'message_in', '10:51:24', "Security layer complete. Delivered: trace-auth.ts with canAccessTrace/canAccessSession/getAccessibleAgentIds, redaction-service.ts catching JWTs/passwords/API-keys/PEM-blocks, trace-rate-limit.ts with in-memory rate limiting, trace-audit.ts for cross-user views. 23/23 security tests passing. Pushed to main.", { fromAgentId: SO, toAgentId: SHIWANGI }),
  ev(SHIWANGI_SID, 'message_in', '10:54:42', "All 17 endpoints built and tested. Delivered: trace.routes.ts, trace.controller.ts, trace.schemas.ts, trace-service.ts, cost-service.ts, flow-service.ts. 28/28 tests passing. Note: found TS errors in ShieldOps' trace-auth.ts — ownerId field doesn't exist on AgentRegistryWhereInput, headId doesn't exist on DepartmentWhereInput.", { fromAgentId: BF, toAgentId: SHIWANGI }),
  ev(SHIWANGI_SID, 'thinking', '10:54:45', "BackendForge flagged TS errors in ShieldOps' trace-auth.ts. The AgentRegistry model uses 'createdBy' not 'ownerId', and Department uses 'managerId' not 'headId'. I need to fix these myself before UIcraft finishes.", { fromAgentId: SHIWANGI }),
  ev(SHIWANGI_SID, 'tool_call', '10:54:50', "Edited src/middleware/trace-auth.ts: changed 'ownerId' to 'createdBy' on line 68, changed 'headId' to 'managerId' on line 107. Ran npx tsc --noEmit — zero errors.", { fromAgentId: SHIWANGI, metadata: { tool: 'edit', file: 'src/middleware/trace-auth.ts', changes: 2 }, cost: '0.01' }),
  ev(SHIWANGI_SID, 'message_in', '10:55:15', 'AgentTrace frontend complete. Delivered: 17 components (event cards, flow nodes, agent map, cost charts, log viewer), 6 hooks (traces, sessions, events, flow, stats, live SSE), 2 pages (agent-trace map, trace flow detail). Installed reactflow and react-diff-viewer-continued. All 4 UI levels implemented. Pushed to main.', { fromAgentId: UC, toAgentId: SHIWANGI }),
  ev(SHIWANGI_SID, 'thinking', '10:55:20', "All parallel agents done. Frontend build has TS errors — cost-breakdown.tsx Recharts formatter type, use-live-trace.ts wrong field name 'token' should be 'accessToken', use-attendance.ts type comparison issue. Fixing these now.", { fromAgentId: SHIWANGI }),
  ev(SHIWANGI_SID, 'tool_call', '10:55:30', "Fixed 3 TS errors: cost-breakdown.tsx (Recharts formatter accepts undefined), use-live-trace.ts (state.token → state.accessToken), use-attendance.ts (removed string comparison on number type). Frontend builds clean now.", { fromAgentId: SHIWANGI, metadata: { tool: 'edit', files: ['cost-breakdown.tsx', 'use-live-trace.ts', 'use-attendance.ts'] }, cost: '0.01' }),
  ev(SHIWANGI_SID, 'delegation', '10:57:00', 'TestRunner: Write integration tests for all 17 AgentTrace endpoints, security tests for redaction and auth, and Playwright E2E tests for the frontend.', { fromAgentId: SHIWANGI, toAgentId: TRA }),
  ev(SHIWANGI_SID, 'delegation', '10:57:01', "DocSmith: Write docs/agent-trace-api.md with all 17 endpoints documented, docs/agent-trace-architecture.md with data model and security overview, update docs/build-log.md with Phase 7, update README.md.", { fromAgentId: SHIWANGI, toAgentId: DSA }),
  ev(SHIWANGI_SID, 'message_in', '11:00:12', 'Documentation complete. Delivered: agent-trace-api.md (21KB, all 17 endpoints with examples), agent-trace-architecture.md (37KB, data model, 4 UI levels, security model), updated build-log.md with Phase 7 entry, updated README.md with AgentTrace section. Pushed to main.', { fromAgentId: DSA, toAgentId: SHIWANGI }),
  ev(SHIWANGI_SID, 'message_in', '11:01:52', 'Tests complete. Delivered: integration tests covering all 17 endpoints (CRUD, pagination, filters, auth), security tests (redaction patterns, ownership enforcement), Playwright E2E tests (navigation, view toggle, trace list, flow page, responsive, accessibility). Pushed to main.', { fromAgentId: TRA, toAgentId: SHIWANGI }),
  ev(SHIWANGI_SID, 'completion', '11:05:00', 'Phase 7: AgentTrace — DELIVERED. 3 tables, 17 endpoints, 3 services, security layer (23 tests), 17 frontend components, 6 hooks, 2 pages, 28 backend tests, E2E suite, 58KB+ docs. Total: $2.78, 17 minutes, 7 agents. Both repos build clean. All pushed to main.', { fromAgentId: SHIWANGI, cost: '0.03' }),

  // === DataArchitect (6 events) ===
  ev(DA_SID, 'instruction', '10:48:05', 'Create Prisma models for TaskTrace, TraceSession, and SessionEvent. Include proper relations, indexes on ownerId/status/timestamp. Run migration.', { fromAgentId: SHIWANGI, toAgentId: DA }),
  ev(DA_SID, 'thinking', '10:48:08', "Reading existing schema to understand model patterns. Need UUID primary keys, proper @map for snake_case table names, DateTime defaults, Decimal for costs. TaskTrace owns many TraceSessions. TraceSession has self-referencing parent for hierarchy. SessionEvent has polymorphic from/to agent refs.", { fromAgentId: DA }),
  ev(DA_SID, 'tool_call', '10:48:12', 'Read prisma/schema.prisma — 470 lines, 15 existing models. Using same patterns: @id @default(uuid()), @map for column names, @@map for table names.', { fromAgentId: DA, metadata: { tool: 'read', file: 'prisma/schema.prisma' } }),
  ev(DA_SID, 'tool_call', '10:48:30', 'Added 3 models to schema.prisma: TaskTrace (12 fields, 3 relations, 3 indexes), TraceSession (14 fields, 6 relations, 4 indexes), SessionEvent (11 fields, 3 relations, 3 indexes). Total: 95 new lines.', { fromAgentId: DA, metadata: { tool: 'edit', file: 'prisma/schema.prisma', linesAdded: 95 } }),
  ev(DA_SID, 'tool_call', '10:48:42', 'Ran: npx prisma migrate dev --name add-agent-trace-tables. Migration 20260228104925 created and applied. 3 tables created in PostgreSQL. Prisma Client regenerated.', { fromAgentId: DA, metadata: { tool: 'exec', command: 'npx prisma migrate dev' } }),
  ev(DA_SID, 'report', '10:48:49', 'Schema complete. 3 tables created: task_traces (12 columns), trace_sessions (14 columns), session_events (11 columns). All relations verified. Indexes on owner_id, status, started_at, task_trace_id, agent_id, session_id, type, timestamp. Migration applied. Pushed to main as commit DataArchitect-schema.', { fromAgentId: DA, cost: '0.015' }),

  // === ShieldOps (8 events) ===
  ev(SO_SID, 'instruction', '10:49:01', 'Build security layer: ownership enforcement, secret redaction, rate limiting, audit logging.', { fromAgentId: SHIWANGI, toAgentId: SO }),
  ev(SO_SID, 'thinking', '10:49:05', 'Four components needed: 1) trace-auth.ts for RLS-style ownership checks, 2) redaction-service.ts for scrubbing secrets from event content, 3) trace-rate-limit.ts for in-memory rate limiting, 4) trace-audit.ts for logging sensitive operations.', { fromAgentId: SO }),
  ev(SO_SID, 'tool_call', '10:49:30', 'Created src/middleware/trace-auth.ts — canAccessTrace(userId, role, traceId), canAccessSession(userId, role, sessionId), getAccessibleAgentIds(userId, role), traceWhereFilter(userId, role). SUPER_ADMIN bypasses all checks. HR_ADMIN sees managed departments via managedDeptEmployeeIds lookup.', { fromAgentId: SO, metadata: { tool: 'write', file: 'trace-auth.ts', lines: 85 } }),
  ev(SO_SID, 'tool_call', '10:50:00', 'Created src/services/redaction-service.ts — redactContent() and redactMetadata(). Patterns: Bearer JWT tokens, standalone JWTs (eyJ...), password fields, DATABASE_URL, sk-*/pk-* API keys, PEM private key blocks, generic secret/apikey patterns. Each pattern tested with regex.', { fromAgentId: SO, metadata: { tool: 'write', file: 'redaction-service.ts', lines: 72 } }),
  ev(SO_SID, 'tool_call', '10:50:20', 'Created src/middleware/trace-rate-limit.ts — in-memory Map-based rate limiter. SSE: max 5 concurrent connections per user. Events: max 100 per minute per session. Listing: max 30 requests per minute per user. Auto-cleanup interval every 60s.', { fromAgentId: SO, metadata: { tool: 'write', file: 'trace-rate-limit.ts', lines: 65 } }),
  ev(SO_SID, 'tool_call', '10:50:40', 'Created src/services/trace-audit.ts — logTraceView (when SUPER_ADMIN views another user\'s trace), logTraceDeletion, logSSEConnect/Disconnect. Wraps existing audit log infrastructure.', { fromAgentId: SO, metadata: { tool: 'write', file: 'trace-audit.ts', lines: 45 } }),
  ev(SO_SID, 'tool_call', '10:51:00', 'Created test suites: redaction-service.test.ts (8 tests covering all patterns), trace-rate-limit.test.ts (7 tests for SSE slots + rate windows), trace-auth.test.ts (8 tests for ownership/SUPER_ADMIN bypass/HR_ADMIN department access). All 23 passing.', { fromAgentId: SO, metadata: { tool: 'write', tests: 23 } }),
  ev(SO_SID, 'report', '10:51:22', 'Security layer complete. 4 files, 267 lines. Ownership enforcement with 3 role levels. Redaction catches 7+ secret patterns. Rate limiting protects all trace endpoints. Audit logging for sensitive operations. 23/23 tests green. Pushed to main.', { fromAgentId: SO, cost: '0.045' }),

  // === BackendForge (10 events) ===
  ev(BF_SID, 'instruction', '10:49:00', 'Build ALL 17 AgentTrace API endpoints with services and tests.', { fromAgentId: SHIWANGI, toAgentId: BF }),
  ev(BF_SID, 'thinking', '10:49:05', 'Starting with route structure under src/modules/agent-trace/. Need 3 services: trace-service for CRUD+sessions+events, cost-service for aggregation, flow-service for ReactFlow graph. Using Zod for validation, existing auth middleware for JWT.', { fromAgentId: BF }),
  ev(BF_SID, 'tool_call', '10:49:30', 'Created src/modules/agent-trace/trace.routes.ts — registered all 17 routes with Fastify. GET/POST/PATCH/DELETE for traces, GET for sessions/events/timeline, POST for event creation, GET for cost-breakdown/stats/org-tree/flow, SSE stream endpoint.', { fromAgentId: BF, metadata: { tool: 'write', file: 'trace.routes.ts', lines: 180 } }),
  ev(BF_SID, 'tool_call', '10:50:15', 'Created trace.controller.ts — request handlers with Zod schema validation, pagination parsing, error handling. Each handler delegates to the appropriate service.', { fromAgentId: BF, metadata: { tool: 'write', file: 'trace.controller.ts', lines: 220 } }),
  ev(BF_SID, 'tool_call', '10:51:00', 'Created trace-service.ts — CRUD operations, session tree building with recursive children, event filtering and timeline formatting, owner authorization checks.', { fromAgentId: BF, metadata: { tool: 'write', file: 'trace-service.ts', lines: 185 } }),
  ev(BF_SID, 'tool_call', '10:51:45', 'Created cost-service.ts — sub-agent cost aggregation using Prisma groupBy, employee cost summaries joining agents→traceSessions, org tree rollup with manager hierarchy, daily cost arrays for charts.', { fromAgentId: BF, metadata: { tool: 'write', file: 'cost-service.ts', lines: 140 } }),
  ev(BF_SID, 'tool_call', '10:52:30', 'Created flow-service.ts — builds directed graph from trace sessions. Nodes = agents (id, name, cost, duration, status). Edges = delegation events between agents (from→to with instruction label). Returns ReactFlow-compatible structure.', { fromAgentId: BF, metadata: { tool: 'write', file: 'flow-service.ts', lines: 95 } }),
  ev(BF_SID, 'error', '10:53:00', "TypeScript compilation failed: src/middleware/trace-auth.ts(68,14): 'ownerId' does not exist on AgentRegistryWhereInput. src/middleware/trace-auth.ts(107,14): 'headId' does not exist on DepartmentWhereInput. These are in ShieldOps' files, not mine.", { fromAgentId: BF, metadata: { file: 'trace-auth.ts', errors: 2 } }),
  ev(BF_SID, 'tool_call', '10:53:30', 'Created test files: trace-service.test.ts (18 tests), cost-service.test.ts (5 tests), flow-service.test.ts (5 tests). All 28 tests passing with mocked Prisma client.', { fromAgentId: BF, metadata: { tool: 'write', files: 3, tests: 28 } }),
  ev(BF_SID, 'report', '10:54:39', "17 endpoints built across 7 files (903 lines). 3 services: trace-service (CRUD + sessions + events + timeline), cost-service (aggregation + org rollup), flow-service (ReactFlow graph). 28/28 tests passing. Flagged TS errors in trace-auth.ts (ShieldOps) — ownerId/headId field names wrong. Pushed to main.", { fromAgentId: BF, cost: '0.12' }),

  // === UIcraft (9 events) ===
  ev(UI_SID, 'instruction', '10:49:02', 'Build the complete AgentTrace frontend — all 4 UI levels with ReactFlow, side panel, event cards, cost charts.', { fromAgentId: SHIWANGI, toAgentId: UC }),
  ev(UI_SID, 'thinking', '10:49:08', 'Need to install reactflow first. Then build bottom-up: hooks (data layer) → event card components → conversation stream → side panel → agent map → flow graph page. Using shadcn Sheet for side panel, Tabs for the 3-tab layout, Recharts for cost charts.', { fromAgentId: UC }),
  ev(UI_SID, 'tool_call', '10:49:15', 'Installed dependencies: npm install reactflow react-diff-viewer-continued. Both added to package.json.', { fromAgentId: UC, metadata: { tool: 'exec', command: 'npm install reactflow react-diff-viewer-continued' } }),
  ev(UI_SID, 'tool_call', '10:50:00', 'Created 6 hooks: use-traces.ts (list/get/create/delete), use-trace-sessions.ts (sessions by trace/agent), use-session-events.ts (events + timeline), use-trace-flow.ts (ReactFlow data), use-agent-stats.ts (stats + cost breakdown + org overview), use-live-trace.ts (SSE real-time streaming).', { fromAgentId: UC, metadata: { tool: 'write', files: 6, lines: 280 } }),
  ev(UI_SID, 'tool_call', '10:51:30', 'Created 12 UI components: event-card.tsx (dispatcher), thinking-event.tsx (expandable amber), tool-call-event.tsx (gray with result), message-event.tsx (blue/green directional), error-event.tsx (red with fix), conversation-stream.tsx, raw-log-viewer.tsx (monospace + filters), cost-breakdown.tsx (Recharts bar chart), agent-badge.tsx, agent-detail-panel.tsx (Sheet with 3 tabs), trace-filters.tsx, live-indicator.tsx.', { fromAgentId: UC, metadata: { tool: 'write', files: 12, lines: 850 } }),
  ev(UI_SID, 'tool_call', '10:52:45', 'Created ReactFlow components: task-flow-graph.tsx (wrapper with Background/Controls/MiniMap), flow-node.tsx (custom node with emoji/cost/status), flow-edge.tsx (custom edge with label). Plus agent-map.tsx (org tree with view toggle) and view-toggle.tsx.', { fromAgentId: UC, metadata: { tool: 'write', files: 5, lines: 320 } }),
  ev(UI_SID, 'tool_call', '10:53:30', "Created pages: agent-trace/page.tsx (Level 1 — Agent Map with org/agent toggle + recent traces list), agent-trace/trace/[traceId]/page.tsx (Level 3 — flow graph + issues + summary). Added 'Agent Trace' to sidebar navigation.", { fromAgentId: UC, metadata: { tool: 'write', files: 2, lines: 280 } }),
  ev(UI_SID, 'error', '10:54:00', 'TypeScript error in cost-breakdown.tsx line 87: Recharts Tooltip formatter expects (value: number | undefined) but received (value: number). Type mismatch in formatter callback signature.', { fromAgentId: UC, metadata: { file: 'cost-breakdown.tsx', line: 87 } }),
  ev(UI_SID, 'report', '10:55:13', 'AgentTrace frontend complete. 17 components, 6 hooks, 2 pages. All 4 UI levels: Agent Map with org/agent toggle, Agent Detail side panel (conversation + costs + raw logs), Task Flow graph with ReactFlow, Raw Log viewer. Dark mode compatible, responsive, loading skeletons, empty states. Pushed to main.', { fromAgentId: UC, cost: '0.035' }),

  // === DocSmith (7 events) ===
  ev(DS_SID, 'instruction', '10:57:01', 'Write complete documentation for AgentTrace: API reference, architecture overview, build log, README update.', { fromAgentId: SHIWANGI, toAgentId: DSA }),
  ev(DS_SID, 'thinking', '10:57:05', 'Four deliverables: 1) agent-trace-api.md — every endpoint with method/path/auth/body/response/example, 2) agent-trace-architecture.md — data model, UI levels, security, 3) build-log.md Phase 7 entry, 4) README.md section.', { fromAgentId: DSA }),
  ev(DS_SID, 'tool_call', '10:57:30', 'Created docs/agent-trace-api.md — 21KB comprehensive API reference. 17 endpoints organized by section: Traces (5), Sessions (3), Events (2), Analytics (4), Real-Time (3). Each endpoint: method, path, auth requirement, request params/body, response shape, curl example, error codes.', { fromAgentId: DSA, metadata: { tool: 'write', file: 'agent-trace-api.md', size: '21KB' } }),
  ev(DS_SID, 'tool_call', '10:58:30', 'Created docs/agent-trace-architecture.md — 37KB architecture deep-dive. Entity relationship diagram, 4 UI levels explained, trace capture flow, cost aggregation pipeline, flow reconstruction logic, security model (ownership, redaction, rate limiting, audit), performance considerations.', { fromAgentId: DSA, metadata: { tool: 'write', file: 'agent-trace-architecture.md', size: '37KB' } }),
  ev(DS_SID, 'tool_call', '10:59:15', "Updated docs/build-log.md — Added Phase 7 entry with all sub-phases (7.1-7.7), listing every agent's contribution, all 17 endpoints, file counts, test counts.", { fromAgentId: DSA, metadata: { tool: 'edit', file: 'build-log.md' } }),
  ev(DS_SID, 'tool_call', '10:59:45', "Updated README.md — Added 'AgentTrace — Agent Observability Platform' section with feature list and links to detailed docs.", { fromAgentId: DSA, metadata: { tool: 'edit', file: 'README.md' } }),
  ev(DS_SID, 'report', '11:00:09', 'Documentation complete. 4 files: agent-trace-api.md (21KB), agent-trace-architecture.md (37KB), build-log.md (Phase 7 added), README.md (AgentTrace section). Total 58KB+ of documentation. Pushed to main.', { fromAgentId: DSA, cost: '0.008' }),

  // === TestRunner (6 events) ===
  ev(TR_SID, 'instruction', '10:57:00', 'Write integration tests for all 17 AgentTrace endpoints, security tests, and Playwright E2E tests.', { fromAgentId: SHIWANGI, toAgentId: TRA }),
  ev(TR_SID, 'thinking', '10:57:05', 'Three test suites needed: 1) Integration tests hitting real endpoints with auth, 2) Security tests for redaction and ownership, 3) Playwright E2E for frontend flows. Starting with integration since it covers the most ground.', { fromAgentId: TRA }),
  ev(TR_SID, 'tool_call', '10:58:00', 'Created tests/integration/agent-trace/agent-trace.test.ts — Full endpoint coverage: login → create trace → create sessions → create events → list traces with pagination → get single trace → get sessions tree → get events with type filter → get timeline → get flow graph → get cost breakdown → get agent stats → update trace status → delete trace → verify auth (non-owner blocked).', { fromAgentId: TRA, metadata: { tool: 'write', file: 'agent-trace.test.ts', tests: 17 } }),
  ev(TR_SID, 'tool_call', '10:59:00', 'Created tests/integration/agent-trace/agent-trace-security.test.ts — Redaction: JWT tokens, passwords, API keys, PEM blocks, credit cards. Authorization: ownership enforcement (user A can\'t see user B\'s traces), SUPER_ADMIN bypass. Input validation: SQL injection prevention, XSS handling.', { fromAgentId: TRA, metadata: { tool: 'write', file: 'agent-trace-security.test.ts', tests: 8 } }),
  ev(TR_SID, 'tool_call', '11:00:30', 'Created tests/e2e/agent-trace.spec.ts — Playwright E2E: navigate to agent-trace page, verify sidebar link, test org/agent view toggle, verify trace filters, click trace → verify flow page loads, responsive design (mobile/tablet/desktop), loading states, error handling, accessibility checks.', { fromAgentId: TRA, metadata: { tool: 'write', file: 'agent-trace.spec.ts', tests: 12 } }),
  ev(TR_SID, 'report', '11:01:49', 'Tests complete. 3 test files: integration (17 tests), security (8 tests), E2E Playwright (12 tests). Total 37 tests covering all endpoints, auth, redaction, and frontend flows. Pushed to main.', { fromAgentId: TRA, cost: '0.03' }),
];

async function main() {
  console.log('Deleting all session_events...');
  const deleted = await prisma.sessionEvent.deleteMany();
  console.log(`Deleted ${deleted.count} events`);

  console.log(`Inserting ${events.length} new events...`);
  const result = await prisma.sessionEvent.createMany({ data: events });
  console.log(`Inserted ${result.count} events`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
