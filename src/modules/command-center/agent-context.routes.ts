import { FastifyInstance } from 'fastify';
import { AgentContextService } from './agent-context.service.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { prisma } from '../../lib/prisma.js';

const agentContextService = new AgentContextService(prisma);

export async function agentContextRoutes(app: FastifyInstance) {
  // Get all context usage for a conversation
  app.get(
    '/contexts/:conversationId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { conversationId } = request.params as { conversationId: string };
      const userId = request.user!.userId;

      // Verify user owns this conversation
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId },
      });

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      const contexts = await agentContextService.getConversationContextsWithLevels(conversationId);
      return reply.send({ data: contexts });
    }
  );

  // Get context for all agents in user's active tab
  app.get(
    '/contexts/active/tab',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;

      // Get active tab
      const activeTab = await prisma.conversationTab.findFirst({
        where: { userId, isActive: true },
        include: {
          conversations: {
            select: { id: true },
          },
        },
      });

      if (!activeTab || activeTab.conversations.length === 0) {
        return reply.send({ data: [] });
      }

      // Get contexts for all conversations in active tab
      const allContexts = [];
      for (const conv of activeTab.conversations) {
        const contexts = await agentContextService.getConversationContextsWithLevels(conv.id);
        allContexts.push(...contexts);
      }

      return reply.send({ data: allContexts });
    }
  );
}
