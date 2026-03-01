# Task: Test Agent Trace Bug Fixes

**Agent:** TestRunner  
**Priority:** HIGH  
**Branch:** feature/fix-agent-trace-bugs (both repos)  
**Objective:** Verify all 3 bug fixes work correctly

---

## Context

3 bugs were fixed on Agent Trace page. Need comprehensive testing before merge.

**Backend:** http://157.10.98.227:3001  
**Frontend:** http://157.10.98.227:3000  
**Test user:** admin@shelfzone.com / ShelfEx@2025

---

## Test Plan

### Test #1: Visual Trees (Issue #1)

**Navigate to:** http://157.10.98.227:3000/dashboard/agent-trace

**Org View Tests:**
1. [ ] Page loads without errors
2. [ ] Visual tree renders (not a text list)
3. [ ] Employee cards show:
   - Avatar/initials
   - Name
   - Designation (if any)
   - Agent badges below
   - Cost today
4. [ ] Connecting lines visible (dashed, with arrows)
5. [ ] ReactFlow controls work (zoom, pan)
6. [ ] MiniMap visible in bottom right
7. [ ] Can click and drag to pan
8. [ ] Can zoom in/out with mouse wheel or controls
9. [ ] Dark mode toggle works (check Settings)
10. [ ] Click agent badge → detail panel opens

**Agent View Tests:**
1. [ ] Switch to "Agent View" tab
2. [ ] Shows only employees with agents
3. [ ] Employee cards at top
4. [ ] Lines connecting to agent nodes below
5. [ ] Agent nodes show:
   - Emoji
   - Name
   - Status color (green=active, yellow=paused, gray=inactive)
   - Cost today
6. [ ] Tree is zoomable/pannable
7. [ ] Click agent node → detail panel opens

**What to check:**
- NOT indented text lists
- ARE visual cards with connecting lines
- Layout looks professional (like Linear/Vercel)

---

### Test #2: Trace Flow Navigation (Issue #2)

**Navigate to:** http://157.10.98.227:3000/dashboard/agent-trace

**Recent Traces Section:**
1. [ ] Scroll to "Recent Traces" section
2. [ ] Should see list of recent traces
3. [ ] Each trace shows:
   - Status badge (completed/running/error)
   - Agent name
   - Instruction text
   - Duration
   - Cost
   - Agent count
   - Arrow icon on right

**Click "View" Test:**
1. [ ] Click any trace row
2. [ ] Should navigate to `/dashboard/agent-trace/trace/[traceId]`
3. [ ] Page should load successfully
4. [ ] Should NOT show "Trace not found" error
5. [ ] Should show:
   - Trace header with instruction
   - Status badge
   - Stats (duration, cost, agents, tokens)
   - ReactFlow graph with agent nodes
   - Event timeline

**ReactFlow Graph:**
1. [ ] Graph renders with nodes and edges
2. [ ] Agent nodes show agent name
3. [ ] Can click nodes → opens detail panel
4. [ ] Can zoom/pan graph

**Timeline:**
1. [ ] Event timeline shows events
2. [ ] Events have timestamps
3. [ ] Events show type (thinking, tool_call, completion, etc.)

**URL Test:**
1. [ ] Copy trace ID from URL
2. [ ] Verify it's a CUID format (starts with 'c', ~25 chars)
3. [ ] Refresh page → should still work

---

### Test #3: Agent Detail Panel (Issue #3)

**From Org View:**
1. [ ] Go to Agent Trace page
2. [ ] Click any agent badge on an employee card
3. [ ] Side panel opens from right
4. [ ] Panel shows agent name, emoji, status dot

**Conversation Tab:**
1. [ ] Default tab is "Conversation"
2. [ ] Should show events (NOT "No conversation")
3. [ ] Events show:
   - Type (instruction, thinking, tool_call, etc.)
   - Content/message
   - Timestamp
4. [ ] Can scroll through events

