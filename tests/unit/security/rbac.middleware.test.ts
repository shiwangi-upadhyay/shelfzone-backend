import { requireRole } from '../../../src/middleware/rbac.middleware.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

function mockRequest(user?: { role: string } | null): FastifyRequest {
  return { user } as unknown as FastifyRequest;
}

function mockReply(): FastifyReply & { statusCode: number; body: unknown } {
  const rep: any = { statusCode: 0, body: null };
  rep.status = (code: number) => { rep.statusCode = code; return rep; };
  rep.send = (body: unknown) => { rep.body = body; return rep; };
  return rep;
}

describe('RBAC Middleware — requireRole()', () => {
  it('allows a user with the correct role', async () => {
    const handler = requireRole('HR_ADMIN' as any);
    const req = mockRequest({ role: 'HR_ADMIN' });
    const rep = mockReply();
    await handler(req, rep as any);
    expect(rep.statusCode).toBe(0); // status() never called
  });

  it('returns 403 for an unauthorized role', async () => {
    const handler = requireRole('SUPER_ADMIN' as any);
    const req = mockRequest({ role: 'EMPLOYEE' });
    const rep = mockReply();
    await handler(req, rep as any);
    expect(rep.statusCode).toBe(403);
    expect(rep.body).toEqual({ error: 'Forbidden', message: 'Insufficient permissions' });
  });

  it('returns 403 when user is missing', async () => {
    const handler = requireRole('HR_ADMIN' as any);
    const req = mockRequest(null);
    const rep = mockReply();
    await handler(req, rep as any);
    expect(rep.statusCode).toBe(403);
  });

  it('returns 403 when user is undefined', async () => {
    const handler = requireRole('HR_ADMIN' as any);
    const req = mockRequest(undefined as any);
    const rep = mockReply();
    await handler(req, rep as any);
    expect(rep.statusCode).toBe(403);
  });

  it('allows when user has one of multiple accepted roles', async () => {
    const handler = requireRole('HR_ADMIN' as any, 'MANAGER' as any);
    const req = mockRequest({ role: 'MANAGER' });
    const rep = mockReply();
    await handler(req, rep as any);
    expect(rep.statusCode).toBe(0);
  });

  it('rejects when user role is not in the accepted list', async () => {
    const handler = requireRole('SUPER_ADMIN' as any, 'HR_ADMIN' as any);
    const req = mockRequest({ role: 'EMPLOYEE' });
    const rep = mockReply();
    await handler(req, rep as any);
    expect(rep.statusCode).toBe(403);
  });
});
