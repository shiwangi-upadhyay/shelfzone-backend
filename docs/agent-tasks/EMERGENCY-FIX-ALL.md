# EMERGENCY: Fix All Three Features NOW

**Priority:** CRITICAL - Boss is frustrated. No more excuses.

---

## The Problem

Boss says:
- ❌ Agent Directory: NO "Flow View" tab visible
- ❌ Agent Trace Org View: NO purple connecting lines
- ❌ Command Center: Throws errors when sending messages

Boss tried: Ctrl+Shift+R, incognito, cleared cache. NOTHING worked.

**Translation:** The code exists in files but ISN'T RENDERING in the browser.

---

## UIcraft Tasks

### Task 1: Fix Agent Directory Flow View Tab

**Issue:** Tab exists in code but NOT showing in browser.

**Likely cause:** React component error, build issue, or conditional rendering hiding it.

**Debug steps:**
```bash
cd /root/.openclaw/workspace/shelfzone-web

# Check the exact code structure
cat src/app/dashboard/agents/page.tsx | grep -A20 "TabsList"

# Check if ReactFlow import has issues
grep "import.*ReactFlow" src/components/agents/agent-flow-diagram.tsx
grep "import.*ReactFlow" src/components/agent-trace/org-tree-view.tsx
```

**Possible fixes:**
1. **If ReactFlow SSR issue:** Add dynamic import
   ```tsx
   import dynamic from 'next/dynamic';
   const AgentFlowDiagram = dynamic(() => import('@/components/agents/agent-flow-diagram'), { ssr: false });
   ```

2. **If tab is conditionally hidden:** Remove any conditions hiding the Flow View tab

3. **If component crashes:** Wrap in ErrorBoundary and check console

**Requirements:**
- Open http://157.10.98.227:3000/dashboard/agents in browser automation
- Verify "Flow View" tab is VISIBLE
- Click it and verify ReactFlow diagram renders
- Screenshot the working tab

### Task 2: Fix Org View Purple Connecting Lines

**Issue:** Cards show but NO lines connecting them.

**Likely causes:**
1. ReactFlow edges not rendering (SSR issue)
2. Edges exist but invisible (CSS issue)
3. Positions wrong (layout bug)

**Debug:**
```bash
cd /root/.openclaw/workspace/shelfzone-web
grep -A10 "const edges" src/components/agent-trace/org-tree-view.tsx | head -20
```

**Possible fixes:**
1. **Make edges MORE visible:**
   ```tsx
   style: {
     stroke: '#8b5cf6',
     strokeWidth: 5,  // Even thicker
   }
   ```

2. **Add dynamic import for ReactFlow:**
   ```tsx
   import dynamic from 'next/dynamic';
   const ReactFlow = dynamic(() => import('reactflow'), { ssr: false });
   ```

3. **Move reactflow CSS to _app or layout:**
   ```tsx
   // In src/app/layout.tsx
   import 'reactflow/dist/style.css';
   ```

**Requirements:**
- Open http://157.10.98.227:3000/dashboard/agent-trace
- Click "Org View" tab
- Verify PURPLE LINES connecting employee cards
- Screenshot the lines

---

## BackendForge Task

### Fix Command Center Error

**Issue:** Error when sending messages in Command Center.

**Debug:**
```bash
cd /root/.openclaw/workspace/shelfzone-backend

# Check recent errors
tail -100 backend-prod.log | grep -i "error\|Error" | tail -20

# Test the endpoint manually
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@shelfzone.com","password":"ShelfEx@2025"}' | jq -r '.accessToken')

curl -X POST http://localhost:3001/api/agent-gateway/instruct \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"c3ed83e4-80c9-47d7-9307-7dc130387094","instruction":"test"}' | jq '.'
```

**Possible issues:**
1. API key not set → need USE_SIMULATION=true in backend
2. Agent validation failing
3. Duplicate trace creation
4. Database constraint violations

**Fixes:**
1. **Enable simulation mode (bypass Anthropic API):**
   ```bash
   # In backend .env
   USE_SIMULATION=true
   ```

2. **Fix duplicate traces:** Add unique constraint or dedupe logic

3. **Better error handling:** Return clear error messages

**Requirements:**
- Test sending a message in Command Center
- Message should process without errors
- Response should appear in chat
- NO duplicate agents in activity log

---

## TestRunner Task

### Verify Everything Works

**After UIcraft and BackendForge finish:**

1. **Clear everything:**
   ```bash
   cd /root/.openclaw/workspace/shelfzone-web
   rm -rf .next
   npm run build
   pkill -f "next start"
   npm start
   ```

2. **Test Agent Directory:**
   - Open http://157.10.98.227:3000/dashboard/agents
   - Take screenshot showing "Flow View" tab
   - Click Flow View
   - Take screenshot showing ReactFlow diagram
   - Verify: User node, SHIWANGI node, 7 sub-agent nodes, animated arrows

3. **Test Org View:**
   - Open http://157.10.98.227:3000/dashboard/agent-trace
   - Take screenshot showing purple lines between cards
   - Try dragging a card
   - Try department filter
   - Verify: Lines are VISIBLE and colored

4. **Test Command Center:**
   - Open http://157.10.98.227:3000/dashboard/agents/command
   - Send test message: "Hello, test"
   - Wait for response
   - Take screenshot of working chat
   - Verify: NO errors, NO duplicates, response appears

5. **Create report with:**
   - ✅ or ❌ for each feature
   - Screenshots of all three working
   - Exact error messages if anything fails

---

## Success Criteria

**ALL THREE must work:**
- ✅ Flow View tab visible and diagram renders
- ✅ Purple lines visible between Org View cards
- ✅ Command Center sends messages without errors

**Proof required:**
- Screenshots showing each feature working
- No errors in browser console
- No errors in backend logs

---

## Branch

Work in: `feature/fix-agent-trace-bugs`

Do NOT create new branches.

---

## Timeline

- UIcraft: 30 minutes
- BackendForge: 20 minutes
- TestRunner: 15 minutes (after others complete)

**Total: ~1 hour maximum**

---

**Boss wants PROOF, not claims. Show working screenshots or admit it's broken and fix it.**
