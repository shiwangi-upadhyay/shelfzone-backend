# AgentTrace Architecture

> Agent observability platform with distributed tracing, cost attribution, and flow reconstruction.

---

## Table of Contents

1. [Data Model](#data-model)
2. [Four UI Levels](#four-ui-levels)
3. [Trace Capture Flow](#trace-capture-flow)
4. [Cost Aggregation](#cost-aggregation)
5. [Flow Reconstruction](#flow-reconstruction)
6. [Security Model](#security-model)
7. [Performance Considerations](#performance-considerations)

---

## Data Model

### Entity Relationship Diagram

```
┌──────────────────┐
│      User        │
│   (from auth)    │
└────────┬─────────┘
         │
         │ 1:M
         │
         ▼
┌──────────────────────────────┐
│     TraceSession             │
│  (groups related traces)     │
├──────────────────────────────┤
│ sessionId (PK)               │
│ agentId (FK)                 │
│ userId (FK)                  │
│ startTime                    │
│ endTime (nullable)           │
│ durationMs (computed)        │
│ status                       │
│ costEstimate                 │
│ metadata (JSON)              │
│ createdAt                    │
└────────┬──────────┬──────────┘
         │          │
         │          │ 1:M
         │          │
         │          ▼
         │    ┌─────────────────────────┐
         │    │    TaskTrace            │
         │    │ (individual operations) │
         │    ├─────────────────────────┤
         │    │ traceId (PK)            │
         │    │ sessionId (FK)          │
         │    │ taskId (unique/session) │
         │    │ taskName                │
         │    │ parentTraceId (FK, self)│
         │    │ status                  │
         │    │ startTime               │
         │    │ endTime (nullable)      │
         │    │ durationMs (computed)   │
         │    │ inputTokens             │
         │    │ outputTokens            │
         │    │ cost (computed)         │
         │    │ model                   │
         │    │ metadata (JSON)         │
         │    │ createdAt               │
         │    └─────────────────────────┘
         │
         │ 1:M
         │
         ▼
┌──────────────────────────────┐
│    SessionEvent              │
│ (immutable audit log)        │
├──────────────────────────────┤
│ eventId (PK)                 │
│ sessionId (FK)               │
│ eventType                    │
│ timestamp                    │
│ severity                     │
│ payload (JSON)               │
│ source (nullable)            │
│ createdAt                    │
└──────────────────────────────┘
```

### Key Relationships

- **TraceSession → Agent**: Many sessions per agent
- **TraceSession → User**: Tracks who initiated the session
- **TaskTrace → TraceSession**: Many tasks per session
- **TaskTrace → TaskTrace**: Hierarchical parent-child relationships (self-referential)
- **SessionEvent → TraceSession**: Many events per session (immutable append-only log)

### Indexing Strategy

```typescript
// Fast session lookup and filtering
CREATE INDEX idx_trace_session_agent_time ON trace_sessions(agentId, startTime DESC);
CREATE INDEX idx_trace_session_user_time ON trace_sessions(userId, startTime DESC);
CREATE INDEX idx_trace_session_status ON trace_sessions(status);

// Fast task tree traversal
CREATE INDEX idx_task_trace_session_time ON task_traces(sessionId, startTime DESC);
CREATE INDEX idx_task_trace_status ON task_traces(status);
CREATE INDEX idx_task_trace_parent ON task_traces(parentTraceId);

// Fast event filtering
CREATE INDEX idx_session_event_type ON session_events(sessionId, eventType);
CREATE INDEX idx_session_event_time ON session_events(sessionId, timestamp DESC);
```

---

## Four UI Levels

### Level 1: Agent Map

**Purpose:** High-level overview of all agents and their operational status.

**Visual:**

```
┌─────────────────────────────────────────────────────┐
│              Agent Network Map                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│    ┌─────────────┐      ┌─────────────┐            │
│    │   Agent A   │──────│   Agent B   │            │
│    │  $120.34    │      │   $45.67    │            │
│    │  ACTIVE ✓   │      │  ACTIVE ✓   │            │
│    └─────────────┘      └─────────────┘            │
│          │                      │                   │
│          │ (shared data)        │                   │
│          └──────────┬───────────┘                   │
│                     │                               │
│              ┌──────▼──────┐                        │
│              │   Agent C   │                        │
│              │  $200.12    │                        │
│              │  WARNING ⚠  │                        │
│              └─────────────┘                        │
│                                                     │
└─────────────────────────────────────────────────────┘

Data Points per Agent Node:
- Agent name
- Total cost (YTD or period)
- Status (ACTIVE, IDLE, WARNING, ERROR)
- Session count (badges)
- Last activity (tooltip)
- Health score (color coding)
```

**Interactions:**
- Click agent → Navigate to Agent Detail Panel
- Hover → Show recent sessions
- Filter by status/team/cost
- Zoom/pan for large networks
- Time range selector (7d, 30d, 90d, YTD)

**Components:**
- `AgentMapCanvas` — Viz.js network rendering
- `AgentNode` — Interactive nodes with cost/status
- `MapControls` — Filters, search, zoom controls

**Data Source:** `GET /analytics/health` + cost aggregation

---

### Level 2: Agent Detail Panel

**Purpose:** Deep dive into a single agent's performance and health.

**Layout:**

```
┌────────────────────────────────────────────────────┐
│ Agent: Employee Service Agent                       │
│ Status: ACTIVE | Cost YTD: $1,240.56               │
├────────────────────────────────────────────────────┤
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ Cost Breakdown                               │  │
│ │ ┌─────────────────────────────────────────┐ │  │
│ │ │   $500                                  │ │  │
│ │ │   │      ███ Opus (62%)                 │ │  │
│ │ │   │      ██  Sonnet (28%)               │ │  │
│ │ │   │      █   Haiku (10%)                │ │  │
│ │ │   └─────────────────────────────────────┘ │  │
│ │ │ 7d   14d   30d  ▶ (trend sparkline)       │ │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ Performance Metrics                          │  │
│ │ ┌─────────────┬──────────────────────────┐  │  │
│ │ │ Latency     │ Avg: 850ms  P99: 2.5s   │  │  │
│ │ │ Throughput  │ 12 sess/hr               │  │  │
│ │ │ Error Rate  │ 2.3%                     │  │  │
│ │ │ Success     │ 97.7% ✓                  │  │  │
│ │ └─────────────┴──────────────────────────┘  │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ Health Score: 87/100 (GOOD)                  │  │
│ │ ├─ Efficiency:    85/100 ▓▓▓▓░               │  │
│ │ ├─ Reliability:   92/100 ▓▓▓▓▓               │  │
│ │ ├─ Latency:      78/100 ▓▓▓░░               │  │
│ │ └─ Cost Control:  89/100 ▓▓▓▓░              │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ [View Sessions] [View Cost] [Export] [Settings]  │
└────────────────────────────────────────────────────┘
```

**Components:**
- `AgentDetailHeader` — Agent name, status, YTD cost
- `CostBreakdown` — Pie chart + trend sparkline
- `PerformanceMetrics` — Latency gauges, throughput, error rate
- `HealthScore` — 5-factor composite with factor breakdown

**Data Sources:**
- `GET /analytics/agent/:id` (cost, latency, throughput)
- `GET /analytics/health` (health score)
- `GET /sessions?agentId=...` (recent sessions)

---

### Level 3: Task Trace Flow

**Purpose:** Visualize execution flow as a directed acyclic graph (DAG).

**Visual:**

```
┌────────────────────────────────────────────────────┐
│ Session: sess_1h2j...  | Execution Flow            │
├────────────────────────────────────────────────────┤
│                                                    │
│        ┌─────────────────────┐                    │
│        │  Parse Request      │                    │
│        │  ⏱ 120ms  $0.002    │                    │
│        └──────────┬──────────┘                    │
│                   │                               │
│                   ▼                               │
│    ┌──────────────────────────┐                  │
│    │  Query Employees         │                  │
│    │  ⏱ 450ms  $0.015         │                  │
│    │  Tokens: 250↓ 180↑       │                  │
│    └────┬──────────────┬──────┘                  │
│         │              │                          │
│   (parallel)      (parallel)                      │
│         │              │                          │
│         ▼              ▼                          │
│    ┌─────────┐   ┌──────────────┐               │
│    │Format   │   │Aggregate     │               │
│    │Results  │   │Metrics       │               │
│    │⏱80ms    │   │⏱120ms        │               │
│    │$0.001   │   │$0.003        │               │
│    └────┬────┘   └────┬─────────┘               │
│         │             │                          │
│         └──────┬──────┘                          │
│                │                                 │
│                ▼                                 │
│        ┌─────────────────┐                      │
│        │Return Response  │                      │
│        │⏱50ms  $0.001    │                      │
│        └─────────────────┘                      │
│                                                    │
│ ┌──────────────────────────────┐                │
│ │ Critical Path: 780ms          │                │
│ │ Total Tokens: 430↓ 180↑       │                │
│ │ Session Cost: $0.022          │                │
│ │ Bottleneck: Query (57% of time) │             │
│ └──────────────────────────────┘                │
│                                                    │
│ [Timeline] [Raw Logs] [Export] [Inspect]        │
└────────────────────────────────────────────────────┘
```

**Features:**
- Task nodes show: name, duration, cost, tokens
- Edges show dependencies (serial or parallel)
- Color coding: COMPLETED (green), RUNNING (yellow), FAILED (red)
- Critical path highlighted
- Bottleneck identification
- Zoom/pan for large flows
- Hover for full task details

**Components:**
- `TaskFlowCanvas` — ReactFlow rendering
- `TaskNode` — Interactive task node with details
- `TaskEdge` — Dependency arrows with timing
- `TaskTimeline` — Gantt chart side view
- `FlowControls` — Auto-layout, zoom, fit-to-screen

**Data Source:** `GET /sessions/:sessionId/flow`

---

### Level 4: Raw Logs

**Purpose:** Access to granular event-level data for debugging.

**Visual:**

```
┌────────────────────────────────────────────────────┐
│ Raw Event Log for Session: sess_1h2j...            │
├──────────┬──────────┬───────────┬────────────────┤
│Time      │Type      │Severity   │Message         │
├──────────┼──────────┼───────────┼────────────────┤
│11:00:00  │SPAN_START│INFO       │task:parse-req  │
│11:00:00  │LOG       │DEBUG      │input_size:1240 │
│11:00:00  │METRIC    │INFO       │parse_time:12ms │
│11:00:00  │SPAN_END  │INFO       │task:parse-req  │
│11:00:00  │SPAN_START│INFO       │task:query-db   │
│11:00:01  │LOG       │INFO       │query_rows:42   │
│11:00:01  │METRIC    │INFO       │db_latency:450m │
│11:00:01  │SPAN_END  │INFO       │task:query-db   │
│11:00:01  │ERROR     │ERROR      │invalid_format  │
│11:00:02  │LOG       │WARN       │retry_attempt:1 │
│11:00:03  │SPAN_END  │INFO       │task:aggregate  │
│                                                    │
├──────────────────────────────────────────────────┤
│ Filter: [Type ▼] [Severity ▼] [Source ▼]        │
│ Search: [invalid_format............] [Clear]     │
│ [Export as JSON] [Export as CSV]                 │
└────────────────────────────────────────────────────┘

Click a row to expand full payload:
{
  "eventId": "evt_...",
  "eventType": "LOG",
  "severity": "ERROR",
  "timestamp": "2026-02-28T11:00:01.234Z",
  "payload": {
    "message": "invalid_format",
    "field": "aadhaar",
    "value": "REDACTED",
    "expected": "12-digit-number"
  },
  "source": "employee-service"
}
```

**Features:**
- Chronological event log (all events)
- Sortable/filterable columns
- Severity-based color coding
- Full payload viewer with syntax highlighting
- PII redaction visible (with audit trail of redaction)
- Export as JSON/CSV
- Search across all fields

**Components:**
- `EventTable` — Searchable, sortable event list
- `EventDetail` — Full payload viewer
- `EventFilters` — Type, severity, source filters

**Data Source:** `GET /sessions/:sessionId/events`

---

## Trace Capture Flow

### How Events Get Logged

```
┌────────────────────────────────────────────┐
│      Agent Runtime                         │
│  (BackendForge/UIcraft/TestRunner)         │
└────────────┬─────────────────────────────┘
             │
             │ 1. Agent starts execution
             │
             ▼
┌────────────────────────────────────────────┐
│ POST /api/traces/sessions                  │
│  → Creates TraceSession (ACTIVE)           │
│  → Returns sessionId                       │
└────────────┬─────────────────────────────┘
             │
             │ 2. Each task starts
             │
             ▼
┌────────────────────────────────────────────┐
│ POST /api/traces/tasks                     │
│  → Creates TaskTrace (PENDING)             │
│  → Returns traceId                         │
│  → Optional: parentTraceId for nesting     │
└────────────┬─────────────────────────────┘
             │
             │ 3. During execution
             │    (loop: events fired)
             │
             ▼
┌────────────────────────────────────────────┐
│ POST /api/traces/events                    │
│  → Append SessionEvent (immutable)         │
│  → Types: SPAN_START, SPAN_END,            │
│          LOG, METRIC, ERROR                │
│  → Includes payload (JSON)                 │
└────────────┬─────────────────────────────┘
             │
             │ 4. Task completes
             │
             ▼
┌────────────────────────────────────────────┐
│ PUT /api/traces/tasks/:traceId/complete    │
│  → Updates TaskTrace                       │
│  → Sets status: COMPLETED/FAILED           │
│  → Records: inputTokens, outputTokens      │
│  → Calculates: cost, durationMs            │
└────────────┬─────────────────────────────┘
             │
             │ 5. All tasks done or
             │    session ends
             │
             ▼
┌────────────────────────────────────────────┐
│ PUT /api/traces/sessions/:sessionId/complete│
│  → Updates TraceSession                    │
│  → Sets status: COMPLETED/FAILED           │
│  → Finalizes: totalCost, durationMs        │
└────────────────────────────────────────────┘
             │
             │ 6. Analytics updated
             │    (async aggregation)
             │
             ▼
┌────────────────────────────────────────────┐
│ Cost & Analytics Cache                     │
│  (AgentCostLedger, efficiency scores)      │
└────────────────────────────────────────────┘
```

### Non-Blocking Design

All trace logging is **fire-and-forget**:

```typescript
// Agent code example
async function executeTask() {
  const traceId = await createTaskTrace(...);
  
  try {
    // Main execution
    const result = await doWork();
    
    // Log completion (non-blocking)
    completeTaskTrace(traceId, result).catch(err => {
      // Silently log error (don't fail main task)
      console.error('Trace logging failed:', err);
    });
  } catch (error) {
    // Log error (non-blocking)
    completeTaskTrace(traceId, { status: 'FAILED', error }).catch(() => {});
    throw error;
  }
}
```

**Benefits:**
- Agent execution never blocked by tracing
- Failures in tracing don't cascade
- Lower latency for main operations
- Graceful degradation (tracing failure ≠ task failure)

---

## Cost Aggregation

### Real-Time Cost Calculation

```
┌──────────────────────────────────┐
│   Task Completion Event          │
│   inputTokens: 250               │
│   outputTokens: 180              │
│   model: "claude-3-opus"         │
└────────────────┬─────────────────┘
                 │
                 ▼
┌──────────────────────────────────┐
│  Cost Calculator Library         │
│  src/lib/cost-calculator.ts      │
│                                  │
│  Model Rates:                    │
│  Opus: $15/M in, $75/M out       │
│  Sonnet: $3/M in, $15/M out      │
│  Haiku: $0.25/M in, $1.25/M out  │
└────────────────┬─────────────────┘
                 │
                 ▼
┌──────────────────────────────────┐
│  Formula:                        │
│  inputCost = (250 / 1M) * 15     │
│            = $0.00375            │
│                                  │
│  outputCost = (180 / 1M) * 75    │
│             = $0.0135            │
│                                  │
│  totalCost = $0.01725            │
└────────────────┬─────────────────┘
                 │
                 ▼
┌──────────────────────────────────┐
│  Update TaskTrace.cost           │
│  Increment Session.costEstimate  │
│  Create AgentCostLedger entry    │
└────────────────┬─────────────────┘
                 │
                 ▼
┌──────────────────────────────────┐
│  Analytics Cache Updates         │
│  (async aggregation)             │
│  - Daily total by agent          │
│  - Monthly total by agent        │
│  - By model breakdown            │
│  - Budget checks                 │
└──────────────────────────────────┘
```

### Aggregation Pipeline

```
Task Completion
      │
      ├─→ TraceService.completeTask()
      │   └─→ Calculates & stores cost
      │
      ├─→ AgentCostLedger (immutable log)
      │   ├─ One ledger entry per task
      │   ├─ Immutable (audit trail)
      │   └─ Indexed by agent + date
      │
      └─→ Async Aggregation Job (every 5 min)
          ├─→ Cost Service
          │   ├─ Sum by agent + period
          │   ├─ Sum by model + period
          │   ├─ Calculate daily totals
          │   └─ Store in cache
          │
          └─→ Budget Service
              ├─ Check monthly total
              ├─ Compare to budget cap
              └─ Flag overages / auto-pause
```

### Cost Query Performance

```typescript
// Fast reads via pre-aggregated data
// Time complexity: O(1) for cached lookups

GET /analytics/cost?agentId=...&period=7d
→ Reads from CostAggregationCache
→ 5-min stale data (acceptable for dashboards)
→ Returns in <50ms

// Ledger for audit trail
GET /costs/ledger?agentId=...&date=2026-02-28
→ Scans indexed AgentCostLedger table
→ Returns raw transaction-level data
→ Returns in <100ms (with indexes)
```

---

## Flow Reconstruction

### DAG Building Algorithm

**Input:** TaskTrace hierarchy + SessionEvent log

**Output:** Directed acyclic graph (nodes + edges)

```typescript
function reconstructFlow(sessionId: string): DAG {
  // Step 1: Fetch all tasks for session
  const tasks = await prisma.taskTrace.findMany({
    where: { sessionId },
    orderBy: { startTime: 'asc' },
  });

  // Step 2: Build node map
  const nodes = tasks.map(task => ({
    id: task.traceId,
    label: task.taskName,
    duration: task.durationMs,
    cost: task.cost,
    status: task.status,
    startTime: task.startTime,
    endTime: task.endTime,
  }));

  // Step 3: Build edges from parent-child relationships
  const edges = [];
  for (const task of tasks) {
    if (task.parentTraceId) {
      edges.push({
        from: task.parentTraceId,
        to: task.traceId,
        type: 'DEPENDENCY',
      });
    }
  }

  // Step 4: Detect parallel execution
  // (tasks with same parent, overlapping time windows)
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const ti = tasks[i];
      const tj = tasks[j];
      
      if (ti.parentTraceId === tj.parentTraceId &&
          !timeWindowsOverlap(ti, tj)) {
        // Sequential
        edges.push({
          from: ti.traceId,
          to: tj.traceId,
          type: 'SEQUENCE',
        });
      } else if (ti.parentTraceId === tj.parentTraceId) {
        // Mark as parallel (for UI rendering)
        // Keep edge, but flag as parallel
        edges.push({
          from: ti.traceId,
          to: tj.traceId,
          type: 'PARALLEL',
        });
      }
    }
  }

  // Step 5: Topological sort
  const sortedNodes = topologicalSort(nodes, edges);

  // Step 6: Detect critical path
  const criticalPath = findCriticalPath(sortedNodes, edges);

  // Step 7: Identify bottlenecks
  const bottlenecks = identifyBottlenecks(sortedNodes, edges);

  return {
    nodes: sortedNodes,
    edges,
    criticalPath,
    bottlenecks,
  };
}
```

### Critical Path Analysis

```
Critical Path = longest chain of dependent tasks

Example:
  Parse → Query → Format → Return
  T1       T2       T3       T4
  
  T1: 120ms
  T2: 450ms  ← longest
  T3: 80ms
  T4: 50ms
  
  Critical Path = T1 + T2 + T3 + T4 = 700ms
  
Bottlenecks:
  T2 takes 450ms (64% of critical path)
  Suggestion: Optimize query or use caching
```

### Cycle Detection

```typescript
// Prevent invalid DAGs (circular dependencies)
function hasCycle(nodes: Node[], edges: Edge[]): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    const children = edges
      .filter(e => e.from === nodeId)
      .map(e => e.to);
    
    for (const childId of children) {
      if (!visited.has(childId)) {
        if (dfs(childId)) return true;
      } else if (recursionStack.has(childId)) {
        return true; // Cycle detected
      }
    }
    
    recursionStack.delete(nodeId);
    return false;
  }
  
  for (const node of nodes) {
    if (!visited.has(node.id) && dfs(node.id)) {
      return true;
    }
  }
  return false;
}
```

---

## Security Model

### Ownership-Based Access Control

```
Ownership Rules:
┌──────────────┬─────────────────────────────────┐
│ Role         │ Can See                         │
├──────────────┼─────────────────────────────────┤
│ SUPER_ADMIN  │ All traces (all agents)        │
│ HR_ADMIN     │ All traces (all agents)        │
│ MANAGER      │ Team's agents' traces only     │
│ AGENT_OWNER  │ Own agent's traces only        │
│ EMPLOYEE     │ Own execution traces only      │
└──────────────┴─────────────────────────────────┘

Ownership Validation:
For each trace query:
  1. Extract userId from JWT
  2. Fetch user's role + team
  3. Compare to trace's agent ownership
  4. Return 403 if access denied
```

### PII Redaction

```
Sensitive Patterns Detected & Redacted:
┌─────────────────────┬────────────────────────────┐
│ Pattern             │ Regex                      │
├─────────────────────┼────────────────────────────┤
│ SSN                 │ \d{3}-\d{2}-\d{4}          │
│ Email               │ [a-z0-9._%+-]+@[a-z0-9.-] │
│ Phone               │ \d{3}-\d{3}-\d{4}          │
│ Credit Card         │ \d{4}[\s-]?\d{4}[\s-]?\d{4}│
│ API Key             │ (key|token|secret|apikey)= │
│ Password            │ (password|passwd|pwd)=    │
└─────────────────────┴────────────────────────────┘

Redaction Strategy:
- Task metadata: fields matching patterns → REDACTED
- Event payloads: sensitive fields → REDACTED
- Session metadata: sensitive fields → REDACTED
- Reversible: hash stored for link verification
- Audit log: tracks what was redacted, by whom, when

Example:
  Before: { email: "john@example.com", phone: "555-123-4567" }
  After:  { email: "REDACTED", phone: "REDACTED" }
  Audit:  [{ action: "REDACT", field: "email", timestamp: "...", userId: "..." }]
```

### Rate Limiting

```
Per-Agent Limits (Sliding Window):
┌──────────────────────┬────────────┬──────────┐
│ Endpoint             │ Limit      │ Window   │
├──────────────────────┼────────────┼──────────┤
│ POST /tasks          │ 1000 req   │ 60s      │
│ POST /events         │ 100 req    │ 60s      │
│ POST /sessions       │ 50 req     │ 60s      │
│ GET endpoints        │ 500 req    │ 60s      │
└──────────────────────┴────────────┴──────────┘

Sliding Window Algorithm:
  1. Maintain timestamp list for agent
  2. On each request:
     - Remove timestamps older than window
     - Check if new request exceeds limit
     - Return 429 if exceeded
     - Otherwise, add timestamp
  3. Cleanup job: runs every 5 min, removes stale entries

Response Headers:
  X-RateLimit-Limit: 1000
  X-RateLimit-Remaining: 875
  Retry-After: 45 (if 429)
```

### Audit Logging

```
Immutable Audit Trail:
┌────────────────────────────────────────────┐
│ AuditLog Table                             │
├────────────────────────────────────────────┤
│ auditLogId (PK)                            │
│ action (create, read, update, redact)      │
│ userId (who performed action)              │
│ sessionId (optional FK)                    │
│ details (JSON, action-specific)            │
│ timestamp (createdAt)                      │
│ No updatedAt or deletedAt (write-once)     │
└────────────────────────────────────────────┘

Logged Operations:
- Session creation/completion
- Task logging (with tokens, not payloads)
- Event creation
- Analytics queries (high-volume read logs)
- Redaction operations (what, by whom, when)
- Access denials (failed 403s)
```

---

## Performance Considerations

### Query Optimization

```
Session List (large datasets):
- Index: (agentId, startTime DESC)
- With pagination: LIMIT 20 OFFSET (page-1)*20
- Execution time: <100ms for typical data size

Task Tree (hierarchical):
- Index: (sessionId, startTime DESC) + (parentTraceId)
- Parent lookup: O(1) with parentTraceId FK
- Child lookup: O(n) scan, but filtered by parentTraceId index
- Execution time: <200ms for 1000 tasks

Event Stream (high-volume):
- Index: (sessionId, timestamp DESC) + (eventType)
- Filter by type: uses (sessionId, eventType) index
- Pagination: LIMIT 100 OFFSET ...
- Execution time: <150ms typical
```

### Data Retention

```
Retention Policy:
- Live traces: Never expire (owner's responsibility)
- Completed sessions: Keep for 90 days
- Archived sessions: Move to cold storage after 90d
- Audit logs: Keep indefinitely (compliance)
- Event logs: Keep for 30 days (performance)

Storage Estimate:
- Per session: ~50 KB (metadata + task tree)
- Per event: ~500 bytes (payload included)
- Per 1000 sessions/day: ~50 MB traces + 100 MB events
- Monthly: ~4.5 GB traces + 3 GB events

Archival:
- Nightly job: Move sessions >90d old to S3
- Restore from S3 on demand (slower reads)
```

### Horizontal Scalability

```
Sharding Strategy (future):
- By agentId (distribute agents across shards)
- Trace query always routes to agent's shard
- No cross-shard joins needed
- Cost aggregation aggregates across shards

Caching:
- Cost aggregates cached for 5 min
- Health scores cached for 10 min
- Session list cached for 1 min
- TTL-based invalidation on session completion
```

---

## Integration Points

### With Agent Portal (Phase 4)

```
AgentTrace reads cost data for:
- Agent analytics dashboard
- Budget checks
- Cost attribution per agent
- Team cost rollup

Data flow:
  AgentTrace.TaskTrace.cost
    → AgentPortal.analytics.agent
    → AgentPortal.costs module
    → AgentPortal.budgets (checks against limits)
```

### With HR Platform (Phase 3)

```
AgentTrace logs for:
- Employee data access (audit trail)
- Leave approval decisions
- Attendance corrections
- Payroll processing

Data flow:
  HR.Employee.read → AgentTrace.task(entity: Employee)
  HR.Leave.approve → AgentTrace.event(action: approve)
  Security review: All employee data access logged
```

### Future Integrations

```
Slack Notifications:
- Critical error alerts
- Cost overages
- Budget thresholds breached

Datadog/New Relic APM:
- Distributed tracing export
- Flame graphs
- Performance bottleneck detection

S3 Export:
- Long-term archival
- Compliance backup
- Data lake integration
```

---

## Future Enhancements

1. **Custom Metrics**: Allow agents to log arbitrary metrics (response time, accuracy, etc.)
2. **Flow Diff**: Compare flows between sessions (detect regressions)
3. **Automated Optimization**: ML-based recommendations (e.g., "consider batch processing")
4. **Cost Anomaly Detection**: Alert on unusual spending patterns
5. **Distributed Tracing**: Multi-service tracing across microservices
6. **OpenTelemetry Export**: Standard tracing format for external tools
