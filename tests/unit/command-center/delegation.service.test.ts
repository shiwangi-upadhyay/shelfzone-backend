import { jest } from '@jest/globals';

// Mock Prisma client module first
jest.unstable_mockModule('@prisma/client', () => ({
  Prisma: {
    Decimal: class MockDecimal {
      constructor(value: any) {
        return value;
      }
    },
  },
}));

// Mock Prisma instance
const mockAgentRegistryFindFirst = jest.fn();
const mockAgentRegistryCreate = jest.fn();
const mockTaskTraceCreate = jest.fn();
const mockTraceSessionCreate = jest.fn();
const mockTraceSessionUpdate = jest.fn();

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  prisma: {
    agentRegistry: {
      findFirst: mockAgentRegistryFindFirst,
      create: mockAgentRegistryCreate,
    },
    taskTrace: {
      create: mockTaskTraceCreate,
    },
    traceSession: {
      create: mockTraceSessionCreate,
      update: mockTraceSessionUpdate,
    },
  },
}));

// Import after mocking
const { DelegationService } = await import('../../../src/modules/command-center/delegation.service.js');

// Mock global fetch
global.fetch = jest.fn() as any;

describe('DelegationService', () => {
  const userId = 'user-123';
  const anthropicApiKey = 'sk-ant-test-key';
  let service: DelegationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DelegationService(anthropicApiKey, userId);
  });

  // ─── delegateToAgent ────────────────────────────────────────────────

  describe('delegateToAgent', () => {
    it('should successfully delegate task to BackendForge', async () => {
      const agentName = 'BackendForge';
      const instruction = 'Create a user authentication API endpoint';
      const reason = 'Need backend API implementation';

      // Mock agent registry
      const mockAgent = {
        id: 'agent-123',
        name: agentName,
        model: 'claude-sonnet-4-5',
        systemPrompt: 'You are BackendForge...',
        temperature: 0.3,
        maxTokens: 8192,
      };

      mockAgentRegistryFindFirst.mockResolvedValue(mockAgent);

      // Mock task trace
      const mockTaskTrace = {
        id: 'task-trace-123',
        ownerId: userId,
        masterAgentId: mockAgent.id,
        instruction,
        status: 'running',
        startedAt: new Date(),
      };

      mockTaskTraceCreate.mockResolvedValue(mockTaskTrace);

      // Mock trace session
      const mockTraceSession = {
        id: 'trace-session-123',
        taskTraceId: mockTaskTrace.id,
        agentId: mockAgent.id,
        instruction,
        status: 'running',
        modelUsed: 'claude-sonnet-4-5',
        sessionType: 'delegation',
        startedAt: new Date(),
      };

      mockTraceSessionCreate.mockResolvedValue(mockTraceSession);
      mockTraceSessionUpdate.mockResolvedValue({});

      // Mock Anthropic API response
      const mockAnthropicResponse = {
        content: [
          {
            type: 'text',
            text: 'Here is the authentication endpoint implementation...',
          },
        ],
        usage: {
          input_tokens: 1500,
          output_tokens: 2000,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockAnthropicResponse,
      });

      const result = await service.delegateToAgent(agentName, instruction, reason);

      // Verify result
      expect(result).toMatchObject({
        success: true,
        agentName,
        instruction,
        result: 'Here is the authentication endpoint implementation...',
        sessionId: mockTraceSession.id,
        tokensUsed: {
          input: 1500,
          output: 2000,
          total: 3500,
        },
      });

      expect(result.cost).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // Verify Anthropic API call
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
          },
        })
      );

      // Verify trace session was updated
      expect(mockTraceSessionUpdate).toHaveBeenCalledWith({
        where: { id: mockTraceSession.id },
        data: expect.objectContaining({
          status: 'success',
          tokensIn: 1500,
          tokensOut: 2000,
        }),
      });
    });

    it('should create agent registry entry if not exists', async () => {
      const agentName = 'TestRunner';
      const instruction = 'Write unit tests for the user service';
      const reason = 'Need test coverage';

      // Agent doesn't exist
      mockAgentRegistryFindFirst.mockResolvedValue(null);

      // Mock agent creation
      const mockAgent = {
        id: 'new-agent-123',
        name: agentName,
        model: 'claude-sonnet-4-5',
        slug: 'testrunner',
        type: 'INTEGRATION',
        status: 'ACTIVE',
      };

      mockAgentRegistryCreate.mockResolvedValue(mockAgent);

      mockTaskTraceCreate.mockResolvedValue({
        id: 'task-123',
        ownerId: userId,
      });

      mockTraceSessionCreate.mockResolvedValue({
        id: 'session-123',
        agentId: mockAgent.id,
      });

      mockTraceSessionUpdate.mockResolvedValue({});

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Test implementation...' }],
          usage: { input_tokens: 1000, output_tokens: 1500 },
        }),
      });

      await service.delegateToAgent(agentName, instruction, reason);

      // Verify agent was created
      expect(mockAgentRegistryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: agentName,
          slug: agentName.toLowerCase(),
          type: 'INTEGRATION',
          status: 'ACTIVE',
          model: 'claude-sonnet-4-5',
          createdBy: userId,
        }),
      });
    });

    it('should throw error for unknown agent', async () => {
      await expect(
        service.delegateToAgent('UnknownAgent', 'test', 'reason')
      ).rejects.toThrow('Unknown agent: UnknownAgent');

      expect(mockAgentRegistryFindFirst).not.toHaveBeenCalled();
    });

    it('should handle Anthropic API errors', async () => {
      const agentName = 'DocSmith';

      mockAgentRegistryFindFirst.mockResolvedValue({
        id: 'agent-123',
        name: agentName,
        model: 'claude-haiku-4-5',
      });

      mockTaskTraceCreate.mockResolvedValue({ id: 'task-123' });
      mockTraceSessionCreate.mockResolvedValue({ id: 'session-123' });
      mockTraceSessionUpdate.mockResolvedValue({});

      // Mock API error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: async () => 'API rate limit exceeded',
      });

      await expect(
        service.delegateToAgent(agentName, 'Write docs', 'Documentation needed')
      ).rejects.toThrow('Anthropic API error');

      // Verify trace session marked as failed
      expect(mockTraceSessionUpdate).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: expect.objectContaining({
          status: 'failed',
        }),
      });
    });

    it('should calculate costs correctly for different models', async () => {
      // Use real agents with their actual models
      const testCases = [
        {
          agentName: 'BackendForge',
          model: 'claude-sonnet-4-5',
          inputTokens: 1000,
          outputTokens: 2000,
          expectedMinCost: 0.003 + 0.03, // (1000/1M)*3 + (2000/1M)*15
        },
        {
          agentName: 'DocSmith',
          model: 'claude-haiku-4-5',
          inputTokens: 1000,
          outputTokens: 2000,
          expectedMinCost: 0.0008 + 0.008, // (1000/1M)*0.8 + (2000/1M)*4
        },
      ];

      for (const testCase of testCases) {
        mockAgentRegistryFindFirst.mockResolvedValue({
          id: `agent-${testCase.agentName}`,
          name: testCase.agentName,
          model: testCase.model,
        });

        mockTaskTraceCreate.mockResolvedValue({ id: 'task-123' });
        mockTraceSessionCreate.mockResolvedValue({ id: 'session-123' });
        mockTraceSessionUpdate.mockResolvedValue({});

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            content: [{ type: 'text', text: 'Result' }],
            usage: {
              input_tokens: testCase.inputTokens,
              output_tokens: testCase.outputTokens,
            },
          }),
        });

        const result = await service.delegateToAgent(testCase.agentName, 'test', 'reason');

        expect(result.cost).toBeGreaterThanOrEqual(testCase.expectedMinCost);
        expect(result.tokensUsed.input).toBe(testCase.inputTokens);
        expect(result.tokensUsed.output).toBe(testCase.outputTokens);
      }
    });

    it('should handle zero tokens', async () => {
      const agentName = 'DocSmith';
      
      mockAgentRegistryFindFirst.mockResolvedValue({
        id: 'agent-123',
        name: agentName,
        model: 'claude-haiku-4-5',
      });

      mockTaskTraceCreate.mockResolvedValue({ id: 'task-123' });
      mockTraceSessionCreate.mockResolvedValue({ id: 'session-123' });
      mockTraceSessionUpdate.mockResolvedValue({});

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '' }],
          usage: {
            input_tokens: 0,
            output_tokens: 0,
          },
        }),
      });

      const result = await service.delegateToAgent(agentName, 'test', 'reason');

      expect(result.cost).toBe(0);
      expect(result.tokensUsed.total).toBe(0);
    });

    it('should handle missing response content', async () => {
      const agentName = 'DataArchitect';
      
      mockAgentRegistryFindFirst.mockResolvedValue({
        id: 'agent-123',
        name: agentName,
        model: 'claude-sonnet-4-5',
      });

      mockTaskTraceCreate.mockResolvedValue({ id: 'task-123' });
      mockTraceSessionCreate.mockResolvedValue({ id: 'session-123' });
      mockTraceSessionUpdate.mockResolvedValue({});

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [],
          usage: { input_tokens: 100, output_tokens: 0 },
        }),
      });

      const result = await service.delegateToAgent(agentName, 'test', 'reason');

      expect(result.result).toBe('');
    });

    it('should delegate to all sub-agents', async () => {
      const subAgents = ['BackendForge', 'UIcraft', 'DataArchitect', 'TestRunner', 'DocSmith'];

      for (const agentName of subAgents) {
        mockAgentRegistryFindFirst.mockResolvedValue({
          id: `agent-${agentName}`,
          name: agentName,
          model: 'claude-sonnet-4-5',
        });

        mockTaskTraceCreate.mockResolvedValue({ id: 'task-123' });
        mockTraceSessionCreate.mockResolvedValue({ id: 'session-123' });
        mockTraceSessionUpdate.mockResolvedValue({});

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            content: [{ type: 'text', text: `${agentName} response` }],
            usage: { input_tokens: 500, output_tokens: 1000 },
          }),
        });

        const result = await service.delegateToAgent(
          agentName,
          `Task for ${agentName}`,
          'Testing delegation'
        );

        expect(result.success).toBe(true);
        expect(result.agentName).toBe(agentName);
        expect(result.result).toBe(`${agentName} response`);
      }
    });

    it('should track duration correctly', async () => {
      const agentName = 'UIcraft';
      
      mockAgentRegistryFindFirst.mockResolvedValue({
        id: 'agent-123',
        name: agentName,
        model: 'claude-sonnet-4-5',
      });

      mockTaskTraceCreate.mockResolvedValue({ id: 'task-123' });
      mockTraceSessionCreate.mockResolvedValue({ id: 'session-123' });
      mockTraceSessionUpdate.mockResolvedValue({});

      // Simulate API delay
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    content: [{ type: 'text', text: 'Result' }],
                    usage: { input_tokens: 100, output_tokens: 200 },
                  }),
                }),
              100
            )
          )
      );

      const result = await service.delegateToAgent(agentName, 'test', 'reason');

      expect(result.durationMs).toBeGreaterThanOrEqual(100);
    });

    it('should pass correct system prompt to agent', async () => {
      const agentName = 'BackendForge';

      mockAgentRegistryFindFirst.mockResolvedValue({
        id: 'agent-123',
        name: agentName,
        model: 'claude-sonnet-4-5',
      });

      mockTaskTraceCreate.mockResolvedValue({ id: 'task-123' });
      mockTraceSessionCreate.mockResolvedValue({ id: 'session-123' });
      mockTraceSessionUpdate.mockResolvedValue({});

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Result' }],
          usage: { input_tokens: 100, output_tokens: 200 },
        }),
      });

      await service.delegateToAgent(agentName, 'Build API', 'Need backend');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.system).toContain('BackendForge');
      expect(requestBody.system).toContain('Fastify');
      expect(requestBody.model).toBe('claude-sonnet-4-5');
      expect(requestBody.temperature).toBe(0.3);
      expect(requestBody.max_tokens).toBe(8192);
    });
  });
});
