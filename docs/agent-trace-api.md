# AgentTrace API Documentation

> Full agent observability with 4 UI levels, distributed tracing, cost attribution, and flow reconstruction.

**Base URL:** `http://localhost:3001/api/traces`

**Authentication:** Bearer token (JWT) in Authorization header

---

## Table of Contents

1. [Trace Sessions](#trace-sessions)
2. [Tasks](#tasks)
3. [Events](#events)
4. [Analytics](#analytics)
5. [Real-Time](#real-time)
6. [Data Models](#data-models)
7. [Error Responses](#error-responses)

---

## Trace Sessions

### POST /sessions

Create a new trace session to group related agent tasks.

**Auth Required:** SUPER_ADMIN, HR_ADMIN, AGENT_OWNER

**Request Body:**

```typescript
{
  agentId: string;      // Agent CUID
  userId: string;       // User CUID (executor)
  metadata?: {
    [key: string]: any; // Custom metadata (optional)
  };
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3001/api/traces/sessions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "cl9x2m0zb0001qz088h0u4i9a",
    "userId": "cl9x2m0zb0001qz088h0u4i9x",
    "metadata": {
      "initiator": "user",
      "context": "daily-report-generation"
    }
  }'
```

**Response (201):**

```typescript
{
  sessionId: string;     // Unique trace session ID
  agentId: string;
  userId: string;
  startTime: string;     // ISO 8601
  status: "ACTIVE";
  costEstimate: number;  // $0.00 at start
  metadata: object;
}
```

**Example Response:**

```json
{
  "sessionId": "sess_1h2j3k4l5m6n7o8p9q0r1s2t",
  "agentId": "cl9x2m0zb0001qz088h0u4i9a",
  "userId": "cl9x2m0zb0001qz088h0u4i9x",
  "startTime": "2026-02-28T11:00:00Z",
  "status": "ACTIVE",
  "costEstimate": 0.00,
  "metadata": {
    "initiator": "user",
    "context": "daily-report-generation"
  }
}
```

**Error Responses:**

- `400` — Invalid agentId/userId, missing required fields
- `401` — Missing/invalid auth token
- `403` — Insufficient permissions (not owner or admin)
- `404` — Agent or User not found

---

### GET /sessions

List all trace sessions with optional filtering.

**Auth Required:** SUPER_ADMIN, HR_ADMIN, AGENT_OWNER (own agents only)

**Query Parameters:**

```typescript
page?: number;          // Default: 1
limit?: number;         // Default: 20, Max: 100
agentId?: string;       // Filter by agent
status?: "ACTIVE" | "COMPLETED" | "FAILED";
startDate?: string;     // ISO 8601 (inclusive)
endDate?: string;       // ISO 8601 (inclusive)
```

**Example Request:**

```bash
curl "http://localhost:3001/api/traces/sessions?agentId=cl9x2m0zb0001qz088h0u4i9a&status=COMPLETED&limit=10" \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```typescript
{
  data: Array<{
    sessionId: string;
    agentId: string;
    userId: string;
    startTime: string;
    endTime?: string;
    durationMs?: number;
    status: "ACTIVE" | "COMPLETED" | "FAILED";
    costEstimate: number;
    taskCount: number;
    eventCount: number;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

**Example Response:**

```json
{
  "data": [
    {
      "sessionId": "sess_1h2j3k4l5m6n7o8p9q0r1s2t",
      "agentId": "cl9x2m0zb0001qz088h0u4i9a",
      "userId": "cl9x2m0zb0001qz088h0u4i9x",
      "startTime": "2026-02-28T11:00:00Z",
      "endTime": "2026-02-28T11:05:30Z",
      "durationMs": 330000,
      "status": "COMPLETED",
      "costEstimate": 0.32,
      "taskCount": 12,
      "eventCount": 45
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

---

### GET /sessions/:sessionId

Get a single trace session with full task tree and event summary.

**Auth Required:** SUPER_ADMIN, HR_ADMIN, AGENT_OWNER (agent owner)

**Path Parameters:**

- `sessionId` (string, required) — Trace session ID

**Example Request:**

```bash
curl "http://localhost:3001/api/traces/sessions/sess_1h2j3k4l5m6n7o8p9q0r1s2t" \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```typescript
{
  session: {
    sessionId: string;
    agentId: string;
    userId: string;
    startTime: string;
    endTime?: string;
    durationMs?: number;
    status: "ACTIVE" | "COMPLETED" | "FAILED";
    costEstimate: number;
    metadata: object;
  };
  tasks: Array<{
    traceId: string;
    taskId: string;
    taskName: string;
    parentTraceId?: string;
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
    startTime: string;
    endTime?: string;
    durationMs?: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    model: string;
  }>;
  events: {
    total: number;
    byType: {
      SPAN_START: number;
      SPAN_END: number;
      LOG: number;
      METRIC: number;
      ERROR: number;
    };
  };
  flowGraph: {
    nodes: Array<{ id: string; task: string; duration: number }>;
    edges: Array<{ from: string; to: string; type: string }>;
  };
}
```

**Error Responses:**

- `404` — Session not found
- `403` — Access denied

---

### GET /sessions/:sessionId/timeline

Get task execution timeline for a session (Gantt-chart data).

**Auth Required:** SUPER_ADMIN, HR_ADMIN, AGENT_OWNER

**Path Parameters:**

- `sessionId` (string, required)

**Example Request:**

```bash
curl "http://localhost:3001/api/traces/sessions/sess_1h2j3k4l5m6n7o8p9q0r1s2t/timeline" \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```typescript
{
  sessionId: string;
  startTime: string;
  endTime?: string;
  totalDurationMs: number;
  events: Array<{
    taskId: string;
    taskName: string;
    startTime: string;
    endTime: string;
    durationMs: number;
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
    sequenceNumber: number;
  }>;
}
```

---

### GET /sessions/:sessionId/flow

Reconstruct execution flow (DAG) for a session.

**Auth Required:** SUPER_ADMIN, HR_ADMIN, AGENT_OWNER

**Path Parameters:**

- `sessionId` (string, required)

**Example Request:**

```bash
curl "http://localhost:3001/api/traces/sessions/sess_1h2j3k4l5m6n7o8p9q0r1s2t/flow" \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```typescript
{
  flowGraph: {
    nodes: Array<{
      id: string;
      taskName: string;
      model: string;
      durationMs: number;
      cost: number;
      status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
      inputTokens: number;
      outputTokens: number;
    }>;
    edges: Array<{
      from: string;
      to: string;
      type: "DEPENDENCY" | "PARALLEL";
    }>;
  };
  criticalPath: {
    nodes: string[];
    totalDurationMs: number;
  };
  bottlenecks: Array<{
    taskId: string;
    taskName: string;
    reason: string;
    impact: "HIGH" | "MEDIUM" | "LOW";
  }>;
  metrics: {
    taskCount: number;
    parallelLevels: number;
    totalCost: number;
    avgTaskDuration: number;
  };
}
```

---

### PUT /sessions/:sessionId/complete

Mark a trace session as complete.

**Auth Required:** Service-to-service (Agent Runtime)

**Path Parameters:**

- `sessionId` (string, required)

**Request Body:**

```typescript
{
  status: "COMPLETED" | "FAILED";
  endTime: string;       // ISO 8601
  finalCost: number;
}
```

**Response (200):**

```typescript
{
  completed: true;
  sessionId: string;
  finalCost: number;
}
```

---

## Tasks

### POST /tasks

Log a task start (create TaskTrace entry).

**Auth Required:** Service-to-service (Agent Runtime)

**Request Body:**

```typescript
{
  sessionId: string;
  taskId: string;        // Unique within session
  taskName: string;
  parentTaskId?: string; // For hierarchical nesting
  model?: string;        // e.g., "claude-3-opus"
  metadata?: object;
}
```

**Response (201):**

```typescript
{
  traceId: string;
  sessionId: string;
  taskId: string;
  taskName: string;
  startTime: string;
}
```

---

### PUT /tasks/:traceId/complete

Log a task completion with metrics.

**Auth Required:** Service-to-service (Agent Runtime)

**Path Parameters:**

- `traceId` (string, required) — Trace ID from POST /tasks

**Request Body:**

```typescript
{
  status: "COMPLETED" | "FAILED";
  endTime: string;       // ISO 8601
  inputTokens: number;
  outputTokens: number;
  cost?: number;         // Auto-calculated if omitted
  metadata?: object;
}
```

**Response (200):**

```typescript
{
  completed: true;
  traceId: string;
  durationMs: number;
  cost: number;
}
```

---

## Events

### POST /events

Log an event (span, metric, error, log) within a session.

**Auth Required:** Service-to-service (Agent Runtime)

**Request Body:**

```typescript
{
  sessionId: string;
  eventType: "SPAN_START" | "SPAN_END" | "LOG" | "METRIC" | "ERROR";
  severity?: "DEBUG" | "INFO" | "WARN" | "ERROR";
  payload: object;       // Event-specific data
  source?: string;       // Optional source identifier
}
```

**Example Request:**

```json
{
  "sessionId": "sess_1h2j3k4l5m6n7o8p9q0r1s2t",
  "eventType": "LOG",
  "severity": "INFO",
  "payload": {
    "message": "Employee query completed",
    "resultCount": 42
  },
  "source": "employee-service"
}
```

**Response (201):**

```typescript
{
  eventId: string;
  sessionId: string;
  timestamp: string;
}
```

---

### GET /sessions/:sessionId/events

List events for a session with optional filtering.

**Auth Required:** SUPER_ADMIN, HR_ADMIN, AGENT_OWNER

**Path Parameters:**

- `sessionId` (string, required)

**Query Parameters:**

```typescript
eventType?: "SPAN_START" | "SPAN_END" | "LOG" | "METRIC" | "ERROR";
severity?: "DEBUG" | "INFO" | "WARN" | "ERROR";
offset?: number;        // Default: 0
limit?: number;         // Default: 100, Max: 500
```

**Response (200):**

```typescript
{
  events: Array<{
    eventId: string;
    sessionId: string;
    eventType: string;
    severity: string;
    timestamp: string;
    payload: object;
    source?: string;
  }>;
  total: number;
  offset: number;
  limit: number;
}
```

---

## Analytics

### GET /analytics/cost

Cost breakdown by agent, model, and time period.

**Auth Required:** SUPER_ADMIN, HR_ADMIN, FINANCE

**Query Parameters:**

```typescript
agentId?: string;
period: "7d" | "30d" | "90d";
breakdown: "agent" | "model" | "hour";
```

**Example Request:**

```bash
curl "http://localhost:3001/api/traces/analytics/cost?agentId=cl9x2m0zb0001qz088h0u4i9a&period=7d&breakdown=model" \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```typescript
{
  totalCost: number;
  period: "7d" | "30d" | "90d";
  breakdown: "agent" | "model" | "hour";
  costByCategory: Array<{
    category: string;      // Agent ID, model name, or hour
    cost: number;
    percentage: number;
    sessionCount: number;
    avgCostPerSession: number;
  }>;
  trends: Array<{
    date: string;
    cost: number;
    sessionsCount: number;
  }>;
}
```

---

### GET /analytics/performance

Latency, throughput, and error metrics.

**Auth Required:** SUPER_ADMIN, HR_ADMIN, AGENT_OWNER

**Query Parameters:**

```typescript
agentId?: string;
period: "7d" | "30d" | "90d";
```

**Response (200):**

```typescript
{
  agentId: string;
  period: "7d" | "30d" | "90d";
  metrics: {
    avgLatencyMs: number;
    p50LatencyMs: number;
    p99LatencyMs: number;
    throughputSessionsPerHour: number;
    errorRate: number;         // 0-100%
    successRate: number;        // 0-100%
    taskSuccessRate: number;
  };
  trends: Array<{
    date: string;
    avgLatencyMs: number;
    throughput: number;
    errorRate: number;
  }>;
}
```

---

### GET /analytics/tokens

Token usage by model.

**Auth Required:** SUPER_ADMIN, HR_ADMIN, AGENT_OWNER

**Query Parameters:**

```typescript
agentId?: string;
period: "7d" | "30d" | "90d";
```

**Response (200):**

```typescript
{
  agentId: string;
  period: "7d" | "30d" | "90d";
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  avgTokensPerSession: number;
  byModel: Array<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    percentage: number;
    avgTokensPerSession: number;
  }>;
  trends: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
  }>;
}
```

---

### GET /analytics/health

Agent health scores and alerts.

**Auth Required:** SUPER_ADMIN, HR_ADMIN, MANAGER

**Query Parameters:**

```typescript
period: "7d" | "30d" | "90d";
```

**Response (200):**

```typescript
{
  period: "7d" | "30d" | "90d";
  agents: Array<{
    agentId: string;
    agentName: string;
    healthScore: number;        // 0-100
    rating: "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS_IMPROVEMENT";
    factors: {
      efficiency: number;        // Cost per task
      reliability: number;       // Success rate
      latency: number;           // Avg latency
      costControl: number;       // Budget adherence
    };
    status: "HEALTHY" | "WARNING" | "CRITICAL";
  }>;
  overallHealthScore: number;
  alerts: Array<{
    agentId: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    message: string;
    recommendation: string;
  }>;
}
```

---

## Real-Time

### GET /live/sessions

**WebSocket Endpoint**

Stream active trace sessions in real-time.

**Connection URL:**

```
ws://localhost:3001/api/traces/live/sessions
```

**Auth Required:** SUPER_ADMIN, HR_ADMIN

**Example Connection:**

```javascript
const ws = new WebSocket(
  'ws://localhost:3001/api/traces/live/sessions',
  'Bearer <token>'
);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Trace update:', message);
};
```

**Message Types:**

```typescript
// New session started
{
  type: "SESSION_CREATED";
  sessionId: string;
  agentId: string;
  startTime: string;
}

// Session completed
{
  type: "SESSION_COMPLETED";
  sessionId: string;
  status: "COMPLETED" | "FAILED";
  finalCost: number;
  durationMs: number;
}

// Cost updated
{
  type: "COST_UPDATED";
  sessionId: string;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
}
```

---

### GET /live/agent/:agentId

**WebSocket Endpoint**

Stream an agent's active tasks in real-time.

**Connection URL:**

```
ws://localhost:3001/api/traces/live/agent/:agentId
```

**Auth Required:** SUPER_ADMIN, HR_ADMIN, AGENT_OWNER

**Message Types:**

```typescript
// Task started
{
  type: "TASK_STARTED";
  sessionId: string;
  traceId: string;
  taskId: string;
  taskName: string;
  startTime: string;
}

// Task completed
{
  type: "TASK_COMPLETED";
  traceId: string;
  status: "COMPLETED" | "FAILED";
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

// Error occurred
{
  type: "TASK_ERROR";
  traceId: string;
  error: string;
  severity: "WARN" | "ERROR";
}

// Metric recorded
{
  type: "METRIC";
  traceId: string;
  metric: string;
  value: number;
  unit: string;
}
```

---

### GET /live/tasks/:sessionId

**WebSocket Endpoint**

Stream a session's task tree and flow updates.

**Connection URL:**

```
ws://localhost:3001/api/traces/live/tasks/:sessionId
```

**Auth Required:** SUPER_ADMIN, HR_ADMIN, AGENT_OWNER

**Message Types:**

```typescript
// Flow structure updated
{
  type: "FLOW_UPDATED";
  sessionId: string;
  nodes: Array<{ id: string; task: string }>;
  edges: Array<{ from: string; to: string }>;
}

// Task hierarchy changed
{
  type: "HIERARCHY_CHANGED";
  sessionId: string;
  taskId: string;
  parentTaskId?: string;
}

// Real-time metrics
{
  type: "METRICS";
  sessionId: string;
  totalDurationMs: number;
  totalCost: number;
  completedTasks: number;
  remainingTasks: number;
}
```

---

## Data Models

### TraceSession

```typescript
{
  sessionId: string;          // CUID
  agentId: string;            // FK to Agent
  userId: string;             // FK to User
  startTime: string;          // ISO 8601
  endTime?: string;           // ISO 8601
  durationMs?: number;
  status: "ACTIVE" | "COMPLETED" | "FAILED";
  costEstimate: number;
  metadata?: {
    [key: string]: any;
  };
  createdAt: string;
}
```

### TaskTrace

```typescript
{
  traceId: string;            // CUID
  sessionId: string;          // FK to TraceSession
  taskId: string;             // Unique within session
  taskName: string;
  parentTraceId?: string;     // FK to TaskTrace (self-reference)
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  startTime: string;
  endTime?: string;
  durationMs?: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model?: string;
  metadata?: {
    [key: string]: any;
  };
  createdAt: string;
}
```

### SessionEvent

```typescript
{
  eventId: string;            // CUID
  sessionId: string;          // FK to TraceSession
  eventType: "SPAN_START" | "SPAN_END" | "LOG" | "METRIC" | "ERROR";
  timestamp: string;          // ISO 8601
  severity: "DEBUG" | "INFO" | "WARN" | "ERROR";
  payload: {
    [key: string]: any;
  };
  source?: string;
  createdAt: string;
}
```

---

## Error Responses

All errors follow this format:

```typescript
{
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable message
    details?: {
      [key: string]: any;
    };
  };
}
```

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 400 | Bad Request | Invalid query parameters, missing required fields |
| 401 | Unauthorized | Missing/invalid auth token |
| 403 | Forbidden | Access denied (insufficient permissions) |
| 404 | Not Found | Session/task/event not found |
| 409 | Conflict | Duplicate task ID within session |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

### Example Error Response

```json
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Trace session sess_1h2j3k4l5m6n7o8p9q0r1s2t not found",
    "details": {
      "sessionId": "sess_1h2j3k4l5m6n7o8p9q0r1s2t"
    }
  }
}
```

---

## Rate Limiting

AgentTrace endpoints are rate-limited per agent and user:

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /tasks | 1,000 req/min | Per agent |
| POST /events | 100 req/min | Per session |
| POST /sessions | 50 req/min | Per user |
| GET endpoints | 500 req/min | Per user |

Exceeding limits returns `429 Too Many Requests` with `Retry-After` header.

---

## RBAC Matrix

| Endpoint | SUPER_ADMIN | HR_ADMIN | MANAGER | AGENT_OWNER | EMPLOYEE |
|----------|-------------|----------|---------|-------------|----------|
| POST /sessions | ✅ | ✅ | ❌ | ✅ | ❌ |
| GET /sessions | ✅ | ✅ | ✅ (team) | ✅ (own) | ❌ |
| GET /sessions/:id | ✅ | ✅ | ✅ (team) | ✅ (own) | ❌ |
| GET /sessions/:id/timeline | ✅ | ✅ | ✅ (team) | ✅ (own) | ❌ |
| GET /sessions/:id/flow | ✅ | ✅ | ✅ (team) | ✅ (own) | ❌ |
| POST /tasks | S2S | S2S | S2S | S2S | S2S |
| PUT /tasks/:id/complete | S2S | S2S | S2S | S2S | S2S |
| POST /events | S2S | S2S | S2S | S2S | S2S |
| GET /sessions/:id/events | ✅ | ✅ | ✅ (team) | ✅ (own) | ❌ |
| GET /analytics/cost | ✅ | ✅ | ❌ | ✅ | ❌ |
| GET /analytics/performance | ✅ | ✅ | ✅ (team) | ✅ (own) | ❌ |
| GET /analytics/tokens | ✅ | ✅ | ✅ (team) | ✅ (own) | ❌ |
| GET /analytics/health | ✅ | ✅ | ✅ (team) | ✅ (own) | ❌ |
| WS /live/sessions | ✅ | ✅ | ❌ | ❌ | ❌ |
| WS /live/agent/:id | ✅ | ✅ | ✅ (team) | ✅ (own) | ❌ |
| WS /live/tasks/:id | ✅ | ✅ | ✅ (team) | ✅ (own) | ❌ |

**Notes:**
- S2S = Service-to-Service (Agent Runtime only)
- (own) = User's own agents/sessions only
- (team) = User's team's agents/sessions only

---

## Audit Trail

All trace operations are logged to the AuditLog table:

- Session creation/completion
- Task logging (with token counts, not payloads)
- Event creation
- Analytics queries
- Redaction operations

Audit logs include: userId, action, sessionId, timestamp, details.

---

## Security

### Ownership Validation

- SUPER_ADMIN/HR_ADMIN: see all traces
- AGENT_OWNER: see own agent's traces only
- MANAGER: see team's agents' traces only

Returns `403 Forbidden` if access denied.

### Redaction

Sensitive data (PII, API keys, passwords) is automatically redacted from:
- Task metadata
- Event payloads
- Session metadata

Redaction preserves data integrity for compliance audits while preventing sensitive data exposure.

### Rate Limiting

Per-agent and per-session limits prevent:
- Log flooding attacks
- Disk I/O exhaustion
- Cost explosion from runaway sessions

---

## Webhooks & Integrations

Future enhancements:
- Slack notifications for critical errors
- Datadog/New Relic integration for APM
- S3 export for long-term archival
- Grafana dashboard templates

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/shiwangi-upadhyay/shelfzone-backend/issues
- Email: shiwangiupadhyay332@gmail.com
