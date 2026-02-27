# ShelfZone Build Log

> Every task. Every decision. Every issue. Written down.

---

## Layer 0 — The Void

### [L0.0] Repository Initialization
- **Agent:** SHIWANGI
- **Status:** ✅ Complete
- **Output:** Backend repo initialized, branches created (main, develop, testing)
- **Repos:** https://github.com/shiwangi-upadhyay/shelfzone-backend

### [L0.1] API Process Scaffold
- **Agent:** BackendForge
- **Status:** ✅ Complete
- **Output:**
  - `src/index.ts` — Fastify server with CORS, Helmet, health endpoint
  - `src/config/env.ts` — Zod-validated environment config
  - `package.json` — @shelfzone/api@0.1.0, ESM, Fastify stack
  - `tsconfig.json` — Strict, ES2022, NodeNext
  - `.env.example`, `.gitignore`
- **Verified:** Typecheck passes. `GET /health` returns 200 with status, timestamp, uptime.
- **Decisions:** Top-level await for plugin registration. Host 0.0.0.0 for container compat.
- **Unblocks:** All backend development

### [L0.2] Frontend Scaffold
- **Agent:** UIcraft
- **Status:** ✅ Complete
- **Output:**
  - Next.js app with App Router, TypeScript strict, Tailwind CSS
  - Landing page: "ShelfZone — HR + Agent Management Platform"
  - Dependencies: zustand, @tanstack/react-query, react-hook-form, zod
- **Verified:** `npm run build` passes with zero errors.
- **Repo:** https://github.com/shiwangi-upadhyay/shelfzone-web
- **Unblocks:** All frontend development

### [L0.3] Docker Compose — Local Infrastructure
- **Agent:** ShieldOps
- **Status:** ✅ Complete
- **Output:**
  - `docker-compose.dev.yml` — PostgreSQL 16 (TimescaleDB image) + Redis 7 Alpine
  - Health checks on both services, named volumes for persistence
- **Verified:** YAML valid. (Docker not installed on build host — will validate on dev machine)
- **Unblocks:** Database setup (Layer 1)

### [L0.4] Project Structure
- **Agent:** ShieldOps
- **Status:** ✅ Complete
- **Output:** Directory scaffold with .gitkeep: src/modules, src/middleware, src/lib, src/config, src/types, src/jobs, tests/unit, tests/integration, tests/e2e, tests/security, tests/load, docs, docs/api
- **Unblocks:** All agents know where to write

### [L0.5] ESLint + Prettier Configuration
- **Agent:** ShieldOps
- **Status:** ✅ Complete
- **Output:**
  - `.eslintrc.cjs` — TypeScript ESLint, strict rules
  - `.prettierrc` + `.prettierignore` — Consistent formatting
  - ESLint v10.0.2, Prettier v3.8.1
- **Unblocks:** Code quality enforcement from first line

### [L0.6] Additional Configs
- **Agent:** ShieldOps
- **Status:** ✅ Complete
- **Output:** `.dockerignore`, `.editorconfig`, `nodemon.json`
- **Unblocks:** Docker builds, editor consistency, dev reload

### [L0.7] Repository Documentation + Build Log
- **Agent:** DocSmith
- **Status:** ✅ Complete
- **Output:** README.md, CONTRIBUTING.md, build-log.md, progress.md (both repos)

### Layer 0 — Merge History
- feature/layer-0-foundation → develop ✅ (approved)
- develop → testing ✅ (approved, all tests pass)
- testing → main ✅ (approved) — **Layer 0 shipped to production**

---

## Layer 1 — Identity

### [L1.1] Prisma ORM + Users Table
- **Agent:** DataArchitect
- **Status:** ✅ Complete
- **Output:**
  - `prisma/schema.prisma` — User model with Role & EmployeeStatus enums
  - `prisma/migrations/0001_init_users/migration.sql` — Migration SQL (not applied, no DB on host)
  - `prisma.config.ts` — Prisma v7 connection config (URL from env)
  - `src/lib/prisma.ts` — Singleton PrismaClient helper
- **Verified:** `prisma generate` succeeds, typecheck passes
- **Decisions:**
  - cuid() for IDs (URL-safe, sortable, no collision)
  - Snake_case DB columns via @map, camelCase in TypeScript
  - refreshToken stored on User for quick lookup
  - Prisma v7.4.1 — connection URL moved to prisma.config.ts (v7 change)
- **Unblocks:** All auth endpoints, all future DB models

### [L1.2] POST /api/auth/register
- **Agent:** ShieldOps
- **Status:** ✅ Complete (part of L1.2–L1.6 batch)
- **Output:** Registration endpoint — validates input (Zod), hashes password (argon2id), creates user, returns user object (no passwordHash)
- **Security:** Generic error on duplicate email ("Registration failed"), password min 8 chars

### [L1.3] POST /api/auth/login
- **Agent:** ShieldOps
- **Status:** ✅ Complete
- **Output:** Login endpoint — verifies credentials, generates access token (15min) + refresh token (7d), stores hashed refresh token in DB, sets httpOnly cookie
- **Security:** Generic "Invalid credentials" message, blocks inactive users

### [L1.4] POST /api/auth/refresh
- **Agent:** ShieldOps
- **Status:** ✅ Complete
- **Output:** Token rotation — reads refresh token from cookie or body, verifies against hashed DB value, issues new token pair, invalidates old
- **Security:** Full token rotation on every refresh, argon2 hash comparison

