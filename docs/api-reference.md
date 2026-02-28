# ShelfZone API Reference

Base URL: `http://localhost:3001`

All authenticated endpoints require `Authorization: Bearer <token>` header.

---

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login, returns JWT + refresh token |
| POST | `/api/auth/refresh` | No | Rotate refresh token |
| POST | `/api/auth/logout` | Yes | Invalidate refresh token |
| GET | `/api/auth/me` | Yes | Get current user profile |

### POST /api/auth/register
```json
// Request
{ "email": "user@example.com", "password": "Min8chars", "firstName": "John", "lastName": "Doe" }
// Response 201
{ "id": "cuid", "email": "...", "role": "EMPLOYEE", "createdAt": "..." }
```

### POST /api/auth/login
```json
// Request
{ "email": "user@example.com", "password": "..." }
// Response 200
{ "accessToken": "jwt...", "refreshToken": "...", "user": { "id", "email", "role" } }
```

---

## Departments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/departments` | Admin | Create department |
| GET | `/api/departments` | Yes | List departments |
| GET | `/api/departments/:id` | Yes | Get department |
| PUT | `/api/departments/:id` | Admin | Update department |
| DELETE | `/api/departments/:id` | Admin | Delete department |

---

## Employees

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/employees` | Admin | Create employee |
| GET | `/api/employees` | Yes | List employees |
| GET | `/api/employees/:id` | Yes | Get employee |
| PUT | `/api/employees/:id` | Admin | Update employee |
| DELETE | `/api/employees/:id` | Admin | Delete employee |

---

## Self-Service

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/me/profile` | Yes | Get own profile |
| PUT | `/api/me/profile` | Yes | Update own profile |
| GET | `/api/me/payslips` | Yes | Get own payslips |
| GET | `/api/me/attendance` | Yes | Get own attendance |
| GET | `/api/me/leaves` | Yes | Get own leaves |
| GET | `/api/me/dashboard` | Yes | Get personal dashboard data |

---

## Leave

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/leave/apply` | Yes | Apply for leave |
| GET | `/api/leave` | Yes | List leave requests |
| GET | `/api/leave/:id` | Yes | Get leave details |
| PUT | `/api/leave/:id/cancel` | Yes | Cancel leave request |

---

## Leave Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/leave-admin/approve/:id` | Manager+ | Approve leave |
| POST | `/api/leave-admin/reject/:id` | Manager+ | Reject leave |
| GET | `/api/leave-admin/pending` | Manager+ | List pending requests |

---

## Payroll

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/payroll/generate` | Admin | Generate payroll |
| POST | `/api/payroll/process` | Admin | Process payroll |
| GET | `/api/payroll` | Admin | List payroll records |
| GET | `/api/payroll/:id` | Admin | Get payroll detail |

---

## Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/reports/attendance` | Admin | Generate attendance report |
| GET | `/api/reports/attendance` | Admin | Get attendance reports |

---

## Agents (Basic CRUD)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/agents` | Yes | List agents |
| GET | `/api/agents/:id` | Yes | Get agent |
| PUT | `/api/agents/:id` | Admin | Update agent |
| DELETE | `/api/agents/:id` | Admin | Delete agent |

---

## Agent Portal — Agents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/portal/agents` | Admin | Create agent |
| GET | `/api/portal/agents` | Yes | List agents |
| GET | `/api/portal/agents/:id` | Yes | Get agent |
| GET | `/api/portal/agents/:id/detail` | Yes | Get agent detail |
| PUT | `/api/portal/agents/:id` | Admin | Update agent |
| PUT | `/api/portal/agents/:id/deactivate` | Admin | Deactivate agent |
| PUT | `/api/portal/agents/:id/archive` | Admin | Archive agent |
| POST | `/api/portal/agents/:id/health-check` | Yes | Trigger health check |

---

## Agent Portal — Teams

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/portal/teams` | Admin | Create team |
| GET | `/api/portal/teams` | Yes | List teams |
| GET | `/api/portal/teams/:id` | Yes | Get team |
| PUT | `/api/portal/teams/:id` | Admin | Update team |
| POST | `/api/portal/teams/:id/assign-agent` | Admin | Assign agent to team |
| DELETE | `/api/portal/teams/:id/remove-agent/:agentId` | Admin | Remove agent from team |
| GET | `/api/portal/teams/:id/stats` | Yes | Get team stats |

---

## Agent Portal — Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/portal/analytics/platform` | Yes | Platform-wide analytics |
| GET | `/api/portal/analytics/agent/:id` | Yes | Agent analytics |
| GET | `/api/portal/analytics/team/:id` | Yes | Team analytics |
| GET | `/api/portal/analytics/efficiency/:agentId` | Yes | Agent efficiency score |
| GET | `/api/portal/analytics/trends/:agentId` | Yes | Agent trend data |

---

## Agent Portal — Sessions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/portal/sessions` | Yes | List sessions |
| GET | `/api/portal/sessions/:id` | Yes | Get session |

---

## Agent Portal — Costs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/portal/costs/platform` | Yes | Platform cost summary |
| GET | `/api/portal/costs/breakdown` | Yes | Cost breakdown |
| GET | `/api/portal/costs/agent/:id` | Yes | Agent cost detail |
| GET | `/api/portal/costs/team/:id` | Yes | Team cost detail |

