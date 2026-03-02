import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { billingService } from './billing.service.js';

export async function billingRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/command-center/billing/overview
   * Get complete billing overview with all metrics
   */
  fastify.get(
    '/overview',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const overview = await billingService.getBillingOverview(userId);
        return reply.send({ data: overview });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message || 'Failed to fetch billing overview' });
      }
    }
  );

  /**
   * GET /api/command-center/billing/agents
   * Get per-agent spend breakdown (all time)
   */
  fastify.get(
    '/agents',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const agents = await billingService.getAgentSpendAllTime(userId);
        return reply.send({ data: agents });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message || 'Failed to fetch agent spend' });
      }
    }
  );

  /**
   * GET /api/command-center/billing/daily?days=30
   * Get daily spend breakdown
   */
  fastify.get<{ Querystring: { days?: string } }>(
    '/daily',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const days = request.query.days ? parseInt(request.query.days) : 30;
        const dailyBreakdown = await billingService.getDailySpendBreakdown(userId, days);
        return reply.send({ data: dailyBreakdown });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message || 'Failed to fetch daily spend' });
      }
    }
  );
}
