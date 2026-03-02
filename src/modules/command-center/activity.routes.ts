import type { FastifyInstance } from 'fastify';
import { activityService } from './activity.service';
import { authenticate } from '../../middleware/auth.middleware.js';

export async function activityRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/command-center/activity/stream
   * SSE endpoint for live activity updates
   * Uses token query param since EventSource doesn't support custom headers
   */
  fastify.get<{ Querystring: { token?: string } }>('/stream', async (request, reply) => {
    // Try to get token from query param (for SSE) or Authorization header (fallback)
    let userId: string | undefined;

    if (request.query.token) {
      // Verify token from query param
      try {
        const { verifyAccessToken } = await import('../auth/auth.service.js');
        const payload = verifyAccessToken(request.query.token);
        userId = payload.userId;
      } catch {
        return reply.status(401).send({ error: 'Invalid token' });
      }
    } else {
      // Fallback to standard auth
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
          const { verifyAccessToken } = await import('../auth/auth.service.js');
          const payload = verifyAccessToken(token);
          userId = payload.userId;
        } catch {
          return reply.status(401).send({ error: 'Unauthorized' });
        }
      }
    }

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Register SSE client (sets headers and keeps connection alive)
    activityService.registerClient(userId, reply);
    
    // Keep connection open
    return reply;
  });

  /**
   * GET /api/command-center/activity/status
   * Get activity service status
   */
  fastify.get('/status', async (request, reply) => {
    return reply.send({
      data: {
        activeClients: activityService.getActiveClientsCount(),
        status: 'operational',
      },
    });
  });
}
