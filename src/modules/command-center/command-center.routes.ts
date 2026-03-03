import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/index.js';
import { handleSendMessage } from './command-center.controller.js';
import { handleDelegationMessage } from './delegation.controller.js';
import { handleFileUpload } from './file-upload.controller.js';
import { handleSearch } from './search.controller.js';
import { handleExport } from './export.controller.js';
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
import { syncFromOpenClawHandler } from '../agents/agent.controller.js';

export default async function commandCenterRoutes(fastify: FastifyInstance) {
  // GET /api/command-center/agents/sync-from-openclaw - Sync agents from OpenClaw config
  fastify.get(
    '/agents/sync-from-openclaw',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    syncFromOpenClawHandler,
  );

  // GET /api/command-center/search - Search conversations
  fastify.get(
    '/search',
    { preHandler: authenticate },
    handleSearch,
  );

  // POST /api/command-center/upload - Upload file (image/code)
  fastify.post(
    '/upload',
    { preHandler: authenticate },
    handleFileUpload,
  );

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

  // GET /api/command-center/conversations/:id/export - Export conversation
  fastify.get<{ Params: { id: string } }>(
    '/conversations/:id/export',
    { preHandler: authenticate },
    handleExport,
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
