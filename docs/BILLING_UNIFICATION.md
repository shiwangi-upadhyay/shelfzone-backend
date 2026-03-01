# Billing Data Unification (2026-03-01)

## Problem

Two billing endpoints were returning inconsistent data:

- `/api/billing/summary` → **$3.83** (correct)
- `/api/agent-portal/analytics/platform` → **$0.00** (incorrect)

## Root Cause

**Two different data sources:**

1. **`trace_sessions` table** (167 records, $3.83 total)
   - Populated by `/api/billing/ingest` endpoint
   - Contains raw usage data from all trace sessions
   - **Source of truth** for billing

2. **`agent_daily_stats` table** (0 records)
   - Pre-aggregated summary table
   - Only populated when sessions go through agent-portal session recording
   - Not populated for direct trace ingestion
   - **Empty** because billing data flows through ingestion, not portal sessions

## Solution

**Unified both endpoints to query `trace_sessions` as single source of truth.**

### Changes Made

**File:** `src/modules/agent-portal/analytics/analytics.service.ts`

#### Modified Functions:

1. **`getPlatformAnalytics(period)`**
   - Changed from: `prisma.agentDailyStats.aggregate()`
   - Changed to: `prisma.traceSession.aggregate()`
   - Now returns consistent data with billing endpoint

2. **`getAgentAnalytics(agentId, period)`**
   - Changed from: `prisma.agentDailyStats.aggregate()`
   - Changed to: `prisma.traceSession.aggregate()`
   - Uses `durationMs` for latency metrics

3. **`getTeamAnalytics(teamId, period)`**
   - Changed from: `prisma.agentDailyStats.aggregate()`
   - Changed to: `prisma.traceSession.aggregate()`

4. **`getTokenTrends(agentId, days)`**
   - Changed from: `prisma.agentDailyStats.findMany()`
   - Changed to: Raw SQL query grouping `trace_sessions` by date

## Data Flow

```
┌─────────────────────┐
│  Billing Ingestion  │  ← Usage data comes in
│  /api/billing/ingest│
└──────────┬──────────┘
           │
           ▼
    ┌──────────────┐
    │trace_sessions│  ← Single source of truth
    └──────┬───────┘
           │
           ├─────────────────────────────┐
           ▼                             ▼
   ┌──────────────────┐      ┌─────────────────────────┐
   │ /api/billing/*   │      │ /api/agent-portal/      │
   │                  │      │   analytics/*           │
   └──────────────────┘      └─────────────────────────┘
   
   Both now query the same source ✅
```

## Testing

```bash
TOKEN="..."
curl -s http://localhost:3001/api/billing/summary \
  -H "Authorization: Bearer $TOKEN" | jq '.totalCost'
# Output: 3.8256

curl -s http://localhost:3001/api/agent-portal/analytics/platform \
  -H "Authorization: Bearer $TOKEN" | jq '.data.totalCost'
# Output: 3.8256
```

✅ **Both endpoints now return identical billing data**

## Future Considerations

### Option 1: Keep `agent_daily_stats` for optimization

If we want to keep the daily stats table for performance:
- Add a scheduled job to populate it from `trace_sessions`
- Use it for historical queries (>30 days)
- Keep recent data queries hitting `trace_sessions` directly

### Option 2: Remove `agent_daily_stats`

Since all analytics now query `trace_sessions`:
- Consider removing the table entirely
- Simplifies the schema
- Eliminates sync issues
- May need indexing on `trace_sessions` for performance

## Recommendation

**Keep current implementation** (query `trace_sessions` directly):
- Simpler architecture
- Always accurate
- No sync lag
- Single source of truth

Add database indexes if analytics queries become slow:
```sql
CREATE INDEX idx_trace_sessions_agent_started 
  ON trace_sessions(agent_id, started_at);
  
CREATE INDEX idx_trace_sessions_started_status 
  ON trace_sessions(started_at, status);
```

---

**Implemented by:** DataArchitect subagent  
**Date:** 2026-03-01  
**Verified:** Both endpoints return $3.8256 consistently
