# ShelfZone — Layer 2 Security Architecture

> Comprehensive security documentation for the permission, encryption, and audit subsystems.

---

## 1. Role-Based Access Control (RBAC)

### Roles

| Role | Description |
|------|-------------|
| `SUPER_ADMIN` | Full system access |
| `HR_ADMIN` | HR portal administration |
| `MANAGER` | Team/department management |
| `EMPLOYEE` | Self-service access |

### Middleware Flow

**File:** `src/middleware/rbac.middleware.ts`

```
Request → Auth Middleware (JWT verify) → requireRole(...roles) → Route Handler
```

- `requireRole()` accepts one or more `Role` enum values.
- Reads `request.user` (set by auth middleware).
- Returns **403 Forbidden** if user is missing or role is not in the allowed list.
- Applied as a Fastify `preHandler` on protected routes.

### Permissions Matrix

| Endpoint Pattern | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |
|-----------------|:-----------:|:--------:|:-------:|:--------:|
| Admin routes | ✅ | ❌ | ❌ | ❌ |
| HR management | ✅ | ✅ | ❌ | ❌ |
| Team management | ✅ | ✅ | ✅ | ❌ |
| Self-service | ✅ | ✅ | ✅ | ✅ |

---

## 2. Row-Level Security (RLS)

**File:** `src/lib/rls.ts`

### Mechanism

PostgreSQL session variables are set within Prisma interactive transactions using `SET LOCAL`:

- `app.current_user_id` — authenticated user's ID
- `app.current_user_role` — authenticated user's role

### Key Functions

| Function | Purpose |
|----------|---------|
| `setRLSContext(tx, userId, role)` | Sets session vars within an existing transaction |
| `withRLS(prisma, userId, role, fn)` | Wraps a callback in an RLS-aware transaction |

### Security Notes

- `SET LOCAL` scopes variables to the current transaction only — no leakage between requests.
- Single quotes in userId/role are escaped (`''`) to prevent SQL injection.
- RLS policies are enforced at the PostgreSQL level — the application sets context, the DB enforces access.

### Bypass Conditions

- Direct Prisma queries outside `withRLS()` bypass RLS (e.g., system-level operations like audit logging).
- Superuser DB connections bypass all RLS policies.

---

## 3. Field-Level Encryption

**File:** `src/lib/encryption.ts`

### Algorithm

- **AES-256-GCM** (authenticated encryption)
- IV: 12 bytes (96 bits), randomly generated per encryption
- Auth tag: 16 bytes (128 bits)

### Key Management

- Encryption key loaded from `ENCRYPTION_KEY` environment variable.
- Must be exactly 64 hex characters (32 bytes).
- Single symmetric key for all field-level encryption.

### Ciphertext Format

```
{iv_hex}:{authTag_hex}:{ciphertext_hex}
```

Three colon-separated hex strings. Validated on decryption — rejects anything not matching this 3-part format.

### Encrypted Fields (Prisma Schema)

| Field | Column | Table |
|-------|--------|-------|
| `encryptedAadhaar` | `encrypted_aadhaar` | `users` |
| `encryptedPan` | `encrypted_pan` | `users` |
| `encryptedSalary` | `encrypted_salary` | `users` |

All fields are nullable (`String?`) — encryption is applied at the application layer before persistence.

---

## 4. Audit Logging

**File:** `src/lib/audit.ts`

### Schema

