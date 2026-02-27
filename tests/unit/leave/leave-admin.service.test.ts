import { jest } from '@jest/globals';
import { LeaveType, EmployeeStatus } from '@prisma/client';

// Mock data
const mockPolicies = [
  {
    id: 'policy-1',
    leaveType: LeaveType.CASUAL,
    name: 'Casual Leave',
    totalDaysPerYear: 12,
    maxConsecutiveDays: 5,
    isActive: true,
    canCarryForward: true,
    maxCarryForwardDays: 5,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'policy-2',
    leaveType: LeaveType.SICK,
    name: 'Sick Leave',
    totalDaysPerYear: 10,
    maxConsecutiveDays: 7,
    isActive: true,
    canCarryForward: false,
    maxCarryForwardDays: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'policy-3',
    leaveType: LeaveType.EARNED,
    name: 'Earned Leave',
    totalDaysPerYear: 15,
    maxConsecutiveDays: 10,
    isActive: true,
    canCarryForward: true,
    maxCarryForwardDays: 10,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

const mockBalance = {
  id: 'balance-1',
  employeeId: 'emp-1',
  leaveType: LeaveType.CASUAL,
  year: 2024,
  totalEntitled: 12,
  used: 2,
  carriedForward: 0,
  remaining: 10,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockEmployees = [
  { id: 'emp-1', status: EmployeeStatus.ACTIVE },
  { id: 'emp-2', status: EmployeeStatus.ACTIVE },
  { id: 'emp-3', status: EmployeeStatus.INACTIVE },
];

const mockPreviousYearBalances = [
  {
    id: 'prev-balance-1',
    employeeId: 'emp-1',
    leaveType: LeaveType.CASUAL,
    year: 2023,
    totalEntitled: 12,
    used: 7,
    carriedForward: 0,
    remaining: 5,
  },
  {
    id: 'prev-balance-2',
    employeeId: 'emp-1',
    leaveType: LeaveType.EARNED,
    year: 2023,
    totalEntitled: 15,
    used: 5,
    carriedForward: 0,
    remaining: 10,
  },
  {
    id: 'prev-balance-3',
    employeeId: 'emp-2',
    leaveType: LeaveType.CASUAL,
    year: 2023,
    totalEntitled: 12,
    used: 12,
    carriedForward: 0,
    remaining: 0, // No balance to carry forward
  },
];

// Mock Prisma methods
const mockFindUnique = jest.fn<(...args: any[]) => Promise<any>>();
const mockFindMany = jest.fn<(...args: any[]) => Promise<any>>();
const mockCreate = jest.fn<(...args: any[]) => Promise<any>>();
const mockUpdate = jest.fn<(...args: any[]) => Promise<any>>();

// Mock audit log
const mockLogAudit = jest.fn();

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: {
    leavePolicy: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
    },
    leaveBalance: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      create: mockCreate,
      update: mockUpdate,
    },
    employee: {
      findMany: mockFindMany,
    },
  },
}));

jest.unstable_mockModule('../../../src/lib/audit.js', () => ({
  logAudit: mockLogAudit,
}));

const {
  initializeEmployeeBalances,
  initializeAllBalances,
  adjustBalance,
  getEmployeeBalances,
  carryForwardBalances,
} = await import('../../../src/modules/leave-admin/leave-admin.service.js');

