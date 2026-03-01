# Task: Fix Org View - Connecting Lines & Layout

**Agent:** UIcraft  
**Priority:** CRITICAL  
**Branch:** feature/fix-agent-trace-bugs

---

## Problems

1. **NO connecting lines between cards** - cards are there but not connected
2. **Cards too far apart** - not arranged as a proper tree
3. **Cards not draggable** - should be able to drag nodes
4. **Department filter doesn't work** - breaks the tree

---

## Required Fixes

### 1. Add Visible Connecting Lines

**Problem:** ReactFlow edges exist in code but not rendering visibly.

**Possible causes:**
- Edge styling invisible (stroke color matches background)
- Edges not in DOM
- Source/target positions wrong

**Fix:**
```typescript
// Make edges VERY visible
const edges: Edge[] = [{
  id: `${parentId}-${childId}`,
  source: parentId,
  target: childId,
  type: 'smoothstep',  // or 'step' or 'straight'
  style: {
    stroke: '#8b5cf6',  // Purple - highly visible
    strokeWidth: 3,     // Thick line
    strokeDasharray: '5,5',
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#8b5cf6',
    width: 20,
    height: 20,
  },
  animated: false,  // Start without animation, add later
}];
```

**Debug:**
- Check browser DevTools → Elements → look for `.react-flow__edge` elements
- Check if edges array has items: `console.log('edges:', edges)`
- Check if source/target IDs match node IDs

### 2. Fix Layout - Cards Too Far Apart

**Problem:** Current position calculation spreads nodes too far.

**Current code (line ~110 in org-tree-view.tsx):**
```typescript
position: { x: level * levelWidth, y: yOffset },
yOffset += levelHeight;
```

This is WRONG. It positions nodes vertically in a list.

**Correct layout algorithm:**

```typescript
interface TreeNode {
  id: string;
  children: TreeNode[];
  x: number;
  y: number;
  width: number;
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 120;
const HORIZONTAL_SPACING = 50;
const VERTICAL_SPACING = 150;

function layoutTree(node: TreeNode, depth: number = 0): number {
  // Leaf node
  if (node.children.length === 0) {
    node.y = depth * VERTICAL_SPACING;
    return NODE_WIDTH;
  }
  
  // Layout children first (post-order)
  let childX = 0;
  for (const child of node.children) {
    const childWidth = layoutTree(child, depth + 1);
    child.x = childX + childWidth / 2;
    childX += childWidth + HORIZONTAL_SPACING;
  }
  
  // Parent centered above children
  const totalWidth = childX - HORIZONTAL_SPACING;
  const leftmost = node.children[0].x;
  const rightmost = node.children[node.children.length - 1].x;
  
  node.x = (leftmost + rightmost) / 2;
  node.y = depth * VERTICAL_SPACING;
  
  return totalWidth;
}

// Shift entire tree to avoid negative coordinates
function shiftTree(node: TreeNode, offsetX: number) {
  node.x += offsetX;
  node.children.forEach(child => shiftTree(child, offsetX));
}

// After layout, find minimum X
function findMinX(node: TreeNode): number {
  let min = node.x;
  node.children.forEach(child => {
    min = Math.min(min, findMinX(child));
  });
  return min;
}
```

**Use this to position nodes:**
```typescript
const root = buildTreeFromEmployees(employees);
layoutTree(root, 0);
const minX = findMinX(root);
shiftTree(root, -minX + 100);  // 100px left padding
```

### 3. Make Nodes Draggable

**In ReactFlow props:**
```typescript
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  nodesDraggable={true}  // ← ADD THIS
  nodesConnectable={false}
  elementsSelectable={true}
  // ... rest
/>
```

**Also allow manual repositioning:**
```typescript
const [nodes, setNodes] = useState<Node[]>(initialNodes);

const onNodesChange = useCallback(
  (changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  },
  []
);

<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}  // ← ADD THIS
  // ...
/>
```

### 4. Fix Department Filter

**Problem:** Filter breaks parent-child relationships.

**Current approach (WRONG):**
```typescript
// Filters employees BEFORE building tree
const filtered = employees.filter(e => e.department === selectedDept);
// Then builds tree from filtered list
// Result: orphaned nodes (children without parents)
```

**Correct approach:**
```typescript
// 1. Build FULL tree from ALL employees
const fullTree = buildTree(employees);

// 2. Filter which BRANCHES to show
function shouldShowBranch(node: TreeNode, filter: string): boolean {
  if (filter === 'all') return true;
  
  // Show if this node matches
  if (node.department === filter) return true;
  
  // Show if any child/descendant matches
  return node.children.some(child => shouldShowBranch(child, filter));
}

// 3. Filter nodes and edges for rendering
const visibleNodeIds = new Set<string>();

function collectVisibleNodes(node: TreeNode, filter: string) {
  if (shouldShowBranch(node, filter)) {
    visibleNodeIds.add(node.id);
    node.children.forEach(child => collectVisibleNodes(child, filter));
  }
}

collectVisibleNodes(fullTree, departmentFilter);

const visibleNodes = nodes.filter(n => visibleNodeIds.has(n.id));
const visibleEdges = edges.filter(e => 
  visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
);

<ReactFlow nodes={visibleNodes} edges={visibleEdges} ... />
```

---

## File to Fix

`src/components/agent-trace/org-tree-view.tsx`

---

## Testing Checklist

- [ ] **Visible connecting lines** - purple/blue dashed lines between parent-child cards
- [ ] **Proper tree layout** - CEO at top center, dept heads side-by-side below
- [ ] **Compact spacing** - cards close enough to see relationships
- [ ] **Draggable nodes** - can click and drag cards
- [ ] **Department filter works** - shows only that branch (with parents preserved)
- [ ] **"All Departments" shows full tree**
- [ ] **Zoom/pan works**
- [ ] **MiniMap shows tree structure**
- [ ] **Dark mode looks good**

---

## Example of Fixed Output

```
                [Gaurav Sethi - CEO]
                        |
                        |
                [Rajmani Shukla - Tech Lead]
                        |
        +---------------+---------------+---------------+
        |               |               |               |
    [Subha]        [Deepanjali]    [Siddiq]        [Jayant]
  Development         Data          AI & CV          UX/UI
        |               |               |               |
    +---+---+       +---+---+       +---+---+           |
    |   |   |       |       |       |   |   |           |
  [T1][T2][T3]    [T4]    [T5]    [T6][T7][T8]        [T9]
```

**With purple dashed lines connecting all parent-child relationships.**

---

**PRIORITY: Get the connecting lines visible first. Then fix layout. Then fix filter.**
