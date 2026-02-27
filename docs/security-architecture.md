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
