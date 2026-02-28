/**
 * Ownership enforcement tests for trace-auth middleware.
 * Uses mocked Prisma client.
 */

const mockPrisma = {
  taskTrace: { findUnique: jest.fn() },
  traceSession: { findUnique: jest.fn() },
  agentRegistry: { findMany: jest.fn() },
  department: { findMany: jest.fn() },
  employee: { findMany: jest.fn() },
};

jest.mock('../../src/lib/prisma.js', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { canAccessTrace, canAccessSession } from '../../src/middleware/trace-auth.js';

beforeEach(() => jest.clearAllMocks());

describe('canAccessTrace', () => {
  it('SUPER_ADMIN can access any trace', async () => {
    expect(await canAccessTrace('admin1', 'SUPER_ADMIN', 'trace1')).toBe(true);
  });

  it('owner can access own trace', async () => {
    mockPrisma.taskTrace.findUnique.mockResolvedValue({ ownerId: 'user1' });
    expect(await canAccessTrace('user1', 'EMPLOYEE', 'trace1')).toBe(true);
  });

  it('non-owner cannot access trace', async () => {
    mockPrisma.taskTrace.findUnique.mockResolvedValue({ ownerId: 'user2' });
    mockPrisma.department.findMany.mockResolvedValue([]);
    expect(await canAccessTrace('user1', 'EMPLOYEE', 'trace1')).toBe(false);
  });

  it('returns false for non-existent trace', async () => {
    mockPrisma.taskTrace.findUnique.mockResolvedValue(null);
    expect(await canAccessTrace('user1', 'EMPLOYEE', 'nope')).toBe(false);
  });

  it('HR_ADMIN can access traces of managed department employees', async () => {
    mockPrisma.taskTrace.findUnique.mockResolvedValue({ ownerId: 'emp1' });
    mockPrisma.department.findMany.mockResolvedValue([{ id: 'dept1' }]);
    mockPrisma.employee.findMany.mockResolvedValue([{ userId: 'emp1' }]);
    expect(await canAccessTrace('hr1', 'HR_ADMIN', 'trace1')).toBe(true);
  });
});

describe('canAccessSession', () => {
  it('SUPER_ADMIN can access any session', async () => {
    expect(await canAccessSession('admin1', 'SUPER_ADMIN', 'sess1')).toBe(true);
  });

  it('owner can access own session', async () => {
    mockPrisma.traceSession.findUnique.mockResolvedValue({
      taskTrace: { ownerId: 'user1' },
    });
    expect(await canAccessSession('user1', 'EMPLOYEE', 'sess1')).toBe(true);
  });

  it('non-owner cannot access session', async () => {
    mockPrisma.traceSession.findUnique.mockResolvedValue({
      taskTrace: { ownerId: 'user2' },
    });
    mockPrisma.department.findMany.mockResolvedValue([]);
    expect(await canAccessSession('user1', 'EMPLOYEE', 'sess1')).toBe(false);
  });
});
