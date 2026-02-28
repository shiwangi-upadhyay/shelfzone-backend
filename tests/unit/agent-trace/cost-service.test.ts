import { jest } from '@jest/globals';

const mockTraceSession = {
  aggregate: jest.fn<any>(),
  groupBy: jest.fn<any>(),
  count: jest.fn<any>(),
};

const mockTaskTrace = {
  findMany: jest.fn<any>(),
};

const mockAgentRegistry = {
  findMany: jest.fn<any>(),
};

const mockEmployee = {
  findUnique: jest.fn<any>(),
};

const mockSessionEvent = {
  findMany: jest.fn<any>(),
};

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: {
    traceSession: mockTraceSession,
    taskTrace: mockTaskTrace,
    agentRegistry: mockAgentRegistry,
    employee: mockEmployee,
    sessionEvent: mockSessionEvent,
  },
}));

const costService = await import(
  '../../../src/modules/agent-trace/services/cost-service.js'
);

describe('Cost Service', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── 12. calculateAgentCost (used by cost-breakdown) ────────────

  describe('calculateAgentCost', () => {
    it('should aggregate costs for an agent', async () => {
      mockTraceSession.aggregate.mockResolvedValue({
        _sum: { cost: 1.5, tokensIn: 1000, tokensOut: 500 },
        _count: 10,
      });

      const result = await costService.calculateAgentCost('agent-1');
      expect(result.totalCost).toBe(1.5);
      expect(result.sessionCount).toBe(10);
    });
  });

  // ─── 12. getSubAgentBreakdown ───────────────────────────────────

  describe('getSubAgentBreakdown', () => {
    it('should return breakdown by sub-agent', async () => {
      mockTaskTrace.findMany.mockResolvedValue([{ id: 'trace-1' }]);
      mockTraceSession.groupBy.mockResolvedValue([
        { agentId: 'sub-1', _sum: { cost: 0.5, tokensIn: 200, tokensOut: 100 }, _count: 3 },
        { agentId: 'sub-2', _sum: { cost: 1.0, tokensIn: 400, tokensOut: 200 }, _count: 5 },
      ]);
      mockAgentRegistry.findMany.mockResolvedValue([
        { id: 'sub-1', name: 'SubAgent1', slug: 'sub-1' },
        { id: 'sub-2', name: 'SubAgent2', slug: 'sub-2' },
      ]);

      const result = await costService.getSubAgentBreakdown('agent-1');
      expect(result.data).toHaveLength(2);
      expect(result.totalCost).toBe(1.5);
    });

    it('should return empty for agent with no traces', async () => {
      mockTaskTrace.findMany.mockResolvedValue([]);

      const result = await costService.getSubAgentBreakdown('agent-1');
      expect(result.data).toHaveLength(0);
    });
  });

  // ─── 13. getEmployeeCostSummary ─────────────────────────────────

  describe('getEmployeeCostSummary', () => {
    it('should return agent summaries for employee', async () => {
      mockEmployee.findUnique.mockResolvedValue({
        userId: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
      });
      mockAgentRegistry.findMany.mockResolvedValue([
        { id: 'agent-1', name: 'Bot1', slug: 'bot1', status: 'ACTIVE' },
      ]);
      mockTraceSession.groupBy.mockResolvedValue([
        { agentId: 'agent-1', _sum: { cost: 2.0 }, _count: 10 },
      ]);
      // Error counts - second groupBy call
      mockTraceSession.groupBy.mockResolvedValueOnce([
        { agentId: 'agent-1', _sum: { cost: 2.0 }, _count: 10 },
      ]);

      const result = await costService.getEmployeeCostSummary('emp-1');
      expect(result.data.employeeName).toBe('John Doe');
      expect(result.data.agents).toHaveLength(1);
    });

    it('should throw 404 for non-existent employee', async () => {
      mockEmployee.findUnique.mockResolvedValue(null);

      await expect(costService.getEmployeeCostSummary('nonexistent')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // ─── 16. costByDay ──────────────────────────────────────────────

  describe('costByDay', () => {
    it('should return daily costs for last N days', async () => {
      mockSessionEvent.findMany.mockResolvedValue([
        { cost: 0.5, timestamp: new Date() },
      ]);

      const result = await costService.costByDay('agent-1', 7);
      expect(result.data).toHaveLength(7);
      expect(result.data[0]).toHaveProperty('date');
      expect(result.data[0]).toHaveProperty('cost');
    });
  });
});
