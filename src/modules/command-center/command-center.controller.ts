import { FastifyRequest, FastifyReply } from 'fastify';
import { sendMessageSchema, SendMessageInput } from './command-center.schemas.js';
import { streamMessage, calculateCost } from './command-center.service.js';
import { AgentContextService } from './agent-context.service.js';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

const agentContextService = new AgentContextService(prisma);

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
    const result = await streamMessage(userId, agentId, conversationId, message);

    // Set SSE headers with CORS
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': request.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    });

    const reader = result.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    let buffer = '';
    let fullResponse = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode and buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);

            // Extract text chunks
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              const text = event.delta.text;
              fullResponse += text;

              // Send chunk to frontend
              reply.raw.write(encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`));
            }

            // Capture tokens
            if (event.type === 'message_start') {
              inputTokens = event.message?.usage?.input_tokens || 0;
            }
            if (event.type === 'message_delta') {
              outputTokens += event.usage?.output_tokens || 0;
            }
          } catch {}
        }
      }

      // Save to database (after streaming completes)
      const cost = calculateCost(result.agentModel, inputTokens, outputTokens);
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - result.startedAt.getTime();

      // Update trace records
      await prisma.traceSession.update({
        where: { id: result.traceSessionId },
        data: {
          status: 'success',
          cost: new Prisma.Decimal(cost.totalCost.toFixed(6)),
          tokensIn: inputTokens,
          tokensOut: outputTokens,
          durationMs,
          completedAt,
        },
      });

      await prisma.taskTrace.update({
        where: { id: result.taskTraceId },
        data: {
          status: 'completed',
          totalCost: new Prisma.Decimal(cost.totalCost.toFixed(6)),
          totalTokens: inputTokens + outputTokens,
          agentsUsed: 1,
          completedAt,
        },
      });

      // Save assistant response to database
      await prisma.message.create({
        data: {
          conversationId: result.conversationId,
          role: 'assistant',
          content: fullResponse,
          tokenCount: outputTokens,
          cost: new Prisma.Decimal(cost.totalCost.toFixed(6)),
          traceSessionId: result.traceSessionId,
        },
      });

      // Track agent context usage
      const totalTokens = inputTokens + outputTokens;
      await agentContextService.trackTokenUsage(
        result.conversationId,
        agentId,
        totalTokens
      );

      // Send final events
      reply.raw.write(encoder.encode(`event: cost\ndata: ${JSON.stringify({ inputTokens, outputTokens, totalCost: cost.totalCost })}\n\n`));
      reply.raw.write(encoder.encode(`event: done\ndata: {}\n\n`));
    } finally {
      reply.raw.end();
    }
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    const errorMessage = error.message || 'Internal server error';

    return reply.status(statusCode).send({
      error: error.error || 'Error',
      message: errorMessage,
    });
  }
}