describe('Leave Admin Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeEmployeeBalances', () => {
    it('should create balances from active policies', async () => {
      mockFindMany.mockResolvedValueOnce(mockPolicies);

      // No existing balances
      mockFindUnique.mockResolvedValue(null);

      mockCreate
        .mockResolvedValueOnce({
          ...mockBalance,
          leaveType: LeaveType.CASUAL,
          totalEntitled: 12,
        })
        .mockResolvedValueOnce({
          ...mockBalance,
          id: 'balance-2',
          leaveType: LeaveType.SICK,
          totalEntitled: 10,
        })
        .mockResolvedValueOnce({
          ...mockBalance,
          id: 'balance-3',
          leaveType: LeaveType.EARNED,
          totalEntitled: 15,
        });

      const result = await initializeEmployeeBalances('emp-1', 2024);

      expect(result).toHaveLength(3);
      expect(result).toEqual(
        expect.arrayContaining([
          { leaveType: LeaveType.CASUAL, totalEntitled: 12 },
          { leaveType: LeaveType.SICK, totalEntitled: 10 },
          { leaveType: LeaveType.EARNED, totalEntitled: 15 },
        ]),
      );
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('should skip existing balances', async () => {
      mockFindMany.mockResolvedValueOnce(mockPolicies);

      // First policy exists, others don't
      mockFindUnique
        .mockResolvedValueOnce(mockBalance) // CASUAL exists
        .mockResolvedValueOnce(null) // SICK doesn't exist
        .mockResolvedValueOnce(null); // EARNED doesn't exist

      mockCreate
        .mockResolvedValueOnce({
          ...mockBalance,
          id: 'balance-2',
          leaveType: LeaveType.SICK,
        })
        .mockResolvedValueOnce({
          ...mockBalance,
          id: 'balance-3',
          leaveType: LeaveType.EARNED,
        });

      const result = await initializeEmployeeBalances('emp-1', 2024);

      expect(result).toHaveLength(2); // Only 2 created
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result).not.toContainEqual(expect.objectContaining({ leaveType: LeaveType.CASUAL }));
    });

    it('should set correct initial values', async () => {
      mockFindMany.mockResolvedValueOnce([mockPolicies[0]]);
      mockFindUnique.mockResolvedValueOnce(null);
      mockCreate.mockResolvedValueOnce(mockBalance);

      await initializeEmployeeBalances('emp-1', 2024);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          employeeId: 'emp-1',
          leaveType: LeaveType.CASUAL,
          year: 2024,
          totalEntitled: 12,
          used: 0,
          carriedForward: 0,
          remaining: 12,
        }),
      });
    });
  });

  describe('initializeAllBalances', () => {
    it('should initialize balances for all active employees', async () => {
      mockFindMany.mockResolvedValueOnce([
        { id: 'emp-1', status: EmployeeStatus.ACTIVE },
        { id: 'emp-2', status: EmployeeStatus.ACTIVE },
      ]);

      // Mock initializeEmployeeBalances for each employee
      mockFindMany.mockResolvedValue(mockPolicies);
      mockFindUnique.mockResolvedValue(null); // No existing balances
      mockCreate.mockResolvedValue(mockBalance);

      const result = await initializeAllBalances(2024);

      expect(result.employeesProcessed).toBe(2);
      expect(result.balancesCreated).toBe(6); // 2 employees * 3 policies
    });

    it('should skip inactive employees', async () => {
      mockFindMany.mockResolvedValueOnce(mockEmployees);
      mockFindMany.mockResolvedValue(mockPolicies);
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue(mockBalance);

      const result = await initializeAllBalances(2024);

      expect(result.employeesProcessed).toBe(3); // All employees including inactive
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
    });

    it('should return zero counts when no active employees', async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const result = await initializeAllBalances(2024);

      expect(result.employeesProcessed).toBe(0);
      expect(result.balancesCreated).toBe(0);
    });
  });

  describe('adjustBalance', () => {
    const auditParams = {
      performedBy: 'admin-user',
      ipAddress: '127.0.0.1',
    };

    it('should increase entitled balance with positive adjustment', async () => {
      mockFindUnique.mockResolvedValueOnce(mockBalance);
      mockUpdate.mockResolvedValueOnce({
        ...mockBalance,
        totalEntitled: 14, // 12 + 2
        remaining: 12, // 14 + 0 - 2
      });

      const result = await adjustBalance(
        'emp-1',
        LeaveType.CASUAL,
        2024,
        2,
        'Bonus leave',
        auditParams,
      );

      expect(result.totalEntitled).toBe(14);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'balance-1' },
        data: {
          totalEntitled: 14,
          used: 2,
          remaining: 12,
        },
      });
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ADJUST_BALANCE',
          resource: 'LeaveBalance',
          resourceId: 'balance-1',
          details: expect.objectContaining({
            adjustment: 2,
            reason: 'Bonus leave',
          }),
        }),
      );
    });

    it('should increase used balance with negative adjustment', async () => {
      mockFindUnique.mockResolvedValueOnce(mockBalance);
      mockUpdate.mockResolvedValueOnce({
        ...mockBalance,
        used: 5, // 2 + 3
        remaining: 7, // 12 + 0 - 5
      });

      const result = await adjustBalance(
        'emp-1',
        LeaveType.CASUAL,
        2024,
        -3,
        'Penalty deduction',
        auditParams,
      );

      expect(result.used).toBe(5);
      expect(result.remaining).toBe(7);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'balance-1' },
        data: {
          totalEntitled: 12, // Unchanged
          used: 5,
          remaining: 7,
        },
      });
    });

    it('should account for carriedForward in remaining calculation', async () => {
      const balanceWithCarry = {
        ...mockBalance,
        carriedForward: 3,
        remaining: 13, // 12 + 3 - 2
      };

      mockFindUnique.mockResolvedValueOnce(balanceWithCarry);
      mockUpdate.mockResolvedValueOnce({
        ...balanceWithCarry,
        totalEntitled: 14,
        remaining: 15, // 14 + 3 - 2
      });

      const result = await adjustBalance(
        'emp-1',
        LeaveType.CASUAL,
        2024,
        2,
        'Adjustment',
        auditParams,
      );

      expect(result.remaining).toBe(15);
    });

    it('should throw error if balance not found', async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      await expect(
        adjustBalance('emp-1', LeaveType.CASUAL, 2024, 2, 'Adjustment', auditParams),
      ).rejects.toThrow('No leave balance found');
    });
  });

  describe('getEmployeeBalances', () => {
    it('should return balances with policy names', async () => {
      const balances = [
        { ...mockBalance, leaveType: LeaveType.CASUAL },
        { ...mockBalance, id: 'balance-2', leaveType: LeaveType.SICK },
      ];

      mockFindMany.mockResolvedValueOnce(balances);
      mockFindMany.mockResolvedValueOnce(mockPolicies);

      const result = await getEmployeeBalances('emp-1', 2024);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        ...mockBalance,
        policyName: 'Casual Leave',
      });
      expect(result[1]).toMatchObject({
        id: 'balance-2',
        leaveType: LeaveType.SICK,
        policyName: 'Sick Leave',
      });
    });

    it('should default to current year if not specified', async () => {
      const currentYear = new Date().getFullYear();
      mockFindMany.mockResolvedValueOnce([mockBalance]);
      mockFindMany.mockResolvedValueOnce(mockPolicies);

      await getEmployeeBalances('emp-1');

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1', year: currentYear },
        orderBy: { leaveType: 'asc' },
      });
    });

    it('should return empty array if no balances found', async () => {
      mockFindMany.mockResolvedValueOnce([]);
      mockFindMany.mockResolvedValueOnce(mockPolicies);

      const result = await getEmployeeBalances('emp-1', 2024);

      expect(result).toEqual([]);
    });

    it('should use leaveType as fallback if policy not found', async () => {
      mockFindMany.mockResolvedValueOnce([mockBalance]);
      mockFindMany.mockResolvedValueOnce([]); // No policies

      const result = await getEmployeeBalances('emp-1', 2024);

      expect(result[0].policyName).toBe(LeaveType.CASUAL);
    });
  });

  describe('carryForwardBalances', () => {
    const auditParams = {
      performedBy: 'admin-user',
      ipAddress: '127.0.0.1',
    };

    it('should carry forward balances respecting canCarryForward', async () => {
      // Only CASUAL and EARNED can carry forward
      const carryForwardPolicies = [mockPolicies[0], mockPolicies[2]];
      mockFindMany.mockResolvedValueOnce(carryForwardPolicies);
      mockFindMany.mockResolvedValueOnce([
        mockPreviousYearBalances[0], // CASUAL: 5 remaining
        mockPreviousYearBalances[1], // EARNED: 10 remaining
      ]);

      // No existing balance for 2024
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue(mockBalance);

      const result = await carryForwardBalances(2024, auditParams);

      expect(result.carried).toBe(2);
      expect(result.details).toHaveLength(2);
      expect(result.details).toEqual(
        expect.arrayContaining([
          { employeeId: 'emp-1', leaveType: LeaveType.CASUAL, amount: 5 },
          { employeeId: 'emp-1', leaveType: LeaveType.EARNED, amount: 10 },
        ]),
      );
    });

    it('should respect maxCarryForwardDays limit', async () => {
      mockFindMany.mockResolvedValueOnce([mockPolicies[0]]); // CASUAL, max 5 days
      mockFindMany.mockResolvedValueOnce([
        {
          ...mockPreviousYearBalances[0],
          remaining: 8, // More than maxCarryForwardDays
        },
      ]);

      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue(mockBalance);

      const result = await carryForwardBalances(2024, auditParams);

      expect(result.details[0].amount).toBe(5); // Capped at maxCarryForwardDays
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          carriedForward: 5,
          remaining: 17, // 12 (totalDaysPerYear) + 5 (carried)
        }),
      });
    });

    it('should update existing balance if already present', async () => {
      mockFindMany.mockResolvedValueOnce([mockPolicies[0]]);
      mockFindMany.mockResolvedValueOnce([mockPreviousYearBalances[0]]);

      // Existing balance for 2024
      const existingBalance = {
        ...mockBalance,
        carriedForward: 0,
        used: 2,
        remaining: 10,
      };
      mockFindUnique.mockResolvedValueOnce(existingBalance);
      mockUpdate.mockResolvedValueOnce({
        ...existingBalance,
        carriedForward: 5,
        remaining: 15,
      });

      const result = await carryForwardBalances(2024, auditParams);

      expect(result.carried).toBe(1);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'balance-1' },
        data: {
          carriedForward: 5,
          remaining: 15, // 12 (entitled) + 5 (carried) - 2 (used)
        },
      });
    });

    it('should skip if no remaining balance', async () => {
      mockFindMany.mockResolvedValueOnce([mockPolicies[0]]);
      mockFindMany.mockResolvedValueOnce([mockPreviousYearBalances[2]]); // remaining: 0

      const result = await carryForwardBalances(2024, auditParams);

      expect(result.carried).toBe(0);
      expect(result.details).toHaveLength(0);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should return zero if no policies allow carry forward', async () => {
      mockFindMany.mockResolvedValueOnce([]); // No policies with canCarryForward

      const result = await carryForwardBalances(2024, auditParams);

      expect(result.carried).toBe(0);
      expect(result.details).toHaveLength(0);
    });

    it('should log audit for carry forward operation', async () => {
      mockFindMany.mockResolvedValueOnce([mockPolicies[0]]);
      mockFindMany.mockResolvedValueOnce([mockPreviousYearBalances[0]]);
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue(mockBalance);

      await carryForwardBalances(2024, auditParams);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CARRY_FORWARD',
          resource: 'LeaveBalance',
          details: expect.objectContaining({
            year: 2024,
            totalCarried: 1,
          }),
        }),
      );
    });
  });
});
