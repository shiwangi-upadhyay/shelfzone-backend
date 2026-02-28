# ShelfZone Backend

API server for the ShelfZone HR + Agent Management Platform.

## Tech Stack

- **Runtime:** Node.js 22 LTS
- **Framework:** Fastify
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL 16 (via TimescaleDB image)
- **Cache:** Redis 7
- **ORM:** Prisma
- **Validation:** Zod
- **Queue:** BullMQ
- **AI:** Anthropic SDK + LangChain.js

## AgentTrace — Agent Observability Platform

Full-stack agent observability with distributed tracing, cost attribution, and execution flow reconstruction.

### Features

- **4 UI Levels:** Agent Map (network overview) → Agent Detail (performance) → Task Flow (execution DAG) → Raw Logs (event-level debugging)
- **Distributed Tracing:** Session-based trace grouping with hierarchical task trees
- **Real-Time Cost Attribution:** Per-task cost calculation with aggregation by agent, model, and time period
- **Flow Reconstruction:** DAG visualization with critical path analysis and bottleneck identification
- **Security:** Ownership-based access control, PII redaction, rate limiting, audit trail
- **Analytics:** Cost breakdowns, performance metrics, token usage, health scoring
- **WebSocket Real-Time:** Live session streaming, agent activity feed, task tree updates

### Documentation

- **API Reference:** [`docs/agent-trace-api.md`](docs/agent-trace-api.md) — 17 endpoints with examples
- **Architecture:** [`docs/agent-trace-architecture.md`](docs/agent-trace-architecture.md) — Data model, UI levels, trace capture, cost aggregation, security model

## Prerequisites

- Node.js 22+
- Docker & Docker Compose
- Git

## Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/shiwangi-upadhyay/shelfzone-backend.git
   cd shelfzone-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment file:
   ```bash
   cp .env.example .env
   ```

4. Start infrastructure:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

5. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

6. Start development server:
   ```bash
   npm run dev
   ```

7. Verify:
   ```bash
   curl http://localhost:3001/health
   ```

## Project Structure

```
src/
├── config/        — Environment and app configuration
├── modules/       — Feature modules (employees, leave, payroll, agents, etc.)
├── middleware/     — Auth, RBAC, rate limiting
├── lib/           — Shared utilities
├── types/         — Shared TypeScript types
├── jobs/          — BullMQ async job processors
└── index.ts       — Server entry point

tests/
├── unit/          — Unit tests (Jest)
├── integration/   — API integration tests (Supertest)
├── e2e/           — End-to-end tests (Playwright)
├── security/      — Security test suite
└── load/          — Load tests (k6)

docs/
├── api/           — OpenAPI/Swagger specs
├── build-log.md   — Build progress log
└── progress.md    — Task completion tracker
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npm run typecheck` | Type check without emitting |

## Git Workflow

- `main` — Production (protected)
- `testing` — QA branch
- `develop` — Integration branch
- `feature/*` — Feature branches

All merges require explicit approval.

## License

Proprietary — Confidential