---

## Agent Portal — Budgets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/portal/budgets` | Admin | Create budget |
| GET | `/api/portal/budgets` | Yes | List budgets |
| GET | `/api/portal/budgets/check/:agentId` | Yes | Check budget status |
| PUT | `/api/portal/budgets/:id/unpause` | Admin | Unpause budget |

---

## Agent Portal — Config

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/api/portal/config/model` | Admin | Update model config |
| PUT | `/api/portal/config/params` | Admin | Update parameters |
| PUT | `/api/portal/config/prompt` | Admin | Update system prompt |
| PUT | `/api/portal/config/toggle` | Admin | Toggle feature flags |
| GET | `/api/portal/config/history` | Yes | Get config change history |

---

## Agent Portal — Commands

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/portal/commands` | Yes | List commands |
| GET | `/api/portal/commands/:id` | Yes | Get command detail |

---

## Agent Portal — API Keys (per-agent)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/portal/api-keys` | Admin | Create agent API key |
| GET | `/api/portal/api-keys` | Admin | List agent API keys |
| POST | `/api/portal/api-keys/:id/rotate` | Admin | Rotate key |
| DELETE | `/api/portal/api-keys/:id` | Admin | Revoke key |

---

## Agent Trace

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/traces` | Yes | List traces |
| GET | `/api/traces/:id` | Yes | Get trace |
| POST | `/api/traces` | Yes | Create trace |
| PATCH | `/api/traces/:id` | Yes | Update trace |
| DELETE | `/api/traces/:id` | Yes | Delete trace |
| GET | `/api/traces/:traceId/sessions` | Yes | Get trace sessions |
| GET | `/api/sessions/:id` | Yes | Get session |
| GET | `/api/sessions/:id/events` | Yes | Get session events |
| GET | `/api/agents/:agentId/sessions` | Yes | Get agent's sessions |
| POST | `/api/sessions/:id/events` | Yes | Create event |
| GET | `/api/sessions/:id/timeline` | Yes | Get session timeline |
| GET | `/api/agents/:id/cost-breakdown` | Yes | Agent cost breakdown |
| GET | `/api/employees/:id/agent-summary` | Manager+ | Employee agent summary |
| GET | `/api/org-tree/agent-overview` | Admin | Org-wide agent overview |
| GET | `/api/traces/:id/flow` | Yes | Get trace flow (DAG) |
| GET | `/api/agents/:id/stats` | Yes | Get agent stats |
| GET | `/api/traces/:id/events/stream` | Yes | SSE event stream |

---

## Agent Gateway (Command Center)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/agent-gateway/instruct` | Yes | Send instruction to agent |
| GET | `/api/agent-gateway/stream/:traceId` | Yes* | SSE execution stream |
| POST | `/api/agent-gateway/cancel/:traceId` | Yes | Cancel execution |
| POST | `/api/agent-gateway/pause/:traceId` | Yes | Pause execution |
| POST | `/api/agent-gateway/resume/:traceId` | Yes | Resume execution |
| GET | `/api/agent-gateway/status/:traceId` | Yes | Get execution status |

*SSE endpoint supports `?token=<jwt>` query param fallback (EventSource limitation).

### POST /api/agent-gateway/instruct
```json
// Request
{ "agentId": "...", "instruction": "Analyze Q4 sales data", "model": "claude-sonnet-4-20250514" }
// Response 200
{ "traceId": "...", "status": "running" }
```

### GET /api/agent-gateway/stream/:traceId
SSE stream. Each event:
```
data: {"type":"thinking","content":"Analyzing...","timestamp":"..."}
data: {"type":"response","content":"Here are the results...","timestamp":"..."}
data: {"type":"done","totalTokens":1234,"cost":0.05}
```

---

## Billing

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/billing/summary` | Yes | Billing summary (total, by period) |
| GET | `/api/billing/by-agent` | Yes | Costs grouped by agent |
| GET | `/api/billing/by-employee` | Admin | Costs grouped by employee |
| GET | `/api/billing/by-model` | Yes | Costs grouped by model |
| GET | `/api/billing/invoices` | Yes | Invoice list |
| GET | `/api/billing/export` | Yes | CSV export |

Query params for all: `?from=YYYY-MM-DD&to=YYYY-MM-DD`

### GET /api/billing/summary
```json
// Response 200
{ "totalCost": 142.50, "totalTokens": 2500000, "periodStart": "2026-02-01", "periodEnd": "2026-02-28", "agentCount": 8 }
```

---

## User API Keys (per-employee, for Anthropic)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/user/api-key` | Yes | Store encrypted API key |
| GET | `/api/user/api-key` | Yes | Check key exists (returns masked) |
| DELETE | `/api/user/api-key` | Yes | Delete stored key |

### POST /api/user/api-key
```json
// Request
{ "apiKey": "sk-ant-..." }
// Response 200
{ "success": true, "maskedKey": "sk-ant-...xxxx" }
```

---

## Common Response Patterns

### Error Response
```json
{ "error": "Error message", "statusCode": 400 }
```

### Pagination
Most list endpoints support: `?page=1&limit=20`

### Authentication
- Access token: JWT, 24h expiry
- Refresh token: httpOnly cookie, 7d expiry
- Roles: `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`
