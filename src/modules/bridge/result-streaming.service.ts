import { FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import BridgeEventEmitter from './event-emitter.js';
import { BridgeEvent, Prisma } from '@prisma/client';

/**
 * Wait for session to complete or timeout
 */
async function waitForSessionComplete(sessionId: string, timeoutMs: number): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const checkInterval = setInterval(async () => {
      const elapsed = Date.now() - startTime;

      // Check timeout
      if (elapsed >= timeoutMs) {
        clearInterval(checkInterval);
        resolve();
        return;
      }

      // Check session status
      try {
        const session = await prisma.bridgeSession.findUnique({
          where: { id: sessionId },
          select: { status: true }
        });

        if (!session || session.status === 'COMPLETED' || session.status === 'ERROR') {
          clearInterval(checkInterval);
          resolve();
        }
      } catch (error) {
        // Ignore errors, keep waiting
      }
    }, 500); // Check every 500ms
  });
}

/**
 * Stream results from a bridge session to the client via SSE
 */
export async function streamResultsToClient(
  sessionId: string,
  reply: FastifyReply
): Promise<void> {
  // Set SSE headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const encoder = new TextEncoder();

  // Subscribe to bridge events for this session
  const eventEmitter = BridgeEventEmitter.getInstance();

  const handleEvent = (event: BridgeEvent) => {
    if (event.bridgeSessionId !== sessionId) return;

    // Stream different event types
    try {
      switch (event.type) {
        case 'RESPONSE':
          // Agent text response
          reply.raw.write(encoder.encode(
            `event: message\ndata: ${JSON.stringify({
              content: event.content,
              done: false
            })}\n\n`
          ));
          break;

        case 'FILE_CHANGE':
          // File was modified
          reply.raw.write(encoder.encode(
            `event: file_change\ndata: ${JSON.stringify({
              filePath: event.fileChanged,
              diff: event.metadata ? (event.metadata as any).diff : null
            })}\n\n`
          ));
          break;

        case 'COMMAND':
          // Command was executed
          reply.raw.write(encoder.encode(
            `event: command\ndata: ${JSON.stringify({
              command: event.commandRun,
              output: event.content
            })}\n\n`
          ));
          break;

        case 'ERROR':
          reply.raw.write(encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              error: event.content
            })}\n\n`
          ));
          break;
      }
    } catch (error) {
      // Ignore write errors (client might have disconnected)
    }
  };

  eventEmitter.on('bridge_event', handleEvent);

  // Wait for session to complete or timeout (5 minutes)
  await waitForSessionComplete(sessionId, 300000);

  // Calculate and attribute costs before sending final event
  try {
    // Get the session with related data
    const session = await prisma.bridgeSession.findUnique({
      where: { id: sessionId },
      include: { 
        agent: true, 
        node: true,
        instructor: { select: { id: true } }
      }
    });

    if (session) {
      // Get instruction event to calculate input tokens
      const instructionEvent = await prisma.bridgeEvent.findFirst({
        where: { 
          bridgeSessionId: sessionId,
          type: 'INSTRUCTION'
        },
        select: { content: true }
      });

      // Calculate total cost from all response events
      const responseEvents = await prisma.bridgeEvent.findMany({
        where: { 
          bridgeSessionId: sessionId,
          type: 'RESPONSE'
        },
        select: { content: true }
      });

      // Estimate tokens (rough: ~4 chars per token)
      const instructionLength = instructionEvent?.content?.length || 0;
      const totalResponseChars = responseEvents.reduce((sum, e) => sum + (e.content?.length || 0), 0);
      
      const inputTokens = Math.ceil(instructionLength / 4);
      const outputTokens = Math.ceil(totalResponseChars / 4);

      // Calculate cost (Claude Sonnet 4.5 pricing)
      // Input: $0.003/1K, Output: $0.015/1K
      const inputCost = (inputTokens / 1000) * 0.003;
      const outputCost = (outputTokens / 1000) * 0.015;
      const totalCost = inputCost + outputCost;

      // Update bridge session with cost data
      await prisma.bridgeSession.update({
        where: { id: sessionId },
        data: {
          totalCost: new Prisma.Decimal(totalCost.toFixed(6)),
          tokensUsed: inputTokens + outputTokens,
          status: session.status === 'ERROR' ? 'ERROR' : 'COMPLETED',
          endedAt: new Date()
        }
      });

      // Create task trace for this bridge session (required for trace_session)
      const taskTrace = await prisma.taskTrace.create({
        data: {
          ownerId: session.instructorId,
          masterAgentId: session.agentId,
          instruction: instructionEvent?.content || 'Remote agent execution',
          status: session.status === 'ERROR' ? 'failed' : 'completed',
          totalCost: new Prisma.Decimal(totalCost.toFixed(6)),
          totalTokens: inputTokens + outputTokens,
          agentsUsed: 1,
          completedAt: new Date()
        }
      });

      // Create trace_session entry for billing
      // Cost is paid by the node OWNER (not the instructor who used it)
      await prisma.traceSession.create({
        data: {
          taskTraceId: taskTrace.id,
          agentId: session.agentId,
          costPaidBy: session.node.userId, // OWNER pays, not instructor
          modelUsed: 'remote-bridge',
          status: session.status === 'ERROR' ? 'error' : 'success',
          cost: new Prisma.Decimal(totalCost.toFixed(6)),
          tokensIn: inputTokens,
          tokensOut: outputTokens,
          durationMs: session.endedAt 
            ? session.endedAt.getTime() - session.startedAt.getTime()
            : Date.now() - session.startedAt.getTime(),
          completedAt: new Date(),
          sessionType: 'remote-bridge'
        }
      });

      // Send cost event to client
      reply.raw.write(encoder.encode(
        `event: cost\ndata: ${JSON.stringify({
          totalCost: totalCost,
          tokensUsed: inputTokens + outputTokens,
          status: session.status === 'ERROR' ? 'ERROR' : 'COMPLETED'
        })}\n\n`
      ));
    }

    reply.raw.write(encoder.encode(`event: done\ndata: {}\n\n`));
  } catch (error) {
    // Ignore errors on final events
    console.error('Error calculating bridge session cost:', error);
  }

  reply.raw.end();
  eventEmitter.off('bridge_event', handleEvent);
}
