# Task: Fix Agent Trace Page - Final Requirements

**Agent:** UIcraft  
**Priority:** CRITICAL  
**Branch:** feature/fix-agent-trace-bugs (DO NOT CREATE NEW BRANCH)  
**Deadline:** ASAP

---

## Requirements from Boss

### ORG VIEW - Pure Org Chart (NO Agents)

**What to show:**
- Visual tree of company hierarchy ONLY
- CEO at top center
- Lines down to Rajmani (Head of Ops)
- Lines down to 4 department heads (side by side)
- Lines down to team members under each department head

**Each person card shows:**
- Name
- Designation
- Department

**NO agent badges. NO agent information. Pure people hierarchy.**

**Department filter:**
- Dropdown to select department
- When "Development" selected → shows only that branch (Subha + her team)
- When "Data" selected → shows only that branch (Deepanjali + her team)
- When "All" selected → shows full tree

**Visual requirements:**
- ReactFlow or tree library
- Cards connected by VISIBLE LINES (dashed, arrows)
- Side-by-side layout (NOT top-to-bottom list)
- Zoomable, pannable
- MiniMap

---

### AGENT VIEW - Agents Only

**What to show:**
- ONLY employees who own agents
- Each employee card → line down to master agent → lines down to sub-agents

**Employee card shows:**
- Name
- Department

**Agent nodes show:**
- Emoji
- Name
- Model
- Status (color-coded)
- Cost today

**Visual requirements:**
- Tree structure: Employee at top → agent(s) below
- Multiple employees side-by-side if they're in the same department
- Connected with VISIBLE LINES
- Zoomable, pannable
- MiniMap

**Department filter:**
- Works same as Org View
- Filter by department to see only that department's agents
- "Development" → shows only Subha's agents
- "All" → shows all employees with agents

---

## Current Code Issues

### 1. OrgTreeView - Remove Agent Badges

File: `/root/.openclaw/workspace/shelfzone-web/src/components/agent-trace/org-tree-view.tsx`

**Current code (WRONG):**
```typescript
{/* Agent badges */}
{data.agents.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-2">
    {data.agents.map((agent) => (
      <button ...>🤖 {agent.name}</button>
    ))}
  </div>
)}
```

**Required change:**
```typescript
// REMOVE the entire agent badges section
// Show ONLY: name, designation, department
```

**Employee card should be:**
```typescript
<div className="bg-card border border-border/60 rounded-lg p-3 shadow-sm min-w-[180px]">
  {/* Avatar + Name */}
  <div className="flex items-center gap-2.5 mb-2">
    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
      {initials}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{data.name}</p>
      <p className="text-[10px] text-muted-foreground truncate">{data.designation}</p>
    </div>
  </div>
  
  {/* Department */}
  <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/30">
    {data.department}
  </div>
</div>
```

NO stats. NO agent badges. Pure people card.

---

### 2. AgentTreeView - Show Employee → Agent Hierarchy

File: `/root/.openclaw/workspace/shelfzone-web/src/components/agent-trace/agent-tree-view.tsx`

**Current code is close but needs refinement.**

**Structure needed:**
```
[Employee Card]
      |
      |
  [Agent Node]
      |
   +--+--+
   |     |
[Sub1] [Sub2]
```

**Employee card (simpler than Org View):**
```typescript
<div className="bg-card border border-border/60 rounded-lg p-2.5 shadow-sm min-w-[140px]">
  <div className="flex items-center gap-2">
    <div className="h-7 w-7 rounded-full bg-muted ...">
      {initials}
    </div>
    <div>
      <p className="text-xs font-medium">{data.name}</p>
      <p className="text-[9px] text-muted-foreground">{data.department}</p>
    </div>
  </div>
</div>
```

**Agent node (keep existing):**
```typescript
<button className="border rounded-lg p-2.5 shadow-sm min-w-[140px] ...">
  <div className="flex items-center gap-2">
    <span className="text-base">{emoji}</span>
    <span className="text-xs font-semibold">{name}</span>
  </div>
  <div className="text-[9px] font-mono">{model}</div>
  <div className="text-[10px] font-mono">${cost}</div>
</button>
```

---

### 3. Fix Department Filter

File: `/root/.openclaw/workspace/shelfzone-web/src/components/agent-trace/agent-map.tsx`

**Current issue:** Filter doesn't actually filter the tree.

**The problem:**
```typescript
// Current code filters employees array before passing to OrgTreeView
const filteredDepartments = useMemo(() => {
  // ... filtering logic
}, [departments, departmentFilter, search]);

// Then passes: employees={[...filteredDepartments.values()].flat()}
```

**This breaks the tree structure** because parent-child relationships are lost.

