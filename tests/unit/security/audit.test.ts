import { jest } from '@jest/globals';

const mockCreate = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({});

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: {
    auditLog: {
      create: mockCreate,
    },
  },
}));

const { logAudit } = await import('../../../src/lib/audit.js');

describe('logAudit()', () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockCreate.mockResolvedValue({});
  });

  it('calls prisma.auditLog.create with correct data', () => {
    logAudit({ action: 'LOGIN', resource: 'auth', userId: 'u1' });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'LOGIN',
        resource: 'auth',
        userId: 'u1',
      }),
    });
  });

  it('does not throw when prisma rejects', async () => {
    mockCreate.mockRejectedValue(new Error('DB down'));
    expect(() => logAudit({ action: 'FAIL', resource: 'test' })).not.toThrow();
    await new Promise(r => setTimeout(r, 50));
  });

  it('sets nullable fields to null when omitted', () => {
    logAudit({ action: 'VIEW', resource: 'dashboard' });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        resourceId: null,
        ipAddress: null,
        userAgent: null,
      }),
    });
  });
});
