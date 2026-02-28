# ShelfZone Backend

API server for **ShelfZone** — a dual-portal HR + AI Agent Management Platform.

## Features

### HR Portal
- **Employee Management** — CRUD, departments, designations, profiles
- **Attendance Tracking** — Clock in/out, reports
- **Leave Management** — Apply, approve/reject, balances
- **Payroll** — Generation, processing, payslips, Indian tax calculation
- **Self-Service** — Employee dashboard, profile, payslips, attendance, leaves
- **Reports** — Attendance reports with export

### Agent Management Portal
- **Agent Registry** — Create, manage, health-check 8+ AI agents
- **Team Management** — Group agents, assign roles, track team stats
- **Analytics** — Platform/agent/team analytics, efficiency scoring, trends
- **Cost Management** — Real-time cost tracking, budgets with auto-pause
- **Configuration** — Model selection, parameters, prompts, feature toggles
- **API Key Management** — Per-agent keys with rotation

### Agent Trace (Observability)
- **Distributed Tracing** — Session-based traces with hierarchical tasks
- **Flow Visualization** — ReactFlow DAG with animated edges, color coding
- **Cost Attribution** — Per-task cost calculation by agent/model/period
- **Real-Time Streaming** — SSE for live session events
- **Security** — Ownership-based access, PII redaction, rate limiting, audit trail

### Command Center
- **Agent Gateway** — Instruct agents in real-time via SSE streaming
- **Real Anthropic API** — Claude Opus/Sonnet/Haiku integration
- **Per-User API Keys** — AES-256-GCM encrypted, BYOK model
- **3-Panel UI** — Agent selector, chat interface, live task board

### Billing Dashboard
- **Cost Analytics** — By agent, employee, model with date range filtering
- **Invoices** — Invoice generation and tracking
- **CSV Export** — Full billing data export

## Tech Stack

- **Runtime:** Node.js 22 LTS
- **Framework:** Fastify
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **ORM:** Prisma
- **Validation:** Zod
- **AI:** Anthropic SDK
- **Security:** AES-256-GCM encryption, Argon2id hashing, RBAC, RLS, audit logging

## Quick Start

```bash
git clone https://github.com/shiwangi-upadhyay/shelfzone-backend.git
cd shelfzone-backend
npm install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
npx prisma migrate dev
npx prisma db seed
npm run dev
# Verify: curl http://localhost:3001/health
```

## Documentation

- **[API Reference](docs/api-reference.md)** — All 70+ endpoints
- **[Build Log](docs/build-log.md)** — Complete development history
- **[Agent Trace API](docs/agent-trace-api.md)** — Trace endpoint details
- **[Architecture](docs/agent-trace-architecture.md)** — System design

## Project Structure

```
src/
├── config/          — Environment config
├── modules/
│   ├── auth/        — Authentication (register, login, JWT)
│   ├── employees/   — Employee CRUD
│   ├── departments/ — Department management
│   ├── leave/       — Leave requests
│   ├── leave-admin/ — Leave approval
│   ├── payroll/     — Payroll processing
│   ├── self-service/— Employee self-service
│   ├── reports/     — Report generation
│   ├── agents/      — Basic agent CRUD
│   ├── agent-portal/— Full agent management (agents, teams, analytics, costs, budgets, config, commands, api-keys)
│   ├── agent-trace/ — Observability & tracing
│   ├── agent-gateway/— Command Center API
│   ├── api-keys/    — Per-user API key management
│   └── billing/     — Billing & cost analytics
├── middleware/       — Auth, RBAC, rate limiting, sanitization
├── lib/             — Encryption, audit, RLS, utilities
└── index.ts         — Server entry
```

## License

Private — © Shiwangi Upadhyay
