import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { handleSendMessage } from './command-center.controller.js';
import {
  handleListConversations,
  handleGetConversation,
  handleCreateConversation,
  handleUpdateConversation,
  handleDeleteConversation,
} from './conversation.controller.js';

export default async function commandCenterRoutes(fastify: FastifyInstance) {
  // POST /api/command-center/message - Send message to agent with streaming response
  fastify.post(
    '/message',
    { preHandler: authenticate },
    handleSendMessage,
  );

  // Conversation management endpoints
  fastify.get(
    '/conversations',
    { preHandler: authenticate },
    handleListConversations,
  );

  fastify.get<{ Params: { id: string } }>(
    '/conversations/:id',
    { preHandler: authenticate },
    handleGetConversation,
  );

  fastify.post(
    '/conversations',
    { preHandler: authenticate },
    handleCreateConversation,
  );

  fastify.put<{ Params: { id: string } }>(
    '/conversations/:id',
    { preHandler: authenticate },
    handleUpdateConversation,
  );

  fastify.delete<{ Params: { id: string } }>(
    '/conversations/:id',
    { preHandler: authenticate },
    handleDeleteConversation,
  );
}
