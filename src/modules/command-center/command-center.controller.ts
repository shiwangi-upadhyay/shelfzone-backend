import { FastifyRequest, FastifyReply } from 'fastify';
import { sendMessageSchema, SendMessageInput } from './command-center.schemas.js';
import { streamMessage, calculateCost } from './command-center.service.js';
import { AgentContextService } from './agent-context.service.js';
import { agentSharingService } from '../agent-sharing/agent-sharing.service.js';
import { agentSharingNotificationService } from '../agent-sharing/notification-hooks.service.js';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { relayToRemoteNode } from '../bridge/instruction-relay.service.js';

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

  const { agentId, conversationId, message, attachments } = validation.data;
  const userId = request.user!.userId;

  try {
    // Check if user has permission to use this agent (either owner or shared with control permission)
    const canControl = await agentSharingService.canUserControlAgent(agentId, userId);
    if (!canControl) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have permission to send messages to this agent',
      });
    }

    // Check if this agent runs on a remote node
    const agent = await prisma.agentRegistry.findUnique({
      where: { id: agentId },
      include: {
        node: true
      }
    });

    if (!agent) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Agent not found'
      });
    }

    // If agent is on a remote node, relay instruction
    if (agent.nodeId && agent.node) {
      return await relayToRemoteNode({
        agentId,
        nodeId: agent.nodeId as string, // Type assertion - we've checked it's not null
        instruction: message,
        userId,
        conversationId,
        reply
      });
    }

    // Create trace records first
    const startedAt = new Date();
    const traceSession = await prisma.traceSession.create({
      data: {
        userId,
        agentId,
        conversationId,
        status: 'running',
        startedAt,
      },
    });

    const taskTrace = await prisma.taskTrace.create({
      data: {
        userId,
        agentId,
        status: 'in_progress',
        instruction: message,
        startedAt,
      },
    });

    // Save user message to database
    await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: message,
        tokenCount: 0,
        cost: 0,
        traceSessionId: traceSession.id,
      },
    });

    // Execute via OpenClaw CLI
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const openclawCommand = `openclaw agent --agent ${agent.name} --message "${message.replace(/"/g, '\\"')}" --deliver --json`;
    
    request.log.info(`📤 Executing: ${openclawCommand}`);
    
    const { stdout, stderr } = await execAsync(openclawCommand, {
      timeout: 300000, // 5 minutes
      maxBuffer: 10 * 1024 * 1024
    });
    
    if (stderr && !stderr.includes('warn')) {
      request.log.warn('OpenClaw stderr:', stderr);
    }
    
    const openclawResult = JSON.parse(stdout);
    
    // Extract the response text
    const responseText = openclawResult.response || openclawResult.message || JSON.stringify(openclawResult);
    
    // Create result object with needed properties
    const result = {
      agentModel: agent.model || 'unknown',
      startedAt,
      traceSessionId: traceSession.id,
      taskTraceId: taskTrace.id,
      conversationId
    };
    
    // Set SSE headers with CORS
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': request.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    });

    const encoder = new TextEncoder();

    let fullResponse = responseText;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      // Stream the complete response word by word for UI effect
      const words = responseText.split(' ');
      for (const word of words) {
        reply.raw.write(encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text: word + ' ' })}\n\n`));
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay between words
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

      // Track shared agent usage costs (if user is using a shared agent)
      console.log('[COST_ATTRIBUTION] Starting cost attribution check', {
        agentId,
        userId,
        traceSessionId: result.traceSessionId,
      });

      const agent = await prisma.agentRegistry.findUnique({
        where: { id: agentId },
        select: { createdBy: true },
      });

      console.log('[COST_ATTRIBUTION] Agent lookup result', {
        agentFound: !!agent,
        createdBy: agent?.createdBy,
        currentUserId: userId,
      });

      const ownerId = agent?.createdBy || userId;
      const isSharedAgent = agent && agent.createdBy !== userId;

      console.log('[COST_ATTRIBUTION] Shared agent check', {
        ownerId,
        isSharedAgent,
        willUpdateCostPaidBy: isSharedAgent,
      });

      if (isSharedAgent) {
        try {
          console.log('[COST_ATTRIBUTION] Processing shared agent usage...');
          
          // This is a shared agent - track cost for the share
          await agentSharingService.trackSharedCost(agentId, userId, cost.totalCost);
          console.log('[COST_ATTRIBUTION] trackSharedCost completed');
          
          // Update trace session with cost payer (always the owner)
          const updateResult = await prisma.traceSession.update({
            where: { id: result.traceSessionId },
            data: { costPaidBy: ownerId },
          });
          
          console.log('[COST_ATTRIBUTION] Successfully updated costPaidBy', {
            traceSessionId: result.traceSessionId,
            costPaidBy: updateResult.costPaidBy,
            ownerId,
          });

          // Notify owner that their agent was used
          const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              email: true,
              employee: { select: { firstName: true, lastName: true } },
            },
          });

          const userName = currentUser?.employee
            ? `${currentUser.employee.firstName} ${currentUser.employee.lastName}`
            : currentUser?.email || 'Unknown User';

          await agentSharingNotificationService.notifySharedAgentUsed({
            ownerUserId: ownerId,
            userName,
            agentName: result.agentName,
            cost: cost.totalCost,
          });
          
          console.log('[COST_ATTRIBUTION] Notification sent to owner');
        } catch (error) {
          console.error('[COST_ATTRIBUTION] ERROR during cost attribution:', error);
          // Don't throw - we don't want to fail the request if cost attribution fails
          // But log it so we can investigate
        }
      } else {
        console.log('[COST_ATTRIBUTION] Not a shared agent, skipping cost attribution');
      }

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