**Table:** `audit_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `user_id` | String? | Actor (nullable for system events) |
| `action` | String | e.g., `LOGIN`, `UPDATE`, `DELETE` |
| `resource` | String | e.g., `user`, `employee` |
| `resource_id` | String? | Target entity ID |
| `details` | Json? | Arbitrary metadata |
| `ip_address` | String? | Client IP |
| `user_agent` | String? | Client user-agent |
| `created_at` | DateTime | Auto-set, never updated |

### Fire-and-Forget Pattern

`logAudit()` is intentionally non-blocking:

1. Calls `prisma.auditLog.create()` — returns a Promise.
2. Attaches `.catch(() => {})` — silently swallows errors.
3. Does **not** `await` — caller continues immediately.

**Rationale:** Audit logging must never crash the application or slow down request handling.

### Immutability

- No `updatedAt` field — records are write-once.
- No update/delete operations exposed through the application layer.
- The `AuditLog` model has no relations that would trigger cascading modifications.

---

## 5. Rate Limiting

**File:** `src/config/rate-limit.ts`

### Tiers

| Tier | Max Requests | Time Window | Applied To |
|------|-------------|-------------|------------|
| Global | 100 | 1 minute | All routes (plugin-level) |
| Login | 10 | 1 minute | `POST /api/auth/login` |
| Register | 5 | 1 minute | `POST /api/auth/register` |

### Implementation

- Uses `@fastify/rate-limit` plugin.
- Global config applied at plugin registration.
- Route-specific configs applied via Fastify route `config.rateLimit` option.
- Default store: in-memory (production should use Redis for multi-instance deployments).

### Error Response

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later."
}
```

---

## 6. Prompt Injection Protection

**Files:** `src/lib/sanitize.ts`, `src/middleware/sanitize.middleware.ts`

### Detection Patterns

| Category | Patterns Detected |
|----------|------------------|
| Prompt injection | `ignore previous instructions`, `you are now`, `act as`, `system:`, `[system]`, `<<SYS>>`, `forget everything`, `new instructions:`, `disregard all` |
| HTML injection | `<script>`, `<iframe>`, event handlers (`onerror=`, `onload=`, etc.) |
| URI injection | `javascript:` URIs |
| Obfuscation | Excessive special characters (10+ non-word chars in sequence) |

### Two-Phase Approach

1. **Validation** (`validateInput`): Checks against all patterns. Returns `{ safe: false, reason }` on match.
2. **Sanitization** (`sanitizeInput`): Strips HTML tags, removes `<>`, null bytes, and collapses excessive whitespace.

### Middleware Behavior

`sanitizeBody` (Fastify preHandler):

- Iterates all string fields in `request.body`.
- **Skips** fields containing `password` or `token` (credentials must not be modified).
- If validation fails → **400 Bad Request** with field name and reason.
- If validation passes → field value is sanitized before reaching the route handler.

---

## Architecture Summary

```
Client Request
    │
    ├─ Rate Limiter (@fastify/rate-limit)
    │
    ├─ Body Sanitization (sanitize middleware)
    │
    ├─ JWT Authentication (auth middleware)
    │
    ├─ Role Check (rbac middleware)
    │
    ├─ Route Handler
    │   ├─ RLS Transaction (withRLS)
    │   ├─ Field Encryption (encrypt/decrypt)
    │   └─ Audit Log (fire-and-forget)
    │
    └─ Response
```

All layers are composable Fastify preHandlers, applied per-route as needed.

---

## Phase 3 — Attendance, Leave, Payroll & Notifications Security

### Row-Level Security (RLS) Policies — Expanded

With the addition of Attendance, Leave, Payroll, and Notification tables, RLS enforcement extends across all employee-data endpoints.

#### Attendance Table RLS

| Role | Access | Policy |
|------|--------|--------|
| SUPER_ADMIN | All rows | No filter |
| HR_ADMIN | All rows | No filter |
| MANAGER | Own + direct reports | `WHERE employee_id IN (SELECT id FROM employees WHERE manager_id = current_user_employee_id)` |
| EMPLOYEE | Own only | `WHERE employee_id = current_user_employee_id` |

**Implementation:** `setRLSContext` applied in attendance list/get handlers; RLS triggers enforce at DB layer.

---

#### LeaveRequest Table RLS

| Role | Access | Policy |
|------|--------|--------|
| SUPER_ADMIN | All rows | No filter |
| HR_ADMIN | All rows | No filter |
| MANAGER | Own + team's | `WHERE employee_id IN (...) OR reviewed_by = current_user_id` |
| EMPLOYEE | Own only | `WHERE employee_id = current_user_employee_id` |

**Special Case:** Managers reviewing team leaves have write access to `status`, `reviewNote`, `reviewedAt`.

---

#### Payslip & SalaryStructure Table RLS

