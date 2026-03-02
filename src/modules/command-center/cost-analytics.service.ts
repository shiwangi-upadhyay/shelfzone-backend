import { prisma } from '../../lib/prisma.js';

export interface AgentCostBreakdown {
  agentId: string;
  agentName: string;
  totalCost: number;
  totalTokens: number;
  tokensIn: number;
  tokensOut: number;
  messageCount: number;
}

export interface ConversationCostBreakdown {
  conversationId: string;
  totalCost: number;
  agents: AgentCostBreakdown[];
}

export interface TabCostBreakdown {
  tabId: string | null;
  tabName: string | null;
  totalCost: number;
  agents: AgentCostBreakdown[];
  conversations: ConversationCostBreakdown[];
}

export class CostAnalyticsService {
  /**
   * Get per-agent cost breakdown for a specific conversation
   */
  async getConversationCostBreakdown(conversationId: string): Promise<ConversationCostBreakdown> {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: {
        traceSession: {
          include: {
            agent: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // Group by agent
    const agentMap = new Map<string, AgentCostBreakdown>();
    let totalCost = 0;

    for (const message of messages) {
      const session = message.traceSession;
      if (!session || !session.agent) continue;

      const agentId = session.agent.id;
      const agentName = session.agent.name;
      const cost = session.cost ? parseFloat(session.cost.toString()) : 0;
      const tokensIn = session.tokensIn || 0;
      const tokensOut = session.tokensOut || 0;
      const totalTokens = tokensIn + tokensOut;

      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          agentId,
          agentName,
          totalCost: 0,
          totalTokens: 0,
          tokensIn: 0,
          tokensOut: 0,
          messageCount: 0,
        });
      }

      const agentData = agentMap.get(agentId)!;
      agentData.totalCost += cost;
      agentData.totalTokens += totalTokens;
      agentData.tokensIn += tokensIn;
      agentData.tokensOut += tokensOut;
      agentData.messageCount += 1;

      totalCost += cost;
    }

    return {
      conversationId,
      totalCost,
      agents: Array.from(agentMap.values()).sort((a, b) => b.totalCost - a.totalCost),
    };
  }

  /**
   * Get per-agent cost breakdown for a tab (all conversations in that tab)
   */
  async getTabCostBreakdown(userId: string, tabId: string | null): Promise<TabCostBreakdown> {
    // Get tab details
    let tabName: string | null = null;
    if (tabId) {
      const tab = await prisma.conversationTab.findUnique({
        where: { id: tabId },
        select: { name: true },
      });
      tabName = tab?.name || null;
    }

    // Get all conversations in this tab
    const conversations = await prisma.conversation.findMany({
      where: { userId, tabId },
      include: {
        messages: {
          include: {
            traceSession: {
              include: {
                agent: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    const conversationBreakdowns: ConversationCostBreakdown[] = [];
    const agentMap = new Map<string, AgentCostBreakdown>();
    let totalCost = 0;

    for (const conv of conversations) {
      const convBreakdown = await this.getConversationCostBreakdown(conv.id);
      conversationBreakdowns.push(convBreakdown);
      totalCost += convBreakdown.totalCost;

      // Aggregate by agent
      for (const agent of convBreakdown.agents) {
        if (!agentMap.has(agent.agentId)) {
          agentMap.set(agent.agentId, {
            agentId: agent.agentId,
            agentName: agent.agentName,
            totalCost: 0,
            totalTokens: 0,
            tokensIn: 0,
            tokensOut: 0,
            messageCount: 0,
          });
        }

        const agentData = agentMap.get(agent.agentId)!;
        agentData.totalCost += agent.totalCost;
        agentData.totalTokens += agent.totalTokens;
        agentData.tokensIn += agent.tokensIn;
        agentData.tokensOut += agent.tokensOut;
        agentData.messageCount += agent.messageCount;
      }
    }

    return {
      tabId,
      tabName,
      totalCost,
      agents: Array.from(agentMap.values()).sort((a, b) => b.totalCost - a.totalCost),
      conversations: conversationBreakdowns,
    };
  }

  /**
   * Get per-agent cost breakdown for all tabs
   */
  async getAllTabsCostBreakdown(userId: string): Promise<TabCostBreakdown[]> {
    const tabs = await prisma.conversationTab.findMany({
      where: { userId },
      select: { id: true, name: true },
    });

    const results: TabCostBreakdown[] = [];

    // Get breakdown for each tab
    for (const tab of tabs) {
      const breakdown = await this.getTabCostBreakdown(userId, tab.id);
      results.push(breakdown);
    }

    // Also get conversations with no tab (tabId = null)
    const noTabBreakdown = await this.getTabCostBreakdown(userId, null);
    if (noTabBreakdown.totalCost > 0 || noTabBreakdown.agents.length > 0) {
      results.push(noTabBreakdown);
    }

    return results.sort((a, b) => b.totalCost - a.totalCost);
  }
}

export const costAnalyticsService = new CostAnalyticsService();
