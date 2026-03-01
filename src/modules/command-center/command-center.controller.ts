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
    // Get the response from service (non-streaming fallback)
    const result = await streamMessage(userId, agentId, conversationId, message);

    // Return JSON response
    return reply.status(200).send({
      success: true,
      data: {
        message: result.message,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalCost: result.totalCost,
        traceSessionId: result.traceSessionId,
        taskTraceId: result.taskTraceId,
      },
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    const errorMessage = error.message || 'Internal server error';

    return reply.status(statusCode).send({
      error: error.error || 'Error',
      message: errorMessage,
    });
  }
}
