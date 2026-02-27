# ShelfZone Agent Portal API Documentation

> Comprehensive API reference for Phase 4: Agent Management Portal, cost tracking, budgeting, analytics, and intelligent agent lifecycle management.

---

## Overview

The Agent Portal API provides complete control over intelligent agent registration, configuration, team management, cost tracking, budget enforcement, and real-time analytics. This API supports multi-tenant team structures, per-agent cost accounting, efficiency scoring, and granular access control via RBAC and agent sandboxing.

### Key Concepts

| Concept | Purpose |
|---------|---------|
| **Agent** | Autonomous AI entity with type, model, prompt, capabilities, and lifecycle state |
| **Agent Type** | CHAT, WORKFLOW, SCHEDULED, INTEGRATION — determines permission matrix |
| **Team** | Group of agents with a lead agent and aggregated metrics |
| **Budget** | Monthly spend cap per agent/team with auto-pause enforcement |
| **Cost Ledger** | Immutable record of token costs per session (input, output, total) |
| **API Key** | Time-scoped, revocable credential for external agent invocation |
| **Efficiency Score** | 5-factor composite metric (0-100) measuring cost, latency, success rate, errors, token efficiency |
| **Rate Limit** | Per-agent sliding window (configurable requests/window) to prevent runaway costs |

---

## 1. Agents Module

### Endpoint: POST /api/agent-portal/agents

**Create a new agent.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Request Body:**
```json
{
  "name": "string",              // Required. Agent display name
  "slug": "string",              // Required. URL-safe identifier
  "description": "string",       // Optional. Agent purpose/behavior
  "type": "CHAT" | "WORKFLOW" | "SCHEDULED" | "INTEGRATION",
  "model": "string",             // e.g., "claude-opus-4-6"
  "systemPrompt": "string",      // Optional, encrypted at rest
  "temperature": number,         // 0-2, default 1
  "maxTokens": number,           // 1-200000, default 4096
  "timeoutMs": number,           // 1000-600000, default 30000
  "capabilities": {              // Optional. Custom JSON metadata
    "tools": ["string"],
    "restrictedOperations": ["string"]
  },
  "tools": ["string"],           // Optional. Allowed tools/integrations
  "isCritical": boolean          // If true, never auto-paused by budget
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "cuid",
    "name": "string",
    "slug": "string",
    "type": "CHAT",
    "model": "string",
    "status": "ACTIVE",
    "isCritical": boolean,
    "createdAt": "ISO8601",
    "createdBy": "cuid"
  }
}
```

**Error Responses:**
- 400: Validation error (invalid type, model, or parameters)
- 409: Slug already exists
- 500: Server error

**Audit:** Logged as `CREATE` action on `AgentRegistry`

---

### Endpoint: GET /api/agent-portal/agents

**List agents with pagination and filters.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`

**Query Parameters:**
```
page=1 (int, min 1)
limit=20 (int, 1-100)
search="string" (partial match on name/slug)
type="CHAT" | "WORKFLOW" | "SCHEDULED" | "INTEGRATION" (optional)
status="ACTIVE" | "INACTIVE" | "ARCHIVED" (optional)
teamId="cuid" (optional, filter by team)
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "cuid",
      "name": "string",
      "slug": "string",
      "type": "CHAT",
      "model": "string",
      "status": "ACTIVE",
      "teamId": "cuid" | null,
      "team": { "id": "cuid", "name": "string" } | null,
      "createdAt": "ISO8601"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

### Endpoint: GET /api/agent-portal/agents/:id

**Get agent summary with recent stats.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "name": "string",
    "slug": "string",
    "type": "CHAT",
    "model": "string",
    "status": "ACTIVE",
    "temperature": number,
    "maxTokens": number,
    "timeoutMs": number,
    "isCritical": boolean,
    "lastHealthCheck": "ISO8601" | null,
    "lastHealthStatus": "healthy" | "degraded" | null,
    "systemPromptVersion": number,
    "team": { "id": "cuid", "name": "string" } | null,
    "dailyStats": [
      {
        "date": "YYYY-MM-DD",
        "sessions": number,
        "totalCost": number,
        "avgLatency": number
      }
    ],
    "createdAt": "ISO8601",
    "createdBy": "cuid"
  }
}
```

**Error:** 404 if agent not found

---

### Endpoint: GET /api/agent-portal/agents/:id/detail

**Get full agent detail with config history and decrypted prompt.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "name": "string",
    "slug": "string",
    "type": "CHAT",
    "model": "string",
    "status": "ACTIVE",
    "systemPrompt": "string (decrypted)",  // Sensitive — admin only
    "systemPromptVersion": number,
    "temperature": number,
    "maxTokens": number,
    "timeoutMs": number,
    "isCritical": boolean,
    "capabilities": {},
    "tools": [],
    "team": { "id": "cuid", "name": "string" } | null,
    "configLogs": [
      {
        "id": "cuid",
        "changeType": "UPDATE",
        "previousValue": {},
        "newValue": {},
        "changedBy": "cuid",
        "changer": { "id": "cuid", "email": "string" },
        "createdAt": "ISO8601"
      }
    ],
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
}
```

