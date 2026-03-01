# Task: Agent Directory - Flow Visualization

**Agent:** UIcraft  
**Priority:** CRITICAL  
**Branch:** feature/fix-agent-trace-bugs

---

## Problem

Agent Directory currently shows agents as a flat list.

Boss wants a **FLOW DIAGRAM** showing how agents communicate with each other.

---

## Required Flow Visualization

**Show the communication path:**
```
User → SHIWANGI → (delegates to) → BackendForge
                → (delegates to) → UIcraft
                → (delegates to) → DataArchitect
                ← (reports back) ← BackendForge
User ← SHIWANGI
```

**Like a system architecture diagram:**
- User node at left
- SHIWANGI (master agent) in center
- Sub-agents (BackendForge, UIcraft, DataArchitect, etc.) around SHIWANGI
- Arrows showing direction of communication
- **Animated arrows** showing flow direction

---

## Requirements

### 1. Agent Nodes

**Each agent card shows:**
- Name
- Model (claude-opus-4-6, claude-sonnet-4-5, etc.)
- Role (Master Agent, Backend Developer, Frontend Developer, etc.)
- What it's good at (1-2 line description)

**Example:**
```
┌─────────────────────────┐
│ 🏗️ SHIWANGI            │
│ claude-sonnet-4-5       │
│ Master AI Architect     │
│ Delegates, coordinates, │
│ reports to Boss         │
└─────────────────────────┘
```

### 2. Communication Flow

**Show these relationships:**
- User → SHIWANGI (instruction)
- SHIWANGI → BackendForge (delegation)
- SHIWANGI → UIcraft (delegation)
- SHIWANGI → DataArchitect (delegation)
- SHIWANGI → ShieldOps (delegation)
- SHIWANGI → PortalEngine (delegation)
- SHIWANGI → TestRunner (delegation)
- SHIWANGI → DocSmith (delegation)
- BackendForge → SHIWANGI (report)
- UIcraft → SHIWANGI (report)
- etc.
- SHIWANGI → User (final report)

### 3. Visual Design

**Use ReactFlow:**
- Nodes: Agent cards
- Edges: Directional arrows (animated)
- Layout: Hierarchical (User → SHIWANGI → Sub-agents)
- Animation: Arrows flow in direction of communication
- Colors: Different colors for different agent types (master vs sub-agents)

**Edge styling:**
```typescript
{
  type: 'smoothstep',
  animated: true,  // ← Animated arrows
  style: {
    stroke: 'hsl(var(--primary))',
    strokeWidth: 2,
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: 'hsl(var(--primary))',
  },
}
```

### 4. Layout

**Suggested layout:**
```
                [User]
                  ↓
              [SHIWANGI]
                  ↓
         ┌────────┼────────┐
         ↓        ↓        ↓
    [BackendF] [UIcraft] [DataArch]
         ↓        ↓        ↓
    [ShieldOps] [Portal] [TestR] [DocSmith]
```

**Or radial layout with SHIWANGI in center:**
```
         [BackendForge]
              ↓
    [UIcraft] ← [SHIWANGI] → [DataArchitect]
              ↓
         [ShieldOps]
              ↓
          [TestRunner]
```

---

## Implementation

### File to Create/Modify

**New component:** `src/components/agents/agent-flow-diagram.tsx`

**Modify:** `src/app/dashboard/agents/page.tsx`

Add a toggle or tab: "List View" vs "Flow View"

### Code Structure

