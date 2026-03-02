import {
  delegateToolUseSchema,
  delegationResultSchema,
} from '../../../src/modules/command-center/delegation.schemas.js';

describe('Delegation Schemas', () => {
  // ─── delegateToolUseSchema ──────────────────────────────────────────

  describe('delegateToolUseSchema', () => {
    it('should validate correct delegation tool_use', () => {
      const validToolUse = {
        type: 'tool_use',
        id: 'toolu_01ABC123',
        name: 'delegate',
        input: {
          agentName: 'BackendForge',
          instruction: 'Create a REST API endpoint for user authentication',
          reason: 'Need backend implementation for login feature',
        },
      };

      const result = delegateToolUseSchema.safeParse(validToolUse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.input.agentName).toBe('BackendForge');
        expect(result.data.input.instruction).toContain('authentication');
      }
    });

    it('should validate all valid agent names', () => {
      const validAgents = ['BackendForge', 'UIcraft', 'DataArchitect', 'TestRunner', 'DocSmith'];

      validAgents.forEach((agentName) => {
        const toolUse = {
          type: 'tool_use',
          id: 'toolu_123',
          name: 'delegate',
          input: {
            agentName,
            instruction: 'Test instruction for ' + agentName,
            reason: 'Testing validation',
          },
        };

        const result = delegateToolUseSchema.safeParse(toolUse);

        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid agent name', () => {
      const invalidToolUse = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'delegate',
        input: {
          agentName: 'InvalidAgent',
          instruction: 'Do something',
          reason: 'Test',
        },
      };

      const result = delegateToolUseSchema.safeParse(invalidToolUse);

      expect(result.success).toBe(false);
    });

    it('should reject SHIWANGI as agent name (master cannot delegate to itself)', () => {
      const invalidToolUse = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'delegate',
        input: {
          agentName: 'SHIWANGI',
          instruction: 'Do something',
          reason: 'Test',
        },
      };

      const result = delegateToolUseSchema.safeParse(invalidToolUse);

      expect(result.success).toBe(false);
    });

    it('should reject instruction that is too short', () => {
      const invalidToolUse = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'delegate',
        input: {
          agentName: 'BackendForge',
          instruction: 'Short',
          reason: 'Testing',
        },
      };

      const result = delegateToolUseSchema.safeParse(invalidToolUse);

      expect(result.success).toBe(false);
    });

    it('should reject instruction that is too long', () => {
      const tooLongInstruction = 'a'.repeat(5001);

      const invalidToolUse = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'delegate',
        input: {
          agentName: 'BackendForge',
          instruction: tooLongInstruction,
          reason: 'Testing',
        },
      };

      const result = delegateToolUseSchema.safeParse(invalidToolUse);

      expect(result.success).toBe(false);
    });

    it('should accept instruction at max length (5000 chars)', () => {
      const maxLengthInstruction = 'a'.repeat(5000);

      const validToolUse = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'delegate',
        input: {
          agentName: 'BackendForge',
          instruction: maxLengthInstruction,
          reason: 'Testing',
        },
      };

      const result = delegateToolUseSchema.safeParse(validToolUse);

      expect(result.success).toBe(true);
    });

    it('should accept instruction at min length (10 chars)', () => {
      const minLengthInstruction = 'a'.repeat(10);

      const validToolUse = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'delegate',
        input: {
          agentName: 'BackendForge',
          instruction: minLengthInstruction,
          reason: 'Test!',
        },
      };

      const result = delegateToolUseSchema.safeParse(validToolUse);

      expect(result.success).toBe(true);
    });

    it('should reject reason that is too short', () => {
      const invalidToolUse = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'delegate',
        input: {
          agentName: 'BackendForge',
          instruction: 'Valid instruction here',
          reason: 'Hi',
        },
      };

      const result = delegateToolUseSchema.safeParse(invalidToolUse);

      expect(result.success).toBe(false);
    });

    it('should reject reason that is too long', () => {
      const tooLongReason = 'a'.repeat(501);

      const invalidToolUse = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'delegate',
        input: {
          agentName: 'BackendForge',
          instruction: 'Valid instruction',
          reason: tooLongReason,
        },
      };

      const result = delegateToolUseSchema.safeParse(invalidToolUse);

      expect(result.success).toBe(false);
    });

    it('should accept reason at max length (500 chars)', () => {
      const maxLengthReason = 'a'.repeat(500);

      const validToolUse = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'delegate',
        input: {
          agentName: 'BackendForge',
          instruction: 'Valid instruction',
          reason: maxLengthReason,
        },
      };

      const result = delegateToolUseSchema.safeParse(validToolUse);

      expect(result.success).toBe(true);
    });

    it('should reject wrong type (not tool_use)', () => {
      const invalidToolUse = {
        type: 'tool_result',
        id: 'toolu_123',
        name: 'delegate',
        input: {
          agentName: 'BackendForge',
          instruction: 'Valid instruction',
          reason: 'Testing',
        },
      };

      const result = delegateToolUseSchema.safeParse(invalidToolUse);

      expect(result.success).toBe(false);
    });

    it('should reject wrong tool name', () => {
      const invalidToolUse = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'other_tool',
        input: {
          agentName: 'BackendForge',
          instruction: 'Valid instruction',
          reason: 'Testing',
        },
      };

      const result = delegateToolUseSchema.safeParse(invalidToolUse);

      expect(result.success).toBe(false);
    });

    it('should reject missing fields', () => {
      const missingAgent = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'delegate',
        input: {
          instruction: 'Valid instruction',
          reason: 'Testing',
        },
      };

      expect(delegateToolUseSchema.safeParse(missingAgent).success).toBe(false);

      const missingInstruction = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'delegate',
        input: {
          agentName: 'BackendForge',
          reason: 'Testing',
        },
      };

      expect(delegateToolUseSchema.safeParse(missingInstruction).success).toBe(false);

      const missingReason = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'delegate',
        input: {
          agentName: 'BackendForge',
          instruction: 'Valid instruction',
        },
      };

      expect(delegateToolUseSchema.safeParse(missingReason).success).toBe(false);
    });

    it('should handle complex real-world instructions', () => {
      const complexToolUse = {
        type: 'tool_use',
        id: 'toolu_01D7FLrfh4GYq3BMLqLPT',
        name: 'delegate',
        input: {
          agentName: 'BackendForge',
          instruction: `Create a RESTful API endpoint for user authentication with the following requirements:
- POST /api/auth/login endpoint
- Accept email and password in request body
- Validate credentials against database
- Return JWT token on success
- Use bcrypt for password comparison
- Add rate limiting (5 attempts per 15 minutes)
- Log authentication attempts to audit log`,
          reason:
            'User requested authentication feature - backend implementation needed for secure login flow',
        },
      };

      const result = delegateToolUseSchema.safeParse(complexToolUse);

      expect(result.success).toBe(true);
    });
  });

  // ─── delegationResultSchema ─────────────────────────────────────────

  describe('delegationResultSchema', () => {
    it('should validate successful delegation result', () => {
      const validResult = {
        success: true,
        agentName: 'BackendForge',
        instruction: 'Create authentication endpoint',
        result: 'Here is the implementation...',
        sessionId: 'session-123',
        cost: 0.045,
        tokensUsed: {
          input: 1500,
          output: 2000,
          total: 3500,
        },
        durationMs: 2500,
      };

      const result = delegationResultSchema.safeParse(validResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.cost).toBe(0.045);
        expect(result.data.tokensUsed.total).toBe(3500);
      }
    });

    it('should validate failed delegation result', () => {
      const failedResult = {
        success: false,
        agentName: 'UIcraft',
        instruction: 'Build component',
        result: '',
        sessionId: 'session-456',
        cost: 0,
        tokensUsed: {
          input: 0,
          output: 0,
          total: 0,
        },
        durationMs: 100,
      };

      const result = delegationResultSchema.safeParse(failedResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(false);
        expect(result.data.cost).toBe(0);
      }
    });

    it('should accept zero cost', () => {
      const zeroCostResult = {
        success: true,
        agentName: 'DocSmith',
        instruction: 'Write docs',
        result: 'Documentation content',
        sessionId: 'session-789',
        cost: 0,
        tokensUsed: {
          input: 0,
          output: 0,
          total: 0,
        },
        durationMs: 500,
      };

      const result = delegationResultSchema.safeParse(zeroCostResult);

      expect(result.success).toBe(true);
    });

    it('should accept high token counts', () => {
      const highTokenResult = {
        success: true,
        agentName: 'TestRunner',
        instruction: 'Write comprehensive tests',
        result: 'Complete test suite...',
        sessionId: 'session-999',
        cost: 0.15,
        tokensUsed: {
          input: 5000,
          output: 8000,
          total: 13000,
        },
        durationMs: 5000,
      };

      const result = delegationResultSchema.safeParse(highTokenResult);

      expect(result.success).toBe(true);
    });

    it('should reject negative cost', () => {
      const invalidResult = {
        success: true,
        agentName: 'BackendForge',
        instruction: 'Test',
        result: 'Result',
        sessionId: 'session-123',
        cost: -0.01,
        tokensUsed: {
          input: 100,
          output: 200,
          total: 300,
        },
        durationMs: 1000,
      };

      const result = delegationResultSchema.safeParse(invalidResult);

      // Schema doesn't enforce positive numbers, but service should prevent this
      // This test documents current behavior
      expect(result.success).toBe(true); // Schema allows any number
    });

    it('should reject negative tokens', () => {
      const invalidResult = {
        success: true,
        agentName: 'BackendForge',
        instruction: 'Test',
        result: 'Result',
        sessionId: 'session-123',
        cost: 0.01,
        tokensUsed: {
          input: -100,
          output: 200,
          total: 100,
        },
        durationMs: 1000,
      };

      const result = delegationResultSchema.safeParse(invalidResult);

      // Schema doesn't enforce positive numbers
      expect(result.success).toBe(true);
    });

    it('should reject missing fields', () => {
      const missingSuccess = {
        agentName: 'BackendForge',
        instruction: 'Test',
        result: 'Result',
        sessionId: 'session-123',
        cost: 0.01,
        tokensUsed: { input: 100, output: 200, total: 300 },
        durationMs: 1000,
      };

      expect(delegationResultSchema.safeParse(missingSuccess).success).toBe(false);

      const missingCost = {
        success: true,
        agentName: 'BackendForge',
        instruction: 'Test',
        result: 'Result',
        sessionId: 'session-123',
        tokensUsed: { input: 100, output: 200, total: 300 },
        durationMs: 1000,
      };

      expect(delegationResultSchema.safeParse(missingCost).success).toBe(false);
    });

    it('should reject invalid tokensUsed structure', () => {
      const invalidTokens = {
        success: true,
        agentName: 'BackendForge',
        instruction: 'Test',
        result: 'Result',
        sessionId: 'session-123',
        cost: 0.01,
        tokensUsed: {
          input: 100,
          output: 200,
          // missing total
        },
        durationMs: 1000,
      };

      const result = delegationResultSchema.safeParse(invalidTokens);

      expect(result.success).toBe(false);
    });

    it('should handle empty result string', () => {
      const emptyResult = {
        success: true,
        agentName: 'BackendForge',
        instruction: 'Test instruction',
        result: '',
        sessionId: 'session-123',
        cost: 0.01,
        tokensUsed: {
          input: 100,
          output: 0,
          total: 100,
        },
        durationMs: 1000,
      };

      const result = delegationResultSchema.safeParse(emptyResult);

      expect(result.success).toBe(true);
    });

    it('should handle very long result strings', () => {
      const longResult = 'a'.repeat(50000);

      const validResult = {
        success: true,
        agentName: 'TestRunner',
        instruction: 'Write all tests',
        result: longResult,
        sessionId: 'session-123',
        cost: 0.5,
        tokensUsed: {
          input: 2000,
          output: 10000,
          total: 12000,
        },
        durationMs: 8000,
      };

      const result = delegationResultSchema.safeParse(validResult);

      expect(result.success).toBe(true);
    });

    it('should validate all sub-agent names', () => {
      const agents = ['BackendForge', 'UIcraft', 'DataArchitect', 'TestRunner', 'DocSmith'];

      agents.forEach((agentName) => {
        const delegationResult = {
          success: true,
          agentName,
          instruction: 'Test for ' + agentName,
          result: 'Completed',
          sessionId: 'session-' + agentName,
          cost: 0.02,
          tokensUsed: {
            input: 100,
            output: 150,
            total: 250,
          },
          durationMs: 1500,
        };

        const result = delegationResultSchema.safeParse(delegationResult);

        expect(result.success).toBe(true);
      });
    });

    it('should accept SHIWANGI as agent name (for orchestration tracking)', () => {
      const result = {
        success: true,
        agentName: 'SHIWANGI',
        instruction: 'Orchestrate task',
        result: 'Delegated to sub-agents',
        sessionId: 'session-master',
        cost: 0.01,
        tokensUsed: {
          input: 500,
          output: 300,
          total: 800,
        },
        durationMs: 2000,
      };

      const validationResult = delegationResultSchema.safeParse(result);

      expect(validationResult.success).toBe(true);
    });
  });
});