**Correct approach:**

```typescript
// 1. Pass ALL employees to OrgTreeView
// 2. Let OrgTreeView build the FULL tree
// 3. Then FILTER which branches to RENDER

// In OrgTreeView:
function shouldRenderBranch(node: TreeNode, filter: string): boolean {
  if (filter === 'all') return true;
  
  // If this node or any descendant matches filter, render this branch
  if (node.department === filter) return true;
  
  // Check children recursively
  return node.children.some(child => shouldRenderBranch(child, filter));
}
```

**Then when rendering:**
```typescript
const visibleNodes = nodes.filter(node => {
  const treeNode = findNodeInTree(root, node.id);
  return shouldRenderBranch(treeNode, departmentFilter);
});

<ReactFlow nodes={visibleNodes} edges={visibleEdges} ... />
```

---

## Implementation Steps

### Step 1: Update OrgTreeView

File: `src/components/agent-trace/org-tree-view.tsx`

Changes:
- ✅ Remove agent badges section
- ✅ Simplify employee card (name, designation, department only)
- ✅ Remove totalCost, activeAgents props
- ✅ Remove onAgentClick handler
- ✅ Implement proper department filtering (render only matching branches)

### Step 2: Update AgentTreeView

File: `src/components/agent-trace/agent-tree-view.tsx`

Changes:
- ✅ Keep employee → agent hierarchy
- ✅ Show only employees who have agents
- ✅ Agent nodes show emoji, name, model, status, cost
- ✅ Implement department filtering
- ✅ Proper side-by-side layout for multiple employees

### Step 3: Update AgentMap (parent component)

File: `src/components/agent-trace/agent-map.tsx`

Changes:
- ✅ Pass full employee list to both views
- ✅ Pass departmentFilter as prop
- ✅ Let child components handle filtering
- ✅ Remove agent click handler from Org View
- ✅ Keep agent click handler only for Agent View

### Step 4: Update TraceFilters

File: `src/components/agent-trace/trace-filters.tsx`

Make sure department filter dropdown works correctly.

---

## Props Interface Updates

### OrgTreeView

```typescript
interface OrgTreeViewProps {
  employees: OrgEmployee[];
  departmentFilter: string;  // NEW: 'all' or department name
}

// REMOVED:
// - onAgentClick
// - Agent-related fields from employee cards
```

### AgentTreeView

```typescript
interface AgentTreeViewProps {
  employees: OrgEmployee[];
  departmentFilter: string;  // NEW
  onAgentClick: (agentId: string, agentName: string, status: string) => void;
}
```

---

## Testing Checklist

### Org View:
- [ ] Shows pure org chart (no agent badges)
- [ ] CEO at top center
- [ ] Department heads side-by-side
- [ ] Team members side-by-side under their head
- [ ] Each card shows: name, designation, department
- [ ] Visible connecting lines between nodes
- [ ] Department filter works (shows only that branch)
- [ ] "All Departments" shows full tree
- [ ] Zoomable, pannable
- [ ] Dark mode works

### Agent View:
- [ ] Shows only employees with agents
- [ ] Employee card → agent(s) below
- [ ] Agent nodes show: emoji, name, model, status, cost
- [ ] Visible connecting lines
- [ ] Multiple employees side-by-side
- [ ] Department filter works
- [ ] Click agent node → opens detail panel
- [ ] Zoomable, pannable
- [ ] Dark mode works

### Both Views:
- [ ] NOT a vertical list
- [ ] Side-by-side layout
- [ ] Proper tree structure
- [ ] ReactFlow controls work
- [ ] MiniMap visible

---

## Git Workflow

```bash
cd /root/.openclaw/workspace/shelfzone-web
git checkout feature/fix-agent-trace-bugs

# Make all changes
npm run build  # Verify it compiles

git add .
git commit -m "fix(agent-trace): Separate Org View (people only) from Agent View (agents only)"
git push origin feature/fix-agent-trace-bugs
```

---

## Success Criteria

Boss opens http://157.10.98.227:3000/dashboard/agent-trace and sees:

**Org View:**
- ✅ Pure org chart showing company hierarchy
- ✅ No agent information
- ✅ Department filter shows only that branch

**Agent View:**
- ✅ Only employees with agents
- ✅ Employee → agent tree structure
- ✅ Agent details visible
- ✅ Department filter works

**Both:**
- ✅ Visual tree with connecting lines
- ✅ Side-by-side layout (not list)
- ✅ Professional appearance

---

**DO NOT CREATE NEW BRANCH. Work in feature/fix-agent-trace-bugs.**

**PRIORITY: CRITICAL - Boss is waiting.**