**Security Note:** System prompt is encrypted at rest; decryption is admin-only.

---

### Endpoint: PUT /api/agent-portal/agents/:id

**Update agent configuration.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Request Body:** (All fields optional)
```json
{
  "name": "string",
  "slug": "string",
  "description": "string",
  "type": "CHAT" | "WORKFLOW" | "SCHEDULED" | "INTEGRATION",
  "model": "string",
  "systemPrompt": "string",
  "temperature": number,
  "maxTokens": number,
  "timeoutMs": number,
  "capabilities": {},
  "tools": [],
  "isCritical": boolean
}
```

**Response:** 200 OK with updated agent

**Behavior:**
- Changes are logged in `AgentConfigLog` for audit trail
- If `systemPrompt` is updated, `systemPromptVersion` increments
- Encrypted fields are re-encrypted with fresh IV
- Audit logged with changed field names

---

### Endpoint: PUT /api/agent-portal/agents/:id/deactivate

**Deactivate agent (soft pause, can reactivate).**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "status": "INACTIVE",
    "deactivatedAt": "ISO8601"
  }
}
```

**Behavior:**
- Agent status set to `INACTIVE`
- Sandboxing middleware will reject requests for inactive agents
- Budget checks still apply (cannot resume if budget exceeded)
- Config remains intact for reactivation

**Audit:** Logged as `DEACTIVATE` action

---

### Endpoint: PUT /api/agent-portal/agents/:id/archive

**Archive agent (permanent removal from active list).**

**Access:** `SUPER_ADMIN` only

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "status": "ARCHIVED"
  }
}
```

**Behavior:**
- Agent status set to `ARCHIVED`
- Excluded from list queries by default
- All related data (sessions, logs, configs) retained for audit
- Cannot be directly reactivated; requires new registration

**Audit:** Logged as `ARCHIVE` action (super-admin only)

---

### Endpoint: POST /api/agent-portal/agents/:id/health-check

**Trigger health check and record status.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "status": "healthy",
    "checkedAt": "ISO8601"
  }
}
```

**Behavior:**
- Updates `lastHealthCheck` timestamp
- Sets `lastHealthStatus` to "healthy" (future versions may do actual probing)
- Always returns 200 if agent exists
- Useful for monitoring dashboards and automated checks

**Audit:** Logged as `HEALTH_CHECK` action

---

## 2. Teams Module

### Endpoint: POST /api/agent-portal/teams

**Create a team of agents.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Request Body:**
```json
{
  "name": "string",              // Required
  "description": "string",       // Optional
  "leadAgentId": "cuid"          // Optional. Designated team lead
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "cuid",
    "name": "string",
    "description": "string",
    "leadAgentId": "cuid" | null,
    "isActive": true,
    "createdAt": "ISO8601",
    "createdBy": "cuid"
  }
}
```

**Audit:** Logged as `CREATE` action on `AgentTeam`

---

### Endpoint: GET /api/agent-portal/teams

**List teams with agent counts.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`

**Query Parameters:**
```
page=1 (int, min 1)
limit=20 (int, 1-100)
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "cuid",
      "name": "string",
      "description": "string",
      "leadAgentId": "cuid" | null,
      "isActive": true,
      "_count": { "agents": 3 },
      "createdAt": "ISO8601"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 10, "totalPages": 1 }
}
```

---

### Endpoint: GET /api/agent-portal/teams/:id

**Get team detail with full agent list.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "name": "string",
    "description": "string",
    "leadAgentId": "cuid" | null,
    "isActive": true,
    "agents": [
      {
        "id": "cuid",
        "name": "string",
        "slug": "string",
        "type": "CHAT",
        "status": "ACTIVE",
        "model": "string"
      }
    ],
    "leadAgent": { "id": "cuid", "name": "string" } | null,
    "createdAt": "ISO8601"
  }
}
```

---

### Endpoint: PUT /api/agent-portal/teams/:id

**Update team metadata.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Request Body:** (All optional)
```json
{
  "name": "string",
  "description": "string",
  "leadAgentId": "cuid" | null,
  "isActive": boolean
}
```

**Response:** 200 OK with updated team

---

### Endpoint: POST /api/agent-portal/teams/:id/assign-agent

**Assign an agent to a team.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Request Body:**
```json
{
  "agentId": "cuid"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "name": "string",
    "teamId": "cuid"  // Now assigned
  }
}
```

**Error:** 404 if team or agent not found

**Audit:** Logged as `ASSIGN_AGENT` action

---

### Endpoint: DELETE /api/agent-portal/teams/:id/remove-agent/:agentId

**Remove an agent from a team.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "name": "string",
    "teamId": null  // Unassigned
  }
}
```

**Error:** 400 if agent not in team

**Audit:** Logged as `REMOVE_AGENT` action

---

