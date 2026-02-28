import { prisma } from '../../lib/prisma.js';

// Track active simulations so we can cancel them
const activeSimulations = new Map<string, NodeJS.Timeout[]>();

export async function createTraceWithSession(
  ownerId: string,
  instruction: string,
  masterAgentId?: string,
) {
  // If no masterAgentId provided, find the first CHAT agent or any agent
  let agentId = masterAgentId;
  if (!agentId) {
    const agent = await prisma.agentRegistry.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    if (!agent) throw { statusCode: 400, error: 'Bad Request', message: 'No active agent found' };
    agentId = agent.id;
  }

  const trace = await prisma.taskTrace.create({
    data: {
      ownerId,
      masterAgentId: agentId,
      instruction,
      status: 'running',
    },
  });

  const session = await prisma.traceSession.create({
    data: {
      taskTraceId: trace.id,
      agentId,
      instruction,
      status: 'running',
    },
  });

  return { traceId: trace.id, sessionId: session.id, agentId };
}

export async function simulateAgentWork(traceId: string, masterSessionId: string, masterAgentId: string) {
  const timeouts: NodeJS.Timeout[] = [];

  const schedule = (ms: number, fn: () => Promise<void>) => {
    const t = setTimeout(async () => {
      try {
        // Check if trace is still running before inserting
        const trace = await prisma.taskTrace.findUnique({ where: { id: traceId } });
        if (!trace || trace.status === 'cancelled') return;
        if (trace.status === 'paused') {
          // Re-schedule for later
          schedule(2000, fn);
          return;
        }
        await fn();
      } catch (e) {
        console.error('Simulation error:', e);
      }
    }, ms);
    timeouts.push(t);
  };

  activeSimulations.set(traceId, timeouts);

  // 0s: trace started
  schedule(200, async () => {
    await prisma.sessionEvent.create({
      data: {
        sessionId: masterSessionId,
        type: 'trace:started',
        content: 'Task trace initiated',
        fromAgentId: masterAgentId,
        tokenCount: 0,
        cost: 0,
        metadata: {},
      },
    });
  });

  // 1s: thinking
  schedule(1000, async () => {
    await prisma.sessionEvent.create({
      data: {
        sessionId: masterSessionId,
        type: 'agent:thinking',
        content: 'Analyzing instruction and planning execution strategy...',
        fromAgentId: masterAgentId,
        tokenCount: 245,
        cost: 0.0037,
        durationMs: 820,
        metadata: { model: 'claude-opus-4-6' },
      },
    });
  });

  // 2s: delegation events — find sub-agents
  schedule(2000, async () => {
    const subAgents = await prisma.agentRegistry.findMany({
      where: { status: 'ACTIVE', id: { not: masterAgentId } },
      take: 3,
    });

    for (const sub of subAgents) {
      await prisma.sessionEvent.create({
        data: {
          sessionId: masterSessionId,
          type: 'agent:delegation',
          content: `Delegating sub-task to ${sub.name}`,
          fromAgentId: masterAgentId,
          toAgentId: sub.id,
          tokenCount: 180,
          cost: 0.0027,
          metadata: { delegatedAgent: sub.name, subTask: `Handle ${sub.type.toLowerCase()} operations` },
        },
      });

      // Create sub-sessions
      const subSession = await prisma.traceSession.create({
        data: {
          taskTraceId: traceId,
          agentId: sub.id,
          parentSessionId: masterSessionId,
          delegatedBy: masterAgentId,
          instruction: `Sub-task for ${sub.name}`,
          status: 'running',
        },
      });

      // 3-4s: sub-agent thinking
      const thinkDelay = 3000 + Math.random() * 1000;
      schedule(thinkDelay, async () => {
        await prisma.sessionEvent.create({
          data: {
            sessionId: subSession.id,
            type: 'agent:thinking',
            content: `${sub.name} analyzing delegated task...`,
            fromAgentId: sub.id,
            tokenCount: 320,
            cost: 0.0048,
            durationMs: 650,
            metadata: { model: 'claude-opus-4-6' },
          },
        });
      });

      // 4-5s: tool call
      schedule(4000 + Math.random() * 1000, async () => {
        await prisma.sessionEvent.create({
          data: {
            sessionId: subSession.id,
            type: 'agent:tool_call',
            content: `Executing database query`,
            fromAgentId: sub.id,
            tokenCount: 150,
            cost: 0.0023,
            durationMs: 340,
            metadata: { tool: 'prisma_query', args: { table: 'employees' } },
          },
        });
      });

      // 5-6s: tool result
      schedule(5500 + Math.random() * 1000, async () => {
        await prisma.sessionEvent.create({
          data: {
            sessionId: subSession.id,
            type: 'agent:tool_result',
            content: 'Query returned 42 records',
            fromAgentId: sub.id,
            tokenCount: 85,
            cost: 0.0013,
            durationMs: 120,
            metadata: { tool: 'prisma_query', resultSize: 42 },
          },
        });
      });

      // 6-7s: sub-agent completion
      schedule(6500 + Math.random() * 1500, async () => {
        await prisma.sessionEvent.create({
          data: {
            sessionId: subSession.id,
            type: 'agent:completion',
            content: `${sub.name} completed sub-task successfully`,
            fromAgentId: sub.id,
            tokenCount: 210,
            cost: 0.0032,
            durationMs: 450,
            metadata: { status: 'success' },
          },
        });
        await prisma.traceSession.update({
          where: { id: subSession.id },
          data: { status: 'completed', completedAt: new Date(), cost: 0.0143, tokensIn: 520, tokensOut: 295 },
        });
      });
    }

    // Update agents used count
    await prisma.taskTrace.update({
      where: { id: traceId },
      data: { agentsUsed: subAgents.length + 1 },
    });
  });

  // 7s: cost update
  schedule(7500, async () => {
    await prisma.sessionEvent.create({
      data: {
        sessionId: masterSessionId,
        type: 'cost:update',
        content: 'Running cost update',
        fromAgentId: masterAgentId,
        tokenCount: 0,
        cost: 0,
        metadata: { totalCost: 0.0389, totalTokens: 1845 },
      },
    });
  });

  // 8s: master agent message
  schedule(8000, async () => {
    await prisma.sessionEvent.create({
      data: {
        sessionId: masterSessionId,
        type: 'agent:message',
        content: 'All sub-agents have completed their tasks. Compiling final results...',
        fromAgentId: masterAgentId,
        tokenCount: 185,
        cost: 0.0028,
        durationMs: 380,
        metadata: {},
      },
    });
  });

  // 9s: trace completed
  schedule(9000, async () => {
    await prisma.sessionEvent.create({
      data: {
        sessionId: masterSessionId,
        type: 'trace:completed',
        content: 'Task completed successfully',
        fromAgentId: masterAgentId,
        tokenCount: 95,
        cost: 0.0014,
        metadata: { totalCost: 0.0452, totalTokens: 2130, duration: 9000 },
      },
    });

    await prisma.traceSession.update({
      where: { id: masterSessionId },
      data: { status: 'completed', completedAt: new Date(), cost: 0.0452, tokensIn: 1280, tokensOut: 850 },
    });

    await prisma.taskTrace.update({
      where: { id: traceId },
      data: { status: 'completed', completedAt: new Date(), totalCost: 0.0452, totalTokens: 2130 },
    });

    activeSimulations.delete(traceId);
  });
}

