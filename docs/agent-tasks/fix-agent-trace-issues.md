# Task: Fix Agent Trace Page Issues

**Agent:** PortalEngine  
**Priority:** HIGH  
**Branch:** feature/fix-agent-trace-bugs  
**Estimated:** 3-4 hours

## Context

Boss found 3 critical bugs on the Agent Trace page (`/dashboard/agent-trace`). All must be fixed and tested before merge.

---

## Issue 1: Org View & Agent View Need Visual Trees

**Problem:** Currently showing simple indented lists. Need proper visual org chart with:
- Cards for each person/agent
- Photos/avatars
- Connecting lines (vertical + horizontal, dashed)
- Proper tree layout
- Zoomable, pannable

**Reference:** Copy the existing employee org chart style (if it exists). If not, build from scratch using ReactFlow.

**Requirements:**

### Org View:
```
ShelfZone (company node)
├── C-suite (Gaurav, Vishal, Rajmani)
│   ├── Lines to department heads
│   │   ├── Subhro (Development)
│   │   ├── Deepanjali (Data)
│   │   └── etc.
│   └── Lines to team members
└── Each person card shows:
    - Photo/avatar
    - Name
    - Designation
    - Small agent badges below (if they own agents)
```

### Agent View:
```
Employees who own agents (cards at top)
└── Line down to master agent node
    └── Lines down to sub-agents
```

**Agent nodes show:**
- Emoji
- Name
- Model
- Status dot
- Cost today

**Technical:**
- Use ReactFlow or similar tree library
- Same connecting line style as employee org chart (if exists)
- Must be VISUAL TREE with cards and lines, not lists

**Files to modify:**
- `/root/.openclaw/workspace/shelfzone-web/src/components/agent-trace/agent-map.tsx` (replace `buildTree()` function)
- May need new component: `org-tree.tsx` or similar

---

## Issue 2: Trace Flow - "Trace not found" Error

**Problem:** 
- Recent Traces section shows traces
- Click "View" button → navigates to trace detail page
- Page shows "Trace not found" error

**Debug Steps:**
1. Check what URL is generated when clicking "View"
2. Verify trace ID is passed correctly in the router.push
3. Test the backend endpoint `GET /api/traces/:id` with a real trace ID from the database
4. Check if the traceId param is being read correctly in the page component

**Current implementation:**
- File: `/root/.openclaw/workspace/shelfzone-web/src/app/dashboard/agent-trace/trace/[traceId]/page.tsx`
- Router call: `router.push(\`/dashboard/agent-trace/trace/${trace.id}\`)`

**Likely causes:**
- Route param mismatch (`[traceId]` vs `[id]`)
- API endpoint URL mismatch
- Backend returning wrong data structure

**Fix:**
- Debug the navigation URL
- Verify API endpoint returns proper trace data
- Test with real trace IDs from database
- Ensure ReactFlow graph renders when data exists

**Files to check:**
- `/root/.openclaw/workspace/shelfzone-web/src/app/dashboard/agent-trace/trace/[traceId]/page.tsx`
- `/root/.openclaw/workspace/shelfzone-web/src/hooks/use-traces.ts`
- `/root/.openclaw/workspace/shelfzone-backend/src/modules/agent-portal/trace.controller.ts` (or similar)

---

## Issue 3: Agent Detail Panel - Empty Conversation & Raw Logs

**Problem:**
- Click agent badge → side panel opens
- Cost & Usage tab shows data ✓
- Conversation tab says "No conversation" ✗
- Raw Logs shows nothing ✗

**Analysis:**
- Cost & Usage shows data = trace_sessions exist
- Empty conversations = session_events are empty or not queried correctly

**Backend check:**
The backend DOES create session_events (verified in `gateway.service.ts`):
- `agent:thinking`
- `agent:tool_call`
- `agent:completion`
- etc.

**Likely causes:**
1. Frontend query is using wrong sessionId
2. Backend endpoint returns wrong structure
3. Session events ARE being created but query filters them out
4. Event type mismatch between backend and frontend

**Debug:**
1. Run SQL query: `SELECT COUNT(*), type FROM session_events GROUP BY type;`
2. Check if events exist for recent Command Center usage
3. Verify frontend hook is passing correct sessionId
4. Check backend endpoint `/api/session-events?sessionId=...` returns data
5. Test with real session IDs from Cost & Usage tab (which works)

**Files to check:**
- `/root/.openclaw/workspace/shelfzone-web/src/components/agent-trace/conversation-tab.tsx`
- `/root/.openclaw/workspace/shelfzone-web/src/components/agent-trace/raw-logs-tab.tsx`
- `/root/.openclaw/workspace/shelfzone-web/src/hooks/use-session-events.ts`
- `/root/.openclaw/workspace/shelfzone-backend/src/modules/agent-portal/session-events.controller.ts` (or similar)

**If events don't exist:**
- Check Command Center streaming endpoint
- Verify it creates session_events for every message/action
- Event types needed: instruction, thinking, tool_call, completion, message_in, message_out

---

## Testing Checklist

### Issue 1 (Visual Tree):
- [ ] Org View shows proper tree with connecting lines
- [ ] Agent View shows proper tree with connecting lines
- [ ] Cards show photos, names, designations
- [ ] Agent badges appear below employee cards
- [ ] Tree is zoomable and pannable
- [ ] Dark mode works correctly
- [ ] Responsive on mobile/tablet

### Issue 2 (Trace Flow):
- [ ] Click "View" on any trace → navigates correctly
- [ ] Trace detail page shows correct data
- [ ] ReactFlow graph renders with agent nodes
- [ ] No "Trace not found" error
- [ ] Timeline shows events
- [ ] Stats display correctly (duration, cost, tokens, agents)

### Issue 3 (Conversation & Logs):
- [ ] Use Command Center to create a new conversation
- [ ] Click agent badge → panel opens
- [ ] Conversation tab shows messages/events
- [ ] Raw Logs tab shows event stream
- [ ] Export JSON button works
- [ ] Filters work in Raw Logs
- [ ] Cost & Usage still works (don't break it)

---

## Git Workflow

1. **Create feature branch:**
   ```bash
   cd /root/.openclaw/workspace/shelfzone-web
   git checkout develop
   git pull origin develop
   git checkout -b feature/fix-agent-trace-bugs
   ```

2. **Backend changes (if needed):**
   ```bash
   cd /root/.openclaw/workspace/shelfzone-backend
   git checkout develop
   git pull origin develop
   git checkout -b feature/fix-agent-trace-bugs
   ```

3. **Commit after each fix:**
   ```bash
   git add .
   git commit -m "fix(agent-trace): [description of fix]"
   git push origin feature/fix-agent-trace-bugs
   ```

4. **Ask Boss before merge:**
   - Do NOT merge to develop without approval
   - Test everything thoroughly first
   - Provide detailed test report

---

## Success Criteria

- All 3 issues fixed and tested
- No regressions in existing functionality
- Visual tree looks professional (like Linear/Vercel style)
- Trace flow navigation works perfectly
- Conversation & Raw Logs show real data
- Dark mode works on all views
- Code is clean and well-commented

---

## Notes

- Install ReactFlow if not already: `npm install reactflow` (in shelfzone-web)
- Check if there's an existing employee org chart to copy visual style from
- Test with REAL data (use Command Center to generate traces/events)
- Screenshot before/after for documentation
