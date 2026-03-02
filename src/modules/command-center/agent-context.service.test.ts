import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { AgentContextService } from './agent-context.service';

const prisma = new PrismaClient();
const service = new AgentContextService(prisma);

describe('AgentContextService', () => {
  let testConversationId: string;
  let testAgentId: string;

  beforeEach(async () => {
    // Create test data
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: 'test',
        role: 'EMPLOYEE',
      },
    });

    const agent = await prisma.agentRegistry.create({
      data: {
        name: `Test Agent ${Date.now()}`,
        slug: `test-agent-${Date.now()}`,
        type: 'SERVICE',
        model: 'claude-sonnet-4-5',
        createdBy: user.id,
      },
    });

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        agentId: agent.id,
        title: 'Test Conversation',
      },
    });

    testConversationId = conversation.id;
    testAgentId = agent.id;
  });

  afterEach(async () => {
    // Cleanup
    await prisma.agentContext.deleteMany({ where: { conversationId: testConversationId } });
    await prisma.conversation.deleteMany({ where: { id: testConversationId } });
    await prisma.agentRegistry.deleteMany({ where: { id: testAgentId } });
  });

  describe('trackTokenUsage', () => {
    it('should create new context when none exists', async () => {
      const result = await service.trackTokenUsage(testConversationId, testAgentId, 1000);

      expect(result).toBeDefined();
      expect(result.tokensUsed).toBe(1000);
      expect(result.conversationId).toBe(testConversationId);
      expect(result.agentId).toBe(testAgentId);
    });

    it('should increment tokens when context exists', async () => {
      // First call
      await service.trackTokenUsage(testConversationId, testAgentId, 1000);
      
      // Second call
      const result = await service.trackTokenUsage(testConversationId, testAgentId, 500);

      expect(result.tokensUsed).toBe(1500);
    });

    it('should update lastMessageAt timestamp', async () => {
      const before = new Date();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = await service.trackTokenUsage(testConversationId, testAgentId, 100);

      expect(new Date(result.lastMessageAt).getTime()).toBeGreaterThan(before.getTime());
    });
  });

  describe('calculateUsageLevel', () => {
    it('should return green for < 75%', () => {
      const result = service.calculateUsageLevel(50000, 200000);
      expect(result.level).toBe('green');
      expect(result.percentage).toBe(25);
    });

    it('should return amber for 75-90%', () => {
      const result = service.calculateUsageLevel(160000, 200000);
      expect(result.level).toBe('amber');
      expect(result.percentage).toBe(80);
    });

    it('should return red for > 90%', () => {
      const result = service.calculateUsageLevel(190000, 200000);
      expect(result.level).toBe('red');
      expect(result.percentage).toBe(95);
    });
  });

  describe('getConversationContexts', () => {
    it('should return empty array when no contexts exist', async () => {
      const result = await service.getConversationContexts(testConversationId);
      expect(result).toEqual([]);
    });

    it('should return contexts with agent info', async () => {
      await service.trackTokenUsage(testConversationId, testAgentId, 1000);

      const result = await service.getConversationContexts(testConversationId);

      expect(result).toHaveLength(1);
      expect(result[0].agent).toBeDefined();
      expect(result[0].agent.name).toBeDefined();
    });
  });

  describe('getConversationContextsWithLevels', () => {
    it('should include usage level info', async () => {
      await service.trackTokenUsage(testConversationId, testAgentId, 150000);

      const result = await service.getConversationContextsWithLevels(testConversationId);

      expect(result).toHaveLength(1);
      expect(result[0].usage).toBeDefined();
      expect(result[0].usage.level).toBe('amber'); // 75% = amber
      expect(result[0].usage.percentage).toBe(75);
    });
  });
});
