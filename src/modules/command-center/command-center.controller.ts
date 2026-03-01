import { FastifyRequest, FastifyReply } from 'fastify';
import { sendMessageSchema, SendMessageInput } from './command-center.schemas.js';
import { streamMessage } from './command-center.service.js';

export async function handleSendMessage(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Validate request body
  const validation = sendMessageSchema.safeParse(request.body);
  if (!validation.success) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: validation.error.issues.map((e: any) => e.message).join(', '),
    });
  }

  const { agentId, conversationId, message } = validation.data;
  const userId = request.user!.userId;

  try {
    // Get the stream from service
    const { stream } = await streamMessage(userId, agentId, conversationId, message);

    // Set up SSE response headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Pipe the stream to the response
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply.raw.write(value);
      }
    } catch (error: any) {
      // If client disconnects, log but don't crash
      console.error('Stream error:', error.message);
    } finally {
      reply.raw.end();
    }
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    const errorMessage = error.message || 'Internal server error';

    // If headers already sent (streaming started), we can't send JSON error
    if (reply.raw.headersSent) {
      // Send error as SSE event
      const errorEvent = `event: error\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`;
      reply.raw.write(errorEvent);
      reply.raw.end();
    } else {
      // Send normal JSON error
      return reply.status(statusCode).send({
        error: error.error || 'Error',
        message: errorMessage,
      });
    }
  }
}
