import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/index.js';
import {
  instructHandler,
  streamHandler,
  cancelHandler,
  pauseHandler,
  resumeHandler,
  statusHandler,
} from './gateway.controller.js';

export default async function agentGatewayRoutes(app: FastifyInstance) {
  app.post('/api/agent-gateway/instruct', { preHandler: [authenticate] }, instructHandler);
  app.get('/api/agent-gateway/stream/:traceId', { preHandler: [authenticate] }, streamHandler);
  app.post('/api/agent-gateway/cancel/:traceId', { preHandler: [authenticate] }, cancelHandler);
  app.post('/api/agent-gateway/pause/:traceId', { preHandler: [authenticate] }, pauseHandler);
  app.post('/api/agent-gateway/resume/:traceId', { preHandler: [authenticate] }, resumeHandler);
  app.get('/api/agent-gateway/status/:traceId', { preHandler: [authenticate] }, statusHandler);
}