export async function cancelTrace(traceId: string, ownerId: string) {
  const trace = await prisma.taskTrace.findFirst({ where: { id: traceId, ownerId } });
  if (!trace) throw { statusCode: 404, error: 'Not Found', message: 'Trace not found' };
  if (trace.status === 'completed' || trace.status === 'cancelled')
    throw { statusCode: 400, error: 'Bad Request', message: `Trace is already ${trace.status}` };

  // Cancel simulation timeouts
  const timers = activeSimulations.get(traceId);
  if (timers) {
    timers.forEach(clearTimeout);
    activeSimulations.delete(traceId);
  }

  await prisma.traceSession.updateMany({
    where: { taskTraceId: traceId, status: 'running' },
    data: { status: 'cancelled', completedAt: new Date() },
  });

  return prisma.taskTrace.update({
    where: { id: traceId },
    data: { status: 'cancelled', completedAt: new Date() },
  });
}

export async function pauseTrace(traceId: string, ownerId: string) {
  const trace = await prisma.taskTrace.findFirst({ where: { id: traceId, ownerId } });
  if (!trace) throw { statusCode: 404, error: 'Not Found', message: 'Trace not found' };
  if (trace.status !== 'running')
    throw { statusCode: 400, error: 'Bad Request', message: 'Can only pause running traces' };

  return prisma.taskTrace.update({
    where: { id: traceId },
    data: { status: 'paused' },
  });
}

export async function resumeTrace(traceId: string, ownerId: string) {
  const trace = await prisma.taskTrace.findFirst({ where: { id: traceId, ownerId } });
  if (!trace) throw { statusCode: 404, error: 'Not Found', message: 'Trace not found' };
  if (trace.status !== 'paused')
    throw { statusCode: 400, error: 'Bad Request', message: 'Can only resume paused traces' };

  return prisma.taskTrace.update({
    where: { id: traceId },
    data: { status: 'running' },
  });
}

export async function getTraceStatus(traceId: string, ownerId: string) {
  const trace = await prisma.taskTrace.findFirst({
    where: { id: traceId, ownerId },
    include: {
      sessions: {
        include: {
          agent: { select: { id: true, name: true, type: true } },
          events: { orderBy: { timestamp: 'asc' } },
        },
        orderBy: { startedAt: 'asc' },
      },
      masterAgent: { select: { id: true, name: true, type: true } },
    },
  });

  if (!trace) throw { statusCode: 404, error: 'Not Found', message: 'Trace not found' };
  return trace;
}

export async function getSessionEventsAfter(traceId: string, afterTimestamp?: Date) {
  const sessions = await prisma.traceSession.findMany({
    where: { taskTraceId: traceId },
    select: { id: true },
  });

  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length === 0) return [];

  return prisma.sessionEvent.findMany({
    where: {
      sessionId: { in: sessionIds },
      ...(afterTimestamp ? { timestamp: { gt: afterTimestamp } } : {}),
    },
    include: {
      fromAgent: { select: { id: true, name: true } },
      toAgent: { select: { id: true, name: true } },
    },
    orderBy: { timestamp: 'asc' },
  });
}
