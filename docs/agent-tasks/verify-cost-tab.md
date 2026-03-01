# Task: Verify Cost Tab Data (Quick Check)

**Agent:** BackendForge  
**Priority:** MEDIUM  
**Branch:** feature/fix-agent-trace-bugs (DO NOT CREATE NEW BRANCH)

---

## Issue

Boss reported Cost & Usage tab is blank/empty.  
It WAS working before.  

**Root cause found:** Backend crashed (SIGTERM) and was restarted.

---

## Task

### 1. Verify backend endpoint works

Test the agent stats endpoint:

```bash
TOKEN=$(curl -s -X POST http://157.10.98.227:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@shelfzone.com", "password": "ShelfEx@2025"}' | jq -r '.accessToken')

AGENT_ID="c3ed83e4-80c9-47d7-9307-7dc130387094"  # UIcraft

curl -s "http://157.10.98.227:3001/api/agents/$AGENT_ID/stats" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Expected:** Should return stats object with:
- totalSessions
- avgCost
- totalTokens
- errorRate
- costByDay array

### 2. Check frontend CostTab component

File: `/root/.openclaw/workspace/shelfzone-web/src/components/agent-trace/cost-tab.tsx`

**Current code (line 13-15):**
```typescript
if (!stats) {
  return <div className="p-4 text-sm text-muted-foreground">No stats available</div>;
}
```

**Possible issue:** If agentId is null, the hook won't query. Check if:
```typescript
const { data: stats, isLoading, error } = useAgentStats(agentId);

// Should also check:
if (!agentId) {
  return <div className="p-4 text-sm text-muted-foreground">No agent selected</div>;
}
```

### 3. Check useAgentStats hook

File: `/root/.openclaw/workspace/shelfzone-web/src/hooks/use-agent-stats.ts`

Verify the hook is enabled only when agentId exists:
```typescript
export function useAgentStats(agentId: string | null) {
  return useQuery({
    queryKey: ['agent-stats', agentId],
    queryFn: async () => {
      const res = await api.get(`/api/agents/${agentId}/stats`);
      return res.data as AgentStats;
    },
    enabled: !!agentId,  // ← Make sure this is present
  });
}
```

### 4. Test in browser

1. Open http://157.10.98.227:3000/dashboard/agent-trace
2. Click any agent badge
3. Side panel opens
4. Switch to "Cost & Usage" tab
5. Should show:
   - 4 stat cards (Total Cost, Total Tokens, Sessions, Error Rate)
   - Bar chart with last 7 days
   
**If blank:**
- Open browser console (F12)
- Check for errors
- Check Network tab for failed API calls

---

## Expected Outcome

- ✅ Backend endpoint returns valid stats
- ✅ Frontend hook queries correctly
- ✅ Cost tab renders data
- ❌ No "No stats available" message when agent HAS stats

---

## If Still Broken

Check if the problem is:
1. **agentId is null** - Agent detail panel not passing correct agentId
2. **Backend returns empty data** - No sessions exist for this agent
3. **Frontend not unwrapping response** - Check if backend returns `{ data: {...} }` or just `{...}`

---

## Git (If Changes Needed)

```bash
cd /root/.openclaw/workspace/shelfzone-web
git checkout feature/fix-agent-trace-bugs

# Make fixes to cost-tab.tsx or use-agent-stats.ts

git add .
git commit -m "fix(agent-trace): Add null check for agentId in Cost tab"
git push origin feature/fix-agent-trace-bugs
```

---

## Success Criteria

- [ ] Backend /api/agents/:id/stats returns data
- [ ] Frontend Cost tab shows 4 stat cards
- [ ] Bar chart renders with data
- [ ] No "No stats available" when agent has activity
- [ ] Boss can see cost data in the panel

---

**Note:** This is likely a simple null check or the backend restart fixed it already.
