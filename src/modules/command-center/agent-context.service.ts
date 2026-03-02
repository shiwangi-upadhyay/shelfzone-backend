import { PrismaClient } from '@prisma/client';

export class AgentContextService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Update or create agent context after a message is sent
   */
  async trackTokenUsage(
    conversationId: string,
    agentId: string,
    tokensUsed: number
  ) {
    const existing = await this.prisma.agentContext.findUnique({
      where: {
        conversationId_agentId: {
          conversationId,
          agentId,
        },
      },
    });

    if (existing) {
      return this.prisma.agentContext.update({
        where: { id: existing.id },
        data: {
          tokensUsed: existing.tokensUsed + tokensUsed,
          lastMessageAt: new Date(),
        },
      });
    } else {
      return this.prisma.agentContext.create({
        data: {
          conversationId,
          agentId,
          tokensUsed,
          lastMessageAt: new Date(),
        },
      });
    }
  }

  /**
   * Get context usage for a conversation
   */
  async getConversationContexts(conversationId: string) {
    return this.prisma.agentContext.findMany({
      where: { conversationId },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            model: true,
          },
        },
      },
    });
  }

  /**
   * Get context usage for a specific agent in a conversation
   */
  async getAgentContext(conversationId: string, agentId: string) {
    return this.prisma.agentContext.findUnique({
      where: {
        conversationId_agentId: {
          conversationId,
          agentId,
        },
      },
    });
  }

  /**
   * Calculate usage percentage and warning level
   */
  calculateUsageLevel(tokensUsed: number, maxTokens: number = 200000) {
    const percentage = (tokensUsed / maxTokens) * 100;

    let level: 'green' | 'amber' | 'red';
    if (percentage < 75) {
      level = 'green';
    } else if (percentage < 90) {
      level = 'amber';
    } else {
      level = 'red';
    }

    return {
      tokensUsed,
      maxTokens,
      percentage: Math.round(percentage * 10) / 10, // 1 decimal place
      level,
    };
  }

  /**
   * Get all contexts with usage levels for a conversation
   */
  async getConversationContextsWithLevels(conversationId: string) {
    const contexts = await this.getConversationContexts(conversationId);

    return contexts.map((ctx) => ({
      ...ctx,
      usage: this.calculateUsageLevel(ctx.tokensUsed, ctx.maxTokens),
    }));
  }
}
