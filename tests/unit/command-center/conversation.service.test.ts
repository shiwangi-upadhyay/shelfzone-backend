import { jest } from '@jest/globals';

// Mock Prisma methods
const mockConversationFindMany = jest.fn();
const mockConversationFindFirst = jest.fn();
const mockConversationFindUnique = jest.fn();
const mockConversationCreate = jest.fn();
const mockConversationUpdate = jest.fn();
const mockConversationDelete = jest.fn();
const mockAgentRegistryFindUnique = jest.fn();

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  prisma: {
    conversation: {
      findMany: mockConversationFindMany,
      findFirst: mockConversationFindFirst,
      findUnique: mockConversationFindUnique,
      create: mockConversationCreate,
      update: mockConversationUpdate,
      delete: mockConversationDelete,
    },
    agentRegistry: {
      findUnique: mockAgentRegistryFindUnique,
    },
  },
}));

const {
  listConversations,
  getConversation,
  getConversationByAgentAndTab,
  createConversation,
  updateConversationTitle,
  deleteConversation,
} = await import('../../../src/modules/command-center/conversation.service.js');

// Create aliases for easier access
const prisma = {
  conversation: {
    findMany: mockConversationFindMany,
    findFirst: mockConversationFindFirst,
    findUnique: mockConversationFindUnique,
    create: mockConversationCreate,
    update: mockConversationUpdate,
    delete: mockConversationDelete,
  },
  agentRegistry: {
    findUnique: mockAgentRegistryFindUnique,
  },
};

