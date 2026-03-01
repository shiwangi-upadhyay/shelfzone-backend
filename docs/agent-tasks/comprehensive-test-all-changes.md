# Task: Comprehensive Testing of All Changes

**Agent:** TestRunner  
**Priority:** CRITICAL  
**Objective:** Test EVERY change that was supposed to be implemented and report what's working vs broken

---

## Changes That Were Supposed to Be Done

### 1. Agent Directory - Flow View
**Expected:** 
- Tab called "Flow View" next to "List View" at /dashboard/agents
- Shows animated ReactFlow diagram
- User → SHIWANGI → 7 sub-agents with arrows

**Test:**
- [ ] Open http://157.10.98.227:3000/dashboard/agents
- [ ] Look for "Flow View" tab
- [ ] Click it - does it show the diagram?
- [ ] Screenshot what you see

### 2. Org View - Connecting Lines
**Expected:**
- Purple connecting lines between employee cards
- Cards are draggable
- Department filter works

**Test:**
- [ ] Open http://157.10.98.227:3000/dashboard/agent-trace
- [ ] Org View tab
- [ ] Are there purple/visible lines connecting cards?
- [ ] Can you drag the cards?
- [ ] Does department filter work?
- [ ] Screenshot what you see

### 3. Command Center - Multi-Agent Selection
**Expected:**
- Checkboxes to select multiple agents
- 3 execution modes (delegate/parallel/sequential)
- Live activity sidebar showing real-time thinking
- ChatGPT-like interface

**Test:**
- [ ] Open http://157.10.98.227:3000/dashboard/agents/command
- [ ] Are there agent checkboxes at top?
- [ ] Is there a live activity sidebar on right?
- [ ] Does the interface look like ChatGPT?
- [ ] Try sending a command
- [ ] Does it work or throw error?
- [ ] If error, copy EXACT error message
- [ ] Screenshot the page

### 4. Backend APIs
**Expected:**
- POST /api/agent-gateway/execute-multi
- GET /api/agent-gateway/stream/:traceId

**Test:**
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"shiwangiupadhyay332@gmail.com","password":"ShelfEx@2025"}' | jq -r '.accessToken')

# Test multi-agent endpoint
curl -s -X POST http://localhost:3001/api/agent-gateway/execute-multi \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentIds":["c3ed83e4-80c9-47d7-9307-7dc130387094"],"instruction":"test","mode":"delegate"}' | jq '.'
```

---

## Boss's Complaints

### Issue 1: "No changes applied to agent page and agent trace page"

**What to check:**
1. Are the new component files actually being used?
   ```bash
   cd /root/.openclaw/workspace/shelfzone-web
   grep -n "AgentFlowDiagram" src/app/dashboard/agents/page.tsx
   grep -n "stroke.*8b5cf6" src/components/agent-trace/org-tree-view.tsx
   ```

2. Is the build including the new code?
   ```bash
   find .next -name "*.js" -exec grep -l "AgentFlowDiagram" {} \; | head -1
   find .next -name "*.js" -exec grep -l "8b5cf6" {} \; | head -1
   ```

3. Are the new components actually rendering in the browser?
   - Open browser DevTools
   - Look at Elements tab
   - Search for "Flow View" text
   - Search for purple stroke color

### Issue 2: "Command center throwing error on sending command"

**What to check:**
1. What's the EXACT error?
   - Open http://157.10.98.227:3000/dashboard/agents/command
   - Open browser console (F12)
   - Try sending a command
   - Copy the full error message and stack trace

2. Check network requests:
   - Network tab in DevTools
   - Try sending command
   - Which API call fails?
   - What's the response?

3. Check backend logs:
   ```bash
   tail -50 /root/.openclaw/workspace/shelfzone-backend/backend-prod.log | grep -i error
   ```

### Issue 3: "Too many duplicates of agents in thinking process"

**What to check:**
1. How many agent entries appear?
2. Are they all the same agents repeated?
3. Screenshot the duplicates
4. Check if it's a frontend rendering bug or backend data issue

---

## Detailed Test Plan

### Test 1: Agent Directory Flow View

```bash
# Check if code is in source
cd /root/.openclaw/workspace/shelfzone-web
cat src/app/dashboard/agents/page.tsx | grep -A5 -B5 "FlowView\|Flow View"

# Check if component exists
ls -la src/components/agents/agent-flow-diagram.tsx

# Check if it's in the build
ls -la .next/server/app/dashboard/agents/page.js
```

### Test 2: Org View Lines

```bash
# Check source code
cd /root/.openclaw/workspace/shelfzone-web
grep "8b5cf6\|strokeWidth.*3" src/components/agent-trace/org-tree-view.tsx

# Check if changes are built
grep -r "8b5cf6" .next/static/chunks/ | head -1
```

### Test 3: Command Center

**Manual browser test:**
1. Login at http://157.10.98.227:3000/login
2. Navigate to /dashboard/agents/command
3. Look for:
   - Agent selector (checkboxes)
   - Live activity sidebar
   - ChatGPT-style interface
4. Try sending: "test message"
5. Capture any errors

### Test 4: Backend Endpoints

```bash
# Get fresh token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"shiwangiupadhyay332@gmail.com","password":"ShelfEx@2025"}' | jq -r '.accessToken')

# Test if new endpoint exists
curl -s http://localhost:3001/api/agent-gateway/execute-multi \
  -H "Authorization: Bearer $TOKEN" \
  -X OPTIONS | head -5

# Test actual call
curl -s -X POST http://localhost:3001/api/agent-gateway/execute-multi \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentIds": ["c3ed83e4-80c9-47d7-9307-7dc130387094"],
    "instruction": "Hello, test message",
    "mode": "delegate"
  }' | jq '.'
```

---

## Output Format

**For each feature, report:**

```
Feature: [Name]
Status: ✅ WORKING / ❌ BROKEN / ⚠️ PARTIAL
What I see: [Description]
Expected: [What it should be]
Screenshot: [Browser screenshot]
Error (if any): [Exact error message]
Root cause: [Why it's broken]
```

---

## Screenshots Required

1. Agent Directory page showing (or not showing) Flow View tab
2. Agent Trace Org View showing (or not showing) purple lines
3. Command Center page showing interface
4. Browser console showing any errors
5. Network tab showing failed API calls (if any)

---

## Success Criteria

All 3 features should be:
- ✅ Visible in browser
- ✅ Working without errors
- ✅ Matching the requirements

If ANY feature is broken or missing, identify exactly why and report.

---

**Use browser automation. Take screenshots. Copy exact error messages. Be thorough.**
