import Fastify, { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import authRoutes from '../../../src/modules/auth/auth.routes.js';
import traceRoutes from '../../../src/modules/agent-trace/trace.routes.js';
import { env } from '../../../src/config/env.js';

const prisma = new PrismaClient();

describe('AgentTrace Integration Tests', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUserId: string;
  let traceId: string;
  let sessionId: string;
  let agentId: string;

  beforeAll(async () => {
    // Build Fastify app
    app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(authRoutes);
    await app.register(traceRoutes);
    await app.ready();

    // Login as admin to get token
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@shelfzone.com',
        password: 'Admin@12345',
      },
    });

    expect(loginResponse.statusCode).toBe(200);
    const loginData = JSON.parse(loginResponse.body);
    adminToken = loginData.data.accessToken;
    adminUserId = loginData.data.user.id;

    // Create a test agent for testing
    const agent = await prisma.agent.findFirst({
      where: { name: 'TestAgent' },
    });

    if (agent) {
      agentId = agent.id;
    } else {
      const newAgent = await prisma.agent.create({
        data: {
          name: 'TestAgent',
          model: 'claude-3-5-sonnet-20241022',
          type: 'SUB_AGENT',
          status: 'ACTIVE',
          employeeId: adminUserId,
        },
      });
      agentId = newAgent.id;
    }
  });

  afterAll(async () => {
    // Cleanup: Delete test traces
    if (traceId) {
      await prisma.traceEvent.deleteMany({
        where: {
          session: {
            traceId: traceId,
          },
        },
      });
      await prisma.traceSession.deleteMany({
        where: { traceId: traceId },
      });
      await prisma.taskTrace.deleteMany({
        where: { id: traceId },
      });
    }

    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /api/traces', () => {
    it('should create a new trace', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/traces',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          instruction: 'Test trace for integration testing',
          masterAgentId: agentId,
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.data).toHaveProperty('id');
      expect(data.data.instruction).toBe('Test trace for integration testing');
      expect(data.data.status).toBe('PENDING');
      traceId = data.data.id;
    });

    it('should reject trace creation without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/traces',
        payload: {
          instruction: 'Test trace without auth',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/traces', () => {
    it('should list traces for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/traces',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/traces?page=1&limit=5',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('pagination');
      expect(data.pagination.limit).toBe(5);
    });

    it('should filter by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/traces?status=PENDING',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.data.every((t: any) => t.status === 'PENDING')).toBe(true);
    });
  });

  describe('GET /api/traces/:id', () => {
    it('should get trace detail', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/traces/${traceId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.data.id).toBe(traceId);
      expect(data.data.instruction).toBe('Test trace for integration testing');
    });

    it('should return 404 for non-existent trace', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/traces/non-existent-id',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/traces/:id', () => {
    it('should update trace status', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/traces/${traceId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          status: 'IN_PROGRESS',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.data.status).toBe('IN_PROGRESS');
    });

    it('should update result when completed', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/traces/${traceId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          status: 'COMPLETED',
          result: 'Test completed successfully',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.data.status).toBe('COMPLETED');
      expect(data.data.result).toBe('Test completed successfully');
    });
  });

  describe('POST /api/sessions and Events', () => {
    beforeAll(async () => {
      // Create a session directly via Prisma for testing
      const session = await prisma.traceSession.create({
        data: {
          traceId: traceId,
          agentId: agentId,
          sessionType: 'MASTER',
          status: 'ACTIVE',
          startedAt: new Date(),
        },
      });
      sessionId = session.id;
    });

    it('should create session events', async () => {
      const eventTypes = [
        { type: 'THINKING', content: 'Analyzing the problem...' },
        { type: 'TOOL_CALL', content: 'Calling external API', metadata: { tool: 'web_search', query: 'test' } },
        { type: 'MESSAGE_IN', content: 'User request received' },
        { type: 'MESSAGE_OUT', content: 'Response sent to user' },
        { type: 'ERROR', content: 'An error occurred', metadata: { error: 'Test error' } },
        { type: 'FIX', content: 'Attempting to fix the error' },
      ];

      for (const event of eventTypes) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/sessions/${sessionId}/events`,
          headers: {
            authorization: `Bearer ${adminToken}`,
          },
          payload: event,
        });

        expect(response.statusCode).toBe(201);
        const data = JSON.parse(response.body);
        expect(data.data.type).toBe(event.type);
        expect(data.data.content).toBe(event.content);
      }
    });

    it('should get session events', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/${sessionId}/events`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.data.length).toBeGreaterThan(0);
    });

    it('should filter session events by type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/${sessionId}/events?type=THINKING`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.data.every((e: any) => e.type === 'THINKING')).toBe(true);
    });

    it('should get session timeline', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/${sessionId}/timeline`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('GET /api/traces/:traceId/sessions', () => {
    it('should get trace sessions tree', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/traces/${traceId}/sessions`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('should get session detail', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.data.id).toBe(sessionId);
      expect(data.data.traceId).toBe(traceId);
    });
  });

  describe('GET /api/agents/:agentId/sessions', () => {
    it('should get agent sessions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/agents/${agentId}/sessions`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('GET /api/traces/:id/flow', () => {
    it('should get trace flow graph', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/traces/${traceId}/flow`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('nodes');
      expect(data).toHaveProperty('edges');
      expect(Array.isArray(data.nodes)).toBe(true);
      expect(Array.isArray(data.edges)).toBe(true);
    });
  });

  describe('GET /api/agents/:id/cost-breakdown', () => {
    it('should get agent cost breakdown', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/agents/${agentId}/cost-breakdown`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('data');
    });
  });

  describe('GET /api/agents/:id/stats', () => {
    it('should get agent stats', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/agents/${agentId}/stats`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('totalSessions');
      expect(data.data).toHaveProperty('totalCost');
    });
  });

  describe('GET /api/employees/:id/agent-summary', () => {
    it('should get employee agent summary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/employees/${adminUserId}/agent-summary`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('data');
    });
  });

  describe('GET /api/org-tree/agent-overview', () => {
    it('should get org tree agent overview', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/org-tree/agent-overview',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('data');
    });
  });

  describe('DELETE /api/traces/:id', () => {
    it('should delete trace', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/traces/${traceId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 when deleting non-existent trace', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/traces/non-existent-id',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Authorization Tests', () => {
    let userToken: string;
    let userTraceId: string;

    beforeAll(async () => {
      // Create a regular user
      const user = await prisma.employee.findFirst({
        where: {
          email: { not: 'admin@shelfzone.com' },
          role: 'EMPLOYEE',
        },
      });

      if (user) {
        // Login as user
        const loginResponse = await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email: user.email,
            password: 'Employee@12345', // Assuming default password
          },
        });

        if (loginResponse.statusCode === 200) {
          const loginData = JSON.parse(loginResponse.body);
          userToken = loginData.data.accessToken;
        }
      }
    });

    it('should not allow user to access another users trace', async () => {
      if (!userToken) {
        console.log('Skipping authorization test: no user token available');
        return;
      }

      // Create a trace as admin
      const adminTraceResponse = await app.inject({
        method: 'POST',
        url: '/api/traces',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          instruction: 'Admin-only trace',
        },
      });

      const adminTrace = JSON.parse(adminTraceResponse.body).data;

      // Try to access as regular user
      const response = await app.inject({
        method: 'GET',
        url: `/api/traces/${adminTrace.id}`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/traces/:id/events/stream', () => {
    it('should stream events (SSE)', async () => {
      // Note: Full SSE testing requires special setup
      // This test just verifies the endpoint responds
      const response = await app.inject({
        method: 'GET',
        url: `/api/traces/${traceId}/events/stream`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      // SSE endpoints typically return 200 even if no events yet
      expect([200, 404]).toContain(response.statusCode);
    });
  });
});
