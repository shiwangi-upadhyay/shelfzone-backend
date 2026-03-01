import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/index.js';
import { verifyAccessToken } from '../auth/auth.service.js';
import {
  instructHandler,
  executeMultiHandler,
  streamHandler,
  cancelHandler,
  pauseHandler,
  resumeHandler,
  statusHandler,
} from './gateway.controller.js';

// SSE endpoints can't use Authorization header (EventSource limitation)
// Accept token from query param as fallback
async function authenticateWithQueryFallback(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authenticate(request, reply);
  }
  // Fallback: check query param
  const token = (request.query as Record<string, string>).token;
  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  try {
    const payload = verifyAccessToken(token);
    request.user = payload;
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

export default async function agentGatewayRoutes(app: FastifyInstance) {
  app.post('/api/agent-gateway/instruct', { preHandler: [authenticate] }, instructHandler);
  app.post('/api/agent-gateway/execute-multi', { preHandler: [authenticate] }, executeMultiHandler);
  app.get('/api/agent-gateway/stream/:traceId', { preHandler: [authenticateWithQueryFallback] }, streamHandler);
  app.post('/api/agent-gateway/cancel/:traceId', { preHandler: [authenticate] }, cancelHandler);
  app.post('/api/agent-gateway/pause/:traceId', { preHandler: [authenticate] }, pauseHandler);
  app.post('/api/agent-gateway/resume/:traceId', { preHandler: [authenticate] }, resumeHandler);
  app.get('/api/agent-gateway/status/:traceId', { preHandler: [authenticate] }, statusHandler);
}
