import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { handleSendMessage } from './command-center.controller.js';

export default async function commandCenterRoutes(fastify: FastifyInstance) {
  // POST /api/command-center/message - Send message to agent with streaming response
  fastify.post(
    '/message',
    { preHandler: authenticate },
    handleSendMessage,
  );
}
