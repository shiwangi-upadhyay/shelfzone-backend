# Agent Bridge Testing Guide - Phase 4B.5

## What Was Implemented

Phase 4B.5 enables instruction relay from Command Center to remote OpenClaw nodes and real-time result streaming back to the browser.

### New Components

1. **Database Schema**
   - Added `nodeId` field to `agent_registry` table
   - Agents can now be marked as running on remote nodes

2. **Bridge Event Emitter** (`event-emitter.ts`)
   - Singleton event bus connecting WebSocket and SSE streams

3. **Instruction Relay Service** (`instruction-relay.service.ts`)
   - Relays instructions from Command Center to remote nodes
   - Creates bridge sessions and logs events

4. **Result Streaming Service** (`result-streaming.service.ts`)
   - Streams results from node back to browser via SSE
   - Supports: agent responses, file changes, command output, errors

5. **Updated WebSocket Server**
   - Emits events through event emitter
   - Auto-registers agents on handshake

6. **Updated Command Center Controller**
   - Detects remote agents
   - Routes to relay service for remote agents
   - Falls back to Anthropic API for local agents

## Testing Flow

### Prerequisites

1. Backend running on `localhost:3001`
2. Database with pairing token
3. Test client (`test-bridge-execution.js`)

### Step 1: Create Pairing Token

```bash
# In backend directory
npm run dev

# In another terminal, create a pairing token
psql -d shelfzone -c "INSERT INTO pairing_tokens (id, token, user_id, expires_at, created_at) VALUES (gen_random_uuid()::text, 'test-token-123', 'YOUR_USER_ID', NOW() + INTERVAL '1 hour', NOW());"
```

Replace `YOUR_USER_ID` with your actual user ID from the database.

### Step 2: Run Test Client

```bash
# In backend directory
node test-bridge-execution.js
```

Expected output:
```
🧪 Bridge Execution Test Client
Connecting to: ws://localhost:3001/ws/bridge?token=test-token-123
✅ Connected to WebSocket server
📤 Sending handshake: { type: 'handshake', nodeKey: 'test-node-...', agents: ['TestAgent', 'FrontendBot'], platform: 'linux' }
📨 Received: auth_ok
✅ Authentication successful
📨 Received: handshake_complete
✅ Handshake complete, nodeId: clxxxx...
💡 Node is now online and ready to receive instructions
💡 Send a message to TestAgent or FrontendBot via Command Center API
```

### Step 3: Get Agent ID

```bash
# Query for the newly registered agent
psql -d shelfzone -c "SELECT id, name, node_id FROM agent_registry WHERE name IN ('TestAgent', 'FrontendBot') ORDER BY created_at DESC LIMIT 1;"
```

Copy the agent ID.

### Step 4: Send Instruction via Command Center

```bash
# Replace AGENT_ID and AUTH_TOKEN
curl -X POST http://localhost:3001/api/command-center/message \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "AGENT_ID",
    "conversationId": "test-conv-123",
    "message": "Please create a new file called test.txt"
  }'
```

### Step 5: Observe Test Client Output

The test client should receive and simulate execution:

```
📨 Received: execute
📥 Received instruction to execute:
  Session ID: clxxxx...
  Agent ID: clxxxx...
  Instruction: Please create a new file called test.txt
🤖 Simulating agent execution...
📤 Sending initial response...
📤 Sending file change event...
📤 Sending command output...
📤 Sending progress update...
📤 Sending another command output...
📤 Sending final result...
✅ Execution simulation complete
```

### Step 6: Observe SSE Stream in Browser

The curl command (or frontend) should receive SSE events:

```
event: message
data: {"content":"I received your instruction...","done":false}

event: file_change
data: {"filePath":"/test/example.txt","diff":"+Added new line\n-Removed old line"}

event: command
data: {"command":null,"output":"npm install completed successfully\nInstalled 42 packages"}

event: message
data: {"content":"Processing your request... 50% complete","done":false}

event: command
data: {"command":null,"output":"git commit -m \"feat: implemented feature X\""}

event: message
data: {"content":"✅ Task completed successfully! All changes have been applied.","done":false}

event: cost
data: {"totalCost":0,"tokensUsed":0,"status":"COMPLETED"}

event: done
data: {}
```

## Verification Checklist

- [x] Database schema updated with `nodeId` field
- [x] Event emitter created
- [x] Instruction relay service created
- [x] Result streaming service created
- [x] WebSocket server emits events
- [x] Agent auto-registration on handshake
- [x] Command Center detects remote agents
- [x] SSE stream delivers events to browser
- [x] Build succeeds without errors
- [x] Test client simulates full flow

## Architecture

```
Browser (Command Center)
    |
    | POST /api/command-center/message
    v
Command Center Controller
    |
    | Check if agent.nodeId exists
    v
Instruction Relay Service
    |
    | WebSocket: execute message
    v
Remote Node (OpenClaw)
    |
    | Executes instruction
    v
WebSocket Server
    |
    | result, file_change, command_output messages
    v
Bridge Event Emitter
    |
    | emits 'bridge_event'
    v
Result Streaming Service
    |
    | SSE events
    v
Browser (real-time updates)
```

## Database Schema

```sql
-- agent_registry now has nodeId
ALTER TABLE agent_registry ADD COLUMN node_id TEXT;
ALTER TABLE agent_registry ADD CONSTRAINT fk_agent_node 
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE SET NULL;

-- Bridge sessions track instruction relay
CREATE TABLE bridge_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  instructor_id TEXT NOT NULL,
  conversation_id TEXT,
  status TEXT DEFAULT 'ACTIVE',
  total_cost NUMERIC(10, 6) DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

-- Bridge events log all activity
CREATE TABLE bridge_events (
  id TEXT PRIMARY KEY,
  bridge_session_id TEXT NOT NULL,
  type TEXT NOT NULL, -- INSTRUCTION, RESPONSE, FILE_CHANGE, COMMAND, ERROR
  content TEXT,
  metadata JSONB,
  file_changed TEXT,
  command_run TEXT,
  cost NUMERIC(10, 6) DEFAULT 0,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

## Next Steps

Once this is working:

1. Integrate with real frontend Command Center UI
2. Add authentication/authorization for bridge sessions
3. Implement cost tracking for remote agent usage
4. Add session timeout handling
5. Support multiple concurrent sessions per node
6. Add node health monitoring
7. Implement session cancellation

## Troubleshooting

### Node doesn't connect
- Check pairing token exists and hasn't expired
- Verify WebSocket URL is correct
- Check firewall allows WebSocket connections

### Agent not found
- Ensure handshake completed successfully
- Check agent was registered in database
- Verify agent name matches

### No SSE events
- Check bridge session was created
- Verify node is sending messages
- Look for errors in backend logs
- Test with `curl -N` (no-buffer flag)

### Events not reaching browser
- Check Event Emitter subscription
- Verify session ID matches
- Look for WebSocket errors
- Check SSE headers are correct
