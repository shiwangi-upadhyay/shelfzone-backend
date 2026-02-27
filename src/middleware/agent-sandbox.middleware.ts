import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { checkAgentPermission, type AgentOperation } from '../lib/agent-permissions.js';

/**
 * Creates a Fastify preHandler that enforces agent sandboxing.
 * Validates that the agent is allowed to perform the specified operation
 * based on its type and configured capabilities.
 */
export function agentSandbox(operation: AgentOperation) {
  return async function agentSandboxHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const agentId =
      (request.params as Record<string, string>).agentId ??
      (request.headers['x-agent-id'] as string);

    if (!agentId) {
      reply.status(400).send({
        error: 'Bad Request',
        message: 'Agent ID is required for sandboxed operations',
      });
      return;
    }

    const agent = await prisma.agentRegistry.findUnique({
      where: { id: agentId },
      select: { id: true, type: true, status: true, capabilities: true },
    });

    if (!agent) {
      reply.status(404).send({
        error: 'Not Found',
        message: 'Agent not found',
      });
      return;
    }

    if (agent.status !== 'ACTIVE') {
      reply.status(403).send({
        error: 'Forbidden',
        message: 'Agent is not active',
      });
      return;
    }

    // Check type-level permissions
    if (!checkAgentPermission(agent.type, operation)) {
      reply.status(403).send({
        error: 'Forbidden',
        message: `Agent type ${agent.type} is not allowed to perform operation: ${operation}`,
      });
      return;
    }

    // Check capability-level restrictions if defined
    const capabilities = agent.capabilities as Record<string, unknown> | null;
    if (capabilities?.restrictedOperations) {
      const restricted = capabilities.restrictedOperations as string[];
      if (restricted.includes(operation)) {
        reply.status(403).send({
          error: 'Forbidden',
          message: `Operation ${operation} is explicitly restricted for this agent`,
        });
        return;
      }
    }
  };
}
