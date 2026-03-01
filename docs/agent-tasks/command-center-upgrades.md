# Task: Command Center Upgrades

**Agents:** BackendForge (backend) + UIcraft (frontend)  
**Priority:** CRITICAL  
**Branch:** feature/fix-agent-trace-bugs

---

## Requirements

### 3a. Multi-Agent Selection

**Current:** Can only send to one agent at a time.

**Required:** 
- Select multiple agents: SHIWANGI + BackendForge + UIcraft
- Send same instruction to all selected
- OR select SHIWANGI and let her decide who to delegate to

### 3b. Live Thinking Sidebar

**Current:** Sidebar blank/empty during execution.

**Required:** Show real-time thinking/activity:
```
SHIWANGI: "Analyzing instruction..." (thinking)
SHIWANGI: "This needs backend + frontend work" (decision)
SHIWANGI: "Delegating to BackendForge..." (delegation)
BackendForge: "Working on API endpoint..." (executing)
BackendForge: "Done. 3 endpoints created." (completion)
SHIWANGI: "Reporting to Boss..." (reporting)
```

Each line appears **LIVE** as it happens (SSE events).

Show cost accumulating next to each agent's activity.

### 3c. ChatGPT-like Interface

**Current:** Basic chat.

**Required:**
- Clean chat UI (user messages right, agent messages left)
- **Streaming response** (text appears word-by-word)
- **Markdown rendering** (code blocks, bold, lists)
- Message history (scroll up to see previous conversations)
- Input box at bottom with Send button
- **Enter to send** (Shift+Enter for new line)
- Show which agent is responding (avatar + name above message)
- **Delegation cards:** When SHIWANGI delegates, show compact card:
  ```
  ┌─────────────────────────────────┐
  │ Delegated to BackendForge       │
  │ Task: Build the API endpoint    │
  └─────────────────────────────────┘
      ↓
  BackendForge: [nested/indented response]
  ```

---

## Backend Tasks (BackendForge)

### Task 1: Multi-Agent Selection API

**Endpoint:** `POST /api/agent-gateway/execute-multi`

**Request:**
```json
{
  "agentIds": ["uuid-1", "uuid-2", "uuid-3"],
  "instruction": "Build the login feature",
  "mode": "parallel" | "sequential" | "delegate"
}
```

**Modes:**
- `parallel`: Send to all agents simultaneously
- `sequential`: Send to agents one by one
- `delegate`: Send to master agent (e.g., SHIWANGI) and let her delegate

**Response:** Same trace structure, but with multiple agent sessions.

### Task 2: Live Thinking SSE Events

**Endpoint:** `GET /api/agent-gateway/stream/:traceId`

**Event types:**
```typescript
// Event types to emit:
{
  event: 'thinking',
  agentId: string,
  agentName: string,
  content: string,
  timestamp: string,
  cost: number,
}

{
  event: 'decision',
  agentId: string,
  agentName: string,
  decision: string,
  reasoning: string,
}

{
  event: 'delegation',
  fromAgentId: string,
  fromAgentName: string,
  toAgentId: string,
  toAgentName: string,
  task: string,
}

{
  event: 'executing',
  agentId: string,
  agentName: string,
  action: string,
}

{
  event: 'completion',
  agentId: string,
  agentName: string,
  result: string,
  cost: number,
  tokensUsed: number,
}

{
  event: 'error',
  agentId: string,
  agentName: string,
  error: string,
}
```

**Implementation:**
- When agent thinks → emit 'thinking' event
- When agent decides to delegate → emit 'decision' + 'delegation'
- When sub-agent executes → emit 'executing'
- When sub-agent completes → emit 'completion'
- Accumulate cost and emit with each event

**Stream until trace completes.**

### Task 3: Markdown Response Support

**Update agent response processing:**
- Don't strip markdown from responses
- Return raw markdown in API
- Let frontend render it

---

## Frontend Tasks (UIcraft)

### Task 1: Multi-Agent Selector

**Component:** `<AgentSelector>`

**UI:**
```
┌────────────────────────────────────┐
│ Select Agents                      │
│ ☑ SHIWANGI (Master Agent)          │
│ ☐ BackendForge                     │
│ ☐ UIcraft                          │
│ ☐ DataArchitect                    │
│ ☐ ShieldOps                        │
│ ☐ PortalEngine                     │
│ ☐ TestRunner                       │
│ ☐ DocSmith                         │
│                                    │
│ Mode: ⦿ Let SHIWANGI delegate      │
│       ○ Send to all selected       │
│       ○ Sequential execution       │
└────────────────────────────────────┘
```

**Integration:**
- Show above input box
- When "Let SHIWANGI delegate" → send to SHIWANGI only, she decides
- When "Send to all" → POST to /api/agent-gateway/execute-multi with all selected IDs
- When "Sequential" → same but mode=sequential

### Task 2: Live Thinking Sidebar

