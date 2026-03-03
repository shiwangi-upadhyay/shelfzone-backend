import { FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import BridgeEventEmitter from './event-emitter.js';
import { BridgeEvent } from '@prisma/client';

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

  // Send final cost
  try {
    const session = await prisma.bridgeSession.findUnique({
      where: { id: sessionId },
      select: { totalCost: true, tokensUsed: true, status: true }
    });

    if (session) {
      reply.raw.write(encoder.encode(
        `event: cost\ndata: ${JSON.stringify({
          totalCost: session.totalCost.toNumber(),
          tokensUsed: session.tokensUsed,
          status: session.status
        })}\n\n`
      ));
    }

    reply.raw.write(encoder.encode(`event: done\ndata: {}\n\n`));
  } catch (error) {
    // Ignore errors on final events
  }

  reply.raw.end();
  eventEmitter.off('bridge_event', handleEvent);
}
