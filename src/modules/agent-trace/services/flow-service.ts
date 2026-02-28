import prisma from '../../../lib/prisma.js';

interface FlowNode {
  id: string;
  agentId: string;
  agentName: string;
  cost: number;
  duration: number;
  status: string;
}

interface FlowEdge {
  from: string;
  to: string;
  label: string;
  type: string;
}

export async function buildFlowGraph(traceId: string) {
  const sessions = await prisma.traceSession.findMany({
    where: { taskTraceId: traceId },
    include: {
      agent: { select: { id: true, name: true } },
      events: {
        orderBy: { timestamp: 'asc' },
        select: {
          type: true,
          content: true,
          fromAgentId: true,
          toAgentId: true,
          cost: true,
          durationMs: true,
        },
      },
    },
    orderBy: { startedAt: 'asc' },
  });

  if (sessions.length === 0) {
    return { data: { nodes: [], edges: [] } };
  }

  // Build nodes from sessions (one node per unique agent)
  const agentNodes = new Map<string, FlowNode>();
  for (const s of sessions) {
    const existing = agentNodes.get(s.agentId);
    const cost = Number(s.cost);
    const duration = s.completedAt
      ? s.completedAt.getTime() - s.startedAt.getTime()
      : Date.now() - s.startedAt.getTime();

    if (existing) {
      existing.cost += cost;
      existing.duration += duration;
      if (s.status === 'error') existing.status = 'error';
    } else {
      agentNodes.set(s.agentId, {
        id: s.id,
        agentId: s.agentId,
        agentName: s.agent.name,
        cost,
        duration,
        status: s.status,
      });
    }
  }

  // Build edges from parent-child relationships and inter-agent events
  const edges: FlowEdge[] = [];
  const edgeSet = new Set<string>();

  // Parent-child delegation edges
  for (const s of sessions) {
    if (s.parentSessionId) {
      const parent = sessions.find((p) => p.id === s.parentSessionId);
      if (parent) {
        const key = `${parent.agentId}->${s.agentId}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({
            from: parent.agentId,
            to: s.agentId,
            label: s.instruction?.slice(0, 80) ?? 'delegation',
            type: 'delegation',
          });
        }
      }
    }
  }

  // Inter-agent message edges from events
  for (const s of sessions) {
    for (const e of s.events) {
      if (e.fromAgentId && e.toAgentId && e.fromAgentId !== e.toAgentId) {
        const key = `${e.fromAgentId}->${e.toAgentId}:${e.type}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({
            from: e.fromAgentId,
            to: e.toAgentId,
            label: e.content?.slice(0, 80) ?? e.type,
            type: e.type,
          });
        }
      }
    }
  }

  return {
    data: {
      nodes: Array.from(agentNodes.values()),
      edges,
    },
  };
}
