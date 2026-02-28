import { FastifyRequest, FastifyReply } from 'fastify';
import { instructSchema, traceParamsSchema } from './gateway.schemas.js';
import * as gatewayService from './gateway.service.js';

export async function instructHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = instructSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const { traceId, sessionId, agentId } = await gatewayService.createTraceWithSession(
      request.user!.userId,
      parsed.data.instruction,
      parsed.data.masterAgentId,
    );

    // Kick off async simulation (fire-and-forget)
    gatewayService.simulateAgentWork(traceId, sessionId, agentId).catch((err) => {
      console.error('Simulation failed:', err);
    });

    return reply.status(201).send({ data: { traceId, sessionId } });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply.status(e.statusCode ?? 500).send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function streamHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = traceParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  const { traceId } = parsed.data;

  // Verify ownership
  try {
    await gatewayService.getTraceStatus(traceId, request.user!.userId);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply.status(e.statusCode ?? 500).send({ error: e.error ?? 'Internal Error', message: e.message });
  }

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let lastTimestamp: Date | undefined;
  let completed = false;

  const poll = async () => {
    if (completed || reply.raw.destroyed) {
      clearInterval(intervalId);
      reply.raw.end();
      return;
    }

    try {
      const events = await gatewayService.getSessionEventsAfter(traceId, lastTimestamp);
      for (const event of events) {
        const payload = JSON.stringify({
          id: event.id,
          type: event.type,
          content: event.content,
          timestamp: event.timestamp,
          fromAgent: event.fromAgent,
          toAgent: event.toAgent,
          tokenCount: event.tokenCount,
          cost: event.cost,
          durationMs: event.durationMs,
          metadata: event.metadata,
        });
        reply.raw.write(`data: ${payload}\n\n`);
        lastTimestamp = event.timestamp;

        if (event.type === 'trace:completed') {
          completed = true;
        }
      }
    } catch (err) {
      console.error('SSE poll error:', err);
    }
  };

  const intervalId = setInterval(poll, 2000);
  // Initial poll immediately
  await poll();

  request.raw.on('close', () => {
    clearInterval(intervalId);
  });
}

export async function cancelHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = traceParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const trace = await gatewayService.cancelTrace(parsed.data.traceId, request.user!.userId);
    return reply.send({ data: trace });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply.status(e.statusCode ?? 500).send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function pauseHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = traceParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const trace = await gatewayService.pauseTrace(parsed.data.traceId, request.user!.userId);
    return reply.send({ data: trace });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply.status(e.statusCode ?? 500).send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function resumeHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = traceParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const trace = await gatewayService.resumeTrace(parsed.data.traceId, request.user!.userId);
    return reply.send({ data: trace });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply.status(e.statusCode ?? 500).send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function statusHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = traceParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const trace = await gatewayService.getTraceStatus(parsed.data.traceId, request.user!.userId);
    return reply.send({ data: trace });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply.status(e.statusCode ?? 500).send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}
