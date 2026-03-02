import { FastifyRequest, FastifyReply } from 'fastify';
import { agentSharingService } from './agent-sharing.service.js';
import { shareAgentSchema, updateShareSchema } from './agent-sharing.schemas.js';

/**
 * POST /api/agents/:id/share
 * Share an agent with another user
 */
export async function handleShareAgent(
  request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
  reply: FastifyReply
) {
  const validation = shareAgentSchema.safeParse(request.body);
  
  if (!validation.success) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: validation.error.issues.map((e) => e.message).join(', '),
    });
  }

  const userId = request.user!.userId;
  const agentId = request.params.id;

  try {
    const share = await agentSharingService.shareAgent({
      agentId,
      ownerId: userId,
      ...validation.data,
    });

    return reply.send({ data: share });
  } catch (error: any) {
    return reply.status(400).send({ error: error.message || 'Failed to share agent' });
  }
}

/**
 * DELETE /api/agents/:id/share/:userId
 * Revoke agent sharing
 */
export async function handleRevokeShare(
  request: FastifyRequest<{ Params: { id: string; userId: string } }>,
  reply: FastifyReply
) {
  const ownerId = request.user!.userId;
  const agentId = request.params.id;
  const sharedWithUserId = request.params.userId;

  try {
    const share = await agentSharingService.revokeShare(agentId, ownerId, sharedWithUserId);
    return reply.send({ data: share });
  } catch (error: any) {
    return reply.status(400).send({ error: error.message || 'Failed to revoke share' });
  }
}

/**
 * GET /api/agents/shared-with-me
 * Get agents that others have shared with me
 */
export async function handleGetSharedWithMe(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = request.user!.userId;

  try {
    const shares = await agentSharingService.getSharedWithMe(userId);
    return reply.send({ data: shares });
  } catch (error: any) {
    return reply.status(500).send({ error: error.message || 'Failed to fetch shared agents' });
  }
}

/**
 * GET /api/agents/:id/shares
 * Get who has access to my agent
 */
export async function handleGetMyShares(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const ownerId = request.user!.userId;
  const agentId = request.params.id;

  try {
    const shares = await agentSharingService.getMyShares(agentId, ownerId);
    return reply.send({ data: shares });
  } catch (error: any) {
    return reply.status(500).send({ error: error.message || 'Failed to fetch shares' });
  }
}

/**
 * PUT /api/agents/:id/share/:userId
 * Update share settings
 */
export async function handleUpdateShare(
  request: FastifyRequest<{ Params: { id: string; userId: string }; Body: unknown }>,
  reply: FastifyReply
) {
  const validation = updateShareSchema.safeParse(request.body);
  
  if (!validation.success) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: validation.error.issues.map((e) => e.message).join(', '),
    });
  }

  const ownerId = request.user!.userId;
  const agentId = request.params.id;
  const sharedWithUserId = request.params.userId;

  try {
    const share = await agentSharingService.updateShare(
      agentId,
      ownerId,
      sharedWithUserId,
      validation.data
    );

    return reply.send({ data: share });
  } catch (error: any) {
    return reply.status(400).send({ error: error.message || 'Failed to update share' });
  }
}

/**
 * POST /api/agents/:id/share/:userId/release
 * Release transferred agent back to owner
 */
export async function handleReleaseTransfer(
  request: FastifyRequest<{ Params: { id: string; userId: string } }>,
  reply: FastifyReply
) {
  const sharedWithUserId = request.user!.userId;
  const agentId = request.params.id;

  try {
    const share = await agentSharingService.releaseTransfer(agentId, sharedWithUserId);
    return reply.send({ data: share });
  } catch (error: any) {
    return reply.status(400).send({ error: error.message || 'Failed to release transfer' });
  }
}
