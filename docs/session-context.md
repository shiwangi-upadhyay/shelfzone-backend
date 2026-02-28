# Session Context — ShelfZone
## Last Updated: 2026-02-28 17:30 UTC

## Identity
- **Agent:** SHIWANGI — Master AI Agent for ShelfZone
- **Owner:** Shiwangi Upadhyay

## Architecture
- **Source of Truth:** `docs/ShelfZone_Agent_Portal_v2_Architecture.docx`

## Current State

### Backend (shelfzone-backend) — Branch: main
- **Stack:** Fastify + Prisma + PostgreSQL 16 + Redis 7
- **Server:** 157.10.98.227:3001
- **DB:** localhost:5432/shelfzone

#### Completed Layers:
- **Layer 0:** Foundation (scaffold, Docker, ESLint, configs)
- **Layer 1:** Identity (Prisma, auth endpoints, JWT, login UI, 12 tests)
- **Layer 2:** Permission & Security (RBAC, RLS, encryption, audit, sanitization)
- **Layer 3-6:** HR modules (employees, departments, attendance, leave, payroll, self-service, reports)
- **Phase 4:** Agent Portal v1 (37 endpoints: agents, teams, analytics, sessions, costs, budgets, config, commands, API keys)
- **Phase 7:** Agent Trace (17 endpoints: traces, sessions, events, analytics, flow, SSE)
- **Agent Portal v2.0 (2026-02-28):**
  - Phase 1: Fixed broken Agent Trace pages (route registration, CORS, seed data)
  - Phase 2: Command Center — Agent Gateway API (6 endpoints) + 3-panel UI
  - Phase 2B: Per-user API keys (3 endpoints) + real Anthropic API integration
  - Phase 3: Visualization upgrade (ReactFlow, redesigned trace views)
  - Phase 4: Billing Dashboard (6 endpoints) + full billing UI

#### Total Endpoints: ~70+

### Frontend (shelfzone-web) — Branch: main
- **Stack:** Next.js 16 + shadcn/ui + Zustand + TanStack Query + Tailwind + Recharts + ReactFlow
- **Server:** 157.10.98.227:3000

#### Pages:
- Auth: login
- Dashboard: main, employees, departments, designations, attendance, leave, payroll, notifications, profile
- Agent Portal: agents, agent detail, analytics, budgets, commands, costs, teams
- Agent Trace: org view, agent view, trace flow
- Command Center: 3-panel real-time agent control
- Settings: API key management
- Billing: dashboard with charts, tables, export

### Database
- 19 employees, 8 agents, 6 traces, 1 team
- Admin: admin@shelfzone.com / Admin@12345
- JWT: 24h expiry

## Key Technical Decisions (2026-02-28)
1. SSE over WebSocket for Command Center (simpler, EventSource API)
2. Per-user API keys with AES-256-GCM (not shared org key)
3. Real Anthropic API replacing simulation engine
4. ReactFlow for trace visualization (replaced Viz.js)
5. Linear/Vercel design language for trace views

## What's Next — Phase 5: Polish
- End-to-end testing of all flows
- Performance optimization (query caching, pagination)
- Error handling improvements
- Mobile responsiveness
- Production deployment prep (env configs, CI/CD)
- Documentation finalization