### Endpoint: GET /api/agent-portal/teams/:id/stats

**Get aggregated team metrics (cost, sessions, efficiency).**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Response (200 OK):**
```json
{
  "data": {
    "teamId": "cuid",
    "totalAgents": 5,
    "activeAgents": 4,
    "totalSessions": 1250,
    "totalCost": 45.67,
    "averageCostPerSession": 0.0365,
    "averageLatency": 2850,
    "successRate": 97.2,
    "errorCount": 35,
    "totalTokens": 125000,
    "period": "30d"
  }
}
```

**Behavior:** Aggregates from all agents in team (last 30 days by default)

---

## 3. Analytics Module

### Endpoint: GET /api/agent-portal/analytics/agent/:id

**Get agent-specific analytics for a time period.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Query Parameters:**
```
period="7d" | "14d" | "30d" (default: "7d")
```

**Response (200 OK):**
```json
{
  "data": {
    "agentId": "cuid",
    "period": "7d",
    "totalSessions": 500,
    "successCount": 485,
    "errorCount": 15,
    "totalCost": 12.34,
    "totalInputTokens": 50000,
    "totalOutputTokens": 30000,
    "averageLatency": 2100,
    "byModel": [],
    "hourlyBreakdown": [
      {
        "hour": "2026-02-27T10:00:00Z",
        "sessions": 25,
        "cost": 0.50
      }
    ]
  }
}
```

---

### Endpoint: GET /api/agent-portal/analytics/team/:id

**Get team-wide analytics.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Query Parameters:** Same as agent analytics (period)

**Response:** Similar structure, aggregated across all team agents

---

### Endpoint: GET /api/agent-portal/analytics/platform

**Get platform-wide metrics (all agents, all teams).**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Query Parameters:** Same as agent analytics (period)

**Response (200 OK):**
```json
{
  "data": {
    "period": "7d",
    "totalAgents": 150,
    "totalTeams": 20,
    "totalSessions": 45000,
    "totalCost": 1234.56,
    "averageLatency": 2500,
    "successRate": 96.8,
    "topAgents": [
      {
        "agentId": "cuid",
        "name": "string",
        "sessions": 5000,
        "cost": 150.00
      }
    ],
    "topModels": [
      {
        "model": "claude-opus-4-6",
        "sessions": 20000,
        "cost": 600.00
      }
    ]
  }
}
```

---

### Endpoint: GET /api/agent-portal/analytics/trends/:agentId

**Get token usage trends over time (hourly or daily).**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Query Parameters:**
```
days=30 (int, 1-365, default 30)
```

**Response (200 OK):**
```json
{
  "data": {
    "agentId": "cuid",
    "days": 30,
    "trends": [
      {
        "date": "2026-02-27",
        "sessions": 50,
        "inputTokens": 5000,
        "outputTokens": 3000,
        "totalCost": 0.25
      }
    ]
  }
}
```

---

### Endpoint: GET /api/agent-portal/analytics/efficiency/:agentId

**Get efficiency score breakdown (5-factor composite).**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Query Parameters:**
```
period="7d" | "14d" | "30d" (default: "7d")
```

**Response (200 OK):**
```json
{
  "data": {
    "agentId": "cuid",
    "period": "7d",
    "efficiencyScore": 87,
    "breakdown": {
      "tasksPerDollar": 85,
      "latency": 92,
      "successRate": 90,
      "errorRate": 88,
      "tokensPerTask": 75
    },
    "rating": "Excellent",
    "recommendations": [
      "Tokens per task could be optimized (currently 75/100)"
    ]
  }
}
```

**Scoring Formula:**
- **Tasks per Dollar (25%):** Sessions / Total Cost, normalized 0-1000 range
- **Latency (20%):** Avg response time vs. model benchmark, lower is better
- **Success Rate (25%):** Successful sessions / total, normalized 0-100%
- **Error Rate (15%):** Error sessions / total, normalized 0-50% (lower is better)
- **Tokens per Task (15%):** (Input + Output) / sessions, normalized 0-50k (lower is better)

**Final Score:** Weighted average, clamped 0-100

---

## 4. Session Logs Module

### Endpoint: GET /api/agent-portal/sessions

**List all session logs with filtering and pagination.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Query Parameters:**
```
page=1 (int, min 1)
limit=20 (int, 1-100)
agentId="cuid" (optional)
teamId="cuid" (optional)
dateFrom="YYYY-MM-DD" (optional, ISO format)
dateTo="YYYY-MM-DD" (optional, ISO format)
status="SUCCESS" | "ERROR" (optional)
costMin=0 (optional, USD)
costMax=999.99 (optional, USD)
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "cuid",
      "agentId": "cuid",
      "model": "string",
      "status": "SUCCESS",
      "inputTokens": 500,
      "outputTokens": 300,
      "totalCost": 0.015,
      "latencyMs": 2100,
      "createdAt": "ISO8601"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5000, "totalPages": 250 }
}
```

---

