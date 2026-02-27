# Session Context — SHIWANGI

## Identity
I am **SHIWANGI** — Smart HR Intelligence Workflow Agent for Next-Gen Integration. Master agent of ShelfZone. I delegate to 7 specialized AI agents, verify, and report.

## My Team
| Agent | Model | Role |
|-------|-------|------|
| BackendForge | claude-opus-4-6 | Backend development |
| DataArchitect | claude-opus-4-6 | DB & system design |
| ShieldOps | claude-opus-4-6 | Security & DevOps |
| PortalEngine | claude-opus-4-6 | Agent management portal |
| UIcraft | claude-sonnet-4-5 | Frontend development |
| TestRunner | claude-sonnet-4-5 | Testing |
| DocSmith | claude-haiku-4-5 | Documentation |

## Owner
- **Name:** Shiwangi Upadhyay (Boss)
- **Email:** shiwangiupadhyay332@gmail.com
- **GitHub:** shiwangi-upadhyay

## Repos
- **Backend:** https://github.com/shiwangi-upadhyay/shelfzone-backend.git
- **Frontend:** https://github.com/shiwangi-upadhyay/shelfzone-web.git
- **Git config:** shiwangiupadhyay332@gmail.com / shiwangi-upadhyay

## Rules
1. I do NOT build — I delegate to agents
2. Every step logged in docs/build-log.md (DocSmith maintains)
3. Every merge needs Boss's approval: feature → develop, develop → testing, testing → main
4. **Every agent pushes after every commit. No local-only commits. Ever.**
5. **Context Management Protocol:** At 85% tokens — stop, save context to docs/session-context.md, commit+push, alert Boss

## Project Status — ALL ON MAIN ✅

### Backend (shelfzone-backend)
- **Stack:** Fastify 5 + Prisma 7 + PostgreSQL + TypeScript ESM
- **L0 Foundation:** ✅ Shipped — repos, scaffold, Docker Compose, health endpoints
- **L1 Identity:** ✅ Shipped — Users, JWT auth, register/login/refresh/logout
- **L2 Permission:** ✅ Shipped — RBAC, RLS, AES-256-GCM encryption, audit log, rate limiting, prompt injection protection
- **Phase 3 HR Backend:** ✅ Shipped — 49 endpoints, 256 unit tests
  - 3A: Employee/Department/Designation CRUD (15 endpoints)
  - 3B: Attendance — clock in/out, reports (8 endpoints)
  - 3C: Leave — apply/approve/reject, balance tracking, carry-forward (10 endpoints)
  - 3D: Payroll — salary structures, payslip generation, Indian tax engine (6 endpoints)
  - 3F: Self-service portal + notifications (10 endpoints)
  - 3G: 296 integration test stubs, full API docs
- **Phase 4 Agent Portal:** ✅ Shipped — 37 endpoints, 46 unit tests, 200 integration stubs
  - Agent CRUD + detail + health check (8 endpoints)
  - Team CRUD + assignment + stats (7 endpoints)
  - Session logging service (fire-and-forget)
  - Token analytics — agent/team/platform/trends (5 endpoints)
  - Session log API with filtering (2 endpoints)
  - Cost calculator (3 Claude models) + aggregation (4 endpoints)
  - Efficiency scoring (0-100, 5 weighted factors)
  - Budget system + auto-pause for non-critical agents (4 endpoints)
  - Agent configuration API — model/prompt/params/toggle (5 endpoints)
  - Command audit trail (2 endpoints)
  - Security: scoped API keys (4 endpoints), agent sandboxing, agent rate limiting, RLS on all 8 tables

### Frontend (shelfzone-web)
- **Stack:** Next.js 16, React 19, Tailwind 4, shadcn/ui, Zustand, TanStack Query, RHF + Zod
- **Phase 5A Foundation:** ✅ Shipped — dark mode, layout (sidebar/navbar/breadcrumbs), auth pages, form components, JWT auto-refresh API client
- **Phase 5B HR Portal UI:** ✅ Shipped — 14 routes, 75+ components
  - Dashboard with stats + quick actions
  - Employee list, detail view, onboarding wizard
  - Attendance clock widget + calendar + summary
  - Leave apply + balance + approval inbox
  - Payslip viewer + salary breakdown
  - Self-service profile with PII masking

### Test Totals (Backend)
- 40 test suites, 302 unit tests passing, 486 integration stubs (todo)
- TypeScript: clean compile on both repos
- Frontend: clean build (npm run build)

## Git Branch Status
- All feature branches merged to main via develop → testing → main
- Both repos: main is up to date
- No active feature branches

## What's Next (Pending Boss Decision)
- **Phase 5C:** Agent Portal UI (frontend for Phase 4 backend APIs) — agent dashboard, team management, analytics charts, cost views, budget management, config editor
- **Phase 3E:** Performance module (P1, deferred)
- **P1 Agent Portal tasks:** Multi-tenancy, anomaly detection, cost projection, invoicing, leaderboard, model downgrade recommendations, config versioning with diff/rollback
- **Integration testing:** Implement the 486+ test.todo stubs when test DB is available
- **Deployment:** Docker Compose for full stack, CI/CD pipeline

## Allowed Models
- anthropic/claude-opus-4-6
- anthropic/claude-sonnet-4-5
- anthropic/claude-haiku-4-5

## Key Docs
- `docs/api-core-hr.md` — HR API reference (2,453 lines)
- `docs/api-agent-portal.md` — Agent Portal API reference (1,774 lines)
- `docs/build-log.md` — Full build history
- `docs/security-architecture.md` — Security architecture
- `tests/TEST-SUMMARY.md` — Test coverage summary
