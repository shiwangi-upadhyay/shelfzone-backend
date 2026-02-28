import { jest } from '@jest/globals';

// ─── Mock Data ───────────────────────────────────────────────────────

const mockTrace = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  ownerId: 'user-1',
  masterAgentId: 'agent-1',
  instruction: 'Build the frontend',
  status: 'running',
  totalCost: 0,
  totalTokens: 0,
  agentsUsed: 0,
  startedAt: new Date('2024-01-01'),
  completedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  masterAgent: { id: 'agent-1', name: 'UIcraft', slug: 'uicraft' },
};

const mockSession = {
  id: '660e8400-e29b-41d4-a716-446655440001',
  taskTraceId: mockTrace.id,
  agentId: 'agent-1',
  parentSessionId: null,
  delegatedBy: null,
  instruction: 'Build component',
  status: 'running',
  cost: 0,
  tokensIn: 0,
  tokensOut: 0,
  startedAt: new Date('2024-01-01'),
  completedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  agent: { id: 'agent-1', name: 'UIcraft', slug: 'uicraft', type: 'WORKFLOW' },
  taskTrace: { id: mockTrace.id, ownerId: 'user-1', instruction: 'Build the frontend' },
  _count: { events: 5 },
};

const mockEvent = {
  id: '770e8400-e29b-41d4-a716-446655440002',
  sessionId: mockSession.id,
  type: 'llm_call',
  content: 'Generated code',
  fromAgentId: 'agent-1',
  toAgentId: null,
  metadata: {},
  tokenCount: 500,
  cost: 0.05,
  durationMs: 1200,
  timestamp: new Date('2024-01-01'),
  fromAgent: { id: 'agent-1', name: 'UIcraft' },
  toAgent: null,
};

// ─── Mock Prisma ─────────────────────────────────────────────────────

const mockTaskTrace = {
  create: jest.fn<any>(),
  findUnique: jest.fn<any>(),
  findMany: jest.fn<any>(),
  count: jest.fn<any>(),
  update: jest.fn<any>(),
  delete: jest.fn<any>(),
};

const mockTraceSession = {
  findMany: jest.fn<any>(),
  findUnique: jest.fn<any>(),
  count: jest.fn<any>(),
  update: jest.fn<any>(),
  aggregate: jest.fn<any>(),
  groupBy: jest.fn<any>(),
};

const mockSessionEvent = {
  create: jest.fn<any>(),
  findMany: jest.fn<any>(),
  count: jest.fn<any>(),
};

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: {
    taskTrace: mockTaskTrace,
    traceSession: mockTraceSession,
    sessionEvent: mockSessionEvent,
  },
}));

const traceService = await import(
  '../../../src/modules/agent-trace/services/trace-service.js'
);

