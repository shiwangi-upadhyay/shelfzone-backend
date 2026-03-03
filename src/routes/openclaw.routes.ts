/**
 * OpenClaw Integration Routes
 * 
 * Exposes OpenClaw Gateway functionality through REST API
 */

import { FastifyInstance } from 'fastify';
import { openclawGateway } from '../services/openclaw-gateway-client.js';
import { authenticate } from '../middleware/auth.middleware.js';

export default async function openclawRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  /**
   * GET /api/openclaw/agents
   * Get list of agents from OpenClaw Gateway
   */
  app.get('/api/openclaw/agents', async (request, reply) => {
    try {
      if (!openclawGateway.isReady()) {
        return reply.code(503).send({
          error: 'OpenClaw Gateway not connected',
          message: 'ShelfZone is not connected to OpenClaw Gateway'
        });
      }

      const agents = await openclawGateway.getAgentList();
      
      return reply.send({
        data: agents,
        count: agents.length,
        source: 'openclaw-gateway'
      });
    } catch (error) {
      request.log.error('Failed to fetch agents from OpenClaw:', error);
      return reply.code(500).send({
        error: 'Failed to fetch agents',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/openclaw/agents/:agentId/spawn
   * Spawn an agent session
   */
  app.post<{
    Params: { agentId: string };
    Body: { task: string; mode?: 'run' | 'session' };
  }>('/api/openclaw/agents/:agentId/spawn', async (request, reply) => {
    try {
      if (!openclawGateway.isReady()) {
        return reply.code(503).send({
          error: 'OpenClaw Gateway not connected'
        });
      }

      const { agentId } = request.params;
      const { task, mode = 'run' } = request.body;

      if (!task) {
        return reply.code(400).send({
          error: 'Task is required'
        });
      }

      const result = await openclawGateway.spawnAgent(agentId, task, mode);
      
      return reply.send({
        data: result,
        agentId,
        task,
        mode
      });
    } catch (error) {
      request.log.error('Failed to spawn agent:', error);
      return reply.code(500).send({
        error: 'Failed to spawn agent',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/openclaw/sessions/:sessionKey/send
   * Send message to existing session
   */
  app.post<{
    Params: { sessionKey: string };
    Body: { message: string };
  }>('/api/openclaw/sessions/:sessionKey/send', async (request, reply) => {
    try {
      if (!openclawGateway.isReady()) {
        return reply.code(503).send({
          error: 'OpenClaw Gateway not connected'
        });
      }

      const { sessionKey } = request.params;
      const { message } = request.body;

      if (!message) {
        return reply.code(400).send({
          error: 'Message is required'
        });
      }

      const result = await openclawGateway.sendMessage(sessionKey, message);
      
      return reply.send({
        data: result,
        sessionKey
      });
    } catch (error) {
      request.log.error('Failed to send message:', error);
      return reply.code(500).send({
        error: 'Failed to send message',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/openclaw/sessions/:sessionKey/history
   * Get session history
   */
  app.get<{
    Params: { sessionKey: string };
    Querystring: { limit?: number };
  }>('/api/openclaw/sessions/:sessionKey/history', async (request, reply) => {
    try {
      if (!openclawGateway.isReady()) {
        return reply.code(503).send({
          error: 'OpenClaw Gateway not connected'
        });
      }

      const { sessionKey } = request.params;
      const { limit = 50 } = request.query;

      const history = await openclawGateway.getSessionHistory(sessionKey, limit);
      
      return reply.send({
        data: history,
        sessionKey
      });
    } catch (error) {
      request.log.error('Failed to get session history:', error);
      return reply.code(500).send({
        error: 'Failed to get session history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/openclaw/status
   * Get OpenClaw Gateway connection status
   */
  app.get('/api/openclaw/status', async (request, reply) => {
    const isReady = openclawGateway.isReady();
    
    return reply.send({
      connected: isReady,
      status: isReady ? 'connected' : 'disconnected',
      service: 'openclaw-gateway',
      port: 18789
    });
  });
}
