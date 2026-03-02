import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import {
  handleShareAgent,
  handleRevokeShare,
  handleGetSharedWithMe,
  handleGetMyShares,
  handleUpdateShare,
  handleReleaseTransfer,
} from './agent-sharing.controller.js';

export default async function agentSharingRoutes(fastify: FastifyInstance) {
  // Share agent with user
  fastify.post<{ Params: { id: string }; Body: unknown }>(
    '/agents/:id/share',
    { preHandler: authenticate },
    handleShareAgent
  );

  // Revoke sharing
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/agents/:id/share/:userId',
    { preHandler: authenticate },
    handleRevokeShare
  );

  // Get agents shared with me
  fastify.get(
    '/agents/shared-with-me',
    { preHandler: authenticate },
    handleGetSharedWithMe
  );

  // Get who has access to my agent
  fastify.get<{ Params: { id: string } }>(
    '/agents/:id/shares',
    { preHandler: authenticate },
    handleGetMyShares
  );

  // Update share settings
  fastify.put<{ Params: { id: string; userId: string }; Body: unknown }>(
    '/agents/:id/share/:userId',
    { preHandler: authenticate },
    handleUpdateShare
  );

  // Release transferred agent
  fastify.post<{ Params: { id: string; userId: string } }>(
    '/agents/:id/share/:userId/release',
    { preHandler: authenticate },
    handleReleaseTransfer
  );
}