describe('Trace Service', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── 1. listTraces ───────────────────────────────────────────────

  describe('listTraces', () => {
    it('should list traces for owner with pagination', async () => {
      mockTaskTrace.findMany.mockResolvedValue([mockTrace]);
      mockTaskTrace.count.mockResolvedValue(1);

      const result = await traceService.listTraces({
        ownerId: 'user-1',
        role: 'EMPLOYEE',
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(mockTaskTrace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: 'user-1' } }),
      );
    });

    it('should allow SUPER_ADMIN to see all traces', async () => {
      mockTaskTrace.findMany.mockResolvedValue([mockTrace]);
      mockTaskTrace.count.mockResolvedValue(1);

      await traceService.listTraces({ ownerId: 'admin-1', role: 'SUPER_ADMIN' });

      expect(mockTaskTrace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should filter by status', async () => {
      mockTaskTrace.findMany.mockResolvedValue([]);
      mockTaskTrace.count.mockResolvedValue(0);

      await traceService.listTraces({
        ownerId: 'user-1',
        role: 'EMPLOYEE',
        status: 'completed',
      });

      expect(mockTaskTrace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: 'user-1', status: 'completed' } }),
      );
    });
  });

  // ─── 2. getTrace ────────────────────────────────────────────────

  describe('getTrace', () => {
    it('should return trace with sessions for owner', async () => {
      mockTaskTrace.findUnique.mockResolvedValue({ ...mockTrace, sessions: [mockSession] });

      const result = await traceService.getTrace(mockTrace.id, 'user-1', 'EMPLOYEE');
      expect(result.id).toBe(mockTrace.id);
    });

    it('should throw 404 for non-existent trace', async () => {
      mockTaskTrace.findUnique.mockResolvedValue(null);

      await expect(
        traceService.getTrace('nonexistent', 'user-1', 'EMPLOYEE'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 for non-owner', async () => {
      mockTaskTrace.findUnique.mockResolvedValue(mockTrace);

      await expect(
        traceService.getTrace(mockTrace.id, 'other-user', 'EMPLOYEE'),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ─── 3. createTrace ─────────────────────────────────────────────

  describe('createTrace', () => {
    it('should create a trace', async () => {
      mockTaskTrace.create.mockResolvedValue(mockTrace);

      const result = await traceService.createTrace(
        { instruction: 'Build the frontend', masterAgentId: 'agent-1' },
        'user-1',
      );

      expect(result.id).toBe(mockTrace.id);
      expect(mockTaskTrace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { instruction: 'Build the frontend', masterAgentId: 'agent-1', ownerId: 'user-1' },
        }),
      );
    });
  });

  // ─── 4. updateTrace ─────────────────────────────────────────────

  describe('updateTrace', () => {
    it('should update trace status for owner', async () => {
      mockTaskTrace.findUnique.mockResolvedValue(mockTrace);
      mockTaskTrace.update.mockResolvedValue({ ...mockTrace, status: 'completed' });

      const result = await traceService.updateTrace(mockTrace.id, 'user-1', 'EMPLOYEE', {
        status: 'completed',
      });
      expect(result.status).toBe('completed');
    });

    it('should throw 403 for non-owner', async () => {
      mockTaskTrace.findUnique.mockResolvedValue(mockTrace);

      await expect(
        traceService.updateTrace(mockTrace.id, 'other-user', 'EMPLOYEE', { status: 'completed' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ─── 5. deleteTrace ─────────────────────────────────────────────

  describe('deleteTrace', () => {
    it('should delete trace for owner', async () => {
      mockTaskTrace.findUnique.mockResolvedValue(mockTrace);
      mockTaskTrace.delete.mockResolvedValue(mockTrace);

      const result = await traceService.deleteTrace(mockTrace.id, 'user-1', 'EMPLOYEE');
      expect(result.success).toBe(true);
    });

    it('should throw 403 for non-owner', async () => {
      mockTaskTrace.findUnique.mockResolvedValue(mockTrace);

      await expect(
        traceService.deleteTrace(mockTrace.id, 'other-user', 'EMPLOYEE'),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ─── 6. getTraceSessions ────────────────────────────────────────

  describe('getTraceSessions', () => {
    it('should return tree structure of sessions', async () => {
      mockTaskTrace.findUnique.mockResolvedValue(mockTrace);
      const childSession = {
        ...mockSession,
        id: 'child-session',
        parentSessionId: mockSession.id,
      };
      mockTraceSession.findMany.mockResolvedValue([mockSession, childSession]);

      const result = await traceService.getTraceSessions(mockTrace.id, 'user-1', 'EMPLOYEE');
      expect(result.data).toHaveLength(1); // Only root
      expect(result.data[0].children).toHaveLength(1);
    });
  });

  // ─── 7. getSession ──────────────────────────────────────────────

  describe('getSession', () => {
    it('should return session with details', async () => {
      mockTraceSession.findUnique.mockResolvedValue(mockSession);

      const result = await traceService.getSession(mockSession.id);
      expect(result.id).toBe(mockSession.id);
    });

    it('should throw 404 for non-existent session', async () => {
      mockTraceSession.findUnique.mockResolvedValue(null);

      await expect(traceService.getSession('nonexistent')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // ─── 8. getSessionEvents ────────────────────────────────────────

  describe('getSessionEvents', () => {
    it('should return paginated events', async () => {
      mockSessionEvent.findMany.mockResolvedValue([mockEvent]);
      mockSessionEvent.count.mockResolvedValue(1);

      const result = await traceService.getSessionEvents(mockSession.id, { page: 1, limit: 50 });
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by event type', async () => {
      mockSessionEvent.findMany.mockResolvedValue([]);
      mockSessionEvent.count.mockResolvedValue(0);

      await traceService.getSessionEvents(mockSession.id, { type: 'llm_call' });

      expect(mockSessionEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: mockSession.id, type: 'llm_call' },
        }),
      );
    });
  });

  // ─── 9. getAgentSessions ────────────────────────────────────────

  describe('getAgentSessions', () => {
    it('should return paginated agent sessions', async () => {
      mockTraceSession.findMany.mockResolvedValue([mockSession]);
      mockTraceSession.count.mockResolvedValue(1);

      const result = await traceService.getAgentSessions('agent-1', { page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  // ─── 10. createSessionEvent ─────────────────────────────────────

  describe('createSessionEvent', () => {
    it('should create event and update session costs', async () => {
      mockTraceSession.findUnique.mockResolvedValue(mockSession);
      mockSessionEvent.create.mockResolvedValue(mockEvent);
      mockTraceSession.update.mockResolvedValue(mockSession);

      const result = await traceService.createSessionEvent(mockSession.id, {
        type: 'llm_call',
        content: 'Generated code',
        tokenCount: 500,
        cost: 0.05,
      });

      expect(result.id).toBe(mockEvent.id);
      expect(mockTraceSession.update).toHaveBeenCalled();
    });

    it('should throw 404 for non-existent session', async () => {
      mockTraceSession.findUnique.mockResolvedValue(null);

      await expect(
        traceService.createSessionEvent('nonexistent', { type: 'llm_call' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─── 11. getSessionTimeline ─────────────────────────────────────

  describe('getSessionTimeline', () => {
    it('should return grouped timeline', async () => {
      mockSessionEvent.findMany.mockResolvedValue([mockEvent]);

      const result = await traceService.getSessionTimeline(mockSession.id);
      expect(result.data.events).toHaveLength(1);
      expect(result.data.groups).toHaveProperty('llm_call');
      expect(result.data.totalEvents).toBe(1);
    });
  });
});