| Role | Access | Policy |
|------|--------|--------|
| SUPER_ADMIN | All rows | No filter |
| HR_ADMIN | All rows | No filter |
| MANAGER | Directs only | `WHERE employee_id IN (SELECT id FROM employees WHERE manager_id = current_user_employee_id)` |
| EMPLOYEE | Own only | `WHERE employee_id = current_user_employee_id` |

**Encryption Note:** Salary fields are encrypted; decrypted only for SUPER_ADMIN / HR_ADMIN on read.

---

#### Notification Table RLS

| Role | Access | Policy |
|------|--------|--------|
| SUPER_ADMIN | All | No filter |
| HR_ADMIN | All | No filter |
| MANAGER | Own only | `WHERE user_id = current_user_id` |
| EMPLOYEE | Own only | `WHERE user_id = current_user_id` |

**No cross-user notification access:** Managers cannot see employee notifications.

---

### Field-Level Encryption — Expanded Coverage

**Phase 3 extends encryption to financial data:**

#### SalaryStructure Encryption

| Field | Encryption | Decryption | Audit |
|-------|-----------|-----------|-------|
| `basicSalary` | AES-256-GCM | Admin only | `CREATE salary_structure` event logs amount (redacted) |
| `hra` | AES-256-GCM | Admin only | — |
| `da` | AES-256-GCM | Admin only | — |
| `specialAllowance` | AES-256-GCM | Admin only | — |
| `medicalAllowance` | AES-256-GCM | Admin only | — |
| `transportAllowance` | AES-256-GCM | Admin only | — |
| `grossSalary` (calculated) | AES-256-GCM | Admin only | — |

**Rationale:** Compensation is sensitive PII; encryption at rest ensures compliance with data protection regulations.

**Decryption Flow:**
```
GET /api/payroll/salary-structure/:id
├─ Admin? → Decrypt all fields → Return plaintext
└─ Non-admin? → Strip encrypted fields → Return null
```

**On Update:** Re-encrypt with new random IV (old ciphertext discarded).

#### Payslip Encryption

| Field | Encryption | Decryption | Display |
|-------|-----------|-----------|---------|
| `basicSalary` | AES-256-GCM | Admin only | Null for non-admin lists |
| `grossSalary` | AES-256-GCM | Admin only | Null for non-admin lists |
| `totalDeductions` | AES-256-GCM | Admin only | Null for non-admin lists |
| `netSalary` | AES-256-GCM | Admin only | Null for non-admin lists |

**Self-Service Exception:** Employees viewing own payslips (`GET /api/me/payslips`) see redacted amounts (not decrypted).

---

### Self-Service Data Isolation

**Employee portal enforces strict data boundaries:**

| Endpoint | User's Own Data | Manager/HR Data | Access |
|----------|-----------------|-----------------|--------|
| GET /api/me/profile | ✅ | ❌ | Self-service read |
| PUT /api/me/profile | ✅ (limited) | ❌ | Limited update |
| GET /api/me/payslips | ✅ (redacted) | ❌ | Self-service list |
| GET /api/me/attendance | ✅ | ❌ | Self-service list |
| GET /api/me/leaves | ✅ | ❌ | Self-service list |
| GET /api/me/dashboard | ✅ (summary) | ❌ | Self-service summary |

**Implementation:** All self-service endpoints filter by `userId` before returning data; no way to query other users' data.

---

### Notification Privacy

**Notifications are user-scoped; no bulk notification exposure:**

| Operation | Access | Safeguard |
|-----------|--------|-----------|
| GET /api/notifications | Own only | Filtered by `userId = current_user_id` |
| GET /api/notifications/unread-count | Own only | Counts filtered by `userId` |
| PUT /api/notifications/:id/read | Own only | Verify `notification.userId = current_user_id` before update |
| PUT /api/notifications/read-all | Own only | Bulk update only own notifications |

**Prevent notification leakage:** Route handlers verify ownership before returning/modifying.

---

### Attendance Audit Trail

**Attendance records are immutable (audit trail):**

