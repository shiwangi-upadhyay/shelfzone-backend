# Session Context — Saved 2026-02-28 09:44 UTC (87% tokens)

## Identity
- Agent: SHIWANGI (Master AI Architect)
- Owner: Shiwangi Upadhyay (shiwangiupadhyay332@gmail.com)

## Project: ShelfZone
- **Backend:** Fastify + Prisma 7 + PostgreSQL | Repo: shelfzone-backend
- **Frontend:** Next.js 16 + React 19 + shadcn/ui + TanStack Query + Zustand | Repo: shelfzone-web

## Completed Phases
- Phase 0-4: Backend complete (92 endpoints, 302 tests)
- Phase 5A-5C: Frontend complete (24 routes — HR Portal + Agent Portal UI)
- Phase 6A: Testing (30 Playwright E2E tests + 302 backend tests)
- Phase 6B: Auth hardening (middleware, security headers, error boundaries, Toaster)
- Phase 6D: UX polish (skeletons, live notifications, fixed all /api prefix bugs)
- Phase 6E: Advanced features (Recharts, CSV export, auto-polling)
- Phase 6C (Deployment): NOT DONE — deferred by Boss

## Current State
- Both repos on `main`, all branches synced (develop, testing, feature/phase-5-hr-portal)
- Backend latest commit: `6ea9db6`
- Frontend latest commit: `7c8b864`
- PostgreSQL running on localhost:5432, DB: shelfzone
- Backend running on port 3001 (0.0.0.0)
- Frontend running on port 3000 (0.0.0.0)
- Public IP: 157.10.98.227 (ports 3000, 3001 open via ufw)

## Seeded Data
- 19 users, 19 employees, 6 departments, 16 designations, 7 agents
- ShelfEx org from "Organization Overview.docx" fully loaded
- 7 agents (BackendForge, DataArchitect, ShieldOps, PortalEngine, UIcraft, TestRunner, DocSmith) registered under Shiwangi's account
- Test admin: admin@shelfzone.com / Admin@12345
- All ShelfEx employees: [name]@shelfex.com / ShelfEx@2025

## Known Issues Fixed This Session
1. No PostgreSQL installed → installed + configured
2. Auth slow (double argon2) → SHA-256 for refresh tokens
3. Route group `(dashboard)` caused 404 → renamed to `dashboard/`
4. All hooks missing `/api` prefix → fixed
5. Frontend expected `{ departments: [...] }` but backend returns `{ data: [...] }` → fixed
6. Dashboard API response shape mismatch → added mapper
7. Employee hook double-unwrapping `response.data` → fixed
8. Toaster missing from providers → added
9. Jest ESM config broken → fixed (40/40 suites pass)

## Remaining Known Issue
- Employees page: just fixed, needs Boss to verify it shows data
- Some pages may still have response mapping issues (test each page)

## Rules
- Every agent pushes after every commit
- Every merge needs Boss approval
- Save context at 85% tokens
- Security-first, no exfiltration
