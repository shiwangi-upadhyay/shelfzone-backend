# Phase 6: ShelfZone Agent Gateway — Full Conversation Tracing

## Overview

Route **all** agent API calls through the ShelfZone gateway so every interaction is traced, billed, and auditable — not just Command Center chats.

## Current State (Phase 2-5)

- Command Center: User → ShelfZone → Anthropic API → response streamed back
- Per-user API keys (AES-256 encrypted)
- Billing ingestion via `POST /api/billing/ingest`
- Delegation chains tracked in `trace_sessions`

## Phase 6 Goal

**Every agent call** (OpenClaw sessions, Command Center, external integrations) flows through:

```
Client → ShelfZone Gateway → Provider API (Anthropic/OpenAI/etc.) → Response
                ↓
         trace_sessions (auto-logged)
         billing (auto-calculated)
         audit_logs (who, when, what)
```

## Architecture

### 6A: Gateway Proxy Layer
- `POST /api/gateway/v1/chat` — drop-in replacement for Anthropic/OpenAI chat endpoints
- `POST /api/gateway/v1/complete` — completions
- Accepts standard provider request format + ShelfZone headers:
  - `X-ShelfZone-Agent`: agent name (e.g., "BackendForge")
  - `X-ShelfZone-Task`: task description
  - `X-ShelfZone-Parent-Session`: parent session ID (for delegation)
- Auto-creates TaskTrace + TraceSession per request
- Streams response back to client (SSE passthrough)
- Calculates cost from token usage + model pricing table

### 6B: OpenClaw Integration
- Configure OpenClaw to route API calls through ShelfZone gateway
- ShelfZone becomes the `ANTHROPIC_BASE_URL` for OpenClaw agents
- Every SHIWANGI/BackendForge/UIcraft session auto-traced
- No manual ingestion needed — gateway captures everything

### 6C: Model Pricing Table
- `model_pricing` table: model name → input price per 1M tokens, output price per 1M tokens
- Auto-calculate cost from token counts
- Admin UI to update pricing when models change

### 6D: Rate Limiting & Budget Enforcement
- Per-agent rate limits (requests/min, tokens/day)
- Per-employee budget caps (monthly spend limit)
- Auto-pause agents that exceed budget (existing budget system)
- Gateway enforces limits before proxying to provider

### 6E: Audit & Compliance
- Every gateway request logged to `audit_logs`
- Request/response metadata (no full conversation content unless opted in)
- Export audit trail per agent, employee, or time range

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/gateway/v1/chat` | Proxy chat completion |
| POST | `/api/gateway/v1/complete` | Proxy text completion |
| GET | `/api/gateway/v1/models` | List available models + pricing |
| GET | `/api/gateway/v1/usage` | Real-time usage for current user |
| PUT | `/api/gateway/v1/pricing` | Update model pricing (admin) |

## DB Changes

```sql
CREATE TABLE model_pricing (
  id TEXT PRIMARY KEY,
  model_name TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL,  -- anthropic, openai, etc.
  input_price_per_million DECIMAL(10,4) NOT NULL,
  output_price_per_million DECIMAL(10,4) NOT NULL,
  effective_from TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Build Order

1. **6A**: Gateway proxy with auto-tracing (BackendForge)
2. **6B**: OpenClaw integration config + testing (ShieldOps)
3. **6C**: Model pricing table + admin UI (DataArchitect + UIcraft)
4. **6D**: Rate limiting + budget enforcement at gateway (BackendForge + ShieldOps)
5. **6E**: Audit logging + export (BackendForge + DocSmith)

## Success Criteria

- Zero manual ingestion needed — all usage auto-captured
- Billing dashboard shows real-time costs as agents work
- Budget limits enforced before API calls go through
- Full audit trail exportable for compliance