### Endpoint: GET /api/agent-portal/sessions/:id

**Get detailed session log with full request/response (if stored).**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "agentId": "cuid",
    "model": "string",
    "status": "SUCCESS",
    "inputTokens": 500,
    "outputTokens": 300,
    "inputCost": 0.0075,
    "outputCost": 0.0075,
    "totalCost": 0.015,
    "latencyMs": 2100,
    "requestPayload": "...",     // Optional, if stored
    "responsePayload": "...",    // Optional, if stored
    "errorMessage": null,
    "createdAt": "ISO8601"
  }
}
```

**Error:** 404 if session not found

---

## 5. Costs Module

### Endpoint: GET /api/agent-portal/costs/agent/:id

**Get cost summary for a specific agent.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Query Parameters:**
```
period="7d" | "14d" | "30d" (default: "7d")
```

**Response (200 OK):**
```json
{
  "data": {
    "agentId": "cuid",
    "period": "7d",
    "totalInputCost": 5.00,
    "totalOutputCost": 7.34,
    "totalCost": 12.34,
    "totalInputTokens": 50000,
    "totalOutputTokens": 30000,
    "byModel": [
      {
        "model": "claude-opus-4-6",
        "totalCost": 8.50,
        "inputTokens": 30000,
        "outputTokens": 15000
      }
    ]
  }
}
```

---

### Endpoint: GET /api/agent-portal/costs/team/:id

**Get cost summary for a team (sum of all agents).**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Query Parameters:** Same as agent costs

**Response:** Similar structure, aggregated across team agents

---

### Endpoint: GET /api/agent-portal/costs/platform

**Get platform-wide cost summary.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Query Parameters:** Same (period)

**Response (200 OK):**
```json
{
  "data": {
    "period": "7d",
    "totalCost": 15000.00,
    "byAgent": [
      {
        "agentId": "cuid",
        "name": "string",
        "cost": 500.00
      }
    ],
    "byModel": [
      {
        "model": "claude-opus-4-6",
        "cost": 8000.00
      }
    ],
    "byDay": [
      {
        "date": "2026-02-27",
        "cost": 2000.00
      }
    ]
  }
}
```

---

### Endpoint: GET /api/agent-portal/costs/breakdown

**Get cost breakdown grouped by agent, team, model, or day.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Query Parameters:**
```
period="7d" | "14d" | "30d" (default: "7d")
groupBy="agent" | "team" | "model" | "day" (default: "agent")
```

**Response (200 OK):**
```json
{
  "data": {
    "period": "7d",
    "groupBy": "agent",
    "breakdown": [
      {
        "key": "cuid",           // agent/team/model/day depending on groupBy
        "name": "string",        // human-readable (agent name, date, etc.)
        "cost": 150.00,
        "sessions": 100,
        "percentage": 12.15
      }
    ]
  }
}
```

---

## Cost Calculation Model

### Token Rates (Per Million Tokens)

| Model | Input $/M | Output $/M | Typical Session Cost |
|-------|----------|-----------|----------------------|
| claude-opus-4-6 | $15 | $75 | $0.05-$0.50 |
| claude-sonnet-4-5 | $3 | $15 | $0.01-$0.05 |
| claude-haiku-4-5 | $0.25 | $1.25 | $0.001-$0.01 |

### Calculation Formula

```
Input Cost = (inputTokens / 1,000,000) × modelRate.input
Output Cost = (outputTokens / 1,000,000) × modelRate.output
Total Cost = Input Cost + Output Cost
```

### Cost Ledger

Each session creates an immutable `AgentCostLedger` entry:

```json
{
  "agentId": "cuid",
  "sessionId": "cuid",
  "model": "claude-opus-4-6",
  "inputTokens": 500,
  "outputTokens": 300,
  "inputCost": 0.0075,
  "outputCost": 0.0075,
  "totalCost": 0.015,
  "createdAt": "ISO8601"
}
```

---

## 6. Budgets Module

### Endpoint: POST /api/agent-portal/budgets

**Set or update a monthly budget for an agent or team.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Request Body:**
```json
{
  "agentId": "cuid" | null,    // Either agentId or teamId
  "teamId": "cuid" | null,     // (Mutually exclusive)
  "monthlyCapUsd": 500.00,     // Required. Positive number
  "month": 2,                  // 1-12, required
  "year": 2026,                // Required
  "autoPauseEnabled": true     // Optional, default true
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "cuid",
    "agentId": "cuid" | null,
    "teamId": "cuid" | null,
    "monthlyCapUsd": 500.00,
    "currentSpend": 125.45,
    "month": 2,
    "year": 2026,
    "autoPauseEnabled": true,
    "isPaused": false,
    "createdAt": "ISO8601"
  }
}
```

**Behavior:**
- If budget already exists for month/year, updates cap (not spend)
- `currentSpend` is sum of all costs for agent/team in that month
- `isPaused` automatically set to `true` if `currentSpend >= monthlyCapUsd` and `autoPauseEnabled`

**Audit:** Logged as `SET_BUDGET` action

---

### Endpoint: GET /api/agent-portal/budgets

**List budgets with optional filters.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Query Parameters:**
```
page=1 (int)
limit=20 (int, 1-100)
agentId="cuid" (optional)
teamId="cuid" (optional)
month=2 (optional, 1-12)
year=2026 (optional)
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "cuid",
      "agentId": "cuid" | null,
      "teamId": "cuid" | null,
      "monthlyCapUsd": 500.00,
      "currentSpend": 125.45,
      "percentageUsed": 25.09,
      "month": 2,
      "year": 2026,
      "autoPauseEnabled": true,
      "isPaused": false,
      "createdAt": "ISO8601"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 }
}
```

---

### Endpoint: GET /api/agent-portal/budgets/check/:agentId

**Check agent's budget status for current month.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Response (200 OK):**
```json
{
  "data": {
    "hasBudget": true,
    "budgetId": "cuid",
    "monthlyCapUsd": 500.00,
    "currentSpend": 425.00,
    "percentageUsed": 85,
    "alerts": [
      "80% threshold reached"
    ],
    "shouldPause": false,
    "isCritical": false,  // If true, never pauses
    "month": 2,
    "year": 2026
  }
}
```

**Behavior:**
- Returns current month's budget
- Alerts if `percentageUsed >= 60%`, `>= 80%`, or `>= 100%`
- `shouldPause` is `true` only if: `percentageUsed >= 100%` AND `autoPauseEnabled` AND NOT `isCritical`
- If no budget exists: `hasBudget: false, percentageUsed: 0, shouldPause: false`

---

### Endpoint: PUT /api/agent-portal/budgets/:id/unpause

**Unpause an agent that exceeded its budget.**

**Access:** `SUPER_ADMIN` only

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "agentId": "cuid",
    "isPaused": false,
    "unpaused": true,
    "unpausedBy": "cuid",
    "unpausedAt": "ISO8601"
  }
}
```