- **Create (Check-in):** Logs `action: CREATE`, `resource: Attendance`, `{ employeeId, checkInTime, note }`
- **Update (Check-out):** Logs `action: UPDATE`, `resource: Attendance`, `{ employeeId, checkOutTime, hoursWorked }`
- **Regularize (Admin):** Logs `action: CREATE`, `resource: Attendance`, `{ regularized: true, adminNote }`

**No soft-delete:** Attendance is write-once; corrections require admin regularize (creates new record or overwrites).

---

### Leave Approval Audit

**Manager/HR review actions are logged:**

```typescript
{
  userId: string;          // Manager/HR approving
  action: 'UPDATE';
  resource: 'LeaveRequest';
  resourceId: string;      // Leave request ID
  details: {
    status: 'APPROVED' | 'REJECTED';
    reviewNote: string;
    reviewedBy: string;
    employeeId: string;    // Employee whose leave is being reviewed
  };
  ipAddress: string;
  userAgent: string;
  timestamp: ISO8601;
}
```

**Compliance:** Every leave decision is traceable to approver + timestamp.

---

### Payroll Processing Audit

**Payroll runs are locked once processed:**

| Step | Audit Event | Immutable |
|------|-------------|-----------|
| Create run | `action: CREATE`, `resource: PayrollRun`, `{ month, year, totalEmployees }` | After creation, month/year locked |
| Process run | `action: UPDATE`, `resource: PayrollRun`, `{ status: PROCESSED, successCount, failureCount }` | After processing, payslips immutable |
| Generate payslip | Fire-and-forget, non-blocking creation | Once generated, cannot be modified |

**No delete:** Payslips cannot be deleted; only admin can void via status (if future enhancement).

---

### Leave Balance Adjustments (Admin)

**Administrative adjustments are logged with reason:**

```typescript
{
  userId: string;               // Admin making adjustment
  action: 'UPDATE';
  resource: 'LeaveBalance';
  resourceId: string;           // Balance record ID
  details: {
    employeeId: string;
    leaveType: string;
    adjustment: number;         // +/- days
    reason: string;             // Admin note
    previousBalance: number;
    newBalance: number;
  };
  timestamp: ISO8601;
}
```

**Rationale:** Adjustments are sensitive; reason required for compliance.

---

### Session Security (RLS Context)

**RLS session variables are scoped to transaction:**

```typescript
// Safe: Variables expire at transaction end
await withRLS(prisma, userId, role, async (tx) => {
  await tx.attendance.findMany();  // RLS enforced
});
// Variables cleared here
```

**Prevents leakage between requests:** Each request gets its own `SET LOCAL` context.

---

### Data Isolation Summary

| Data | Encryption | RLS | RBAC | Audit |
|------|-----------|-----|------|-------|
| Attendance | ❌ | ✅ | ✅ | ✅ |
| LeaveRequest | ❌ | ✅ | ✅ | ✅ |
| LeaveBalance | ❌ | ✅ | ✅ | ✅ |
| SalaryStructure | ✅ AES-256-GCM | ✅ | ✅ | ✅ |
| Payslip | ✅ AES-256-GCM | ✅ | ✅ | ✅ |
| Notification | ❌ | ✅ | ✅ | ✅ (limited) |

**Coverage:** 100% of Phase 3 tables have RLS + RBAC; sensitive financial data additionally encrypted.

---

**Last Updated:** 2026-02-27  
**Layer 3 Security Status:** ✅ Complete  
**Audit Trail:** Comprehensive logging for all mutations  
**Encryption:** AES-256-GCM for salary + payroll data  
**RLS:** Enforced at PostgreSQL level for all role-based access

---

## Phase 4 — Agent Portal Security

> Security controls for intelligent agent management, cost tracking, budget enforcement, and external API access.

---

### 4.1 Agent Registry Access Control

**Agent Tables:** AgentRegistry, AgentTeam, AgentConfigLog