```typescript
'use client';

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Custom agent node
function AgentNode({ data }: { data: AgentNodeData }) {
  return (
    <div className="bg-card border-2 border-primary/20 rounded-lg p-4 min-w-[200px] shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{data.emoji}</span>
        <div>
          <h3 className="font-bold text-sm">{data.name}</h3>
          <p className="text-[10px] text-muted-foreground font-mono">{data.model}</p>
        </div>
      </div>
      <p className="text-xs font-semibold text-primary mb-1">{data.role}</p>
      <p className="text-[10px] text-muted-foreground">{data.description}</p>
    </div>
  );
}

const nodeTypes = { agent: AgentNode };

export function AgentFlowDiagram() {
  const nodes: Node[] = [
    {
      id: 'user',
      type: 'agent',
      position: { x: 400, y: 0 },
      data: {
        emoji: '👤',
        name: 'User (Boss)',
        model: 'human',
        role: 'Project Owner',
        description: 'Gives instructions, approves work',
      },
    },
    {
      id: 'shiwangi',
      type: 'agent',
      position: { x: 400, y: 150 },
      data: {
        emoji: '🏗️',
        name: 'SHIWANGI',
        model: 'claude-sonnet-4-5',
        role: 'Master AI Architect',
        description: 'Delegates tasks, coordinates team, reports to Boss',
      },
    },
    {
      id: 'backendforge',
      type: 'agent',
      position: { x: 100, y: 350 },
      data: {
        emoji: '⚙️',
        name: 'BackendForge',
        model: 'claude-opus-4-6',
        role: 'Backend Developer',
        description: 'APIs, databases, server logic',
      },
    },
    // Add all other agents...
  ];

  const edges: Edge[] = [
    {
      id: 'user-shiwangi',
      source: 'user',
      target: 'shiwangi',
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      label: 'instruction',
    },
    {
      id: 'shiwangi-backendforge',
      source: 'shiwangi',
      target: 'backendforge',
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'hsl(var(--chart-1))', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      label: 'delegate',
    },
    // Add all other edges...
  ];

  return (
    <div className="h-[700px] rounded-lg border border-border/60 bg-card">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

---

## Agent Data

**Get from AGENTS.md or hardcode:**

```typescript
const agents = [
  {
    id: 'shiwangi',
    name: 'SHIWANGI',
    emoji: '🏗️',
    model: 'claude-sonnet-4-5',
    role: 'Master AI Architect',
    description: 'Delegates tasks, coordinates team, reports to Boss',
  },
  {
    id: 'backendforge',
    name: 'BackendForge',
    emoji: '⚙️',
    model: 'claude-opus-4-6',
    role: 'Backend Developer',
    description: 'APIs, databases, server logic',
  },
  {
    id: 'uicraft',
    name: 'UIcraft',
    emoji: '🎨',
    model: 'claude-sonnet-4',
    role: 'Frontend Developer',
    description: 'React, UI components, styling',
  },
  {
    id: 'dataarchitect',
    name: 'DataArchitect',
    emoji: '🗄️',
    model: 'claude-opus-4-6',
    role: 'Database Architect',
    description: 'Schema design, migrations, data modeling',
  },
  {
    id: 'shieldops',
    name: 'ShieldOps',
    emoji: '🛡️',
    model: 'claude-opus-4-6',
    role: 'Security & DevOps',
    description: 'Security, deployment, infrastructure',
  },
  {
    id: 'portalengine',
    name: 'PortalEngine',
    emoji: '🚀',
    model: 'claude-opus-4-6',
    role: 'Agent Portal Developer',
    description: 'Agent management features',
  },
  {
    id: 'testrunner',
    name: 'TestRunner',
    emoji: '🧪',
    model: 'claude-sonnet-4',
    role: 'QA Engineer',
    description: 'Testing, verification, quality checks',
  },
  {
    id: 'docsmith',
    name: 'DocSmith',
    emoji: '📝',
    model: 'claude-haiku-4.5',
    role: 'Documentation Writer',
    description: 'Docs, logs, summaries',
  },
];
```

---

## Testing

- [ ] Flow diagram renders
- [ ] All 8 agents visible (+ User node)
- [ ] Arrows animated
- [ ] Arrows point in correct direction (User → SHIWANGI → sub-agents)
- [ ] Agent cards show name, model, role, description
- [ ] Zoomable, pannable
- [ ] MiniMap works
- [ ] Dark mode looks good

---

**This should look like a system architecture diagram showing how SHIWANGI coordinates the team.**
