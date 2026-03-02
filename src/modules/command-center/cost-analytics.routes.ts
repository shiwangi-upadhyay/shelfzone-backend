import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { costAnalyticsService } from './cost-analytics.service.js';

export async function costAnalyticsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/command-center/costs/conversation/:conversationId
   * Get per-agent cost breakdown for a conversation
   */
  fastify.get<{ Params: { conversationId: string } }>(
    '/conversation/:conversationId',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const breakdown = await costAnalyticsService.getConversationCostBreakdown(
          request.params.conversationId
        );
        return reply.send({ data: breakdown });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message || 'Failed to fetch cost breakdown' });
      }
    }
  );

  /**
   * GET /api/command-center/costs/tab/:tabId
   * Get per-agent cost breakdown for a tab
   */
  fastify.get<{ Params: { tabId: string } }>(
    '/tab/:tabId',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const breakdown = await costAnalyticsService.getTabCostBreakdown(
          userId,
          request.params.tabId
        );
        return reply.send({ data: breakdown });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message || 'Failed to fetch cost breakdown' });
      }
    }
  );

  /**
   * GET /api/command-center/costs/tabs
   * Get per-agent cost breakdown for all tabs
   */
  fastify.get(
    '/tabs',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const breakdowns = await costAnalyticsService.getAllTabsCostBreakdown(userId);
        return reply.send({ data: breakdowns });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message || 'Failed to fetch cost breakdowns' });
      }
    }
  );

  /**
   * GET /api/command-center/costs/current-tab
   * Get per-agent cost breakdown for the active tab
   */
  fastify.get(
    '/current-tab',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;

        // Get active tab
        const activeTab = await fastify.prisma.conversationTab.findFirst({
          where: { userId, isActive: true },
        });

        const breakdown = await costAnalyticsService.getTabCostBreakdown(
          userId,
          activeTab?.id || null
        );

        return reply.send({ data: breakdown });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message || 'Failed to fetch cost breakdown' });
      }
    }
  );
}
