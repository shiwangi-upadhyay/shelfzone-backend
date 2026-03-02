import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { billingService } from '../../../src/modules/command-center/billing.service.js';
import { prisma } from '../../../src/lib/prisma.js';

jest.mock('../../../src/lib/prisma.js', () => ({
  prisma: {
    traceSession: {
      findMany: jest.fn(),
    },
  },
}));

describe('BillingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAgentSpendAllTime', () => {
    it('should calculate total spend per agent', async () => {
      const mockSessions = [
        {
          id: 'trace-1',
          cost: { toString: () => '0.0015' },
          tokensIn: 100,
          tokensOut: 50,
          status: 'success',
          agent: { id: 'agent-1', name: 'BackendForge' },
        },
        {
          id: 'trace-2',
          cost: { toString: () => '0.0025' },
          tokensIn: 200,
          tokensOut: 100,
          status: 'success',
          agent: { id: 'agent-1', name: 'BackendForge' },
        },
        {
          id: 'trace-3',
          cost: { toString: () => '0.0010' },
          tokensIn: 80,
          tokensOut: 40,
          status: 'success',
          agent: { id: 'agent-2', name: 'UIcraft' },
        },
      ];

      jest.mocked(prisma.traceSession.findMany).mockResolvedValue(mockSessions as any);

      const result = await billingService.getAgentSpendAllTime('user-1');

      expect(result).toHaveLength(2);

      // BackendForge should be first (highest cost)
      expect(result[0].agentName).toBe('BackendForge');
      expect(result[0].totalCost).toBeCloseTo(0.004, 4);
      expect(result[0].totalTokens).toBe(450);
      expect(result[0].sessionCount).toBe(2);

      // UIcraft should be second
      expect(result[1].agentName).toBe('UIcraft');
      expect(result[1].totalCost).toBeCloseTo(0.001, 4);
      expect(result[1].totalTokens).toBe(120);
      expect(result[1].sessionCount).toBe(1);
    });

    it('should skip sessions without agents', async () => {
      const mockSessions = [
        {
          id: 'trace-1',
          cost: { toString: () => '0.0015' },
          tokensIn: 100,
          tokensOut: 50,
          status: 'success',
          agent: null,
        },
        {
          id: 'trace-2',
          cost: { toString: () => '0.0025' },
          tokensIn: 200,
          tokensOut: 100,
          status: 'success',
          agent: { id: 'agent-1', name: 'BackendForge' },
        },
      ];

      jest.mocked(prisma.traceSession.findMany).mockResolvedValue(mockSessions as any);

      const result = await billingService.getAgentSpendAllTime('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].agentName).toBe('BackendForge');
    });

    it('should return empty array when no sessions exist', async () => {
      jest.mocked(prisma.traceSession.findMany).mockResolvedValue([]);

      const result = await billingService.getAgentSpendAllTime('user-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('getTotalSpendForRange', () => {
    it('should calculate total spend within date range', async () => {
      const mockSessions = [
        {
          id: 'trace-1',
          cost: { toString: () => '0.0015' },
        },
        {
          id: 'trace-2',
          cost: { toString: () => '0.0025' },
        },
        {
          id: 'trace-3',
          cost: { toString: () => '0.0010' },
        },
      ];

      jest.mocked(prisma.traceSession.findMany).mockResolvedValue(mockSessions as any);

      const startDate = new Date('2026-03-01');
      const endDate = new Date('2026-03-02');

      const result = await billingService.getTotalSpendForRange('user-1', startDate, endDate);

      expect(result).toBeCloseTo(0.005, 4);
    });

    it('should return 0 when no sessions in range', async () => {
      jest.mocked(prisma.traceSession.findMany).mockResolvedValue([]);

      const startDate = new Date('2026-03-01');
      const endDate = new Date('2026-03-02');

      const result = await billingService.getTotalSpendForRange('user-1', startDate, endDate);

      expect(result).toBe(0);
    });
  });

  describe('getDailySpendBreakdown', () => {
    it('should group sessions by date', async () => {
      const mockSessions = [
        {
          id: 'trace-1',
          startedAt: new Date('2026-03-01T10:00:00Z'),
          cost: { toString: () => '0.0015' },
          tokensIn: 100,
          tokensOut: 50,
          status: 'success',
          agent: { id: 'agent-1', name: 'BackendForge' },
        },
        {
          id: 'trace-2',
          startedAt: new Date('2026-03-01T14:00:00Z'),
          cost: { toString: () => '0.0025' },
          tokensIn: 200,
          tokensOut: 100,
          status: 'success',
          agent: { id: 'agent-1', name: 'BackendForge' },
        },
        {
          id: 'trace-3',
          startedAt: new Date('2026-03-02T10:00:00Z'),
          cost: { toString: () => '0.0010' },
          tokensIn: 80,
          tokensOut: 40,
          status: 'success',
          agent: { id: 'agent-2', name: 'UIcraft' },
        },
      ];

      jest.mocked(prisma.traceSession.findMany).mockResolvedValue(mockSessions as any);

      const result = await billingService.getDailySpendBreakdown('user-1', 30);

      expect(result).toHaveLength(2);

      // Check 2026-03-01
      const day1 = result.find((d) => d.date === '2026-03-01');
      expect(day1).toBeDefined();
      expect(day1!.totalCost).toBeCloseTo(0.004, 4);
      expect(day1!.agents).toHaveLength(1);
      expect(day1!.agents[0].agentName).toBe('BackendForge');
      expect(day1!.agents[0].sessionCount).toBe(2);

      // Check 2026-03-02
      const day2 = result.find((d) => d.date === '2026-03-02');
      expect(day2).toBeDefined();
      expect(day2!.totalCost).toBeCloseTo(0.001, 4);
      expect(day2!.agents).toHaveLength(1);
      expect(day2!.agents[0].agentName).toBe('UIcraft');
    });

    it('should skip sessions without startedAt', async () => {
      const mockSessions = [
        {
          id: 'trace-1',
          startedAt: null,
          cost: { toString: () => '0.0015' },
          tokensIn: 100,
          tokensOut: 50,
          status: 'success',
          agent: { id: 'agent-1', name: 'BackendForge' },
        },
      ];

      jest.mocked(prisma.traceSession.findMany).mockResolvedValue(mockSessions as any);

      const result = await billingService.getDailySpendBreakdown('user-1', 30);

      expect(result).toHaveLength(0);
    });
  });

  describe('getBillingOverview', () => {
    it('should return complete overview with all metrics', async () => {
      // Mock all-time spend
      jest.mocked(prisma.traceSession.findMany)
        .mockResolvedValueOnce([
          {
            id: 'trace-1',
            cost: { toString: () => '0.0015' },
            tokensIn: 100,
            tokensOut: 50,
            status: 'success',
            agent: { id: 'agent-1', name: 'BackendForge' },
          },
        ] as any)
        // Mock today's spend
        .mockResolvedValueOnce([
          { id: 'trace-1', cost: { toString: () => '0.0005' } },
        ] as any)
        // Mock week's spend
        .mockResolvedValueOnce([
          { id: 'trace-1', cost: { toString: () => '0.0010' } },
        ] as any)
        // Mock month's spend
        .mockResolvedValueOnce([
          { id: 'trace-1', cost: { toString: () => '0.0015' } },
        ] as any)
        // Mock daily breakdown
        .mockResolvedValueOnce([
          {
            id: 'trace-1',
            startedAt: new Date('2026-03-01'),
            cost: { toString: () => '0.0015' },
            tokensIn: 100,
            tokensOut: 50,
            status: 'success',
            agent: { id: 'agent-1', name: 'BackendForge' },
          },
        ] as any);

      const result = await billingService.getBillingOverview('user-1');

      expect(result.totalAllTime).toBeCloseTo(0.0015, 4);
      expect(result.totalToday).toBeCloseTo(0.0005, 4);
      expect(result.totalThisWeek).toBeCloseTo(0.0010, 4);
      expect(result.totalThisMonth).toBeCloseTo(0.0015, 4);
      expect(result.agentBreakdown).toHaveLength(1);
      expect(result.dailyBreakdown).toHaveLength(1);
    });
  });
});
