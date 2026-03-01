# Command Center Streaming API - Phase 1 Step 3

**Status:** ✅ COMPLETE  
**Commit:** `4f1cbfa`  
**Branch:** `feature/command-center-rebuild`

## Overview

Built a new streaming API endpoint for Command Center that makes **ONE REAL** Anthropic API call with streaming and returns real-time chunks via Server-Sent Events (SSE).

## Files Created

### 1. `src/modules/command-center/command-center.schemas.ts`
- Zod validation schema for message requests
- Type-safe request body validation

### 2. `src/modules/command-center/command-center.service.ts`
- Core streaming logic
- Anthropic API integration with `stream: true`
- Token usage tracking
- Cost calculation (input + output tokens)
- Database persistence via `trace_sessions` and `task_trace`

### 3. `src/modules/command-center/command-center.controller.ts`
- Fastify request handler
- SSE response streaming
- Error handling for both pre-stream and mid-stream scenarios

### 4. `src/modules/command-center/command-center.routes.ts`
- Route registration
- Authentication middleware integration

### 5. Modified `src/index.ts`
- Registered command-center routes with prefix `/api/command-center`

## API Endpoint

### `POST /api/command-center/message`

**Authentication:** Required (Bearer token via `Authorization` header)

**Request Body:**
```json
{
  "agentId": "cm4abc123...",
  "conversationId": null,
  "message": "Your message here"
}
```

**Response:** Server-Sent Events (SSE) stream

**SSE Event Types:**

1. **chunk** - Text chunks as they arrive from Anthropic
```
event: chunk
data: {"text": "Hello"}
```

2. **cost** - Final cost with token counts
```
event: cost
data: {"inputTokens": 150, "outputTokens": 50, "totalCost": 0.0025}
```

3. **done** - Stream complete
```
event: done
data: {}
```

4. **error** - Error during streaming (if applicable)
```
event: error
data: {"error": "Error message"}
```

## API Flow Diagram

```
┌─────────────┐
│   Client    │
│  (Frontend) │
└──────┬──────┘
       │ POST /api/command-center/message
       │ {agentId, conversationId?, message}
       │ Authorization: Bearer <token>
       │
       ▼
┌─────────────────────────────────────────┐
│  Command Center Controller              │
│  - Validates request body               │
│  - Extracts userId from auth token      │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Command Center Service                 │
│  1. Get user's Anthropic API key        │
│  2. Load agent config (model, prompt)   │
│  3. Build messages array                │
│  4. Create TaskTrace + TraceSession     │
│  5. Call Anthropic API (stream: true)   │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Anthropic API                          │
│  - Streaming response via SSE           │
│  - message_start (usage: input tokens)  │
│  - content_block_delta (text chunks)    │
│  - message_delta (output tokens)        │
│  - message_stop (end)                   │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Transform Stream                       │
│  - Parse Anthropic SSE format           │
│  - Extract text chunks                  │
│  - Track token usage                    │
│  - Convert to our SSE format            │
│  - Calculate cost on completion         │
│  - Update database (trace_sessions)     │
└──────┬──────────────────────────────────┘
       │
       ▼ SSE: chunk events
┌─────────────┐
│   Client    │
│  (receives  │
│  real-time) │
└─────────────┘
       │
       ▼ SSE: cost event
┌─────────────┐
│   Client    │
│  (final     │
│   tokens +  │
│   cost)     │
└─────────────┘
       │
       ▼ SSE: done event
┌─────────────┐
│   Client    │
│  (stream    │
│   complete) │
└─────────────┘
```

## Database Schema Used

### `task_trace` table
- `id`: Trace ID (cuid)
- `ownerId`: User who initiated the request
- `masterAgentId`: Agent used for the conversation
- `instruction`: User's message
- `status`: 'running' → 'completed' or 'failed'
- `totalCost`: Final cost in USD
- `totalTokens`: Input + output tokens
- `startedAt`, `completedAt`: Timestamps

### `trace_sessions` table
- `id`: Session ID (cuid)
- `taskTraceId`: Parent trace ID
- `agentId`: Agent used
- `instruction`: User's message
- `status`: 'running' → 'success' or 'failed'
- `modelUsed`: Anthropic model (e.g., 'claude-sonnet-4-5')
- `sessionType`: 'command-center'
- `cost`: Final cost (Decimal)
- `tokensIn`, `tokensOut`: Token counts
- `durationMs`: Request duration
- `startedAt`, `completedAt`: Timestamps

## Cost Calculation

**Formula:**
```
totalCost = (inputTokens / 1_000_000 * inputPrice) + (outputTokens / 1_000_000 * outputPrice)
```

