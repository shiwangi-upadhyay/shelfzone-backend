# Session Context — Saved at 87% tokens
## Date: 2026-02-28 14:48 UTC

## Identity
- I am SHIWANGI — Master AI Agent for ShelfZone
- Owner: Shiwangi Upadhyay (Boss)
- My role: Take instructions from Boss, delegate to sub-agents, verify, report. I am an experienced full-stack developer but I DELEGATE, not build myself.

## Architecture Document
- **Source:** /root/.openclaw/workspace/shelfzone-backend/docs/ShelfZone_Agent_Portal_v2_Architecture.docx
- **This is the SINGLE SOURCE OF TRUTH for Agent Portal v2.0**
- Read it FIRST before any work

## Critical Rules (NON-NEGOTIABLE)
1. **NEVER push to main.** Feature branch → develop → testing → main. Ask Boss at EVERY merge.
2. **Test everything yourself before reporting done.** Empty pages = NOT done.
3. **Push after every commit.** No local-only work.
4. **Save context at 70% tokens.**
5. **Dual theme: light/dark/system** as it already exists.

## Current State — What EXISTS

### Backend (shelfzone-backend)
- **Repo:** https://github.com/shiwangi-upadhyay/shelfzone-backend.git
- **Stack:** Fastify + Prisma + PostgreSQL 16
- **Server:** 157.10.98.227, port 3001
- **DB:** localhost:5432, shelfzone, user: postgres, pw: postgres

#### Agent Portal Endpoints (37 total, Phase 4):
- Agents: POST/GET/GET/:id/GET/:id/detail/PUT/:id/PUT/:id/deactivate/PUT/:id/archive/POST/:id/health-check
- Teams: POST/GET/GET/:id/PUT/:id/PUT/:id/assign-agent/DELETE/:id/remove-agent/:agentId/GET/:id/stats
- Analytics: GET platform/agent/:id/team/:id/efficiency/:agentId/trends/:agentId
- Sessions: GET list/GET/:id
- Costs: GET platform/breakdown/agent/:id/team/:id
- Budgets: POST/GET/GET check/:agentId/PUT/:id/unpause
- Config: PUT model/params/prompt/toggle, GET history
- Commands: GET list/GET/:id
- API Keys: POST/GET per agent, DELETE/:id, PUT/:id/rotate

#### AgentTrace Endpoints (17 total, Phase 7):
- Traces: GET list, GET/:id, POST, PATCH/:id, DELETE/:id
- Sessions: GET /traces/:traceId/sessions, GET /sessions/:id, GET /sessions/:id/events, GET /agents/:agentId/sessions
- Events: POST /sessions/:id/events, GET /sessions/:id/timeline
- Analytics: GET /agents/:id/cost-breakdown, GET /employees/:id/agent-summary, GET /org-tree/agent-overview, GET /traces/:id/flow, GET /agents/:id/stats
- SSE: GET /traces/:id/events/stream

#### Security Layer:
- trace-auth.ts: ownership enforcement (SUPER_ADMIN bypass, HR_ADMIN department, owner-only)
- redaction-service.ts: JWT, passwords, API keys, PEM blocks
- trace-rate-limit.ts: 5 SSE/user, 100 events/min, 30 list/min
- trace-audit.ts: cross-user views, deletions

### Frontend (shelfzone-web)
- **Repo:** https://github.com/shiwangi-upadhyay/shelfzone-web.git
- **Stack:** Next.js 16 + shadcn/ui + Zustand + TanStack Query + Tailwind + Recharts + ReactFlow
- **Server:** 157.10.98.227, port 3000 (dev mode)

#### Pages:
- Dashboard: /dashboard (main dashboard)
- Employees: /dashboard/employees, /new, /[id]
- Departments: /dashboard/departments
- Designations: /dashboard/designations
- Attendance: /dashboard/attendance
- Leave: /dashboard/leave, /apply
- Payroll: /dashboard/payroll, /[id]
- Notifications: /dashboard/notifications
- Profile: /dashboard/profile
- Agents: /dashboard/agents, /[id], /analytics, /budgets, /commands, /costs, /teams
- Agent Trace: /dashboard/agent-trace, /trace/[traceId]

#### Current branch: `feature/fix-agent-trace-rendering` (has debug logs)

### Database State
- 19 users, 19 employees, 6 departments
- 8 agents (SHIWANGI + 7 sub-agents), 1 team "ShelfZone Core"
- 1 trace "Build AgentTrace observability platform" with 7 sessions, 66 events
- All agents owned by user `cmm645h9l0002ujf3u8lk5t01` (Shiwangi's employee user)
- Admin login: admin@shelfzone.com / Admin@12345
- JWT expiry: 24h

## WHAT'S BROKEN (Phase 1 — Fix These)

### AgentTrace Page (/dashboard/agent-trace)
- **Org View:** Shows "No employees found" — API returns 19 employees with data, frontend doesn't render
- **Agent View:** Empty — same root cause
- **Recent Traces:** Shows "No traces found" — API returns 1 trace
- **Root cause:** Debug logs added to hooks (use-agent-stats.ts, use-traces.ts) and agent-map.tsx but user reports no errors visible. Need to check browser console.
- Likely issue: either token not being sent (getAuthToken reads from Zustand localStorage), or TanStack Query error handling swallowing errors

### Trace Flow Page (/dashboard/agent-trace/trace/[traceId])
- **Flow graph:** Shows nothing
- **API works:** /api/traces/:id/flow returns 7 nodes, 24 edges correctly

### Dashboard
- Not loading properly

### Seed Data Issues
- Only 1 trace exists — need 3 (per architecture doc)
- Need Prabal's DataBot + sub-agents, Sakshi's HelperBot
- Need 30 days of cost data
- Need budget entries

## Phase 1 Plan — Fix What's Broken

### Step 1: Debug & Fix Frontend Rendering
- Check browser console for the debug logs I added
- The API calls return correct data (verified via curl)
- Most likely: getAuthToken() failing, or response shape mismatch
- Fix the actual rendering bug

### Step 2: Fix Seed Data (per architecture doc section 10)
- Add Prabal's agents: DataBot (master) + ParseBot, QABot, ReportBot
- Add Sakshi's agent: HelperBot (master, no sub-agents)
- Add 2 more traces with real conversations
- Add 30 days of cost data
- Add budget entries ($500/month for Shiwangi)

### Step 3: Verify Every Page
- Test /dashboard/agent-trace — Org View shows employees with badges
- Test /dashboard/agent-trace — Agent View shows agent trees
- Test /dashboard/agent-trace/trace/[traceId] — Flow graph renders
- Test /dashboard — loads without errors
- Test all agent portal pages work

### Step 4: Design Compliance
- Follow design philosophy: Linear/Vercel-style, flat, subtle borders, generous whitespace
- Muted palette: slate/gray base, indigo accent, red errors, green success
- Monospace for data values
- Dual theme: light/dark/system

## Architecture Doc Key Points for Future Phases
- Phase 2: Agent Command Center (chat interface + Anthropic API gateway) — CRITICAL
- Phase 3: Visualization upgrade (match mockup quality)
- Phase 4: Billing Dashboard (new)
- Phase 5: Polish + Agent Requests
- New endpoints needed: /api/agent-gateway/*, /api/agent-requests/*, /api/billing/*

## Git Branches
- main: current production (has all Phase 1-7 code, some broken)
- feature/fix-agent-trace-rendering: current working branch for frontend fixes (has debug logs)
- All future work: feature branch → develop → testing → main (Boss approves each merge)
