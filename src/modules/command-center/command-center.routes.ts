import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { handleSendMessage } from './command-center.controller.js';
import { handleDelegationMessage } from './delegation.controller.js';
import {
  handleListConversations,
  handleGetConversation,
  handleCreateConversation,
  handleUpdateConversation,
  handleDeleteConversation,
} from './conversation.controller.js';
import { tabsRoutes } from './tabs.routes.js';
import { agentContextRoutes } from './agent-context.routes.js';
import { activityRoutes } from './activity.routes.js';
import { costAnalyticsRoutes } from './cost-analytics.routes.js';
import { billingRoutes } from './billing.routes.js';

export default async function commandCenterRoutes(fastify: FastifyInstance) {
  // POST /api/command-center/message - Send message to agent with streaming response
  fastify.post(
    '/message',
    { preHandler: authenticate },
    handleSendMessage,
  );

  // POST /api/command-center/delegate - Send message with delegation support
  fastify.post(
    '/delegate',
    { preHandler: authenticate },
    handleDelegationMessage,
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

  // Conversation tabs endpoints
  await tabsRoutes(fastify);

  // Agent context endpoints
  await agentContextRoutes(fastify);

  // Activity stream endpoints
  fastify.register(activityRoutes, { prefix: '/activity' });

  // Cost analytics endpoints
  fastify.register(costAnalyticsRoutes, { prefix: '/costs' });

  // Billing endpoints
  fastify.register(billingRoutes, { prefix: '/billing' });
}
