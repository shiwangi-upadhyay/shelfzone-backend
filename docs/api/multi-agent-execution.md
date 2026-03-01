# Multi-Agent Execution API

## Overview

The multi-agent execution API allows sending instructions to multiple agents simultaneously, with support for different execution modes.

## Endpoint

```
POST /api/agent-gateway/execute-multi
```

## Authentication

Requires Bearer token in Authorization header.

## Request Body

```typescript
{
  agentIds: string[];     // Array of agent IDs (1-10 agents)
  instruction: string;    // Instruction to send (1-5000 chars)
  mode: 'parallel' | 'sequential' | 'delegate';  // Execution mode
}
```

## Execution Modes

### 1. Parallel Mode (`parallel`)
Sends the instruction to all selected agents simultaneously. All agents execute in parallel.

```bash
curl -X POST http://localhost:3001/api/agent-gateway/execute-multi \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentIds": ["agent-id-1", "agent-id-2", "agent-id-3"],
    "instruction": "Analyze the user authentication flow",
    "mode": "parallel"
  }'
```

**Use case:** When tasks can be done independently and you want fast results.

### 2. Sequential Mode (`sequential`)
Sends the instruction to agents one by one, waiting for each to complete before moving to the next.

```bash
curl -X POST http://localhost:3001/api/agent-gateway/execute-multi \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentIds": ["agent-id-1", "agent-id-2", "agent-id-3"],
    "instruction": "Build the feature step by step",
    "mode": "sequential"
  }'
```

**Use case:** When tasks depend on each other or need ordered execution.

### 3. Delegate Mode (`delegate`)
Sends the instruction to the first agent (typically the master agent like SHIWANGI), who then decides which sub-agents to delegate to.

```bash
curl -X POST http://localhost:3001/api/agent-gateway/execute-multi \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentIds": ["shiwangi-agent-id"],
    "instruction": "Build the user dashboard with proper backend APIs",
    "mode": "delegate"
  }'
```

**Use case:** When you want the master agent to intelligently distribute work.

## Response

```typescript
{
  data: {
    traceId: string;  // Trace ID for monitoring execution
  }
}
```

## Live Streaming (SSE)

After creating a multi-agent execution, listen to real-time events:

```
GET /api/agent-gateway/stream/:traceId?token=YOUR_TOKEN
```

### Event Types

```typescript
// Thinking event
{
  event: 'thinking',
  agentId: string,
  agentName: string,
  content: string,
  timestamp: string,
  cost: number
}

// Decision event
{
  event: 'decision',
  agentId: string,
  agentName: string,
  content: string,
  metadata: { decision: string, reasoning: string }
}

// Delegation event
{
  event: 'delegation',
  agentId: string,
  agentName: string,
  toAgentId: string,
  toAgentName: string,
  content: string
}

// Executing event
{
  event: 'executing',
  agentId: string,
  agentName: string,
  content: string
}

// Message chunk (streaming response)
{
  event: 'message_chunk',
  agentId: string,
  agentName: string,
  content: string  // Partial response chunk
}

// Completion event
{
  event: 'completion',
  agentId: string,
  agentName: string,
  content: string,
  cost: number,
  tokenCount: number
}

// Error event
{
  event: 'error',
  agentId: string,
  agentName: string,
  content: string
}
```

### Example: Listening to SSE Stream

```javascript
const eventSource = new EventSource(
  `http://localhost:3001/api/agent-gateway/stream/${traceId}?token=${token}`
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.event) {
    case 'thinking':
      console.log(`${data.agentName} is thinking: ${data.content}`);
      break;
    
    case 'delegation':
      console.log(`${data.agentName} delegating to ${data.toAgentName}`);
      break;
    
    case 'message_chunk':
      // Append chunk to build streaming response
      appendToResponse(data.agentId, data.content);
      break;
    
    case 'completion':
      console.log(`${data.agentName} completed (cost: $${data.cost})`);
      break;
    
    case 'error':
      console.error(`${data.agentName} error: ${data.content}`);
      break;
  }
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};
```

## Markdown Support

Agent responses now preserve markdown formatting. The API returns raw markdown content, allowing frontends to render it properly with libraries like `react-markdown`.

**Example response content:**
```markdown
## Analysis Results

The authentication flow has **3 main stages**:

1. **Login Request**
   - User submits credentials
   - Backend validates via bcrypt
   
2. **Token Generation**
   - JWT access token (15min)
   - Refresh token (7 days)

3. **Authorization**
   - Middleware validates token
   - RLS policies enforce access

```typescript
// Example middleware
export async function authenticate(req, reply) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  // ... validation logic
}
```

**Status:** ✅ Secure and working
```

## Error Responses

```typescript
// Validation error
{
  error: 'Validation Error',
  message: 'agentIds must contain 1-10 agents'
}

// Agent not found
{
  error: 'Not Found',
  message: 'Agent(s) not found: uuid-123'
}

// Inactive agent
{
  error: 'Bad Request',
  message: 'Inactive agent(s): BackendForge'
}

// Missing API key
{
  error: 'API Key Required',
  message: 'Set your Anthropic API key in settings'
}
```

## Testing with curl

```bash
# 1. Login to get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@shelfzone.com","password":"your_password"}' \
  | jq -r '.data.accessToken')

# 2. Get agent IDs
AGENTS=$(curl -s -X GET http://localhost:3001/api/agents \
  -H "Authorization: Bearer $TOKEN")

echo "Available agents:"
echo "$AGENTS" | jq '.data[] | {id, name}'

# Extract first 3 agent IDs
AGENT_1=$(echo "$AGENTS" | jq -r '.data[0].id')
AGENT_2=$(echo "$AGENTS" | jq -r '.data[1].id')
AGENT_3=$(echo "$AGENTS" | jq -r '.data[2].id')

# 3. Execute multi-agent (parallel)
TRACE=$(curl -s -X POST http://localhost:3001/api/agent-gateway/execute-multi \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"agentIds\": [\"$AGENT_1\", \"$AGENT_2\", \"$AGENT_3\"],
    \"instruction\": \"Review the codebase structure and suggest improvements\",
    \"mode\": \"parallel\"
  }")

echo "Trace created:"
echo "$TRACE" | jq

TRACE_ID=$(echo "$TRACE" | jq -r '.data.traceId')

# 4. Stream events
echo "\nStreaming events:"
curl -N "http://localhost:3001/api/agent-gateway/stream/$TRACE_ID?token=$TOKEN"
```

## Frontend Integration

See `docs/frontend/command-center-integration.md` for React/Next.js integration examples.

## Implementation Details

- **File:** `src/modules/agent-gateway/gateway.service.ts` - `executeMultiAgent()` function
- **Controller:** `src/modules/agent-gateway/gateway.controller.ts` - `executeMultiHandler()`
- **Routes:** `src/modules/agent-gateway/gateway.routes.ts`
- **Schemas:** `src/modules/agent-gateway/gateway.schemas.ts` - `executeMultiSchema`

## Rate Limiting

Same limits as single-agent execution:
- 10 requests per minute per user
- Max 10 agents per request

## Cost Tracking

Each agent session is tracked separately. Total cost is accumulated across all agent executions in the trace.

Access cost data via:
```
GET /api/agent-gateway/status/:traceId
```

Response includes per-agent and total costs.
