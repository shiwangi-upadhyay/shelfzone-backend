import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { costAnalyticsService } from '../../../src/modules/command-center/cost-analytics.service.js';
import { prisma } from '../../../src/lib/prisma.js';

// Mock Prisma
jest.mock('../../../src/lib/prisma.js', () => ({
  prisma: {
    message: {
      findMany: jest.fn(),
    },
    conversation: {
      findMany: jest.fn(),
    },
    conversationTab: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('CostAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConversationCostBreakdown', () => {
    it('should calculate per-agent costs for a conversation', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'Response 1',
          traceSession: {
            id: 'trace-1',
            cost: { toString: () => '0.0015' },
            tokensIn: 100,
            tokensOut: 50,
            agent: {
              id: 'agent-1',
              name: 'BackendForge',
            },
          },
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'Response 2',
          traceSession: {
            id: 'trace-2',
            cost: { toString: () => '0.0025' },
            tokensIn: 200,
            tokensOut: 100,
            agent: {
              id: 'agent-1',
              name: 'BackendForge',
            },
          },
        },
        {
          id: 'msg-3',
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'Response 3',
          traceSession: {
            id: 'trace-3',
            cost: { toString: () => '0.0010' },
            tokensIn: 80,
            tokensOut: 40,
            agent: {
              id: 'agent-2',
              name: 'UIcraft',
            },
          },
        },
      ];

      jest.mocked(prisma.message.findMany).mockResolvedValue(mockMessages as any);

      const result = await costAnalyticsService.getConversationCostBreakdown('conv-1');

      expect(result.conversationId).toBe('conv-1');
      expect(result.totalCost).toBeCloseTo(0.005, 4); // 0.0015 + 0.0025 + 0.0010
      expect(result.agents).toHaveLength(2);

      // Check BackendForge totals
      const backendForge = result.agents.find((a) => a.agentName === 'BackendForge');
      expect(backendForge).toBeDefined();
      expect(backendForge!.totalCost).toBeCloseTo(0.004, 4);
      expect(backendForge!.totalTokens).toBe(450); // (100+50) + (200+100)
      expect(backendForge!.messageCount).toBe(2);

      // Check UIcraft totals
      const uicraft = result.agents.find((a) => a.agentName === 'UIcraft');
      expect(uicraft).toBeDefined();
      expect(uicraft!.totalCost).toBeCloseTo(0.001, 4);
      expect(uicraft!.totalTokens).toBe(120); // 80+40
      expect(uicraft!.messageCount).toBe(1);
    });

    it('should handle conversations with no messages', async () => {
      jest.mocked(prisma.message.findMany).mockResolvedValue([]);

      const result = await costAnalyticsService.getConversationCostBreakdown('conv-empty');

      expect(result.conversationId).toBe('conv-empty');
      expect(result.totalCost).toBe(0);
      expect(result.agents).toHaveLength(0);
    });

    it('should skip messages without trace sessions', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: 'User message',
          traceSession: null,
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'Response',
          traceSession: {
            id: 'trace-1',
            cost: { toString: () => '0.0015' },
            tokensIn: 100,
            tokensOut: 50,
            agent: {
              id: 'agent-1',
              name: 'BackendForge',
            },
          },
        },
      ];

      jest.mocked(prisma.message.findMany).mockResolvedValue(mockMessages as any);

      const result = await costAnalyticsService.getConversationCostBreakdown('conv-1');

      expect(result.totalCost).toBeCloseTo(0.0015, 4);
      expect(result.agents).toHaveLength(1);
    });
  });

  describe('getTabCostBreakdown', () => {
    it('should aggregate costs across all conversations in a tab', async () => {
      const mockTab = { name: 'Project Alpha' };
      jest.mocked(prisma.conversationTab.findUnique).mockResolvedValue(mockTab as any);

      const mockConversations = [
        {
          id: 'conv-1',
          userId: 'user-1',
          tabId: 'tab-1',
          messages: [
            {
              id: 'msg-1',
              traceSession: {
                id: 'trace-1',
                cost: { toString: () => '0.0015' },
                tokensIn: 100,
                tokensOut: 50,
                agent: { id: 'agent-1', name: 'BackendForge' },
              },
            },
          ],
        },
        {
          id: 'conv-2',
          userId: 'user-1',
          tabId: 'tab-1',
          messages: [
            {
              id: 'msg-2',
              traceSession: {
                id: 'trace-2',
                cost: { toString: () => '0.0010' },
                tokensIn: 80,
                tokensOut: 40,
                agent: { id: 'agent-2', name: 'UIcraft' },
              },
            },
          ],
        },
      ];

      jest.mocked(prisma.conversation.findMany).mockResolvedValue(mockConversations as any);
      
      // Mock the conversation breakdown calls
      const originalGetConversationCostBreakdown = costAnalyticsService.getConversationCostBreakdown;
      jest.spyOn(costAnalyticsService, 'getConversationCostBreakdown')
        .mockResolvedValueOnce({
          conversationId: 'conv-1',
          totalCost: 0.0015,
          agents: [
            {
              agentId: 'agent-1',
              agentName: 'BackendForge',
              totalCost: 0.0015,
              totalTokens: 150,
              tokensIn: 100,
              tokensOut: 50,
              messageCount: 1,
            },
          ],
        })
        .mockResolvedValueOnce({
          conversationId: 'conv-2',
          totalCost: 0.0010,
          agents: [
            {
              agentId: 'agent-2',
              agentName: 'UIcraft',
              totalCost: 0.0010,
              totalTokens: 120,
              tokensIn: 80,
              tokensOut: 40,
              messageCount: 1,
            },
          ],
        });

      const result = await costAnalyticsService.getTabCostBreakdown('user-1', 'tab-1');

      expect(result.tabId).toBe('tab-1');
      expect(result.tabName).toBe('Project Alpha');
      expect(result.totalCost).toBeCloseTo(0.0025, 4);
      expect(result.agents).toHaveLength(2);
      expect(result.conversations).toHaveLength(2);
    });
  });

  describe('getAllTabsCostBreakdown', () => {
    it('should return breakdown for all tabs', async () => {
      const mockTabs = [
        { id: 'tab-1', name: 'Tab 1' },
        { id: 'tab-2', name: 'Tab 2' },
      ];

      jest.mocked(prisma.conversationTab.findMany).mockResolvedValue(mockTabs as any);

      jest.spyOn(costAnalyticsService, 'getTabCostBreakdown')
        .mockResolvedValueOnce({
          tabId: 'tab-1',
          tabName: 'Tab 1',
          totalCost: 0.005,
          agents: [],
          conversations: [],
        })
        .mockResolvedValueOnce({
          tabId: 'tab-2',
          tabName: 'Tab 2',
          totalCost: 0.003,
          agents: [],
          conversations: [],
        })
        .mockResolvedValueOnce({
          tabId: null,
          tabName: null,
          totalCost: 0,
          agents: [],
          conversations: [],
        });

      const result = await costAnalyticsService.getAllTabsCostBreakdown('user-1');

      expect(result).toHaveLength(2); // Should exclude empty no-tab breakdown
      expect(result[0].totalCost).toBeGreaterThan(result[1].totalCost); // Sorted by cost desc
    });
  });
});