describe('Conversation Service', () => {
  const userId = 'user-123';
  const agentId = 'agent-456';
  const conversationId = 'conv-789';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── listConversations ──────────────────────────────────────────────

  describe('listConversations', () => {
    it('should return list of conversations with metadata', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          userId,
          agentId: 'agent-1',
          title: 'Conversation 1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          agent: {
            id: 'agent-1',
            name: 'Agent One',
          },
          messages: [{ createdAt: new Date('2024-01-02') }],
          _count: { messages: 5 },
        },
        {
          id: 'conv-2',
          userId,
          agentId: 'agent-2',
          title: 'Conversation 2',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-04'),
          agent: {
            id: 'agent-2',
            name: 'Agent Two',
          },
          messages: [{ createdAt: new Date('2024-01-04') }],
          _count: { messages: 10 },
        },
      ];

      (prisma.conversation.findMany as jest.Mock).mockResolvedValue(mockConversations);

      const result = await listConversations(userId);

      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              createdAt: true,
            },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      expect(result.conversations).toHaveLength(2);
      expect(result.conversations[0]).toMatchObject({
        id: 'conv-1',
        agentId: 'agent-1',
        agentName: 'Agent One',
        title: 'Conversation 1',
        messageCount: 5,
      });
    });

    it('should use createdAt when no messages exist', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          userId,
          agentId: 'agent-1',
          title: 'New Conversation',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          agent: {
            id: 'agent-1',
            name: 'Agent One',
          },
          messages: [],
          _count: { messages: 0 },
        },
      ];

      (prisma.conversation.findMany as jest.Mock).mockResolvedValue(mockConversations);

      const result = await listConversations(userId);

      expect(result.conversations[0].lastMessageAt).toEqual(new Date('2024-01-01'));
      expect(result.conversations[0].messageCount).toBe(0);
    });

    it('should return empty array when user has no conversations', async () => {
      (prisma.conversation.findMany as jest.Mock).mockResolvedValue([]);

      const result = await listConversations(userId);

      expect(result.conversations).toEqual([]);
    });

    it('should order by updatedAt descending', async () => {
      const mockConversations = [
        {
          id: 'conv-2',
          updatedAt: new Date('2024-01-10'),
          createdAt: new Date('2024-01-01'),
          agent: { id: 'a1', name: 'Agent' },
          messages: [],
          _count: { messages: 0 },
        },
        {
          id: 'conv-1',
          updatedAt: new Date('2024-01-05'),
          createdAt: new Date('2024-01-01'),
          agent: { id: 'a1', name: 'Agent' },
          messages: [],
          _count: { messages: 0 },
        },
      ];

      (prisma.conversation.findMany as jest.Mock).mockResolvedValue(mockConversations);

      const result = await listConversations(userId);

      expect(result.conversations[0].id).toBe('conv-2'); // More recent first
      expect(result.conversations[1].id).toBe('conv-1');
    });
  });

  // ─── getConversation ────────────────────────────────────────────────

  describe('getConversation', () => {
    it('should return conversation with all messages', async () => {
      const mockConversation = {
        id: conversationId,
        userId,
        agentId,
        title: 'Test Conversation',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        agent: {
          id: agentId,
          name: 'Test Agent',
        },
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            tokenCount: 5,
            cost: 0.001,
            createdAt: new Date('2024-01-01'),
          },
          {
            id: 'msg-2',
            role: 'assistant',
            content: 'Hi there!',
            tokenCount: 10,
            cost: 0.002,
            createdAt: new Date('2024-01-01'),
          },
        ],
      };

      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);

      const result = await getConversation(userId, conversationId);

      expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: conversationId,
          userId,
        },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              role: true,
              content: true,
              tokenCount: true,
              cost: true,
              createdAt: true,
            },
          },
        },
      });

      expect(result.conversation).toMatchObject({
        id: conversationId,
        agentId,
        agentName: 'Test Agent',
        title: 'Test Conversation',
      });
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('assistant');
    });

    it('should throw 404 error when conversation not found', async () => {
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(getConversation(userId, conversationId)).rejects.toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Conversation not found',
      });
    });

    it('should throw 404 when conversation belongs to different user', async () => {
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(getConversation('different-user', conversationId)).rejects.toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Conversation not found',
      });
    });

    it('should return conversation with empty messages array', async () => {
      const mockConversation = {
        id: conversationId,
        userId,
        agentId,
        title: 'Empty Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
        agent: {
          id: agentId,
          name: 'Test Agent',
        },
        messages: [],
      };

      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);

      const result = await getConversation(userId, conversationId);

      expect(result.messages).toEqual([]);
    });
  });

  // ─── getConversationByAgentAndTab ───────────────────────────────────

  describe('getConversationByAgentAndTab', () => {
    it('should return conversation for specific agent and tab', async () => {
      const tabId = 'tab-123';
      const mockConversation = {
        id: conversationId,
        userId,
        agentId,
        tabId,
        title: 'Tab Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
        agent: {
          id: agentId,
          name: 'Test Agent',
        },
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test message',
            tokenCount: 5,
            cost: 0.001,
            createdAt: new Date(),
          },
        ],
      };

      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);

      const result = await getConversationByAgentAndTab(userId, agentId, tabId);

      expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          agentId,
          tabId,
        },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              role: true,
              content: true,
              tokenCount: true,
              cost: true,
              createdAt: true,
            },
          },
        },
      });

      expect(result.conversation).toBeTruthy();
      expect(result.conversation?.tabId).toBe(tabId);
      expect(result.messages).toHaveLength(1);
    });

    it('should handle null tabId', async () => {
      const mockConversation = {
        id: conversationId,
        userId,
        agentId,
        tabId: null,
        title: 'No Tab Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
        agent: {
          id: agentId,
          name: 'Test Agent',
        },
        messages: [],
      };

      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);

      const result = await getConversationByAgentAndTab(userId, agentId, null);

      expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          agentId,
          tabId: null,
        },
        include: expect.any(Object),
      });

      expect(result.conversation).toBeTruthy();
      expect(result.conversation?.tabId).toBeNull();
    });

    it('should return null conversation and empty messages when not found', async () => {
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await getConversationByAgentAndTab(userId, agentId, 'tab-999');

      expect(result).toEqual({
        conversation: null,
        messages: [],
      });
    });
  });

  // ─── createConversation ─────────────────────────────────────────────

  describe('createConversation', () => {
    it('should create new conversation with default title', async () => {
      const mockAgent = {
        id: agentId,
        name: 'Code Assistant',
      };

      const mockConversation = {
        id: conversationId,
        userId,
        agentId,
        title: 'New conversation with Code Assistant',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.agentRegistry.findUnique as jest.Mock).mockResolvedValue(mockAgent);
      (prisma.conversation.create as jest.Mock).mockResolvedValue(mockConversation);

      const result = await createConversation(userId, agentId);

      expect(prisma.agentRegistry.findUnique).toHaveBeenCalledWith({
        where: { id: agentId },
        select: { id: true, name: true },
      });

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: {
          userId,
          agentId,
          title: 'New conversation with Code Assistant',
        },
      });

      expect(result.conversation).toMatchObject({
        id: conversationId,
        agentId,
        agentName: 'Code Assistant',
        title: 'New conversation with Code Assistant',
      });
    });

    it('should create conversation with custom title', async () => {
      const customTitle = 'My Custom Conversation';
      const mockAgent = {
        id: agentId,
        name: 'Test Agent',
      };

      const mockConversation = {
        id: conversationId,
        userId,
        agentId,
        title: customTitle,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.agentRegistry.findUnique as jest.Mock).mockResolvedValue(mockAgent);
      (prisma.conversation.create as jest.Mock).mockResolvedValue(mockConversation);

      const result = await createConversation(userId, agentId, customTitle);

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: {
          userId,
          agentId,
          title: customTitle,
        },
      });

      expect(result.conversation.title).toBe(customTitle);
    });

    it('should throw 404 error when agent not found', async () => {
      (prisma.agentRegistry.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(createConversation(userId, 'invalid-agent')).rejects.toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Agent not found',
      });

      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });
  });

  // ─── updateConversationTitle ────────────────────────────────────────

  describe('updateConversationTitle', () => {
    it('should update conversation title', async () => {
      const newTitle = 'Updated Title';
      const mockConversation = {
        id: conversationId,
        userId,
        agentId,
        title: 'Old Title',
      };

      const updatedConversation = {
        id: conversationId,
        title: newTitle,
        updatedAt: new Date(),
      };

      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(updatedConversation);

      const result = await updateConversationTitle(userId, conversationId, newTitle);

      expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: conversationId,
          userId,
        },
      });

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: conversationId },
        data: { title: newTitle },
      });

      expect(result.conversation.title).toBe(newTitle);
    });

    it('should throw 404 error when conversation not found', async () => {
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        updateConversationTitle(userId, conversationId, 'New Title')
      ).rejects.toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Conversation not found',
      });

      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });

    it('should throw 404 when conversation belongs to different user', async () => {
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        updateConversationTitle('different-user', conversationId, 'New Title')
      ).rejects.toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Conversation not found',
      });
    });
  });

  // ─── deleteConversation ─────────────────────────────────────────────

  describe('deleteConversation', () => {
    it('should delete conversation successfully', async () => {
      const mockConversation = {
        id: conversationId,
        userId,
        agentId,
      };

      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);
      (prisma.conversation.delete as jest.Mock).mockResolvedValue(mockConversation);

      const result = await deleteConversation(userId, conversationId);

      expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: conversationId,
          userId,
        },
      });

      expect(prisma.conversation.delete).toHaveBeenCalledWith({
        where: { id: conversationId },
      });

      expect(result).toEqual({ success: true });
    });

    it('should throw 404 error when conversation not found', async () => {
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(deleteConversation(userId, conversationId)).rejects.toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Conversation not found',
      });

      expect(prisma.conversation.delete).not.toHaveBeenCalled();
    });

    it('should throw 404 when conversation belongs to different user', async () => {
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(deleteConversation('different-user', conversationId)).rejects.toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Conversation not found',
      });
    });

    it('should cascade delete messages (via Prisma schema)', async () => {
      const mockConversation = {
        id: conversationId,
        userId,
        agentId,
      };

      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);
      (prisma.conversation.delete as jest.Mock).mockResolvedValue(mockConversation);

      await deleteConversation(userId, conversationId);

      // We expect only the conversation delete to be called
      // Messages cascade delete happens at DB level
      expect(prisma.conversation.delete).toHaveBeenCalledTimes(1);
    });
  });
});