**Rates (per million tokens):**
| Model | Input | Output |
|-------|-------|--------|
| claude-opus-4-6 | $15 | $75 |
| claude-sonnet-4-5 | $3 | $15 |
| claude-haiku-4-5 | $0.8 | $4 |

## Error Handling

| Status Code | Condition | Message |
|-------------|-----------|---------|
| 400 | Missing required fields | Validation error details |
| 403 | No Anthropic API key | "No Anthropic API key configured" |
| 404 | Agent not found | "Agent with ID {id} not found" |
| 400 | Agent not active | "Agent {name} is not active" |
| 500 | Anthropic API error | Error from Anthropic API |

## Testing Guide

### Prerequisites
1. Backend server running on port 3001
2. Valid user account with Anthropic API key configured
3. At least one ACTIVE agent in database

### Test Steps

#### 1. Login to get auth token
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

**Expected:** JSON with `accessToken`

#### 2. Get list of agents
```bash
curl -X GET http://localhost:3001/api/agents \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

**Expected:** JSON array with agent objects containing `id` and `name`

#### 3. Send streaming message
```bash
curl -N -X POST http://localhost:3001/api/command-center/message \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "<AGENT_ID_FROM_STEP_2>",
    "conversationId": null,
    "message": "Hello! Count to 5 for me."
  }'
```

**Expected:** Real-time SSE stream:
```
event: chunk
data: {"text":"1"}

event: chunk
data: {"text":", "}

event: chunk
data: {"text":"2"}

event: chunk
data: {"text":", "}

event: chunk
data: {"text":"3"}

...

event: cost
data: {"inputTokens":45,"outputTokens":12,"totalCost":0.000315}

event: done
data: {}
```

### Verification Checklist

✅ **Only ONE Anthropic API call made** (check server logs)  
✅ **Response streams in real-time** (not all at once)  
✅ **Chunk events contain text** (incremental text)  
✅ **Cost event has real token counts** (positive integers)  
✅ **Cost is non-negative decimal** (e.g., 0.0025)  
✅ **Database updated**:
   - `task_trace` has new entry with `status: 'completed'`
   - `trace_sessions` has matching session with cost and tokens
✅ **No fake events** (no simulation code)

### Database Verification

```sql
-- Check latest trace
SELECT id, instruction, status, "totalCost", "totalTokens", "completedAt"
FROM task_trace
ORDER BY "createdAt" DESC
LIMIT 1;

-- Check latest session
SELECT id, "agentId", "modelUsed", cost, "tokensIn", "tokensOut", "durationMs"
FROM trace_sessions
ORDER BY "createdAt" DESC
LIMIT 1;
```

## Implementation Notes

### Key Features
1. **Real streaming**: Uses Anthropic's native `stream: true`
2. **Token tracking**: Captures usage from `message_start` and `message_delta` events
3. **Cost accuracy**: Calculates from real API usage, saved with 6 decimal precision
4. **Robust error handling**: Handles both pre-stream and mid-stream errors
5. **SSE format**: Clean event-based streaming compatible with EventSource API

### Future Enhancements (Step 6)
- Load conversation history for context
- Save user message + agent response to new `conversations` and `messages` tables
- Support multi-turn conversations with memory

## Testing with EventSource (JavaScript)

```javascript
const eventSource = new EventSource('http://localhost:3001/api/command-center/message', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    agentId: 'YOUR_AGENT_ID',
    conversationId: null,
    message: 'Hello!'
  })
});

eventSource.addEventListener('chunk', (e) => {
  const { text } = JSON.parse(e.data);
  console.log('Chunk:', text);
});

eventSource.addEventListener('cost', (e) => {
  const { inputTokens, outputTokens, totalCost } = JSON.parse(e.data);
  console.log('Cost:', { inputTokens, outputTokens, totalCost });
});

eventSource.addEventListener('done', (e) => {
  console.log('Stream complete');
  eventSource.close();
});

eventSource.addEventListener('error', (e) => {
  console.error('Error:', e);
  eventSource.close();
});
```

## Success Criteria Met

✅ Endpoint created: `POST /api/command-center/message`  
✅ Authentication via existing middleware  
✅ Loads agent config from database  
✅ Calls Anthropic API with `stream: true`  
✅ Returns SSE stream with chunk, cost, done events  
✅ Calculates real cost from token usage  
✅ Saves to `trace_sessions` for billing  
✅ Handles errors (403, 404, 400, 500)  
✅ Files created and registered  
✅ Build succeeds  
✅ Server starts without errors  

**Status:** Ready for Step 4 (UIcraft to connect frontend streaming)