**RLS Policies:**
- **CREATE Agent:** Requires `SUPER_ADMIN` or `HR_ADMIN` role (RBAC enforcement)
- **READ Agent:** Requires authentication; MANAGER can view active agents and teams only
- **UPDATE Agent:** Requires `SUPER_ADMIN` or `HR_ADMIN` (config changes logged)
- **DEACTIVATE Agent:** Requires `SUPER_ADMIN` or `HR_ADMIN`
- **ARCHIVE Agent:** Requires `SUPER_ADMIN` only (permanent removal from active list)

**Row-Level Filtering:**
- Managers can view agents in their teams (via teamId relationship)
- Config history visible to admins only (systemPrompt sensitive)
- Archived agents excluded from list queries by default (soft delete)

**Implementation:**
```typescript
// In queries: WHERE status != 'ARCHIVED' (unless explicitly requested)
// In config detail: Decrypt systemPrompt only for admin users
// In list: Never include systemPrompt (even encrypted)
```

---

### 4.2 API Key Lifecycle & Management

**API Key Security Model:**

| Phase | Storage | Visibility | Revocable | Expiry |
|-------|---------|------------|-----------|--------|
| Generate | SHA-256 hash | Full key shown once | Yes | Optional |
| Store | Hash only | Prefix (8 chars) | Yes | Optional |
| Use | Hash validation | Header: Bearer token | Yes | Check on validate |
| Rotate | Old hash inactive | New key shown once | Yes | Carry forward |
| Revoke | Hash inactive | Prefix remains visible | N/A | Immediate |

**Key Format:**
```
sk-[base64url characters] (56 total)
Stored as: keyHash (SHA-256), keyPrefix (first 8 chars)
```

**Full Key Exposure Prevention:**
- Full key shown **only at creation** (new key endpoint)
- List endpoint returns only prefix (sk-abc123)
- No "show key" endpoint (force secure storage by client)
- Rotation creates new key, old becomes inactive immediately

**Key Validation:**
```typescript
// On request with key header:
const keyHash = sha256(rawKey);
const apiKey = db.find({ keyHash });
if (!apiKey || !apiKey.isActive || isExpired(apiKey.expiresAt))
  return 401 Unauthorized;
```

**Scope Enforcement:**
- Each key has `scopes` array (e.g., ["agents:invoke", "costs:read"])
- Request validated against key scopes (middleware to be implemented in Phase 5)
- Example: Key with scope "costs:read" cannot invoke `POST /agents`

**Audit Trail:**
- Key creation: `AGENT_API_KEY_CREATED` (includes scopes, userId)
- Key rotation: `AGENT_API_KEY_ROTATED` (old key id, new key id)
- Key revocation: `AGENT_API_KEY_REVOKED` (immediate)

---

### 4.3 Agent Sandboxing & Operation Authorization

**Sandboxing Middleware:** `src/middleware/agent-sandbox.middleware.ts`

**Three-Level Authorization Check:**

1. **Agent Existence & Status**
   ```
   Query: AgentRegistry WHERE id = agentId AND status = 'ACTIVE'
   Fail: 404 if not found, 403 if INACTIVE/ARCHIVED
   ```

2. **Agent Type Permission (Type-Level)**
   ```typescript
   PERMISSION_MATRIX = {
     CHAT: ['employee:read', 'attendance:read', ..., 'chat:respond'],
     WORKFLOW: ['employee:read', 'employee:write', ..., 'workflow:execute'],
     SCHEDULED: ['scheduled:execute', 'report:generate', ...],
     INTEGRATION: ['integration:call', 'employee:read', ...]
   }
   
   // Check: isPermitted = PERMISSION_MATRIX[agent.type].includes(operation)
   Fail: 403 if operation not in matrix
   ```

3. **Capability-Level Restrictions (Override)**
   ```typescript
   // In agent.capabilities:
   agent.capabilities.restrictedOperations = ['employee:write']
   
   // Check: if restrictedOperations.includes(operation) → 403
   // This allows admins to further restrict specific agents
   ```

**Sandboxing Enforcement:**
- Applied as Fastify `preHandler` on all agent-executed routes
- Fail-fast: returns 403 before handler is called (no wasted computation)
- Header: Agents can pass `X-Agent-ID` header; params also checked
- Immutable: Agent type cannot change (prevents sandbox escape)