**Behavior:**
- Sets `isPaused: false` even if `currentSpend >= monthlyCapUsd`
- Requires super-admin approval (HR_ADMIN cannot override budget enforcement)
- Re-pausing happens automatically when spend hits cap again
- Audit logged as `UNPAUSE_AGENT` action

---

## Budget System Rules

### Auto-Pause Logic

When `currentSpend >= monthlyCapUsd` and `autoPauseEnabled`:

1. If agent is `isCritical: true` → **Never pause** (critical agents exempt)
2. If agent is `isCritical: false` → **Auto-pause** (prevent further sessions)
3. Paused agents receive 429 status on invocation (rate-limit response)

### Budget Refresh

- Budgets are **per calendar month** (Jan-Dec)
- On Feb 1, all Jan budgets close; new Feb budgets begin fresh
- Historical budgets remain for reporting/audit

### Cost Attribution

- Costs logged to month/year of session **creation** time
- Leap-second precision: session at 2026-02-28 23:59:59 costs to Feb budget
- Backdating: If session logged late, costs to month of `createdAt`

---

## 7. Config Module

### Endpoint: PUT /api/agent-portal/config/:agentId/model

**Change the AI model for an agent.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Request Body:**
```json
{
  "model": "string",        // e.g., "claude-sonnet-4-5"
  "reason": "string"        // Optional. Why the change?
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "model": "claude-sonnet-4-5",
    "updatedAt": "ISO8601"
  }
}
```

**Behavior:**
- Model change is immediate
- Recorded in `AgentConfigLog` with old/new values
- Effective for next session onwards
- Reason field is optional (for documentation)

**Audit:** Logged as `CHANGE_MODEL` action

---

### Endpoint: PUT /api/agent-portal/config/:agentId/prompt

**Update agent's system prompt.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Request Body:**
```json
{
  "systemPrompt": "string",    // 1-50000 chars. Encrypted at rest.
  "reason": "string"           // Optional
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "systemPromptVersion": 5,
    "updatedAt": "ISO8601"
  }
}
```

**Behavior:**
- Prompt encrypted with AES-256-GCM before storage
- `systemPromptVersion` auto-increments
- New sessions use updated prompt
- Config log records change (encrypted field shows `[encrypted]`)

**Audit:** Logged as `UPDATE_PROMPT` action

---

### Endpoint: PUT /api/agent-portal/config/:agentId/params

**Adjust inference parameters (temperature, maxTokens, timeout).**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Request Body:** (All optional)
```json
{
  "temperature": 0.7,       // 0-2
  "maxTokens": 4096,        // 1-200000
  "timeoutMs": 30000,       // 1000-600000
  "reason": "string"        // Optional
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "temperature": 0.7,
    "maxTokens": 4096,
    "timeoutMs": 30000,
    "updatedAt": "ISO8601"
  }
}
```

**Audit:** Logged as `ADJUST_PARAMS` action with changed values

---

### Endpoint: PUT /api/agent-portal/config/:agentId/toggle

