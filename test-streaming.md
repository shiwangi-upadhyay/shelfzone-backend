# Streaming Implementation Test Guide

## Changes Made

1. **Service Layer** (`command-center.service.ts`):
   - Changed `stream: false` → `stream: true`
   - Modified return type from `MessageResult` to `StreamResult`
   - Returns raw Anthropic stream body instead of parsing JSON
   - Moved database operations to controller

2. **Controller Layer** (`command-center.controller.ts`):
   - Set SSE headers (`text/event-stream`)
   - Reads stream with `ReadableStream` API
   - Buffers and parses SSE format (`data: {...}`)
   - Extracts text chunks from `content_block_delta` events
   - Captures tokens from `message_start` and `message_delta` events
   - Saves to database after stream completes
   - Emits events: `chunk`, `cost`, `done`

## Testing with curl

Once authentication is set up, test with:

```bash
# First, login to get a token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Extract token from response
TOKEN="<your-token-here>"

# Test streaming endpoint
curl -X POST http://localhost:3001/api/command-center/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "agentId": "<agent-id>",
    "message": "Hello, tell me a story about AI"
  }' \
  --no-buffer

# Expected output (SSE format):
event: chunk
data: {"text":"Once"}

event: chunk
data: {"text":" upon"}

event: chunk
data: {"text":" a"}

event: chunk
data: {"text":" time"}

...

event: cost
data: {"inputTokens":45,"outputTokens":234,"totalCost":0.003825}

event: done
data: {}
```

## Key Features

✅ **Direct stream pipe** - No complex ReadableStream transforms
✅ **Minimal buffering** - Only buffers incomplete SSE lines
✅ **Real-time chunks** - Text appears as it's generated
✅ **Token tracking** - Captures usage from stream events
✅ **Database persistence** - Saves after stream completes
✅ **Error handling** - Proper cleanup on stream errors

## Performance

- **Latency**: First chunk arrives immediately (no buffer delay)
- **Memory**: Minimal - only buffers incomplete lines
- **Reliability**: Proper error handling and stream cleanup

## Frontend Integration

The frontend should listen to SSE events:

```typescript
const eventSource = new EventSource('/api/command-center/message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ agentId, message }),
});

eventSource.addEventListener('chunk', (e) => {
  const { text } = JSON.parse(e.data);
  appendToUI(text); // Append chunk to response
});

eventSource.addEventListener('cost', (e) => {
  const { inputTokens, outputTokens, totalCost } = JSON.parse(e.data);
  displayCost(totalCost);
});

eventSource.addEventListener('done', () => {
  eventSource.close();
  markComplete();
});
```
