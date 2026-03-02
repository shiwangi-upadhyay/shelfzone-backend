import { jest } from '@jest/globals';
import { AgentContextService } from '../../../src/modules/command-center/agent-context.service.js';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  agentContext: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('AgentContextService', () => {
  let service: AgentContextService;
  const conversationId = 'conv-123';
  const agentId = 'agent-456';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AgentContextService(mockPrisma);
  });

  // ─── trackTokenUsage ────────────────────────────────────────────────

  describe('trackTokenUsage', () => {
    it('should create new context when it does not exist', async () => {
      const tokensUsed = 1500;
      const mockContext = {
        id: 'ctx-1',
        conversationId,
        agentId,
        tokensUsed,
        lastMessageAt: expect.any(Date),
      };

      (mockPrisma.agentContext.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.agentContext.create as jest.Mock).mockResolvedValue(mockContext);

      const result = await service.trackTokenUsage(conversationId, agentId, tokensUsed);

      expect(mockPrisma.agentContext.findUnique).toHaveBeenCalledWith({
        where: {
          conversationId_agentId: {
            conversationId,
            agentId,
          },
        },
      });

      expect(mockPrisma.agentContext.create).toHaveBeenCalledWith({
        data: {
          conversationId,
          agentId,
          tokensUsed,
          lastMessageAt: expect.any(Date),
        },
      });

      expect(result).toEqual(mockContext);
    });

    it('should update existing context by adding tokens', async () => {
      const existingTokens = 5000;
      const newTokens = 2000;
      const totalTokens = existingTokens + newTokens;

      const existingContext = {
        id: 'ctx-1',
        conversationId,
        agentId,
        tokensUsed: existingTokens,
        lastMessageAt: new Date('2024-01-01'),
      };

      const updatedContext = {
        ...existingContext,
        tokensUsed: totalTokens,
        lastMessageAt: expect.any(Date),
      };

      (mockPrisma.agentContext.findUnique as jest.Mock).mockResolvedValue(existingContext);
      (mockPrisma.agentContext.update as jest.Mock).mockResolvedValue(updatedContext);

      const result = await service.trackTokenUsage(conversationId, agentId, newTokens);

      expect(mockPrisma.agentContext.update).toHaveBeenCalledWith({
        where: { id: existingContext.id },
        data: {
          tokensUsed: totalTokens,
          lastMessageAt: expect.any(Date),
        },
      });

      expect(result.tokensUsed).toBe(totalTokens);
    });

    it('should handle zero tokens', async () => {
      const mockContext = {
        id: 'ctx-1',
        conversationId,
        agentId,
        tokensUsed: 0,
        lastMessageAt: expect.any(Date),
      };

      (mockPrisma.agentContext.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.agentContext.create as jest.Mock).mockResolvedValue(mockContext);

      await service.trackTokenUsage(conversationId, agentId, 0);

      expect(mockPrisma.agentContext.create).toHaveBeenCalledWith({
        data: {
          conversationId,
          agentId,
          tokensUsed: 0,
          lastMessageAt: expect.any(Date),
        },
      });
    });

    it('should handle large token counts', async () => {
      const largeTokens = 150000;

      (mockPrisma.agentContext.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.agentContext.create as jest.Mock).mockResolvedValue({
        id: 'ctx-1',
        conversationId,
        agentId,
        tokensUsed: largeTokens,
        lastMessageAt: expect.any(Date),
      });

      await service.trackTokenUsage(conversationId, agentId, largeTokens);

      expect(mockPrisma.agentContext.create).toHaveBeenCalledWith({
        data: {
          conversationId,
          agentId,
          tokensUsed: largeTokens,
          lastMessageAt: expect.any(Date),
        },
      });
    });
  });

  // ─── getConversationContexts ────────────────────────────────────────

  describe('getConversationContexts', () => {
    it('should return all contexts for a conversation with agent info', async () => {
      const mockContexts = [
        {
          id: 'ctx-1',
          conversationId,
          agentId: 'agent-1',
          tokensUsed: 5000,
          lastMessageAt: new Date(),
          agent: {
            id: 'agent-1',
            name: 'Code Assistant',
            model: 'claude-sonnet-3.5',
          },
        },
        {
          id: 'ctx-2',
          conversationId,
          agentId: 'agent-2',
          tokensUsed: 10000,
          lastMessageAt: new Date(),
          agent: {
            id: 'agent-2',
            name: 'Data Analyst',
            model: 'gpt-4',
          },
        },
      ];

      (mockPrisma.agentContext.findMany as jest.Mock).mockResolvedValue(mockContexts);

      const result = await service.getConversationContexts(conversationId);

      expect(mockPrisma.agentContext.findMany).toHaveBeenCalledWith({
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

      expect(result).toEqual(mockContexts);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no contexts exist', async () => {
      (mockPrisma.agentContext.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getConversationContexts(conversationId);

      expect(result).toEqual([]);
    });
  });

  // ─── getAgentContext ────────────────────────────────────────────────

  describe('getAgentContext', () => {
    it('should return specific agent context for a conversation', async () => {
      const mockContext = {
        id: 'ctx-1',
        conversationId,
        agentId,
        tokensUsed: 7500,
        lastMessageAt: new Date(),
      };

      (mockPrisma.agentContext.findUnique as jest.Mock).mockResolvedValue(mockContext);

      const result = await service.getAgentContext(conversationId, agentId);

      expect(mockPrisma.agentContext.findUnique).toHaveBeenCalledWith({
        where: {
          conversationId_agentId: {
            conversationId,
            agentId,
          },
        },
      });

      expect(result).toEqual(mockContext);
    });

    it('should return null when context does not exist', async () => {
      (mockPrisma.agentContext.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getAgentContext(conversationId, agentId);

      expect(result).toBeNull();
    });
  });

  // ─── calculateUsageLevel ────────────────────────────────────────────

  describe('calculateUsageLevel', () => {
    it('should return green level for usage < 75%', () => {
      const result = service.calculateUsageLevel(50000, 200000);

      expect(result).toEqual({
        tokensUsed: 50000,
        maxTokens: 200000,
        percentage: 25.0,
        level: 'green',
      });
    });

    it('should return green at 74.9%', () => {
      const result = service.calculateUsageLevel(149800, 200000);

      expect(result.level).toBe('green');
      expect(result.percentage).toBe(74.9);
    });

    it('should return amber level for usage 75-89%', () => {
      const result = service.calculateUsageLevel(160000, 200000);

      expect(result).toEqual({
        tokensUsed: 160000,
        maxTokens: 200000,
        percentage: 80.0,
        level: 'amber',
      });
    });

    it('should return amber at exactly 75%', () => {
      const result = service.calculateUsageLevel(150000, 200000);

      expect(result.level).toBe('amber');
      expect(result.percentage).toBe(75.0);
    });

    it('should return amber at 89.9%', () => {
      const result = service.calculateUsageLevel(179800, 200000);

      expect(result.level).toBe('amber');
      expect(result.percentage).toBe(89.9);
    });

    it('should return red level for usage >= 90%', () => {
      const result = service.calculateUsageLevel(185000, 200000);

      expect(result).toEqual({
        tokensUsed: 185000,
        maxTokens: 200000,
        percentage: 92.5,
        level: 'red',
      });
    });

    it('should return red at exactly 90%', () => {
      const result = service.calculateUsageLevel(180000, 200000);

      expect(result.level).toBe('red');
      expect(result.percentage).toBe(90.0);
    });

    it('should return red at 100%', () => {
      const result = service.calculateUsageLevel(200000, 200000);

      expect(result.level).toBe('red');
      expect(result.percentage).toBe(100.0);
    });

    it('should handle usage over 100%', () => {
      const result = service.calculateUsageLevel(250000, 200000);

      expect(result.level).toBe('red');
      expect(result.percentage).toBe(125.0);
    });

    it('should handle zero usage', () => {
      const result = service.calculateUsageLevel(0, 200000);

      expect(result).toEqual({
        tokensUsed: 0,
        maxTokens: 200000,
        percentage: 0.0,
        level: 'green',
      });
    });

    it('should round percentage to 1 decimal place', () => {
      const result = service.calculateUsageLevel(12345, 200000);

      expect(result.percentage).toBe(6.2); // 6.1725 rounded
    });

    it('should handle custom max tokens', () => {
      const result = service.calculateUsageLevel(90000, 100000);

      expect(result).toEqual({
        tokensUsed: 90000,
        maxTokens: 100000,
        percentage: 90.0,
        level: 'red',
      });
    });

    it('should use default maxTokens of 200000', () => {
      const result = service.calculateUsageLevel(50000);

      expect(result.maxTokens).toBe(200000);
    });
  });

  // ─── getConversationContextsWithLevels ──────────────────────────────

  describe('getConversationContextsWithLevels', () => {
    it('should return contexts with calculated usage levels', async () => {
      const mockContexts = [
        {
          id: 'ctx-1',
          conversationId,
          agentId: 'agent-1',
          tokensUsed: 50000,
          maxTokens: 200000,
          lastMessageAt: new Date(),
          agent: {
            id: 'agent-1',
            name: 'Agent 1',
            model: 'claude',
          },
        },
        {
          id: 'ctx-2',
          conversationId,
          agentId: 'agent-2',
          tokensUsed: 180000,
          maxTokens: 200000,
          lastMessageAt: new Date(),
          agent: {
            id: 'agent-2',
            name: 'Agent 2',
            model: 'gpt-4',
          },
        },
      ];

      (mockPrisma.agentContext.findMany as jest.Mock).mockResolvedValue(mockContexts);

      const result = await service.getConversationContextsWithLevels(conversationId);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'ctx-1',
        tokensUsed: 50000,
        usage: {
          tokensUsed: 50000,
          maxTokens: 200000,
          percentage: 25.0,
          level: 'green',
        },
      });

      expect(result[1]).toMatchObject({
        id: 'ctx-2',
        tokensUsed: 180000,
        usage: {
          tokensUsed: 180000,
          maxTokens: 200000,
          percentage: 90.0,
          level: 'red',
        },
      });
    });

    it('should handle empty contexts array', async () => {
      (mockPrisma.agentContext.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getConversationContextsWithLevels(conversationId);

      expect(result).toEqual([]);
    });

    it('should calculate different levels for multiple contexts', async () => {
      const mockContexts = [
        {
          id: 'ctx-1',
          tokensUsed: 50000, // 25% - green
          maxTokens: 200000,
        },
        {
          id: 'ctx-2',
          tokensUsed: 150000, // 75% - amber
          maxTokens: 200000,
        },
        {
          id: 'ctx-3',
          tokensUsed: 190000, // 95% - red
          maxTokens: 200000,
        },
      ];

      (mockPrisma.agentContext.findMany as jest.Mock).mockResolvedValue(mockContexts);

      const result = await service.getConversationContextsWithLevels(conversationId);

      expect(result[0].usage.level).toBe('green');
      expect(result[1].usage.level).toBe('amber');
      expect(result[2].usage.level).toBe('red');
    });
  });
});