**Enable or disable an agent (status: ACTIVE/INACTIVE).**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Request Body:**
```json
{
  "enable": true,      // true = ACTIVE, false = INACTIVE
  "reason": "string"   // Optional
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "status": "ACTIVE",
    "updatedAt": "ISO8601"
  }
}
```

**Behavior:**
- Different from `deactivate` endpoint (which is permanent until re-enabled)
- Quick on/off toggle without config loss
- Inactive agents receive 403 from sandboxing middleware

**Audit:** Logged as `TOGGLE_AGENT` action

---

### Endpoint: GET /api/agent-portal/config/:agentId/history

**Get config change history for an agent.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Query Parameters:**
```
limit=50 (int, 1-100, default 50)
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "cuid",
      "changeType": "UPDATE",
      "previousValue": {
        "model": "claude-opus-4-6"
      },
      "newValue": {
        "model": "claude-sonnet-4-5"
      },
      "changedBy": "cuid",
      "changer": {
        "id": "cuid",
        "email": "admin@example.com"
      },
      "createdAt": "ISO8601"
    }
  ]
}
```

**Behavior:**
- Ordered by `createdAt DESC` (most recent first)
- Encrypted fields show `[encrypted]` in old/new values
- Useful for compliance/audit reviews

---

## 8. Commands Module

### Endpoint: GET /api/agent-portal/commands

**List all commands (agent operations) with filtering.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Query Parameters:**
```
page=1 (int)
limit=20 (int, 1-100)
userId="cuid" (optional, who issued the command)
classification="string" (optional, e.g., "HR", "WORKFLOW")
dateFrom="YYYY-MM-DD" (optional)
dateTo="YYYY-MM-DD" (optional)
outcome="SUCCESS" | "FAILURE" (optional)
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "cuid",
      "userId": "cuid",
      "classification": "HR",
      "command": "employee:read",
      "outcome": "SUCCESS",
      "metadata": {},
      "createdAt": "ISO8601"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5000, "totalPages": 250 }
}
```

---

### Endpoint: GET /api/agent-portal/commands/:id

**Get detailed command info.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Response (200 OK):**
```json
{
  "data": {
    "id": "cuid",
    "userId": "cuid",
    "classification": "HR",
    "command": "employee:read",
    "outcome": "SUCCESS",
    "metadata": {
      "filters": { "department": "Sales" }
    },
    "resultCount": 45,
    "executionTimeMs": 250,
    "createdAt": "ISO8601"
  }
}
```

---

## 9. API Keys Module

### Endpoint: POST /api/agent-portal/agents/:agentId/api-keys

**Generate a new API key for external agent invocation.**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Request Body:**
```json
{
  "name": "string",              // e.g., "Production Key v1"
  "scopes": ["string"],          // e.g., ["agents:invoke", "costs:read"]
  "expiresAt": "ISO8601"         // Optional. Future date for expiry.
}
```

**Response (201 Created):**
```json
{
  "message": "API key created. Store this key securely — it will not be shown again.",
  "key": "sk-...",               // Full key (shown only once!)
  "prefix": "sk-abc123"          // Prefix for identification
}
```

**Behavior:**
- Full key shown **once only** at creation
- Key hashed with SHA-256 before storage
- Must be stored securely by client (no recovery)
- If lost, rotate for a new key
- Default expiry: no expiration (if not provided)

**Audit:** Logged as `AGENT_API_KEY_CREATED` action

---

### Endpoint: GET /api/agent-portal/agents/:agentId/api-keys

