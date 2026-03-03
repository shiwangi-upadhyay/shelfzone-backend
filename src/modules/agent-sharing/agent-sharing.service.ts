import { prisma } from '../../lib/prisma.js';
import { SharePermission, ShareMode, ShareStatus } from '@prisma/client';
import { agentSharingNotificationService } from './notification-hooks.service.js';

export interface CreateShareInput {
  agentId: string;
  ownerId: string;
  sharedWithUserId: string;
  permission: SharePermission;
  mode: ShareMode;
  conversationId?: string;
  costLimit?: number;
  expiresAt?: Date;
}

export interface UpdateShareInput {
  permission?: SharePermission;
  mode?: ShareMode;
  costLimit?: number;
  expiresAt?: Date;
}

export class AgentSharingService {
  /**
   * Share an agent with another user
   */
  async shareAgent(input: CreateShareInput) {
    // Check if agent exists and belongs to owner
    const agent = await prisma.agentRegistry.findFirst({
      where: {
        id: input.agentId,
        createdBy: input.ownerId,
      },
    });

    if (!agent) {
      throw new Error('Agent not found or you do not own this agent');
    }

    // Check if user being shared with exists
    const sharedWithUser = await prisma.user.findUnique({
      where: { id: input.sharedWithUserId },
    });

    if (!sharedWithUser) {
      throw new Error('User not found');
    }

    // Check if already shared (active)
    const existingShare = await prisma.agentShare.findFirst({
      where: {
        agentId: input.agentId,
        sharedWithUserId: input.sharedWithUserId,
        status: ShareStatus.active,
      },
    });

    if (existingShare) {
      throw new Error('Agent already shared with this user');
    }

    // Create share
    const share = await prisma.agentShare.create({
      data: {
        agentId: input.agentId,
        ownerId: input.ownerId,
        sharedWithUserId: input.sharedWithUserId,
        permission: input.permission,
        mode: input.mode,
        conversationId: input.conversationId,
        costLimit: input.costLimit,
        expiresAt: input.expiresAt,
      },
      include: {
        agent: {
          select: { id: true, name: true, description: true },
        },
        owner: {
          select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } } },
        },
        sharedWithUser: {
          select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // Send notification to shared user
    const ownerName = share.owner.employee
      ? `${share.owner.employee.firstName} ${share.owner.employee.lastName}`
      : share.owner.email;

    await agentSharingNotificationService.notifyAgentShared({
      receiverUserId: share.sharedWithUserId,
      ownerName,
      agentName: share.agent.name,
      permission: share.permission,
      mode: share.mode,
    });

    return share;
  }

  /**
   * Revoke agent share
   */
  async revokeShare(agentId: string, ownerId: string, sharedWithUserId: string) {
    const share = await prisma.agentShare.findFirst({
      where: {
        agentId,
        ownerId,
        sharedWithUserId,
        status: ShareStatus.active,
      },
    });

    if (!share) {
      throw new Error('Share not found or already revoked');
    }

    const updatedShare = await prisma.agentShare.update({
      where: { id: share.id },
      data: { status: ShareStatus.revoked },
      include: {
        agent: { select: { id: true, name: true } },
        sharedWithUser: { select: { id: true, email: true } },
      },
    });

    // Send notification to shared user
    await agentSharingNotificationService.notifyShareRevoked({
      receiverUserId: updatedShare.sharedWithUserId,
      agentName: updatedShare.agent.name,
    });

    return updatedShare;
  }

  /**
   * Get agents shared with me
   */
  async getSharedWithMe(userId: string) {
    const shares = await prisma.agentShare.findMany({
      where: {
        sharedWithUserId: userId,
        status: ShareStatus.active,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            description: true,
            model: true,
            type: true,
          },
        },
        owner: {
          select: {
            id: true,
            email: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return shares;
  }

  /**
   * Get who I have shared my agents with
   */
  async getMyShares(agentId: string, ownerId: string) {
    const shares = await prisma.agentShare.findMany({
      where: {
        agentId,
        ownerId,
        status: ShareStatus.active,
      },
      include: {
        sharedWithUser: {
          select: {
            id: true,
            email: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return shares;
  }

  /**
   * Update share settings
   */
  async updateShare(
    agentId: string,
    ownerId: string,
    sharedWithUserId: string,
    updates: UpdateShareInput
  ) {
    const share = await prisma.agentShare.findFirst({
      where: {
        agentId,
        ownerId,
        sharedWithUserId,
        status: ShareStatus.active,
      },
    });

    if (!share) {
      throw new Error('Share not found');
    }

    const updatedShare = await prisma.agentShare.update({
      where: { id: share.id },
      data: updates,
      include: {
        agent: { select: { id: true, name: true } },
        sharedWithUser: { select: { id: true, email: true } },
      },
    });

    // Notify about changes
    const changes: string[] = [];
    if (updates.permission) changes.push(`permission changed to ${updates.permission}`);
    if (updates.mode) changes.push(`mode changed to ${updates.mode}`);
    if (updates.costLimit !== undefined) changes.push(`cost limit updated`);
    if (updates.expiresAt !== undefined) changes.push(`expiration date updated`);

    if (changes.length > 0) {
      await agentSharingNotificationService.notifyShareUpdated({
        receiverUserId: share.sharedWithUserId,
        agentName: updatedShare.agent.name,
        changes,
      });
    }

    return updatedShare;
  }

  /**
   * Release transferred agent back to owner
   */
  async releaseTransfer(agentId: string, sharedWithUserId: string) {
    const share = await prisma.agentShare.findFirst({
      where: {
        agentId,
        sharedWithUserId,
        mode: ShareMode.transfer,
        status: ShareStatus.active,
      },
    });

    if (!share) {
      throw new Error('No active transfer found');
    }

    // Change mode back to route (or revoke entirely?)
    const updated = await prisma.agentShare.update({
      where: { id: share.id },
      data: { mode: ShareMode.route },
      include: {
        agent: { select: { id: true, name: true } },
        owner: { select: { id: true, email: true } },
      },
    });

    // Send notification to owner
    await agentSharingNotificationService.notifyShareUpdated({
      receiverUserId: share.ownerId,
      agentName: updated.agent.name,
      changes: ['Transfer released'],
    });

    return updated;
  }

  /**
   * Check if user has access to agent (either owner or shared with control permission)
   */
  async canUserControlAgent(agentId: string, userId: string): Promise<boolean> {
    // Check if owner
    const agent = await prisma.agentRegistry.findFirst({
      where: { id: agentId, createdBy: userId },
    });

    if (agent) return true;

    // Check if shared with control permission
    const share = await prisma.agentShare.findFirst({
      where: {
        agentId,
        sharedWithUserId: userId,
        permission: SharePermission.control,
        status: ShareStatus.active,
      },
    });

    return !!share;
  }

  /**
   * Check if user has view access to agent
   */
  async canUserViewAgent(agentId: string, userId: string): Promise<boolean> {
    // Check if owner
    const agent = await prisma.agentRegistry.findFirst({
      where: { id: agentId, createdBy: userId },
    });

    if (agent) return true;

    // Check if shared (either control or view)
    const share = await prisma.agentShare.findFirst({
      where: {
        agentId,
        sharedWithUserId: userId,
        status: ShareStatus.active,
      },
    });

    return !!share;
  }

  /**
   * Track cost for shared agent usage
   */
  async trackSharedCost(agentId: string, sharedWithUserId: string, cost: number) {
    const share = await prisma.agentShare.findFirst({
      where: {
        agentId,
        sharedWithUserId,
        status: ShareStatus.active,
      },
    });

    if (!share) return;

    // Update cost used
    const newCostUsed = Number(share.costUsed) + cost;

    await prisma.agentShare.update({
      where: { id: share.id },
      data: { costUsed: newCostUsed },
    });

    // Check if cost limit exceeded
    if (share.costLimit && newCostUsed >= Number(share.costLimit)) {
      await prisma.agentShare.update({
        where: { id: share.id },
        data: { status: ShareStatus.revoked },
      });

      // Get agent details for notification
      const agent = await prisma.agentRegistry.findUnique({
        where: { id: agentId },
        select: { name: true },
      });

      if (agent) {
        await agentSharingNotificationService.notifyCostLimitReached({
          ownerUserId: share.ownerId,
          receiverUserId: share.sharedWithUserId,
          agentName: agent.name,
          costLimit: Number(share.costLimit),
        });
      }
    }
  }
}

export const agentSharingService = new AgentSharingService();