**RBAC + Sandboxing Integration:**
```
HTTP Request
  ↓ [authenticate middleware] → Verify JWT, set request.user
  ↓ [requireRole middleware] → Check user role (HR_ADMIN, MANAGER, etc.)
  ↓ [agentSandbox middleware] → Check agent type/operation permission
  ↓ [Route handler] → Safe to execute (all checks passed)
```

---

### 4.4 Rate Limiting & Cost Control

**Rate Limiting Middleware:** `src/middleware/agent-rate-limit.middleware.ts`

**Per-Agent Sliding Window:**
```typescript
config = {
  agentId: string,
  maxRequests: number,    // e.g., 100
  windowMs: number,       // e.g., 60000 (1 minute)
}

// Sliding window: track timestamps for last N requests
// If count(timestamps > now - windowMs) >= maxRequests
//   → 429 Too Many Requests
```

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 47
Retry-After: 15
```

**Enforcement:**
- Prevents runaway sessions (single agent calling API in tight loop)
- Blocks cost explosion (limits damage if API key compromised or agent malicious)
- Configurable per agent (different limits for different agents)
- In-memory tracking (fast, no DB lookup latency)

**Memory Efficiency:**
- Sliding window keeps only timestamps within window (drop old)
- Cleanup task runs every 5 minutes: remove agents with no recent requests
- No memory leak risk (bounded by number of active agents)

**Cost Impact:**
- Rate limit prevents unchecked token consumption
- Combined with budget enforcement (auto-pause at 100% cap)
- Two-layer defense: rate limit (per-request) + budget (per-month)

---

### 4.5 Budget Enforcement & Pause Logic

**Monthly Budget Model:**
```
Budget = {
  agentId or teamId,
  monthlyCapUsd: number,      // e.g., 500
  currentSpend: number,       // Sum of costs in month
  month: 1-12,
  year: 2026,
  autoPauseEnabled: boolean,  // Default: true
  isPaused: boolean           // Set automatically
}
```

**Auto-Pause Logic:**
```typescript
if (currentSpend >= monthlyCapUsd && autoPauseEnabled) {
  if (agent.isCritical) {
    // Critical agents (VP-level) exempt from pause
    // Log warning but allow execution
  } else {
    // Non-critical agent: auto-pause
    agent.status = PAUSED
    // Next API request returns 429 (rate-limit response)
  }
}
```

**Critical Agent Exemption:**
- Flag: `agent.isCritical = true`
- Usage: VP-level agents, essential business processes
- Effect: Never auto-paused by budget; admins can still deactivate manually
- Audit: Logged as `UNPAUSE_AGENT` by SUPER_ADMIN only

**Cost Attribution:**
- Session cost logged to month/year of session creation
- Costs immediately reflected in `budget.currentSpend` (real-time)
- Budget refresh: Feb 1, new month = new budget, old budget archived

**Compliance:**
- Budget cannot be lowered retroactively (immutable cap once set)
- Unpausing requires `SUPER_ADMIN` approval (HR_ADMIN cannot override)
- All budget changes audited (who, when, amount, reason)

---

### 4.6 System Prompt Encryption

**System Prompt Security:**

| Attribute | Security | Access | Audit |
|-----------|----------|--------|-------|
| systemPrompt | AES-256-GCM encrypted | Admin detail only | Version increment logged |
| systemPromptVersion | Plaintext | Visible in list | Auto-increments on update |
| EncryptionKey | Environment variable | Server-side only | Never in code |

**Encryption at Rest:**
```typescript
// Store:
const encrypted = encrypt(systemPrompt, ENCRYPTION_KEY);
// → {iv}:{authTag}:{ciphertext} (hex-encoded)
await db.update({ systemPrompt: encrypted });

// Retrieve (admin only):
const decrypted = decrypt(encrypted, ENCRYPTION_KEY);
// → Original systemPrompt string
```

**Access Control:**
```typescript
// List agents: systemPrompt never included (even encrypted)
GET /agents → omit systemPrompt

