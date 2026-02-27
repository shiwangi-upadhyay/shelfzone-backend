import { jest } from '@jest/globals';

// Mock Prisma
const mockPrisma = {
  agentBudget: {
    findFirst: jest.fn() as any,
    findMany: jest.fn() as any,
    count: jest.fn() as any,
    create: jest.fn() as any,
    update: jest.fn() as any,
    updateMany: jest.fn() as any,
  },
  agentRegistry: {
    findUnique: jest.fn() as any,
    update: jest.fn() as any,
  },
  agentConfigLog: {
    create: jest.fn() as any,
  },
};

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: mockPrisma,
}));

const { setBudget, getBudgets, checkBudget, autoPause, unpause } = await import(
  '../../../src/modules/agent-portal/budgets/budget.service.js'
);

describe('budget.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setBudget()', () => {
    it('creates new budget when none exists', async () => {
      mockPrisma.agentBudget.findFirst.mockResolvedValue(null);
      mockPrisma.agentBudget.create.mockResolvedValue({
        id: 'budget-1',
        agentId: 'agent-1',
        teamId: null,
        monthlyCapUsd: 100,
        month: 2,
        year: 2026,
        currentSpend: 0,
        autoPauseEnabled: true,
        isPaused: false,
      });

      const result = await setBudget({
        agentId: 'agent-1',
        monthlyCapUsd: 100,
        month: 2,
        year: 2026,
      });

      expect(mockPrisma.agentBudget.findFirst).toHaveBeenCalledWith({
        where: { agentId: 'agent-1', teamId: null, month: 2, year: 2026 },
      });
      expect(mockPrisma.agentBudget.create).toHaveBeenCalledWith({
        data: { agentId: 'agent-1', teamId: undefined, monthlyCapUsd: 100, month: 2, year: 2026 },
      });
      expect(result.id).toBe('budget-1');
    });

    it('updates existing budget (upsert)', async () => {
      mockPrisma.agentBudget.findFirst.mockResolvedValue({
        id: 'budget-1',
        agentId: 'agent-1',
        monthlyCapUsd: 50,
        month: 2,
        year: 2026,
      });
      mockPrisma.agentBudget.update.mockResolvedValue({
        id: 'budget-1',
        agentId: 'agent-1',
        monthlyCapUsd: 150,
        month: 2,
        year: 2026,
      });

      const result = await setBudget({
        agentId: 'agent-1',
        monthlyCapUsd: 150,
        month: 2,
        year: 2026,
      });

      expect(mockPrisma.agentBudget.update).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
        data: { monthlyCapUsd: 150 },
      });
      expect(result.monthlyCapUsd).toBe(150);
    });
  });

  describe('getBudgets()', () => {
    it('returns paginated budgets', async () => {
      mockPrisma.agentBudget.findMany.mockResolvedValue([
        { id: 'budget-1', agentId: 'agent-1', monthlyCapUsd: 100 },
        { id: 'budget-2', agentId: 'agent-2', monthlyCapUsd: 200 },
      ]);
      mockPrisma.agentBudget.count.mockResolvedValue(2);

      const result = await getBudgets({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({ page: 1, limit: 10, total: 2, totalPages: 1 });
    });
  });

  describe('checkBudget()', () => {
    it('returns hasBudget=false when no budget exists', async () => {
      mockPrisma.agentBudget.findFirst.mockResolvedValue(null);

      const result = await checkBudget('agent-1');

      expect(result.hasBudget).toBe(false);
      expect(result.percentage).toBe(0);
      expect(result.alerts).toEqual([]);
      expect(result.shouldPause).toBe(false);
    });

    it('returns status under threshold (< 60%)', async () => {
      mockPrisma.agentBudget.findFirst.mockResolvedValue({
        id: 'budget-1',
        monthlyCapUsd: 100,
        currentSpend: 50,
        autoPauseEnabled: true,
        isPaused: false,
      });
      mockPrisma.agentRegistry.findUnique.mockResolvedValue({ isCritical: false });

      const result = await checkBudget('agent-1');

      expect(result.hasBudget).toBe(true);
      expect(result.percentage).toBe(50);
      expect(result.alerts).toEqual([]);
      expect(result.shouldPause).toBe(false);
    });

    it('triggers 60% alert', async () => {
      mockPrisma.agentBudget.findFirst.mockResolvedValue({
        id: 'budget-1',
        monthlyCapUsd: 100,
        currentSpend: 60,
        autoPauseEnabled: true,
        isPaused: false,
      });
      mockPrisma.agentRegistry.findUnique.mockResolvedValue({ isCritical: false });

      const result = await checkBudget('agent-1');

      expect(result.percentage).toBe(60);
      expect(result.alerts).toContain('60% threshold reached');
      expect(result.shouldPause).toBe(false);
    });

    it('triggers 80% alert', async () => {
      mockPrisma.agentBudget.findFirst.mockResolvedValue({
        id: 'budget-1',
        monthlyCapUsd: 100,
        currentSpend: 80,
        autoPauseEnabled: true,
        isPaused: false,
      });
      mockPrisma.agentRegistry.findUnique.mockResolvedValue({ isCritical: false });

      const result = await checkBudget('agent-1');

      expect(result.percentage).toBe(80);
      expect(result.alerts).toContain('60% threshold reached');
      expect(result.alerts).toContain('80% threshold reached');
      expect(result.shouldPause).toBe(false);
    });

    it('triggers 100% alert and pause for non-critical agent', async () => {
      mockPrisma.agentBudget.findFirst.mockResolvedValue({
        id: 'budget-1',
        monthlyCapUsd: 100,
        currentSpend: 100,
        autoPauseEnabled: true,
        isPaused: false,
      });
      mockPrisma.agentRegistry.findUnique.mockResolvedValue({ isCritical: false });

      const result = await checkBudget('agent-1');

      expect(result.percentage).toBe(100);
      expect(result.alerts).toContain('100% threshold reached — budget exceeded');
      expect(result.shouldPause).toBe(true);
    });

    it('does NOT pause critical agent at 100%', async () => {
      mockPrisma.agentBudget.findFirst.mockResolvedValue({
        id: 'budget-1',
        monthlyCapUsd: 100,
        currentSpend: 100,
        autoPauseEnabled: true,
        isPaused: false,
      });
      mockPrisma.agentRegistry.findUnique.mockResolvedValue({ isCritical: true });

      const result = await checkBudget('agent-1');

      expect(result.percentage).toBe(100);
      expect(result.shouldPause).toBe(false); // Critical agents never auto-pause
    });
  });

  describe('autoPause()', () => {
    it('pauses non-critical agent', async () => {
      mockPrisma.agentRegistry.findUnique.mockResolvedValue({ isCritical: false });
      mockPrisma.agentRegistry.update.mockResolvedValue({});
      mockPrisma.agentBudget.updateMany.mockResolvedValue({});

      const result = await autoPause('agent-1');

      expect(result.paused).toBe(true);
      expect(mockPrisma.agentRegistry.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: { status: 'PAUSED' },
      });
    });

    it('does NOT pause critical agent', async () => {
      mockPrisma.agentRegistry.findUnique.mockResolvedValue({ isCritical: true });

      const result = await autoPause('agent-1');

      expect(result.paused).toBe(false);
      expect(result.reason).toBe('Agent is critical — cannot auto-pause');
      expect(mockPrisma.agentRegistry.update).not.toHaveBeenCalled();
    });
  });

  describe('unpause()', () => {
    it('unpauses agent and logs config change (SUPER_ADMIN)', async () => {
      mockPrisma.agentRegistry.update.mockResolvedValue({});
      mockPrisma.agentBudget.updateMany.mockResolvedValue({});
      mockPrisma.agentConfigLog.create.mockResolvedValue({});

      const result = await unpause('agent-1', 'admin-user-1');

      expect(result.unpaused).toBe(true);
      expect(mockPrisma.agentRegistry.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: { status: 'ACTIVE' },
      });
      expect(mockPrisma.agentConfigLog.create).toHaveBeenCalledWith({
        data: {
          agentId: 'agent-1',
          changedBy: 'admin-user-1',
          changeType: 'UNPAUSE',
          previousValue: { status: 'PAUSED' },
          newValue: { status: 'ACTIVE' },
          reason: 'Manual unpause by admin',
        },
      });
    });
  });
});