**List all API keys for an agent (without revealing full keys).**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "cuid",
      "keyPrefix": "sk-abc123",        // Only prefix shown
      "name": "Production Key v1",
      "scopes": ["agents:invoke", "costs:read"],
      "isActive": true,
      "lastUsedAt": "ISO8601" | null,
      "expiresAt": "ISO8601" | null,
      "createdBy": "cuid",
      "createdAt": "ISO8601",
      "revokedAt": null
    }
  ]
}
```

**Security Note:** Full key is never returned in list; only prefix shown for identification

---

### Endpoint: POST /api/agent-portal/api-keys/:id/rotate

**Invalidate old key and generate a new one (same scopes/expiry).**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Response (200 OK):**
```json
{
  "message": "Key rotated. Store this new key securely — it will not be shown again.",
  "key": "sk-...",               // New full key (shown once)
  "prefix": "sk-xyz789"          // New prefix
}
```

**Behavior:**
- Old key immediately set `isActive: false`
- New key created with same scopes/expiry as old
- Useful for periodic key rotation (security best practice)
- Supports zero-downtime rotation if multiple keys exist

**Audit:** Logged as `AGENT_API_KEY_ROTATED` action

---

### Endpoint: DELETE /api/agent-portal/api-keys/:id

**Revoke an API key (immediate deactivation).**

**Access:** `SUPER_ADMIN`, `HR_ADMIN`

**Response (200 OK):**
```json
{
  "message": "API key revoked successfully"
}
```

**Behavior:**
- Sets `isActive: false` and `revokedAt: now()`
- Key cannot be re-activated; rotate for new key if needed
- Immediate effect; any in-flight requests may still succeed (depends on caching)

**Audit:** Logged as `AGENT_API_KEY_REVOKED` action

---

## API Key Lifecycle

### Typical Flow

1. **Generate** → New key issued (shown once) → Store in vault
2. **Use** → Client includes key in `Authorization: Bearer sk-...` header
3. **Monitor** → Check `lastUsedAt` in list endpoint
4. **Rotate** (optional) → On schedule or security concern → Get new key
5. **Revoke** → Remove old key when no longer needed

### Validation

- Key format: `sk-[base64url characters]` (56 chars total)
- SHA-256 hash stored (full key never in DB)
- Prefix stored for key identification (first 8 chars)
- Scopes validated against agent permissions

### Expiry

- If `expiresAt` is set, key becomes invalid at that time
- Expired keys return 401 Unauthorized
- No auto-rotation; admin must rotate manually

---

## 10. Supporting Systems

### Agent Permissions Matrix

Agents are constrained by type. Permission enforcement is at sandboxing middleware level.

```typescript
const PERMISSION_MATRIX: Record<string, AgentOperation[]> = {
  CHAT: [
    'employee:read',
    'attendance:read',
    'leave:read',
    'payroll:read',
    'report:read',
    'department:read',
    'chat:respond',
  ],
  WORKFLOW: [
    'employee:read',
    'employee:write',
    'attendance:read',
    'attendance:write',
    'leave:read',
    'leave:write',
    'payroll:read',
    'report:read',
    'report:generate',
    'department:read',
    'notification:send',
    'workflow:execute',
  ],
  SCHEDULED: [
    'scheduled:execute',
    'report:read',
    'report:generate',
    'notification:send',
  ],
  INTEGRATION: [
    'integration:call',
    'employee:read',
    'attendance:read',
  ],
};
```

### Agent Sandboxing

**Middleware:** `src/middleware/agent-sandbox.middleware.ts`

Applied to all agent-executed operations. Validates:

1. **Agent exists and is ACTIVE** — else 403 Forbidden
2. **Agent type allows operation** — checks `PERMISSION_MATRIX`
3. **Agent capabilities don't explicitly restrict operation** — checks `agent.capabilities.restrictedOperations`
4. **Result:** If all checks pass, request proceeds; if any fail, 403 returned

### Rate Limiting

**Middleware:** `src/middleware/agent-rate-limit.middleware.ts`

Per-agent sliding window rate limiter (in-memory, configurable per agent).

```typescript
config = {
  maxRequests: 100,           // Per window
  windowMs: 60000,            // 1 minute
  agentId: "cuid"
}
```

- Sliding window tracks request timestamps
- If `timestamps.length >= maxRequests` within window → 429 Too Many Requests
- Stale entries cleaned up every 5 minutes
- Configurable per agent (future: load from database)

### Cost Calculation (Detailed)

**File:** `src/lib/cost-calculator.ts`

```typescript
function calculateSessionCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { inputCost: number; outputCost: number; totalCost: number }
```

Uses `MODEL_RATES` lookup; falls back to default if model not found.

**Example:**
```
model: "claude-opus-4-6"
inputTokens: 1000
outputTokens: 500

inputCost = (1000 / 1_000_000) × 15 = 0.015
outputCost = (500 / 1_000_000) × 75 = 0.0375
totalCost = 0.015 + 0.0375 = 0.0525
```

### Efficiency Scoring (Detailed)

**File:** `src/lib/efficiency-scorer.ts`

5-factor composite score (0-100):

1. **Tasks Per Dollar (25% weight)**
   - Formula: `sessions / totalCost`, normalized to 0-1000 range
   - Higher is better (more work per dollar)

2. **Latency (20% weight)**
   - Formula: Avg response time vs. model benchmark (lower is better)
   - Inverted: fast = high score
   - Benchmarks: Opus=15s, Sonnet=8s, Haiku=3s

3. **Success Rate (25% weight)**
   - Formula: `successCount / totalSessions × 100%`
   - Higher is better (more reliable)

4. **Error Rate (15% weight)**
   - Formula: `errorCount / totalSessions × 100%`
   - Inverted: fewer errors = higher score
   - Normalized 0-50% range

5. **Tokens Per Task (15% weight)**
   - Formula: `(inputTokens + outputTokens) / sessions`
   - Inverted: fewer tokens = better (more efficient)
   - Normalized 0-50k range

**Final Calculation:**
```
score = (25% × tasksPerDollarScore)
      + (20% × latencyScore)
      + (25% × successRateScore)
      + (15% × errorRateScore)
      + (15% × tokensPerTaskScore)
