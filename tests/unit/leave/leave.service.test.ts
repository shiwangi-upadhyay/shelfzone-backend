import { jest } from '@jest/globals';
import { LeaveType, LeaveRequestStatus } from '@prisma/client';

// Mock data
const mockPolicy = {
  id: 'policy-1',
  leaveType: LeaveType.CASUAL,
  name: 'Casual Leave',
  totalDaysPerYear: 12,
  maxConsecutiveDays: 5,
  isActive: true,
  canCarryForward: false,
  maxCarryForwardDays: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

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

const mockEmployee = {
  id: 'emp-1',
  userId: 'user-1',
  employeeCode: 'EMP-001',
  firstName: 'John',
  lastName: 'Doe',
  managerId: 'mgr-1',
};

const mockManager = {
  id: 'mgr-1',
  userId: 'mgr-user-1',
  employeeCode: 'EMP-MGR',
};

const mockUser = {
  id: 'user-1',
  email: 'user@example.com',
  role: 'EMPLOYEE',
};

const mockReviewer = {
  id: 'reviewer-1',
  email: 'reviewer@example.com',
  role: 'HR_ADMIN',
};

const mockLeaveRequest = {
  id: 'leave-1',
  employeeId: 'emp-1',
  leaveType: LeaveType.CASUAL,
  startDate: new Date('2024-06-10'),
  endDate: new Date('2024-06-12'),
  totalDays: 3,
  isHalfDay: false,
  halfDayType: null,
  reason: 'Personal work',
  status: LeaveRequestStatus.PENDING,
  reviewedBy: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: new Date('2024-06-01'),
  updatedAt: new Date('2024-06-01'),
  employee: mockEmployee,
};

// Mock Prisma methods
const mockFindUnique = jest.fn<(...args: any[]) => Promise<any>>();
const mockFindFirst = jest.fn<(...args: any[]) => Promise<any>>();
const mockFindMany = jest.fn<(...args: any[]) => Promise<any>>();
const mockCount = jest.fn<(...args: any[]) => Promise<number>>();
const mockCreate = jest.fn<(...args: any[]) => Promise<any>>();
const mockUpdate = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: {
    leavePolicy: {
      findUnique: mockFindUnique,
    },
    leaveBalance: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    leaveRequest: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      findMany: mockFindMany,
      count: mockCount,
      create: mockCreate,
      update: mockUpdate,
    },
    employee: {
      findUnique: mockFindUnique,
    },
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

const { applyLeave, reviewLeave, cancelLeave, getLeaveById, getLeaves } = await import(
  '../../../src/modules/leave/leave.service.js'
);

describe('Leave Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('applyLeave', () => {
    const applyData = {
      leaveType: 'CASUAL' as const,
      startDate: '2024-06-10',
      endDate: '2024-06-12',
      reason: 'Personal work',
      isHalfDay: false,
    };

    it('should successfully apply for leave', async () => {
      // Mock policy check
      mockFindUnique.mockResolvedValueOnce(mockPolicy);

      // Mock balance check
      mockFindUnique.mockResolvedValueOnce(mockBalance);

      // Mock no overlapping requests
      mockFindFirst.mockResolvedValueOnce(null);

      // Mock create
      mockCreate.mockResolvedValueOnce({ ...mockLeaveRequest });

      const result = await applyLeave('emp-1', applyData);

      expect(result).toBeDefined();
      expect(result.totalDays).toBe(3);
      expect(result.status).toBe(LeaveRequestStatus.PENDING);
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          employeeId: 'emp-1',
          leaveType: LeaveType.CASUAL,
          totalDays: 3,
          status: 'PENDING',
        }),
      });
    });

    it('should calculate half-day leave correctly (totalDays=0.5)', async () => {
      const halfDayData = {
        ...applyData,
        startDate: '2024-06-10',
        endDate: '2024-06-10',
        isHalfDay: true,
        halfDayType: 'FIRST_HALF' as const,
      };

      mockFindUnique.mockResolvedValueOnce(mockPolicy);
      mockFindUnique.mockResolvedValueOnce(mockBalance);
      mockFindFirst.mockResolvedValueOnce(null);
      mockCreate.mockResolvedValueOnce({
        ...mockLeaveRequest,
        totalDays: 0.5,
        isHalfDay: true,
        halfDayType: 'FIRST_HALF',
      });

      const result = await applyLeave('emp-1', halfDayData);

      expect(result.totalDays).toBe(0.5);
      expect(result.isHalfDay).toBe(true);
      expect(result.halfDayType).toBe('FIRST_HALF');
    });

    it('should exclude weekends in business days calculation', async () => {
      // June 10-14, 2024: Mon-Fri = 5 business days (excludes Sat/Sun)
      const weekendData = {
        ...applyData,
        startDate: '2024-06-10',
        endDate: '2024-06-14',
      };

      mockFindUnique.mockResolvedValueOnce(mockPolicy);
      mockFindUnique.mockResolvedValueOnce({ ...mockBalance, remaining: 10 });
      mockFindFirst.mockResolvedValueOnce(null);
      mockCreate.mockResolvedValueOnce({
        ...mockLeaveRequest,
        totalDays: 5,
      });

      const result = await applyLeave('emp-1', weekendData);

      expect(result.totalDays).toBe(5);
    });

    it('should reject if insufficient balance', async () => {
      mockFindUnique.mockResolvedValueOnce(mockPolicy);
      mockFindUnique.mockResolvedValueOnce({ ...mockBalance, remaining: 2 }); // Only 2 days left

      await expect(applyLeave('emp-1', applyData)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Insufficient leave balance'),
      });
    });

    it('should reject if overlapping leave request exists', async () => {
      mockFindUnique.mockResolvedValueOnce(mockPolicy);
      mockFindUnique.mockResolvedValueOnce(mockBalance);
      mockFindFirst.mockResolvedValueOnce(mockLeaveRequest); // Overlapping request

      await expect(applyLeave('emp-1', applyData)).rejects.toMatchObject({
        statusCode: 409,
        message: 'Overlapping leave request exists',
      });
    });

    it('should reject if max consecutive days exceeded', async () => {
      const longLeaveData = {
        ...applyData,
        startDate: '2024-06-03',
        endDate: '2024-06-14', // 10 business days, exceeds maxConsecutiveDays=5
      };

      mockFindUnique.mockResolvedValueOnce(mockPolicy);

      await expect(applyLeave('emp-1', longLeaveData)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Exceeds maximum consecutive days'),
      });
    });

    it('should reject if leave policy is inactive', async () => {
      mockFindUnique.mockResolvedValueOnce({ ...mockPolicy, isActive: false });

      await expect(applyLeave('emp-1', applyData)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Leave policy not found or inactive for this leave type',
      });
    });

    it('should reject if leave policy not found', async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      await expect(applyLeave('emp-1', applyData)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Leave policy not found or inactive for this leave type',
      });
    });

    it('should reject if endDate is before startDate', async () => {
      const invalidData = {
        ...applyData,
        startDate: '2024-06-15',
        endDate: '2024-06-10',
      };

      await expect(applyLeave('emp-1', invalidData)).rejects.toMatchObject({
        statusCode: 400,
        message: 'endDate must be >= startDate',
      });
    });
  });

  describe('reviewLeave', () => {
    const reviewData = {
      status: 'APPROVED' as const,
      reviewNote: 'Approved',
    };

    it('should approve leave and deduct balance', async () => {
      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        employee: mockEmployee,
      });
      mockFindUnique.mockResolvedValueOnce(mockReviewer);
      mockUpdate.mockResolvedValueOnce(mockBalance); // Balance update
      mockUpdate.mockResolvedValueOnce({
        ...mockLeaveRequest,
        status: LeaveRequestStatus.APPROVED,
        reviewedBy: 'reviewer-1',
        reviewedAt: new Date(),
        reviewNote: 'Approved',
      });

      const result = await reviewLeave('leave-1', 'reviewer-1', reviewData);

      expect(result.status).toBe(LeaveRequestStatus.APPROVED);
      expect(result.reviewedBy).toBe('reviewer-1');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            employeeId_leaveType_year: {
              employeeId: 'emp-1',
              leaveType: LeaveType.CASUAL,
              year: 2024,
            },
          },
          data: {
            used: { increment: 3 },
            remaining: { decrement: 3 },
          },
        }),
      );
    });

    it('should reject leave without changing balance', async () => {
      const rejectData = {
        status: 'REJECTED' as const,
        reviewNote: 'Not approved',
      };

      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        employee: mockEmployee,
      });
      mockFindUnique.mockResolvedValueOnce(mockReviewer);
      mockUpdate.mockResolvedValueOnce({
        ...mockLeaveRequest,
        status: LeaveRequestStatus.REJECTED,
        reviewedBy: 'reviewer-1',
        reviewedAt: new Date(),
        reviewNote: 'Not approved',
      });

      const result = await reviewLeave('leave-1', 'reviewer-1', rejectData);

      expect(result.status).toBe(LeaveRequestStatus.REJECTED);
      // Balance update should not be called (only one update for the leave request)
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('should reject if leave request not found', async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      await expect(reviewLeave('leave-1', 'reviewer-1', reviewData)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Leave request not found',
      });
    });

    it('should reject reviewing already reviewed leave', async () => {
      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        status: LeaveRequestStatus.APPROVED,
        employee: mockEmployee,
      });

      await expect(reviewLeave('leave-1', 'reviewer-1', reviewData)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Cannot review a request with status'),
      });
    });

    it('should allow manager to review direct reports only', async () => {
      const managerReviewer = {
        id: 'mgr-user-1',
        email: 'manager@example.com',
        role: 'MANAGER',
      };

      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        employee: { ...mockEmployee, managerId: 'mgr-1' },
      });
      mockFindUnique.mockResolvedValueOnce(managerReviewer);
      mockFindUnique.mockResolvedValueOnce(mockManager); // Manager's employee record
      mockUpdate.mockResolvedValueOnce(mockBalance);
      mockUpdate.mockResolvedValueOnce({
        ...mockLeaveRequest,
        status: LeaveRequestStatus.APPROVED,
      });

      const result = await reviewLeave('leave-1', 'mgr-user-1', reviewData);

      expect(result.status).toBe(LeaveRequestStatus.APPROVED);
    });

    it('should reject manager reviewing non-direct report', async () => {
      const managerReviewer = {
        id: 'other-mgr-user',
        email: 'othermanager@example.com',
        role: 'MANAGER',
      };

      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        employee: { ...mockEmployee, managerId: 'mgr-1' }, // Different manager
      });
      mockFindUnique.mockResolvedValueOnce(managerReviewer);
      mockFindUnique.mockResolvedValueOnce({ id: 'other-mgr', userId: 'other-mgr-user' });

      await expect(reviewLeave('leave-1', 'other-mgr-user', reviewData)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('only review leave requests of your direct reports'),
      });
    });

    it('should reject non-authorized user from reviewing', async () => {
      const employeeUser = {
        id: 'emp-user-2',
        email: 'employee@example.com',
        role: 'EMPLOYEE',
      };

      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        employee: mockEmployee,
      });
      mockFindUnique.mockResolvedValueOnce(employeeUser);

      await expect(reviewLeave('leave-1', 'emp-user-2', reviewData)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Not authorized to review leaves',
      });
    });
  });

  describe('cancelLeave', () => {
    it('should cancel pending leave by employee (no balance refund)', async () => {
      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        status: LeaveRequestStatus.PENDING,
        employee: mockEmployee,
      });
      mockFindUnique.mockResolvedValueOnce(mockUser);
      mockUpdate.mockResolvedValueOnce({
        ...mockLeaveRequest,
        status: LeaveRequestStatus.CANCELLED,
      });

      const result = await cancelLeave('leave-1', 'user-1');

      expect(result.status).toBe(LeaveRequestStatus.CANCELLED);
      // Only one update for leave status, no balance refund
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('should cancel approved leave by HR and refund balance', async () => {
      const hrUser = {
        id: 'hr-user-1',
        email: 'hr@example.com',
        role: 'HR_ADMIN',
      };

      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        status: LeaveRequestStatus.APPROVED,
        employee: mockEmployee,
      });
      mockFindUnique.mockResolvedValueOnce(hrUser);
      mockUpdate.mockResolvedValueOnce(mockBalance); // Balance refund
      mockUpdate.mockResolvedValueOnce({
        ...mockLeaveRequest,
        status: LeaveRequestStatus.CANCELLED,
      });

      const result = await cancelLeave('leave-1', 'hr-user-1');

      expect(result.status).toBe(LeaveRequestStatus.CANCELLED);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            employeeId_leaveType_year: {
              employeeId: 'emp-1',
              leaveType: LeaveType.CASUAL,
              year: 2024,
            },
          },
          data: {
            used: { decrement: 3 },
            remaining: { increment: 3 },
          },
        }),
      );
    });

    it('should reject employee cancelling approved leave', async () => {
      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        status: LeaveRequestStatus.APPROVED,
        employee: mockEmployee,
      });
      mockFindUnique.mockResolvedValueOnce(mockUser);

      await expect(cancelLeave('leave-1', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        message: 'Employees can only cancel PENDING requests',
      });
    });

    it('should reject non-owner, non-HR from cancelling', async () => {
      const otherUser = {
        id: 'other-user',
        email: 'other@example.com',
        role: 'EMPLOYEE',
      };

      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        employee: mockEmployee,
      });
      mockFindUnique.mockResolvedValueOnce(otherUser);

      await expect(cancelLeave('leave-1', 'other-user')).rejects.toMatchObject({
        statusCode: 403,
        message: 'Not authorized to cancel this leave',
      });
    });

    it('should reject if leave request not found', async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      await expect(cancelLeave('leave-1', 'user-1')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Leave request not found',
      });
    });
  });

  describe('getLeaveById', () => {
    it('should allow employee to view own leave', async () => {
      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        employee: mockEmployee,
        reviewer: null,
      });

      const result = await getLeaveById('leave-1', {
        userId: 'user-1',
        email: 'user@example.com',
        role: 'EMPLOYEE',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('leave-1');
    });

    it('should reject employee viewing other employee leave', async () => {
      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        employee: mockEmployee,
        reviewer: null,
      });

      await expect(
        getLeaveById('leave-1', {
          userId: 'other-user',
          email: 'other@example.com',
          role: 'EMPLOYEE',
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Access denied',
      });
    });

    it('should allow manager to view team member leave', async () => {
      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        employee: { ...mockEmployee, managerId: 'mgr-1' },
        reviewer: null,
      });
      mockFindUnique.mockResolvedValueOnce(mockManager);

      const result = await getLeaveById('leave-1', {
        userId: 'mgr-user-1',
        email: 'manager@example.com',
        role: 'MANAGER',
      });

      expect(result).toBeDefined();
    });

    it('should reject manager viewing non-team member leave', async () => {
      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        employee: { ...mockEmployee, managerId: 'other-mgr' },
        reviewer: null,
      });
      mockFindUnique.mockResolvedValueOnce(mockManager);

      await expect(
        getLeaveById('leave-1', {
          userId: 'mgr-user-1',
          email: 'manager@example.com',
          role: 'MANAGER',
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Access denied',
      });
    });

    it('should allow HR to view any leave', async () => {
      mockFindUnique.mockResolvedValueOnce({
        ...mockLeaveRequest,
        employee: mockEmployee,
        reviewer: null,
      });

      const result = await getLeaveById('leave-1', {
        userId: 'hr-user-1',
        email: 'hr@example.com',
        role: 'HR_ADMIN',
      });

      expect(result).toBeDefined();
    });
  });

  describe('getLeaves', () => {
    const mockLeaves = [
      {
        ...mockLeaveRequest,
        employee: {
          id: 'emp-1',
          firstName: 'John',
          lastName: 'Doe',
          employeeCode: 'EMP-001',
        },
      },
    ];

    it('should list only own leaves for employee', async () => {
      mockFindUnique.mockResolvedValueOnce(mockEmployee);
      mockFindMany.mockResolvedValueOnce(mockLeaves);
      mockCount.mockResolvedValueOnce(1);

      const result = await getLeaves(
        { page: 1, limit: 10 },
        {
          userId: 'user-1',
          email: 'user@example.com',
          role: 'EMPLOYEE',
        },
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 'emp-1',
          }),
        }),
      );
    });

    it('should list own + team leaves for manager', async () => {
      mockFindUnique.mockResolvedValueOnce(mockManager);
      mockFindMany.mockResolvedValueOnce(mockLeaves);
      mockCount.mockResolvedValueOnce(1);

      const result = await getLeaves(
        { page: 1, limit: 10 },
        {
          userId: 'mgr-user-1',
          email: 'manager@example.com',
          role: 'MANAGER',
        },
      );

      expect(result.data).toHaveLength(1);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { employeeId: 'mgr-1' },
              { employee: { managerId: 'mgr-1' } },
            ]),
          }),
        }),
      );
    });

    it('should list all leaves for HR', async () => {
      mockFindMany.mockResolvedValueOnce(mockLeaves);
      mockCount.mockResolvedValueOnce(1);

      const result = await getLeaves(
        { page: 1, limit: 10 },
        {
          userId: 'hr-user-1',
          email: 'hr@example.com',
          role: 'HR_ADMIN',
        },
      );

      expect(result.data).toHaveLength(1);
      // HR should not have RBAC filtering
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            employeeId: expect.anything(),
          }),
        }),
      );
    });

    it('should apply filters correctly', async () => {
      mockFindMany.mockResolvedValueOnce(mockLeaves);
      mockCount.mockResolvedValueOnce(1);

      await getLeaves(
        {
          page: 1,
          limit: 10,
          leaveType: 'CASUAL',
          status: 'PENDING',
          startDate: '2024-06-01',
        },
        {
          userId: 'hr-user-1',
          email: 'hr@example.com',
          role: 'HR_ADMIN',
        },
      );

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            leaveType: 'CASUAL',
            status: 'PENDING',
            startDate: { gte: new Date('2024-06-01') },
          }),
        }),
      );
    });

    it('should paginate results correctly', async () => {
      mockFindMany.mockResolvedValueOnce(mockLeaves);
      mockCount.mockResolvedValueOnce(25);

      const result = await getLeaves(
        { page: 2, limit: 10 },
        {
          userId: 'hr-user-1',
          email: 'hr@example.com',
          role: 'HR_ADMIN',
        },
      );

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(25);
      expect(result.meta.totalPages).toBe(3);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });
});