### [L1.5] POST /api/auth/logout
- **Agent:** ShieldOps
- **Status:** ✅ Complete
- **Output:** Logout endpoint (requires auth) — clears refresh token from DB, clears cookie
- **Security:** Requires valid access token to logout

### [L1.6] Auth Middleware
- **Agent:** ShieldOps
- **Status:** ✅ Complete
- **Output:**
  - `src/middleware/auth.middleware.ts` — Extracts Bearer token, verifies JWT, attaches user to request
  - Fastify request type augmented with user property (userId, email, role)
- **Security:** Returns 401 on missing/invalid/expired token

### [L1.7] GET /api/auth/me
- **Agent:** ShieldOps (combined with L1.2–L1.6)
- **Status:** ✅ Complete
- **Output:** Protected endpoint — returns current user profile from DB using userId from JWT
- **Verified:** Requires auth middleware, returns user without passwordHash

### [L1.9] Login Page UI
- **Agent:** UIcraft
- **Status:** ✅ Complete
- **Repo:** shelfzone-web (feature/ui-auth)
- **Output:**
  - `src/app/(auth)/login/page.tsx` — Login form with react-hook-form + Zod validation
  - `src/stores/auth-store.ts` — Zustand auth store with localStorage persistence
  - `src/lib/api.ts` — API client utility with auth header support
  - `src/components/providers.tsx` — TanStack Query provider
  - shadcn/ui components: button, card, form, input, label, sonner
  - `src/app/(dashboard)/dashboard/page.tsx` — Placeholder dashboard
  - Landing page updated with "Sign In" link
- **Verified:** `npm run build` passes zero errors, all routes render
- **Decisions:** sonner over toast (shadcn deprecated toast), inline error display on form

### [L1.10] Auth Test Suite
- **Agent:** TestRunner
- **Status:** ✅ Complete
- **Output:**
  - `tests/unit/auth/auth.service.test.ts` — 12 unit tests (all pass)
  - `tests/integration/auth/auth.routes.test.ts` — 14 integration test stubs (todo, need DB)
  - `tests/__mocks__/@prisma/client.ts` — Prisma mock for DB-less testing
  - `jest.config.ts` — Jest config with ts-jest ESM support
- **Test Results:** 12 passed, 0 failed, 14 todo
- **Coverage:** Password hashing, JWT generation/verification, token expiry, Zod schema validation
- **Issues:** Prisma client mocked since no DB on host — integration tests will run once DB is available

### Layer 1 — Issues Found & Fixed
- ESLint flat config fix (already fixed in L0) — no new issues
- Prettier formatting: 3 files auto-formatted after ShieldOps commit
- No functional bugs found

---

## Layer 2 — Permission & Security

### [L2.2] RBAC Middleware
- **Agent:** ShieldOps
- **Status:** ✅ Complete
- **Files:** `src/middleware/rbac.middleware.ts`
- **Decisions:** Generic `requireRole(...roles)` factory returning Fastify preHandler. Returns 403 with "Insufficient permissions" on failure. Role checked against Prisma `Role` enum.

### [L2.3] Row-Level Security (RLS)
- **Agent:** ShieldOps
- **Status:** ✅ Complete
- **Files:** `src/lib/rls.ts`
- **Decisions:** `SET LOCAL` for transaction-scoped session variables. `withRLS()` wrapper for ergonomic RLS-aware transactions. Single-quote escaping for SQL injection prevention.

### [L2.5] Field-Level Encryption
- **Agent:** ShieldOps
- **Status:** ✅ Complete
- **Files:** `src/lib/encryption.ts`, updated `prisma/schema.prisma` (added `encrypted_aadhaar`, `encrypted_pan`, `encrypted_salary` to users)
- **Decisions:** AES-256-GCM with random IV per encryption. Key from `ENCRYPTION_KEY` env var (32 bytes hex). Ciphertext format: `iv:authTag:ciphertext` (all hex). Application-layer encryption, not DB-level.

### [L2.6] Audit Logging
- **Agent:** ShieldOps
- **Status:** ✅ Complete
- **Files:** `src/lib/audit.ts`, updated `prisma/schema.prisma` (added `AuditLog` model → `audit_logs` table)
- **Decisions:** Fire-and-forget pattern — never awaited, errors silently swallowed. Write-once immutability (no `updatedAt`, no update/delete ops). Nullable `userId` for system events.

### [L2.7] Prompt Injection Sanitization
- **Agent:** ShieldOps
- **Status:** ✅ Complete
- **Files:** `src/lib/sanitize.ts`, `src/middleware/sanitize.middleware.ts`
- **Decisions:** Two-phase approach: validate then sanitize. 13 regex patterns covering prompt injection, HTML injection, and JS URI attacks. Password/token fields skipped to avoid credential corruption. Returns 400 with field-specific error on validation failure.

### [L2.8] Rate Limiting
- **Agent:** ShieldOps
- **Status:** ✅ Complete
- **Files:** `src/config/rate-limit.ts`
- **Decisions:** Three tiers — global (100/min), login (10/min), register (5/min). Uses `@fastify/rate-limit` with in-memory store (Redis recommended for production). Route-specific limits via Fastify `config.rateLimit` option.
