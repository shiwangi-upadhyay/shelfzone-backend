import { PrismaClient } from '@prisma/client';
import { CreateTabInput, UpdateTabInput } from './tabs.schemas.js';

export class TabsService {
  constructor(private prisma: PrismaClient) {}

  async getUserTabs(userId: string) {
    return this.prisma.conversationTab.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
      include: {
        conversations: {
          select: {
            id: true,
            title: true,
            agentId: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async createTab(userId: string, input: CreateTabInput) {
    // Check max tabs limit
    const existingTabs = await this.prisma.conversationTab.count({
      where: { userId },
    });

    if (existingTabs >= 5) {
      throw new Error('Maximum 5 tabs allowed per user');
    }

    // Get next position
    const maxPosition = await this.prisma.conversationTab.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const nextPosition = (maxPosition?.position ?? -1) + 1;

    // Deactivate all other tabs
    await this.prisma.conversationTab.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    // Create new tab as active
    return this.prisma.conversationTab.create({
      data: {
        userId,
        title: input.title || 'New Conversation',
        position: nextPosition,
        isActive: true,
      },
    });
  }

  async updateTab(userId: string, tabId: string, input: UpdateTabInput) {
    // Verify ownership
    const tab = await this.prisma.conversationTab.findFirst({
      where: { id: tabId, userId },
    });

    if (!tab) {
      throw new Error('Tab not found');
    }

    // If setting as active, deactivate others
    if (input.isActive === true) {
      await this.prisma.conversationTab.updateMany({
        where: { userId, isActive: true, id: { not: tabId } },
        data: { isActive: false },
      });
    }

    // Handle position changes (reorder)
    if (input.position !== undefined && input.position !== tab.position) {
      const tabs = await this.prisma.conversationTab.findMany({
        where: { userId },
        orderBy: { position: 'asc' },
      });

      const oldPosition = tab.position;
      const newPosition = input.position;

      // Shift other tabs
      if (newPosition > oldPosition) {
        // Moving right
        for (const t of tabs) {
          if (t.position > oldPosition && t.position <= newPosition) {
            await this.prisma.conversationTab.update({
              where: { id: t.id },
              data: { position: t.position - 1 },
            });
          }
        }
      } else {
        // Moving left
        for (const t of tabs) {
          if (t.position >= newPosition && t.position < oldPosition) {
            await this.prisma.conversationTab.update({
              where: { id: t.id },
              data: { position: t.position + 1 },
            });
          }
        }
      }
    }

    // Update the tab
    return this.prisma.conversationTab.update({
      where: { id: tabId },
      data: {
        ...(input.title && { title: input.title }),
        ...(input.position !== undefined && { position: input.position }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  }

  async deleteTab(userId: string, tabId: string) {
    // Verify ownership
    const tab = await this.prisma.conversationTab.findFirst({
      where: { id: tabId, userId },
    });

    if (!tab) {
      throw new Error('Tab not found');
    }

    // Get all tabs to find previous one
    const tabs = await this.prisma.conversationTab.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
    });

    const currentIndex = tabs.findIndex((t) => t.id === tabId);
    const wasActive = tab.isActive;

    // Delete the tab (cascade will delete conversations)
    await this.prisma.conversationTab.delete({
      where: { id: tabId },
    });

    // Shift positions of tabs after deleted one
    for (const t of tabs) {
      if (t.position > tab.position) {
        await this.prisma.conversationTab.update({
          where: { id: t.id },
          data: { position: t.position - 1 },
        });
      }
    }

    // If deleted tab was active, activate previous one
    if (wasActive && tabs.length > 1) {
      const newActiveIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      const newActiveTab = tabs.filter((t) => t.id !== tabId)[newActiveIndex];

      if (newActiveTab) {
        await this.prisma.conversationTab.update({
          where: { id: newActiveTab.id },
          data: { isActive: true },
        });
      }
    }

    return { deleted: true };
  }

  async getActiveTab(userId: string) {
    return this.prisma.conversationTab.findFirst({
      where: { userId, isActive: true },
    });
  }
}
