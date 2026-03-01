# Task: Fix Org Tree Layout - Side-by-Side Visual Tree

**Agent:** UIcraft  
**Priority:** CRITICAL  
**Branch:** feature/fix-agent-trace-bugs (DO NOT CREATE NEW BRANCH)  
**Deadline:** ASAP

---

## Problem

Current OrgTreeView shows employees one-below-another (vertical list).  
Boss wants SIDE-BY-SIDE layout like a family tree / org chart.

**Current broken code:**
```typescript
// OrgTreeView line ~110
position: { x: level * levelWidth, y: yOffset },
yOffset += levelHeight;
```

This puts ALL nodes vertically. Level only controls X offset slightly.

---

## Required Layout

```
                    [CEO - Gaurav Sethi]
                            |
                            |
                [Head of Ops - Rajmani Shukla]
                            |
        +-------------------+-------------------+-------------------+
        |                   |                   |                   |
    [Subhro]            [Prabal]           [Siddique]          [Jayant]
   Development         AI & CV             AI & CV              UX/UI
        |                   |                   |                   |
    +---+---+           +---+---+           +---+---+               |
    |   |   |           |   |   |           |   |   |               |
  [T1][T2][T3]        [T4][T5][T6]        [T7][T8][T9]           [T10]
```

**Key requirements:**
- CEO at TOP CENTER
- Children SIDE-BY-SIDE below parent
- Vertical lines down from parent
- Horizontal lines connecting siblings
- Cards with proper spacing
- Zoomable, pannable ReactFlow

---

## Algorithm Needed

### Step 1: Build hierarchy from manager_id

**Problem:** Database has NO manager_id relationships (all NULL).

**Solution:** Use designation levels to infer hierarchy:
- Level 10 (CEO) → top
- Level 8 (Tech Lead) → below CEO
- Level 7 (Department heads) → below Tech Lead
- Level 5-6 (Seniors) → below department heads
- Level 4 (Juniors) → below seniors

OR wait for DataArchitect to populate manager_id field.

### Step 2: Calculate positions (side-by-side)

**Correct algorithm:**

```typescript
interface TreeNode {
  id: string;
  children: TreeNode[];
  x: number;
  y: number;
  width: number;
}

function calculatePositions(root: TreeNode, levelHeight = 150) {
  // Post-order traversal: position children first
  function positionSubtree(node: TreeNode, depth: number): number {
    const childY = (depth + 1) * levelHeight;
    
    if (node.children.length === 0) {
      // Leaf node: default width
      node.y = depth * levelHeight;
      node.x = 0; // Will be adjusted later
      return 200; // Node width
    }
    
    // Position all children
    let childXOffset = 0;
    for (const child of node.children) {
      const childWidth = positionSubtree(child, depth + 1);
      child.x = childXOffset + childWidth / 2;
      childXOffset += childWidth + 50; // 50px gap between siblings
    }
    
    // Parent centered above children
    const totalWidth = childXOffset - 50;
    node.x = totalWidth / 2;
    node.y = depth * levelHeight;
    
    return totalWidth;
  }
  
  positionSubtree(root, 0);
  
  // Center the tree
  const minX = findMinX(root);
  shiftTree(root, -minX + 100); // 100px left padding
}
```

### Step 3: Create edges with proper routing

```typescript
edges.push({
  id: `${parentId}-${childId}`,
  source: parentId,
  target: childId,
  type: 'smoothstep',
  style: { 
    stroke: 'hsl(var(--border) / 0.4)', 
    strokeWidth: 1.5, 
    strokeDasharray: '5,5' 
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: 'hsl(var(--border) / 0.4)',
  },
});
```

---

## Files to Modify

**Primary:**
- `/root/.openclaw/workspace/shelfzone-web/src/components/agent-trace/org-tree-view.tsx`

**Replace the entire `useMemo` block that builds nodes/edges.**

---

## Testing Checklist

- [ ] CEO node at top center
- [ ] Department heads side-by-side below CEO/Head of Ops
- [ ] Team members side-by-side below their department head
- [ ] Vertical lines from parent to children
- [ ] Proper spacing (not overlapping)
- [ ] Cards show avatar, name, designation
- [ ] Agent badges below each card
- [ ] Zoomable and pannable
- [ ] Dark mode works
- [ ] No horizontal scrolling needed (tree fits in viewport when zoomed out)

---

## Example Reference

Look at typical org chart libraries:
- https://github.com/dabeng/react-orgchart
- https://reactflow.dev/examples/layout/dagre
- D3.js tree layout

The layout algorithm is the CRITICAL part. Get that right first, then worry about styling.

---

## Git Workflow

```bash
cd /root/.openclaw/workspace/shelfzone-web
git checkout feature/fix-agent-trace-bugs
# Make changes to org-tree-view.tsx
git add src/components/agent-trace/org-tree-view.tsx
git commit -m "fix(agent-trace): Implement side-by-side tree layout for Org View"
git push origin feature/fix-agent-trace-bugs
```

**DO NOT CREATE A NEW BRANCH. Use existing feature/fix-agent-trace-bugs.**

---

## Success Criteria

Boss can open http://157.10.98.227:3000/dashboard/agent-trace and see:
- ✅ Visual tree (not a list)
- ✅ CEO at top center
- ✅ Children side-by-side below parents
- ✅ Proper spacing and layout
- ✅ Clickable agent badges
- ✅ Professional org-chart look

---

**Priority:** CRITICAL - Boss is frustrated. Get this RIGHT.
