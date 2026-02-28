import prisma from '../../lib/prisma.js';
import { IngestSessionInput } from './ingest.schemas.js';
import { Prisma } from '@prisma/client';

/**
 * Find or create an agent by name. If not found, auto-register as EXTERNAL type.
 */
async function resolveAgent(name: string, model: string, createdBy: string) {
  let agent = await prisma.agentRegistry.findUnique({ where: { name } });
  if (!agent) {
    // Auto-register unknown agents (e.g. from OpenClaw sessions)
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    agent = await prisma.agentRegistry.create({
      data: {
        name,
        slug: `${slug}-${Date.now()}`,
        type: 'WORKFLOW',
        status: 'ACTIVE',
        model,
        createdBy,
        description: `Auto-registered from ingestion (${model})`,
      },
    });
  }
  return agent;
}

/**
 * Ingest a full session (with optional sub-agent delegation chain).
 * Creates TaskTrace + TraceSession(s).
 */
export async function ingestSession(ownerId: string, input: IngestSessionInput) {
  const masterAgent = await resolveAgent(input.agentName, input.model, ownerId);
  const startedAt = input.timestamp ? new Date(input.timestamp) : new Date();
  const completedAt = input.durationMs
    ? new Date(startedAt.getTime() + input.durationMs)
    : input.status !== 'running' ? new Date() : null;

  // Calculate totals including sub-agents
  const subAgents = input.subAgents ?? [];
  const totalCost = input.cost + subAgents.reduce((s, a) => s + a.cost, 0);
  const totalTokens = input.tokensIn + input.tokensOut +
    subAgents.reduce((s, a) => s + a.tokensIn + a.tokensOut, 0);

  return prisma.$transaction(async (tx) => {
    // 1. Create TaskTrace
    const taskTrace = await tx.taskTrace.create({
      data: {
        ownerId,
        masterAgentId: masterAgent.id,
        instruction: input.taskDescription,
        status: input.status === 'running' ? 'running' : input.status === 'success' ? 'completed' : 'failed',
        totalCost: new Prisma.Decimal(totalCost.toFixed(4)),
        totalTokens,
        agentsUsed: 1 + subAgents.length,
        startedAt,
        completedAt: input.status !== 'running' ? (completedAt ?? new Date()) : null,
      },
    });

    // 2. Create master session
    const masterSession = await tx.traceSession.create({
      data: {
        taskTraceId: taskTrace.id,
        agentId: masterAgent.id,
        instruction: input.instruction ?? input.taskDescription,
        status: input.status,
        modelUsed: input.model,
        sessionType: input.sessionType,
        cost: new Prisma.Decimal(input.cost.toFixed(4)),
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
        durationMs: input.durationMs ?? null,
        startedAt,
        completedAt,
      },
    });

    // 3. Create sub-agent sessions (delegation chain)
    const childSessions = [];
    for (const sub of subAgents) {
      const subAgent = await resolveAgent(sub.agentName, sub.model, ownerId);
      const subStartedAt = startedAt; // approximate
      const subCompletedAt = sub.durationMs
        ? new Date(subStartedAt.getTime() + sub.durationMs)
        : sub.status !== 'running' ? new Date() : null;

      const child = await tx.traceSession.create({
        data: {
          taskTraceId: taskTrace.id,
          agentId: subAgent.id,
          parentSessionId: masterSession.id,
          delegatedBy: masterAgent.id,
          instruction: sub.instruction ?? `Delegated by ${input.agentName}`,
          status: sub.status,
          modelUsed: sub.model,
          sessionType: input.sessionType,
          cost: new Prisma.Decimal(sub.cost.toFixed(4)),
          tokensIn: sub.tokensIn,
          tokensOut: sub.tokensOut,
          durationMs: sub.durationMs ?? null,
          startedAt: subStartedAt,
          completedAt: subCompletedAt,
        },
      });
      childSessions.push(child);
    }

    return {
      taskTraceId: taskTrace.id,
      masterSessionId: masterSession.id,
      childSessionIds: childSessions.map(c => c.id),
      totalCost: Number(taskTrace.totalCost),
      totalTokens: taskTrace.totalTokens,
      agentsUsed: taskTrace.agentsUsed,
    };
  });
}
