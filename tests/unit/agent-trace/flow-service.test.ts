import { jest } from '@jest/globals';

const mockTraceSession = {
  findMany: jest.fn<any>(),
};

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: {
    traceSession: mockTraceSession,
  },
}));

const flowService = await import(
  '../../../src/modules/agent-trace/services/flow-service.js'
);

describe('Flow Service', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── 15. buildFlowGraph ─────────────────────────────────────────

  describe('buildFlowGraph', () => {
    it('should build nodes and edges from sessions', async () => {
      const parentSession = {
        id: 'session-1',
        agentId: 'agent-1',
        parentSessionId: null,
        instruction: 'Build frontend',
        status: 'completed',
        cost: 1.0,
        startedAt: new Date('2024-01-01T00:00:00Z'),
        completedAt: new Date('2024-01-01T00:10:00Z'),
        agent: { id: 'agent-1', name: 'Master' },
        events: [
          {
            type: 'delegation',
            content: 'Delegate to sub',
            fromAgentId: 'agent-1',
            toAgentId: 'agent-2',
            cost: 0.1,
            durationMs: 100,
          },
        ],
      };

      const childSession = {
        id: 'session-2',
        agentId: 'agent-2',
        parentSessionId: 'session-1',
        instruction: 'Build component',
        status: 'completed',
        cost: 0.5,
        startedAt: new Date('2024-01-01T00:01:00Z'),
        completedAt: new Date('2024-01-01T00:05:00Z'),
        agent: { id: 'agent-2', name: 'SubAgent' },
        events: [],
      };

      mockTraceSession.findMany.mockResolvedValue([parentSession, childSession]);

      const result = await flowService.buildFlowGraph('trace-1');
      expect(result.data.nodes).toHaveLength(2);
      expect(result.data.edges.length).toBeGreaterThanOrEqual(1);
      
      // Verify node structure
      const masterNode = result.data.nodes.find((n: any) => n.agentId === 'agent-1');
      expect(masterNode).toBeDefined();
      expect(masterNode!.agentName).toBe('Master');
    });

    it('should return empty graph for trace with no sessions', async () => {
      mockTraceSession.findMany.mockResolvedValue([]);

      const result = await flowService.buildFlowGraph('empty-trace');
      expect(result.data.nodes).toHaveLength(0);
      expect(result.data.edges).toHaveLength(0);
    });
  });
});
