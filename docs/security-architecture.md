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