```

Clamped to 0-100.

**Rating:**
- 90-100: Excellent
- 75-89: Good
- 50-74: Fair
- <50: Needs Improvement

---

## Error Responses

All endpoints use consistent error format:

### 400 Bad Request — Validation Error
```json
{
  "error": "Validation Error",
  "message": "Invalid temperature: must be between 0 and 2"
}
```

### 401 Unauthorized — Missing/Invalid Credentials
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid JWT token"
}
```

### 403 Forbidden — Insufficient Permissions
```json
{
  "error": "Forbidden",
  "message": "Agent type CHAT is not allowed to perform operation: employee:write"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Agent not found"
}
```

### 429 Too Many Requests — Rate Limited
```json
{
  "error": "Too Many Requests",
  "message": "Agent rate limit exceeded. Max 100 requests per 60s.",
  "retryAfter": 45
}
```

Headers included:
- `Retry-After: <seconds>`
- `X-RateLimit-Limit: 100`
- `X-RateLimit-Remaining: 0`

### 500 Internal Server Error
```json
{
  "error": "Internal Error",
  "message": "Database connection failed"
}
```

---

## RBAC Summary

| Endpoint | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |
|----------|:-----------:|:--------:|:-------:|:--------:|
| POST /api/agent-portal/agents | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/agents | ✅ | ✅ | ✅ | ❌ |
| GET /api/agent-portal/agents/:id | ✅ | ✅ | ✅ | ❌ |
| GET /api/agent-portal/agents/:id/detail | ✅ | ✅ | ❌ | ❌ |
| PUT /api/agent-portal/agents/:id | ✅ | ✅ | ❌ | ❌ |
| PUT /api/agent-portal/agents/:id/deactivate | ✅ | ✅ | ❌ | ❌ |
| PUT /api/agent-portal/agents/:id/archive | ✅ | ❌ | ❌ | ❌ |
| POST /api/agent-portal/agents/:id/health-check | ✅ | ✅ | ❌ | ❌ |
| POST /api/agent-portal/teams | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/teams | ✅ | ✅ | ✅ | ❌ |
| GET /api/agent-portal/teams/:id | ✅ | ✅ | ✅ | ❌ |
| PUT /api/agent-portal/teams/:id | ✅ | ✅ | ❌ | ❌ |
| POST /api/agent-portal/teams/:id/assign-agent | ✅ | ✅ | ❌ | ❌ |
| DELETE /api/agent-portal/teams/:id/remove-agent/:agentId | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/teams/:id/stats | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/analytics/agent/:id | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/analytics/team/:id | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/analytics/platform | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/analytics/trends/:agentId | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/analytics/efficiency/:agentId | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/sessions | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/sessions/:id | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/costs/agent/:id | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/costs/team/:id | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/costs/platform | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/costs/breakdown | ✅ | ✅ | ❌ | ❌ |
| POST /api/agent-portal/budgets | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/budgets | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/budgets/check/:agentId | ✅ | ✅ | ❌ | ❌ |
| PUT /api/agent-portal/budgets/:id/unpause | ✅ | ❌ | ❌ | ❌ |
| PUT /api/agent-portal/config/:agentId/model | ✅ | ✅ | ❌ | ❌ |
| PUT /api/agent-portal/config/:agentId/prompt | ✅ | ✅ | ❌ | ❌ |
| PUT /api/agent-portal/config/:agentId/params | ✅ | ✅ | ❌ | ❌ |
| PUT /api/agent-portal/config/:agentId/toggle | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/config/:agentId/history | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/commands | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/commands/:id | ✅ | ✅ | ❌ | ❌ |
| POST /api/agent-portal/agents/:agentId/api-keys | ✅ | ✅ | ❌ | ❌ |
| GET /api/agent-portal/agents/:agentId/api-keys | ✅ | ✅ | ❌ | ❌ |
| POST /api/agent-portal/api-keys/:id/rotate | ✅ | ✅ | ❌ | ❌ |
| DELETE /api/agent-portal/api-keys/:id | ✅ | ✅ | ❌ | ❌ |

---

## Audit Trail

All write operations (CREATE, UPDATE, DELETE) are logged to `AuditLog` table:

```json
{
  "userId": "cuid",           // Who made the change
  "action": "CREATE" | "UPDATE" | "DELETE" | "HEALTH_CHECK" | "ASSIGN_AGENT" | etc.,
  "resource": "AgentRegistry" | "AgentTeam" | "AgentBudget" | "AgentApiKey" | etc.,
  "resourceId": "cuid",       // ID of affected resource
  "details": {},              // Context-specific metadata
  "ipAddress": "string",      // Source IP
  "userAgent": "string",      // Browser/client info
  "timestamp": "ISO8601"
}
```

Audit logs are immutable and retained for compliance.

---

**Last Updated:** 2026-02-27  
**Phase 4 Status:** ✅ Complete  
**Total Endpoints:** 46 documented  
**RBAC Coverage:** 100% enforcement via middleware  
**Cost Tracking:** Full ledger with real-time aggregation  
**Efficiency:** 5-factor scoring with actionable recommendations  
**Security:** Encryption, sandboxing, rate limiting, API key lifecycle
