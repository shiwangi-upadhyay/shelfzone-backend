import prisma from '../../../lib/prisma.js';
import { calculateSessionCost } from '../../../lib/cost-calculator.js';
import type { Prisma } from '@prisma/client';

interface LogSessionData {
  agentId: string;
  userId?: string;
  sessionKey?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: string;
  errorMessage?: string;
  inputPreview?: string;
  outputPreview?: string;
  metadata?: Record<string, unknown>;
}

export function logSession(data: LogSessionData): void {
  // Fire-and-forget — never blocks caller
  void (async () => {
    try {
      const agent = await prisma.agentRegistry.findUnique({
        where: { id: data.agentId },
        select: { id: true, model: true },
      });
      if (!agent) return;

      const totalTokens = data.inputTokens + data.outputTokens;
      const costInfo = calculateSessionCost(agent.model, data.inputTokens, data.outputTokens);

      const session = await prisma.agentSession.create({
        data: {
          agentId: data.agentId,
          userId: data.userId,
          sessionKey: data.sessionKey,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          totalTokens,
          latencyMs: data.latencyMs,
          cost: costInfo.totalCost,
          status: data.status,
          errorMessage: data.errorMessage,
          inputPreview: data.inputPreview,
          outputPreview: data.outputPreview,
          metadata: (data.metadata as unknown as Prisma.InputJsonValue) ?? undefined,
        },
      });

      // Cost ledger entry
      await prisma.agentCostLedger.create({
        data: {
          agentId: data.agentId,
          sessionId: session.id,
          model: agent.model,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          inputCostRate: costInfo.inputCost / (data.inputTokens || 1),
          outputCostRate: costInfo.outputCost / (data.outputTokens || 1),
          inputCost: costInfo.inputCost,
          outputCost: costInfo.outputCost,
          totalCost: costInfo.totalCost,
        },
      });

      // Upsert daily stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.agentDailyStats.upsert({
        where: { agentId_date: { agentId: data.agentId, date: today } },
        create: {
          agentId: data.agentId,
          date: today,
          totalSessions: 1,
          successCount: data.status === 'success' ? 1 : 0,
          errorCount: data.status === 'error' ? 1 : 0,
          timeoutCount: data.status === 'timeout' ? 1 : 0,
          totalInputTokens: data.inputTokens,
          totalOutputTokens: data.outputTokens,
          totalCost: costInfo.totalCost,
          avgLatencyMs: data.latencyMs,
          p95LatencyMs: data.latencyMs,
          uniqueUsers: data.userId ? 1 : 0,
        },
        update: {
          totalSessions: { increment: 1 },
          successCount: { increment: data.status === 'success' ? 1 : 0 },
          errorCount: { increment: data.status === 'error' ? 1 : 0 },
          timeoutCount: { increment: data.status === 'timeout' ? 1 : 0 },
          totalInputTokens: { increment: data.inputTokens },
          totalOutputTokens: { increment: data.outputTokens },
          totalCost: { increment: costInfo.totalCost },
        },
      });

      // Check budget thresholds
      const budgets = await prisma.agentBudget.findMany({
        where: {
          agentId: data.agentId,
          month: today.getMonth() + 1,
          year: today.getFullYear(),
        },
      });

      for (const budget of budgets) {
        const newSpend = budget.currentSpend + costInfo.totalCost;
        await prisma.agentBudget.update({
          where: { id: budget.id },
          data: { currentSpend: newSpend },
        });

        const percentage = (newSpend / budget.monthlyCapUsd) * 100;
        if (percentage >= 100 && budget.autoPauseEnabled && !budget.isPaused) {
          // Check if agent is critical
          if (agent) {
            const fullAgent = await prisma.agentRegistry.findUnique({
              where: { id: data.agentId },
              select: { isCritical: true },
            });
            if (fullAgent && !fullAgent.isCritical) {
              await prisma.agentRegistry.update({
                where: { id: data.agentId },
                data: { status: 'PAUSED' },
              });
              await prisma.agentBudget.update({
                where: { id: budget.id },
                data: { isPaused: true, pausedAt: new Date() },
              });
            }
          }
        }
      }
    } catch {
      // Fire-and-forget: silently ignore errors
    }
  })();
}

export async function getSession(id: string) {
  const session = await prisma.agentSession.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, name: true, model: true } },
      user: { select: { id: true, email: true } },
      costLedger: true,
    },
  });
  if (!session) throw { statusCode: 404, error: 'Not Found', message: 'Session not found' };
  return session;
}
