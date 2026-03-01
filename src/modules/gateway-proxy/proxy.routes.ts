import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { gatewayAuth } from '../../middleware/gateway-auth.js';
import { proxyChatRequest, proxyStreamRequest } from './proxy.service.js';
import prisma from '../../lib/prisma.js';
import { decrypt } from '../../lib/encryption.js';

async function resolveApiKey(userId: string): Promise<string> {
  const userKey = await prisma.userApiKey.findUnique({ where: { userId } });
  if (!userKey?.encryptedKey) throw Object.assign(new Error('No API key configured. Set one in Settings → API Keys.'), { statusCode: 400 });
  return decrypt(userKey.encryptedKey);
}

export default async function gatewayProxyRoutes(app: FastifyInstance) {
  /**
   * POST /api/gateway/v1/messages
   * Drop-in Anthropic API proxy. Send the same body you'd send to api.anthropic.com/v1/messages.
   * ShelfZone auto-logs everything.
   *
   * Headers:
   *   X-ShelfZone-Agent: agent name (optional, default "Unknown")
   *   X-ShelfZone-Task: task description (optional)
   *   X-ShelfZone-Parent-Session: parent trace session ID (optional, for delegation chains)
   *   X-ShelfZone-Session-Type: openclaw|command-center|external|gateway (optional)
   */
  app.post('/api/gateway/v1/messages', { preHandler: [gatewayAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.userId;
    const apiKey = await resolveApiKey(userId);
    const body = request.body as any;

    // If no agent header provided and user is admin, default to SHIWANGI (OpenClaw integration)
    let agentName = (request.headers['x-shelfzone-agent'] as string) || undefined;
    if (!agentName && userId === 'seed-admin-001') {
      agentName = 'SHIWANGI'; // Default for OpenClaw gateway calls
    }

    const meta = {
      userId,
      agentName,
      taskDescription: (request.headers['x-shelfzone-task'] as string) || undefined,
      parentSessionId: (request.headers['x-shelfzone-parent-session'] as string) || undefined,
      sessionType: (request.headers['x-shelfzone-session-type'] as string) || 'openclaw',
    };

    // Check if streaming requested
    if (body.stream) {
      const { stream, traceSessionId, taskTraceId } = await proxyStreamRequest(apiKey, body, meta);

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-ShelfZone-Trace-Session': traceSessionId,
        'X-ShelfZone-Task-Trace': taskTraceId,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'X-ShelfZone-Trace-Session, X-ShelfZone-Task-Trace',
      });

      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(value);
        }
      } finally {
        reply.raw.end();
      }
      return;
    }

    // Non-streaming
    const result = await proxyChatRequest(apiKey, body, meta);

    return reply
      .header('X-ShelfZone-Trace-Session', result.traceSessionId)
      .header('X-ShelfZone-Task-Trace', result.taskTraceId)
      .header('X-ShelfZone-Cost', result.cost.toString())
      .header('X-ShelfZone-Tokens-In', result.usage.inputTokens.toString())
      .header('X-ShelfZone-Tokens-Out', result.usage.outputTokens.toString())
      .send(result.response);
  });

  /**
   * GET /api/gateway/v1/models
   * List available models with pricing
   */
  app.get('/api/gateway/v1/models', { preHandler: [gatewayAuth] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const models = await prisma.modelPricing.findMany({ orderBy: { modelName: 'asc' } });
    return reply.send({
      data: models.map(m => ({
        model: m.modelName,
        provider: m.provider,
        pricing: {
          inputPerMillion: Number(m.inputPricePerMillion),
          outputPerMillion: Number(m.outputPricePerMillion),
          cacheInputPerMillion: Number(m.cacheInputPricePerMillion),
        },
      })),
    });
  });

  /**
   * GET /api/gateway/v1/usage
   * Real-time usage stats for current user
   */
  app.get('/api/gateway/v1/usage', { preHandler: [gatewayAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayStats, monthStats] = await Promise.all([
      prisma.traceSession.aggregate({
        where: { taskTrace: { ownerId: userId }, startedAt: { gte: today } },
        _sum: { cost: true, tokensIn: true, tokensOut: true },
        _count: true,
      }),
      prisma.traceSession.aggregate({
        where: {
          taskTrace: { ownerId: userId },
          startedAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) },
        },
        _sum: { cost: true, tokensIn: true, tokensOut: true },
        _count: true,
      }),
    ]);

    return reply.send({
      data: {
        today: {
          cost: Number(todayStats._sum.cost ?? 0),
          tokensIn: todayStats._sum.tokensIn ?? 0,
          tokensOut: todayStats._sum.tokensOut ?? 0,
          sessions: todayStats._count,
        },
        thisMonth: {
          cost: Number(monthStats._sum.cost ?? 0),
          tokensIn: monthStats._sum.tokensIn ?? 0,
          tokensOut: monthStats._sum.tokensOut ?? 0,
          sessions: monthStats._count,
        },
      },
    });
  });
}
