import { jest } from '@jest/globals';

// Mock cost calculator
const mockCalculateSessionCost = jest.fn();
jest.unstable_mockModule('../../../src/lib/cost-calculator.js', () => ({
  calculateSessionCost: mockCalculateSessionCost,
}));

// Mock Prisma
const mockPrisma = {
  agentRegistry: {
    findUnique: jest.fn() as any,
    update: jest.fn() as any,
  },
  agentSession: {
    create: jest.fn() as any,
    findUnique: jest.fn() as any,
  },
  agentCostLedger: {
    create: jest.fn() as any,
  },
  agentDailyStats: {
    upsert: jest.fn() as any,
  },
  agentBudget: {
    findMany: jest.fn() as any,
    update: jest.fn() as any,
  },
  user: {
    findUnique: jest.fn() as any,
  },
};

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: mockPrisma,
}));

const { logSession, getSession } = await import(
  '../../../src/modules/agent-portal/sessions/session.service.js'
);

describe('session.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logSession()', () => {
    it('creates session, cost ledger, and updates daily stats', async () => {
      const sessionData = {
        agentId: 'agent-1',
        userId: 'user-1',
        sessionKey: 'session-key-1',
        inputTokens: 1000,
        outputTokens: 500,
        latencyMs: 2000,
        status: 'success',
        inputPreview: 'What is the weather?',
        outputPreview: 'The weather is sunny.',
      };

      mockPrisma.agentRegistry.findUnique.mockResolvedValue({
        id: 'agent-1',
        model: 'claude-sonnet-4-5',
        isCritical: false,
      });

      mockCalculateSessionCost.mockReturnValue({
        inputCost: 0.003,
        outputCost: 0.0075,
        totalCost: 0.0105,
      });

      mockPrisma.agentSession.create.mockResolvedValue({
        id: 'session-1',
        agentId: 'agent-1',
        totalTokens: 1500,
        cost: 0.0105,
      });

      mockPrisma.agentCostLedger.create.mockResolvedValue({});
      mockPrisma.agentDailyStats.upsert.mockResolvedValue({});
      mockPrisma.agentBudget.findMany.mockResolvedValue([]);

      logSession(sessionData);

      // Fire-and-forget — give it time to execute
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPrisma.agentRegistry.findUnique).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        select: { id: true, model: true },
      });

      expect(mockCalculateSessionCost).toHaveBeenCalledWith('claude-sonnet-4-5', 1000, 500);

      expect(mockPrisma.agentSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agentId: 'agent-1',
          userId: 'user-1',
          sessionKey: 'session-key-1',
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          latencyMs: 2000,
          cost: 0.0105,
          status: 'success',
        }),
      });

      expect(mockPrisma.agentCostLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agentId: 'agent-1',
          model: 'claude-sonnet-4-5',
          inputTokens: 1000,
          outputTokens: 500,
          inputCost: 0.003,
          outputCost: 0.0075,
          totalCost: 0.0105,
        }),
      });

      expect(mockPrisma.agentDailyStats.upsert).toHaveBeenCalled();
    });

    it('triggers budget check after logging', async () => {
      const sessionData = {
        agentId: 'agent-1',
        inputTokens: 1000,
        outputTokens: 500,
        latencyMs: 2000,
        status: 'success',
      };

      mockPrisma.agentRegistry.findUnique.mockResolvedValue({
        id: 'agent-1',
        model: 'claude-sonnet-4-5',
        isCritical: false,
      });

      mockCalculateSessionCost.mockReturnValue({
        inputCost: 0.003,
        outputCost: 0.0075,
        totalCost: 0.0105,
      });

      mockPrisma.agentSession.create.mockResolvedValue({ id: 'session-1' });
      mockPrisma.agentCostLedger.create.mockResolvedValue({});
      mockPrisma.agentDailyStats.upsert.mockResolvedValue({});

      mockPrisma.agentBudget.findMany.mockResolvedValue([
        {
          id: 'budget-1',
          agentId: 'agent-1',
          monthlyCapUsd: 100,
          currentSpend: 95,
          autoPauseEnabled: true,
          isPaused: false,
        },
      ]);

      mockPrisma.agentBudget.update.mockResolvedValue({});

      logSession(sessionData);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPrisma.agentBudget.findMany).toHaveBeenCalled();
      expect(mockPrisma.agentBudget.update).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
        data: { currentSpend: 95.0105 },
      });
    });

    it('auto-pauses non-critical agent at 100% budget', async () => {
      const sessionData = {
        agentId: 'agent-1',
        inputTokens: 1000,
        outputTokens: 500,
        latencyMs: 2000,
        status: 'success',
      };

      mockPrisma.agentRegistry.findUnique
        .mockResolvedValueOnce({
          id: 'agent-1',
          model: 'claude-sonnet-4-5',
          isCritical: false,
        })
        .mockResolvedValueOnce({
          id: 'agent-1',
          isCritical: false,
        });

      mockCalculateSessionCost.mockReturnValue({
        inputCost: 0.003,
        outputCost: 0.0075,
        totalCost: 5, // Pushes budget to 105%
      });

      mockPrisma.agentSession.create.mockResolvedValue({ id: 'session-1' });
      mockPrisma.agentCostLedger.create.mockResolvedValue({});
      mockPrisma.agentDailyStats.upsert.mockResolvedValue({});

      mockPrisma.agentBudget.findMany.mockResolvedValue([
        {
          id: 'budget-1',
          agentId: 'agent-1',
          monthlyCapUsd: 100,
          currentSpend: 100,
          autoPauseEnabled: true,
          isPaused: false,
        },
      ]);

      mockPrisma.agentBudget.update.mockResolvedValue({});
      mockPrisma.agentRegistry.update.mockResolvedValue({});

      logSession(sessionData);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockPrisma.agentRegistry.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: { status: 'PAUSED' },
      });
    });

    it('does NOT auto-pause critical agent at 100% budget', async () => {
      const sessionData = {
        agentId: 'agent-1',
        inputTokens: 1000,
        outputTokens: 500,
        latencyMs: 2000,
        status: 'success',
      };

      mockPrisma.agentRegistry.findUnique
        .mockResolvedValueOnce({
          id: 'agent-1',
          model: 'claude-sonnet-4-5',
          isCritical: true,
        })
        .mockResolvedValueOnce({
          id: 'agent-1',
          isCritical: true,
        });

      mockCalculateSessionCost.mockReturnValue({
        inputCost: 0.003,
        outputCost: 0.0075,
        totalCost: 5,
      });

      mockPrisma.agentSession.create.mockResolvedValue({ id: 'session-1' });
      mockPrisma.agentCostLedger.create.mockResolvedValue({});
      mockPrisma.agentDailyStats.upsert.mockResolvedValue({});

      mockPrisma.agentBudget.findMany.mockResolvedValue([
        {
          id: 'budget-1',
          agentId: 'agent-1',
          monthlyCapUsd: 100,
          currentSpend: 100,
          autoPauseEnabled: true,
          isPaused: false,
        },
      ]);

      mockPrisma.agentBudget.update.mockResolvedValue({});

      logSession(sessionData);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should NOT pause critical agent
      expect(mockPrisma.agentRegistry.update).not.toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: { status: 'PAUSED' },
      });
    });

    it('does not propagate errors (fire-and-forget)', async () => {
      const sessionData = {
        agentId: 'agent-1',
        inputTokens: 1000,
        outputTokens: 500,
        latencyMs: 2000,
        status: 'success',
      };

      mockPrisma.agentRegistry.findUnique.mockRejectedValue(new Error('Database error'));

      // Should not throw
      expect(() => logSession(sessionData)).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });

  describe('getSession()', () => {
    it('retrieves session by id', async () => {
      mockPrisma.agentSession.findUnique.mockResolvedValue({
        id: 'session-1',
        agentId: 'agent-1',
        agent: { id: 'agent-1', name: 'TestAgent', model: 'claude-sonnet-4-5' },
        user: { id: 'user-1', email: 'test@example.com' },
        costLedger: [{ id: 'ledger-1', totalCost: 0.01 }],
      });

      const result = await getSession('session-1');

      expect(result.id).toBe('session-1');
      expect(result.agent).toBeDefined();
      expect(result.costLedger).toBeDefined();
    });

    it('throws 404 when session not found', async () => {
      mockPrisma.agentSession.findUnique.mockResolvedValue(null);

      await expect(getSession('non-existent')).rejects.toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Session not found',
      });
    });
  });
});