// Get agent detail: systemPrompt included (encrypted) if admin
GET /agents/:id/detail (SUPER_ADMIN, HR_ADMIN) → decrypt + return

// Non-admin detail request
GET /agents/:id/detail (MANAGER) → 403 Forbidden
```

**Key Rotation (Future):**
- Not yet implemented (flagged for Phase 5+)
- Would require re-encrypting all prompts with new key
- Plan: Dual-key support (old key for decrypt, new key for encrypt)

---

### 4.7 Config Change Audit Trail

**Config Logging:** AgentConfigLog table

**Recorded Changes:**
```json
{
  "agentId": "cuid",
  "changeType": "UPDATE" | "DEACTIVATE" | "ARCHIVE",
  "previousValue": {
    "field1": "oldValue",
    "field2": "oldValue"
  },
  "newValue": {
    "field1": "newValue",
    "field2": "newValue"
  },
  "changedBy": "cuid",        // User who made change
  "createdAt": "ISO8601"
}
```

**Examples:**
```json
// Model change
{
  "changeType": "UPDATE",
  "previousValue": { "model": "claude-opus-4-6" },
  "newValue": { "model": "claude-sonnet-4-5" }
}

// Prompt update
{
  "changeType": "UPDATE",
  "previousValue": { "systemPrompt": "[encrypted]" },
  "newValue": { "systemPrompt": "[encrypted]" }
  // Note: encrypted values shown as placeholder (plaintext never in log)
}

