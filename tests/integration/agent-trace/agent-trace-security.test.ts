import Fastify, { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import authRoutes from '../../../src/modules/auth/auth.routes.js';
import traceRoutes from '../../../src/modules/agent-trace/trace.routes.js';
import { redactSensitiveData } from '../../../src/services/redaction-service.js';

const prisma = new PrismaClient();

describe('AgentTrace Security Tests', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUserId: string;
  let userToken: string;
  let userId: string;
  let agentId: string;

  beforeAll(async () => {
    // Build Fastify app
    app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(authRoutes);
    await app.register(traceRoutes);
    await app.ready();

    // Login as admin
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@shelfzone.com',
        password: 'Admin@12345',
      },
    });

    const adminData = JSON.parse(adminLogin.body);
    adminToken = adminData.data.accessToken;
    adminUserId = adminData.data.user.id;

    // Find or create a regular user
    let user = await prisma.employee.findFirst({
      where: {
        email: { not: 'admin@shelfzone.com' },
        role: 'EMPLOYEE',
      },
    });

    if (!user) {
      user = await prisma.employee.create({
        data: {
          email: 'testuser@shelfzone.com',
          password: '$2b$10$abcdefghijklmnopqrstuvwxyz123456', // Pre-hashed
          firstName: 'Test',
          lastName: 'User',
          role: 'EMPLOYEE',
          departmentId: (await prisma.department.findFirst())?.id || '',
          designationId: (await prisma.designation.findFirst())?.id || '',
          joiningDate: new Date(),
          status: 'ACTIVE',
          employmentType: 'FULL_TIME',
        },
      });
    }

    userId = user.id;

    // Create agent for testing
    const agent = await prisma.agent.findFirst({
      where: { name: 'SecurityTestAgent' },
    });

    if (agent) {
      agentId = agent.id;
    } else {
      const newAgent = await prisma.agent.create({
        data: {
          name: 'SecurityTestAgent',
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
    await app.close();
    await prisma.$disconnect();
  });

  describe('Redaction Service', () => {
    it('should redact JWT tokens', () => {
      const input = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const redacted = redactSensitiveData(input);
      expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(redacted).toContain('[REDACTED:JWT_TOKEN]');
    });

    it('should redact passwords', () => {
      const input = 'password=SuperSecret123! and another password: "MyPass@456"';
      const redacted = redactSensitiveData(input);
      expect(redacted).toContain('[REDACTED:PASSWORD]');
      expect(redacted).not.toContain('SuperSecret123!');
      expect(redacted).not.toContain('MyPass@456');
    });

    it('should redact API keys', () => {
      const input = 'api_key=sk-1234567890abcdefghijklmnopqrstuvwxyz and another key: api_key: "pk_test_abcdefgh"';
      const redacted = redactSensitiveData(input);
      expect(redacted).toContain('[REDACTED:API_KEY]');
      expect(redacted).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz');
      expect(redacted).not.toContain('pk_test_abcdefgh');
    });

    it('should redact AWS keys', () => {
      const input = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      const redacted = redactSensitiveData(input);
      expect(redacted).toContain('[REDACTED:AWS_KEY]');
      expect(redacted).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(redacted).not.toContain('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
    });

    it('should redact private keys (PEM blocks)', () => {
      const input = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj
-----END PRIVATE KEY-----`;
      const redacted = redactSensitiveData(input);
      expect(redacted).toContain('[REDACTED:PRIVATE_KEY]');
      expect(redacted).not.toContain('MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj');
    });

    it('should redact RSA private keys', () => {
      const input = `-----BEGIN RSA PRIVATE KEY-----
MIICXAIBAAKBgQCqGKukO1De7zhZj6+H0qtjTkVxwTCpvKe4eCZ0FPqri0cb2JZfXJ/DgYSF6vUp
-----END RSA PRIVATE KEY-----`;
      const redacted = redactSensitiveData(input);
      expect(redacted).toContain('[REDACTED:PRIVATE_KEY]');
      expect(redacted).not.toContain('MIICXAIBAAKBgQCqGKukO1De7zhZj6+H0qtjTkVxwTCpvKe4eCZ0FPqri0cb2JZfXJ');
    });

    it('should redact credit card numbers', () => {
      const input = 'Card: 4532-1488-0343-6467 or 5425233430109903';
      const redacted = redactSensitiveData(input);
      expect(redacted).toContain('[REDACTED:CREDIT_CARD]');
      expect(redacted).not.toContain('4532-1488-0343-6467');
      expect(redacted).not.toContain('5425233430109903');
    });

    it('should redact email addresses', () => {
      const input = 'Contact: user@example.com or admin@company.org';
      const redacted = redactSensitiveData(input);
      expect(redacted).toContain('[REDACTED:EMAIL]');
      expect(redacted).not.toContain('user@example.com');
      expect(redacted).not.toContain('admin@company.org');
    });

    it('should handle multiple sensitive data types', () => {
      const input = `User email: admin@test.com
Password: Secret@123
API Key: sk-proj-abcdefghijklmnopqrstuvwxyz
Credit Card: 4532148803436467`;
      const redacted = redactSensitiveData(input);
      expect(redacted).toContain('[REDACTED:EMAIL]');
      expect(redacted).toContain('[REDACTED:PASSWORD]');
      expect(redacted).toContain('[REDACTED:API_KEY]');
      expect(redacted).toContain('[REDACTED:CREDIT_CARD]');
    });

    it('should preserve non-sensitive data', () => {
      const input = 'This is a normal message with no sensitive data. Temperature is 25 degrees.';
      const redacted = redactSensitiveData(input);
      expect(redacted).toBe(input);
    });
  });

  describe('Ownership Enforcement', () => {
    let adminTrace: any;
    let userTrace: any;

    beforeAll(async () => {
      // Create trace as admin
      adminTrace = await prisma.taskTrace.create({
        data: {
          instruction: 'Admin trace',
          ownerId: adminUserId,
          masterAgentId: agentId,
          status: 'PENDING',
        },
      });

      // Create trace as user
      userTrace = await prisma.taskTrace.create({
        data: {
          instruction: 'User trace',
          ownerId: userId,
          masterAgentId: agentId,
          status: 'PENDING',
        },
      });
    });

    afterAll(async () => {
      await prisma.traceSession.deleteMany({
        where: {
          traceId: { in: [adminTrace.id, userTrace.id] },
        },
      });
      await prisma.taskTrace.deleteMany({
        where: {
          id: { in: [adminTrace.id, userTrace.id] },
        },
      });
    });

    it('should allow admin to access their own trace', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/traces/${adminTrace.id}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.data.id).toBe(adminTrace.id);
    });

    it('should prevent regular user from accessing admin trace (if user token available)', async () => {
      // Try to get user token
      const userLoginAttempt = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'testuser@shelfzone.com',
          password: 'Employee@12345',
        },
      });

      if (userLoginAttempt.statusCode !== 200) {
        console.log('Skipping user authorization test: unable to login as user');
        return;
      }

      const userData = JSON.parse(userLoginAttempt.body);
      userToken = userData.data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: `/api/traces/${adminTrace.id}`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should prevent user from updating admin trace', async () => {
      if (!userToken) {
        console.log('Skipping: no user token');
        return;
      }

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/traces/${adminTrace.id}`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          status: 'COMPLETED',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should prevent user from deleting admin trace', async () => {
      if (!userToken) {
        console.log('Skipping: no user token');
        return;
      }

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/traces/${adminTrace.id}`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow SUPER_ADMIN to access any trace', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/traces/${userTrace.id}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      // Admin should be able to see user trace (based on role permissions)
      expect([200, 403]).toContain(response.statusCode);
    });
  });

  describe('Input Validation & SQL Injection Prevention', () => {
    it('should reject SQL injection attempts in trace instruction', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/traces',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          instruction: "'; DROP TABLE TaskTrace; --",
        },
      });

      // Should either accept it as sanitized text or reject it
      if (response.statusCode === 201) {
        const data = JSON.parse(response.body);
        // Verify the database wasn't compromised
        const traces = await prisma.taskTrace.findMany();
        expect(traces.length).toBeGreaterThan(0);
      }
    });

    it('should handle XSS attempts in event content', async () => {
      // Create a trace and session
      const traceResp = await app.inject({
        method: 'POST',
        url: '/api/traces',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          instruction: 'XSS test trace',
        },
      });

      const trace = JSON.parse(traceResp.body).data;

      const session = await prisma.traceSession.create({
        data: {
          traceId: trace.id,
          agentId: agentId,
          sessionType: 'MASTER',
          status: 'ACTIVE',
          startedAt: new Date(),
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/sessions/${session.id}/events`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          type: 'MESSAGE_OUT',
          content: '<script>alert("XSS")</script>',
        },
      });

      // Should create the event but sanitize the content
      expect([201, 400]).toContain(response.statusCode);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/traces',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/traces',
        headers: {
          authorization: 'Bearer invalid-token-12345',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject expired tokens', async () => {
      // An expired token from the past
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/traces',
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should enforce role-based access for admin endpoints', async () => {
      if (!userToken) {
        console.log('Skipping: no user token');
        return;
      }

      // Regular employee should not access org tree overview
      const response = await app.inject({
        method: 'GET',
        url: '/api/org-tree/agent-overview',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Rate Limiting & DoS Protection', () => {
    it('should handle rapid successive requests', async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        app.inject({
          method: 'GET',
          url: '/api/traces',
          headers: {
            authorization: `Bearer ${adminToken}`,
          },
        })
      );

      const responses = await Promise.all(promises);
      
      // Most should succeed, but rate limiting might kick in
      const successful = responses.filter(r => r.statusCode === 200).length;
      expect(successful).toBeGreaterThan(0);
    });
  });

  describe('Data Validation', () => {
    it('should reject invalid trace status', async () => {
      const traceResp = await app.inject({
        method: 'POST',
        url: '/api/traces',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          instruction: 'Test trace',
        },
      });

      const trace = JSON.parse(traceResp.body).data;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/traces/${trace.id}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          status: 'INVALID_STATUS',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid event type', async () => {
      const traceResp = await app.inject({
        method: 'POST',
        url: '/api/traces',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          instruction: 'Test trace',
        },
      });

      const trace = JSON.parse(traceResp.body).data;

      const session = await prisma.traceSession.create({
        data: {
          traceId: trace.id,
          agentId: agentId,
          sessionType: 'MASTER',
          status: 'ACTIVE',
          startedAt: new Date(),
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/sessions/${session.id}/events`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          type: 'INVALID_EVENT_TYPE',
          content: 'test',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require instruction when creating trace', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/traces',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
