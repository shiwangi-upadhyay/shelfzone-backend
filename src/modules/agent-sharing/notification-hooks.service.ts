import { prisma } from '../../lib/prisma.js';
import { NotificationType } from '@prisma/client';

/**
 * Notification hooks for agent sharing events
 * These are placeholder implementations that create notifications in the database
 * Future: Add email/push notification delivery
 */
export class AgentSharingNotificationService {
  /**
   * Notify user when an agent is shared with them
   */
  async notifyAgentShared(params: {
    receiverUserId: string;
    ownerName: string;
    agentName: string;
    permission: string;
    mode: string;
  }) {
    await prisma.notification.create({
      data: {
        userId: params.receiverUserId,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'Agent Shared With You',
        message: `${params.ownerName} shared ${params.agentName} with you (${params.permission} permission, ${params.mode} mode)`,
        metadata: {
          event: 'agent_shared',
          agentName: params.agentName,
          ownerName: params.ownerName,
          permission: params.permission,
          mode: params.mode,
        },
      },
    });

    // TODO: Send email notification
    // TODO: Send push notification
  }

  /**
   * Notify user when agent share is revoked
   */
  async notifyShareRevoked(params: {
    receiverUserId: string;
    agentName: string;
  }) {
    await prisma.notification.create({
      data: {
        userId: params.receiverUserId,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'Agent Access Revoked',
        message: `Your access to ${params.agentName} has been revoked`,
        metadata: {
          event: 'share_revoked',
          agentName: params.agentName,
        },
      },
    });

    // TODO: Send email notification
    // TODO: Send push notification
  }

  /**
   * Notify owner when their shared agent is used
   */
  async notifySharedAgentUsed(params: {
    ownerUserId: string;
    userName: string;
    agentName: string;
    cost: number;
  }) {
    await prisma.notification.create({
      data: {
        userId: params.ownerUserId,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'Shared Agent Used',
        message: `${params.userName} used ${params.agentName} ($${params.cost.toFixed(4)})`,
        metadata: {
          event: 'shared_agent_used',
          agentName: params.agentName,
          userName: params.userName,
          cost: params.cost,
        },
      },
    });

    // TODO: Send email notification (if cost exceeds threshold)
    // TODO: Send push notification
  }

  /**
   * Notify both owner and receiver when cost limit is reached
   */
  async notifyCostLimitReached(params: {
    ownerUserId: string;
    receiverUserId: string;
    agentName: string;
    costLimit: number;
  }) {
    // Notify owner
    await prisma.notification.create({
      data: {
        userId: params.ownerUserId,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'Shared Agent Cost Limit Reached',
        message: `Cost limit ($${params.costLimit}) reached for shared agent ${params.agentName}. Share has been automatically revoked.`,
        metadata: {
          event: 'cost_limit_reached',
          agentName: params.agentName,
          costLimit: params.costLimit,
        },
      },
    });

    // Notify receiver
    await prisma.notification.create({
      data: {
        userId: params.receiverUserId,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'Agent Access Revoked - Cost Limit',
        message: `Your access to ${params.agentName} has been revoked because the cost limit was reached.`,
        metadata: {
          event: 'cost_limit_reached',
          agentName: params.agentName,
          costLimit: params.costLimit,
        },
      },
    });

    // TODO: Send email notifications
  }

  /**
   * Notify when share permission/mode is updated
   */
  async notifyShareUpdated(params: {
    receiverUserId: string;
    agentName: string;
    changes: string[];
  }) {
    await prisma.notification.create({
      data: {
        userId: params.receiverUserId,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'Shared Agent Updated',
        message: `Access settings for ${params.agentName} have been updated: ${params.changes.join(', ')}`,
        metadata: {
          event: 'share_updated',
          agentName: params.agentName,
          changes: params.changes,
        },
      },
    });

    // TODO: Send email notification
  }
}

export const agentSharingNotificationService = new AgentSharingNotificationService();
