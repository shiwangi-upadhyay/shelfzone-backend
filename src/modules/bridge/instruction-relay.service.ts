import { FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { streamResultsToClient } from './result-streaming.service.js';
import { isNodeOnline, sendInstructionToNode } from './websocket-server.js';

export interface RelayOptions {
  agentId: string;
  nodeId: string;
  instruction: string;
  userId: string;
  conversationId: string;
  reply: FastifyReply;
}

/**
 * Relay instruction to a remote node and stream results back
 */
export async function relayToRemoteNode(options: RelayOptions): Promise<void> {
  const { agentId, nodeId, instruction, userId, conversationId, reply } = options;

  // 1. Check if node is online
  if (!isNodeOnline(nodeId)) {
    return reply.status(503).send({
      error: 'Agent Offline',
      message: 'The agent is running on a remote machine that is currently offline.'
    });
  }

  // 2. Create bridge session
  const session = await prisma.bridgeSession.create({
    data: {
      agentId,
      nodeId,
      instructorId: userId,
      conversationId,
      status: 'ACTIVE'
    }
  });

  // 3. Log instruction event
  await prisma.bridgeEvent.create({
    data: {
      bridgeSessionId: session.id,
      type: 'INSTRUCTION',
      content: instruction
    }
  });

  // 4. Send instruction to node via WebSocket
  const sent = await sendInstructionToNode(nodeId, session.id, agentId, instruction);

  if (!sent) {
    // If send failed, mark session as error
    await prisma.bridgeSession.update({
      where: { id: session.id },
      data: {
        status: 'ERROR',
        endedAt: new Date()
      }
    });

    return reply.status(503).send({
      error: 'Send Failed',
      message: 'Failed to send instruction to remote node'
    });
  }

  // 5. Stream results back to browser via SSE
  return streamResultsToClient(session.id, reply);
}