**Cost & Usage Tab:**
1. [ ] Switch to "Cost & Usage" tab
2. [ ] Should show cost breakdown
3. [ ] Charts render correctly
4. [ ] Stats show actual numbers

**Raw Logs Tab:**
1. [ ] Switch to "Raw Logs" tab
2. [ ] Should show event stream (NOT empty)
3. [ ] Terminal-style log viewer
4. [ ] Each log line shows:
   - Timestamp
   - Event type (colored)
   - Token count
   - Cost
   - Content preview
5. [ ] Click event → expands full content
6. [ ] Search box works
7. [ ] Filter dropdown works (filter by type)
8. [ ] "Export JSON" button works

**From Agent View:**
1. [ ] Switch to "Agent View" tab
2. [ ] Click any agent node
3. [ ] Repeat Conversation/Cost/Logs tests above
4. [ ] All tabs should show data

**From Trace Detail:**
1. [ ] Go to trace detail page (click trace from Recent Traces)
2. [ ] Click any agent node in the flow graph
3. [ ] Panel opens
4. [ ] All tabs should show data

---

## Backend API Tests

**Test with curl:**

```bash
# 1. Login
curl -X POST http://157.10.98.227:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@shelfzone.com", "password": "ShelfEx@2025"}' \
  -o /tmp/login.json

TOKEN=$(jq -r '.accessToken' /tmp/login.json)

# 2. Get recent traces (should return array)
curl -s "http://157.10.98.227:3001/api/traces?limit=3" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id'

# 3. Get specific trace with CUID (should work)
TRACE_ID="cmm7l0jyk0039r8f3385qymzl"  # Use real ID from DB
curl -s "http://157.10.98.227:3001/api/traces/$TRACE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.id // .error'

# Expected: Returns trace ID (not "Invalid UUID" error)

# 4. Get trace sessions
curl -s "http://157.10.98.227:3001/api/traces/$TRACE_ID/sessions" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id'

# 5. Get session events
SESSION_ID=$(curl -s "http://157.10.98.227:3001/api/traces/$TRACE_ID/sessions" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

curl -s "http://157.10.98.227:3001/api/sessions/$SESSION_ID/events?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data | length'

# Expected: Number > 0

# 6. Get agent sessions (for issue #3 fix)
AGENT_ID="c3ed83e4-80c9-47d7-9307-7dc130387094"  # UIcraft
curl -s "http://157.10.98.227:3001/api/agents/$AGENT_ID/sessions?limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id'

# Expected: Returns session ID
```

---

## Expected Results

### Issue #1 (Visual Trees):
✅ Org View shows tree with cards and connecting lines  
✅ Agent View shows tree with employee → agent hierarchy  
✅ Zoomable, pannable, MiniMap works  
✅ Dark mode works  
❌ NOT indented text lists

### Issue #2 (Trace Flow):
✅ Click trace → navigates to detail page  
✅ Page loads without "Trace not found" error  
✅ ReactFlow graph renders  
✅ Backend accepts CUID IDs  
❌ NOT "Invalid UUID" errors

### Issue #3 (Conversation & Logs):
✅ Click agent badge → panel opens  
✅ Conversation tab shows events  
✅ Raw Logs tab shows event stream  
✅ All tabs work from Org/Agent/Trace views  
❌ NOT "No conversation" or empty logs

---

## Bug Reporting

**If any test fails:**

1. Note which test failed
2. Screenshot the error
3. Check browser console (F12) for errors
4. Check network tab for failed API calls
5. Check backend logs: `tail -50 /root/.openclaw/workspace/shelfzone-backend/backend-prod.log`
6. Report back with:
   - Test number
   - What you expected
   - What actually happened
   - Console errors
   - API errors

---

## Success Criteria

- All Org View visual tests pass
- All Agent View visual tests pass
- All Trace Flow navigation tests pass
- All Agent Detail Panel tests pass (from all 3 entry points)
- All backend API tests return valid data
- No console errors
- No "Trace not found" errors
- No "No conversation" errors (when events exist)

---

**Deliverable:** Test report with pass/fail for each section