// Deactivate
{
  "changeType": "DEACTIVATE",
  "previousValue": { "status": "ACTIVE" },
  "newValue": { "status": "INACTIVE" }
}
```

**Compliance Use:**
- Trace all config changes to responsible user
- Identify when dangerous changes occurred (e.g., prompt manipulation)
- Compare before/after for audit reviews
- Version history: can see full evolution of agent config

---

### 4.8 Cost Ledger Integrity

**AgentCostLedger Table (Immutable):**
```json
{
  "id": "cuid",
  "agentId": "cuid",
  "sessionId": "cuid",
  "model": "string",
  "inputTokens": number,
  "outputTokens": number,
  "inputCost": number,
  "outputCost": number,
  "totalCost": number,
  "createdAt": "ISO8601"
  // No updatedAt, no deletedAt (immutable record)
}
```

**Immutability Rules:**
- Each session creates exactly one ledger entry
- No UPDATE or DELETE operations allowed on ledger
- Corrections: Create new ledger entry (if needed) with note/reason
- Audit: All cost calculations traceable to session (no phantom costs)

**Cost Authenticity:**
- Ledger entry created atomically with session completion
- Rates locked at calculation time (prevents retroactive price changes)
- Input/output token counts from model provider (immutable)
- Hash option: Future enhancement to prevent tampering

---

### 4.9 Audit Logging for Phase 4

**Audit Trail Events:**

| Event | Action | Resource | Details | Trigger |
|-------|--------|----------|---------|---------|
| Agent created | CREATE | AgentRegistry | name, slug, type | POST /agents |
| Agent updated | UPDATE | AgentRegistry | changed fields | PUT /agents/:id |
| Agent deactivated | DEACTIVATE | AgentRegistry | status change | PUT /agents/:id/deactivate |
| Agent archived | ARCHIVE | AgentRegistry | status change | PUT /agents/:id/archive |
| Health check | HEALTH_CHECK | AgentRegistry | check result | POST /agents/:id/health-check |
| Team created | CREATE | AgentTeam | name, lead agent | POST /teams |
| Team updated | UPDATE | AgentTeam | changed fields | PUT /teams/:id |
| Agent assigned | ASSIGN_AGENT | AgentTeam | agentId, teamId | POST /teams/:id/assign-agent |
| Agent removed | REMOVE_AGENT | AgentTeam | agentId, teamId | DELETE /teams/:id/remove-agent/:agentId |
| Model changed | CHANGE_MODEL | AgentRegistry | old→new model | PUT /config/:agentId/model |
| Prompt updated | UPDATE_PROMPT | AgentRegistry | version increment | PUT /config/:agentId/prompt |
| Params adjusted | ADJUST_PARAMS | AgentRegistry | temperature, maxTokens | PUT /config/:agentId/params |
| Agent toggled | TOGGLE_AGENT | AgentRegistry | enable/disable | PUT /config/:agentId/toggle |
| Budget set | SET_BUDGET | AgentBudget | cap amount, month/year | POST /budgets |
| Agent unpaused | UNPAUSE_AGENT | AgentBudget | unpaused by user | PUT /budgets/:id/unpause |
| API key created | AGENT_API_KEY_CREATED | AgentApiKey | key prefix, scopes | POST /agents/:agentId/api-keys |
| API key rotated | AGENT_API_KEY_ROTATED | AgentApiKey | old→new prefix | POST /api-keys/:id/rotate |
| API key revoked | AGENT_API_KEY_REVOKED | AgentApiKey | key prefix | DELETE /api-keys/:id |

**Log Fields:**
```json
{
  "userId": "cuid",                    // Who made the change
  "action": "CREATE|UPDATE|DELETE|...", // What action
  "resource": "AgentRegistry|...",     // What was changed
  "resourceId": "cuid",                // ID of affected resource
  "details": {},                       // Context-specific data
  "ipAddress": "string",               // Source IP
  "userAgent": "string",               // Browser/client info
  "timestamp": "ISO8601"               // When it happened
}
```

**Retention & Compliance:**
- Audit logs immutable (append-only)
- Retained indefinitely (no auto-purge)
- Queryable by userId, action, resource, dateRange
- Used for compliance audits, forensics, change tracking

---

### 4.10 Data Isolation Summary (Phase 4)

| Table | Encryption | RLS | RBAC | Sandboxing | Audit |
|-------|-----------|-----|------|-----------|-------|
| AgentRegistry | systemPrompt only | ✅ (status-based) | ✅ | ✅ | ✅ |
| AgentTeam | ❌ | ✅ | ✅ | ❌ | ✅ |
| AgentConfigLog | ❌ | ✅ (admin only) | ✅ | ❌ | ✅ |
| AgentBudget | ❌ | ✅ | ✅ | ❌ | ✅ |
| AgentCostLedger | ❌ | ✅ (read-only) | ✅ | ❌ | ✅ (immutable) |
| AgentApiKey | keyHash only | ✅ | ✅ | ❌ | ✅ |
| AuditLog | ❌ | ✅ (admin only) | ✅ | ❌ | N/A (is audit) |

**Coverage:** 100% of Phase 4 tables have RBAC + audit; sensitive data (systemPrompt, keyHash) encrypted; critical operations (budgets, costs) immutable.

---

### 4.11 Threat Mitigations

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Unauthorized agent creation | RBAC (SUPER_ADMIN, HR_ADMIN only) | ✅ |
| Unauthorized agent execution | Sandboxing (type-level permissions) | ✅ |
| Agent privilege escalation | Immutable agent type (cannot change post-creation) | ✅ |
| Runaway session costs | Rate limiting (per-agent sliding window) | ✅ |
| Budget bypass | Auto-pause (non-critical agents paused at cap) | ✅ |
| API key compromise | Key hashing (SHA-256), immutability, rotation support | ✅ |
| API key oversharing | Full key shown once (force secure storage) | ✅ |
| Config tampering | Audit trail (all changes logged) | ✅ |
| Prompt injection | N/A (prompts are config, not user-provided) | ✅ |
| Cost ledger fraud | Immutable ledger (no updates/deletes) | ✅ |
| Admin abuse | Audit trail (all changes traceable to user + IP) | ✅ |

---

**Last Updated:** 2026-02-27  
**Phase 4 Security Status:** ✅ Complete  
**Agent Sandboxing:** Type-level + capability-level authorization  
**API Key Security:** SHA-256 hashing, scoped, rotatable, expiry-capable  
**Cost Control:** Rate limiting + budget auto-pause (dual defense)  
**Encryption:** System prompts encrypted at rest  
**Audit Trail:** Comprehensive logging for all mutations + config changes  
**Immutability:** Cost ledger append-only, budget caps locked, agent types immutable