**Component:** `<LiveActivitySidebar>`

**Layout:**
```
┌─────────────────────────────┐
│ Live Activity               │
├─────────────────────────────┤
│ 🏗️ SHIWANGI                │
│ Analyzing...    $0.0012     │
│                             │
│ 🏗️ SHIWANGI                │
│ Decision: needs backend     │
│                             │
│ 🏗️ SHIWANGI → ⚙️ BackendF  │
│ Delegating task...          │
│                             │
│ ⚙️ BackendForge             │
│ Building endpoints... $0.05 │
│                             │
│ ⚙️ BackendForge             │
│ Done! 3 endpoints ✓  $0.15  │
│                             │
│ Total Cost: $0.2012         │
└─────────────────────────────┘
```

**Implementation:**
- Use SSE to listen to /api/agent-gateway/stream/:traceId
- On each event, append new line to activity log
- Auto-scroll to bottom
- Show cumulative cost
- Color-code by event type (thinking=gray, error=red, completion=green)

### Task 3: ChatGPT-like Interface

**File:** `src/app/dashboard/agents/command/page.tsx` (refactor)

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  Command Center                                    🏗️ SHIWANGI│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [Previous messages scroll up here]                          │
│                                                              │
│                                       You: Build login page  │◄─ User message (right)
│                                               [2:30 PM]      │
│                                                              │
│  🏗️ SHIWANGI:                                               │◄─ Agent response (left)
│  I'll work on that. Let me delegate:                         │
│                                                              │
│  ┌─────────────────────────────────────┐                    │◄─ Delegation card
│  │ Delegated to BackendForge           │                    │
│  │ Task: Build authentication API      │                    │
│  └─────────────────────────────────────┘                    │
│    ↓                                                         │
│    ⚙️ BackendForge:                                          │◄─ Sub-agent (indented)
│    Creating 3 endpoints... Done!                             │
│                                                              │
│  I've completed the login feature.                           │
│  - Backend API ready                                         │
│  - Routes: /login, /register, /logout                        │
│                                               [2:31 PM]      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Type your message...                              [Send →]  │
└──────────────────────────────────────────────────────────────┘
```

**Features:**
- User messages: right-aligned, blue bubble
- Agent messages: left-aligned, gray bubble
- Avatar + agent name above each message
- Markdown rendering (use `react-markdown` or similar)
- Streaming: text appears character-by-character
- Delegation card: compact, indented sub-responses below it
- Timestamp on each message
- Auto-scroll to bottom on new message
- Input box sticky at bottom
- Enter to send, Shift+Enter for newline

**Streaming implementation:**
```typescript
// Listen to SSE for streaming response
const eventSource = new EventSource(`/api/agent-gateway/stream/${traceId}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.event === 'message_chunk') {
    // Append chunk to current message
    appendToMessage(data.agentId, data.chunk);
  }
  
  if (data.event === 'delegation') {
    // Show delegation card
    addDelegationCard(data);
  }
  
  if (data.event === 'completion') {
    // Mark message as complete
    completeMessage(data.agentId);
  }
};
```

---

## Testing Checklist

### Multi-Agent Selection:
- [ ] Can select multiple agents
- [ ] Can choose delegation mode
- [ ] "Let SHIWANGI delegate" sends to SHIWANGI only
- [ ] "Send to all" sends to all selected agents
- [ ] Response includes all agent outputs

### Live Thinking:
- [ ] Sidebar shows real-time activity
- [ ] Each event appears as it happens (not after completion)
- [ ] Shows thinking, decision, delegation, execution, completion
- [ ] Cost accumulates correctly
- [ ] Auto-scrolls to bottom

### ChatGPT Interface:
- [ ] User messages on right, agent on left
- [ ] Streaming response (word-by-word)
- [ ] Markdown renders (code blocks, **bold**, lists)
- [ ] Message history scrollable
- [ ] Enter sends, Shift+Enter newline
- [ ] Agent avatar + name shown
- [ ] Delegation cards appear correctly
- [ ] Sub-agent responses indented
- [ ] Timestamps on messages

---

## Files to Create/Modify

**Backend:**
- `src/modules/agent-gateway/gateway.controller.ts` (add execute-multi endpoint)
- `src/modules/agent-gateway/gateway.service.ts` (multi-agent execution logic)
- `src/modules/agent-gateway/sse-stream.ts` (live thinking events)

**Frontend:**
- `src/components/command-center/agent-selector.tsx` (NEW)
- `src/components/command-center/live-activity-sidebar.tsx` (NEW)
- `src/components/command-center/chat-interface.tsx` (NEW - refactor existing)
- `src/components/command-center/delegation-card.tsx` (NEW)
- `src/app/dashboard/agents/command/page.tsx` (refactor to use new components)

---

**Split work:**
- **BackendForge:** Multi-agent API + SSE streaming
- **UIcraft:** Agent selector + Live sidebar + ChatGPT interface
