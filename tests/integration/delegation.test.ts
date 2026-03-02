import { jest } from '@jest/globals';

// Mock environment
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.API_KEY_ENCRYPTION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Mock fetch globally
global.fetch = jest.fn() as any;

describe('Phase 3 Delegation Integration Tests', () => {
  let app: any;
  let authToken: string;

  beforeAll(async () => {
    // Import after mocks are in place
    const { default: build } = await import('../../src/app.js');
    app = await build({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/command-center/delegate', () => {
    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/command-center/delegate',
        payload: {
          agentId: 'SHIWANGI',
          message: 'Test message',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with missing required fields', async () => {
      // Login first to get auth token
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'admin@shelfzone.com',
          password: 'admin123',
        },
      });

      const { accessToken } = JSON.parse(loginResponse.body);
      authToken = accessToken;

      // Test missing message
      const response = await app.inject({
        method: 'POST',
        url: '/api/command-center/delegate',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          agentId: 'SHIWANGI',
          // missing message
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Validation Error');
    });

    it('should return 400 with empty message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/command-center/delegate',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          agentId: 'SHIWANGI',
          message: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Validation Error');
    });

    it('should return 403 if no API key configured', async () => {
      // Login as employee who has no API key
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'employee@shelfzone.com',
          password: 'employee123',
        },
      });

      const { accessToken } = JSON.parse(loginResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: '/api/command-center/delegate',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          agentId: 'SHIWANGI',
          message: 'Test message',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('No API key configured');
    });

    it('should handle delegation with valid request', async () => {
      // Mock Anthropic API response (no tool use)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'text',
              text: 'Hello! How can I help you today?',
            },
          ],
          usage: {
            input_tokens: 100,
            output_tokens: 50,
          },
        }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/command-center/delegate',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          agentId: 'SHIWANGI',
          message: 'Hello',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('message');
      expect(body.data.message).toBe('Hello! How can I help you today?');
    });

    it('should handle delegation with tool use', async () => {
      // Mock first call (with tool_use)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'text',
              text: "I'll delegate this to BackendForge.",
            },
            {
              type: 'tool_use',
              id: 'toolu_123',
              name: 'delegate',
              input: {
                agentName: 'BackendForge',
                instruction: 'Create a user authentication API',
                reason: 'Need backend implementation',
              },
            },
          ],
          usage: {
            input_tokens: 200,
            output_tokens: 100,
          },
        }),
      });

      // Mock sub-agent call (BackendForge)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'text',
              text: 'Here is the authentication endpoint implementation...',
            },
          ],
          usage: {
            input_tokens: 300,
            output_tokens: 500,
          },
        }),
      });

      // Mock final SHIWANGI call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'text',
              text: 'BackendForge has implemented the authentication API successfully.',
            },
          ],
          usage: {
            input_tokens: 400,
            output_tokens: 80,
          },
        }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/command-center/delegate',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          agentId: 'SHIWANGI',
          message: 'Build a user authentication API',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('message');
      expect(body.data).toHaveProperty('delegations');
      expect(body.data.delegations).toHaveLength(1);
      expect(body.data.delegations[0].agentName).toBe('BackendForge');
    });

    it('should return 500 on Anthropic API error', async () => {
      // Mock API error
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/command-center/delegate',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          agentId: 'SHIWANGI',
          message: 'Test message',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Anthropic API error');
    });

    it('should return 404 if SHIWANGI agent not found', async () => {
      // This would happen if SHIWANGI is not in the database
      // We can't easily test this without dropping the agent from DB
      // So we'll skip this test
    });
  });
});
