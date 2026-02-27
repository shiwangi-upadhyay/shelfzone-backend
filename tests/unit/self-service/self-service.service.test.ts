import { jest } from '@jest/globals';

// Mock Prisma methods
const mockEmployeeFindUnique = jest.fn<(...args: any[]) => Promise<any>>();
const mockEmployeeUpdate = jest.fn<(...args: any[]) => Promise<any>>();
const mockLeaveBalanceFindMany = jest.fn<(...args: any[]) => Promise<any>>();
const mockAttendanceSummaryFindFirst = jest.fn<(...args: any[]) => Promise<any>>();
const mockPayslipFindMany = jest.fn<(...args: any[]) => Promise<any>>();
const mockPayslipCount = jest.fn<(...args: any[]) => Promise<number>>();
const mockPayslipFindFirst = jest.fn<(...args: any[]) => Promise<any>>();
const mockAttendanceRecordFindMany = jest.fn<(...args: any[]) => Promise<any>>();
const mockAttendanceRecordCount = jest.fn<(...args: any[]) => Promise<number>>();
const mockAttendanceRecordFindFirst = jest.fn<(...args: any[]) => Promise<any>>();
const mockLeaveRequestFindMany = jest.fn<(...args: any[]) => Promise<any>>();
const mockLeaveRequestCount = jest.fn<(...args: any[]) => Promise<number>>();

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: {
    employee: {
      findUnique: mockEmployeeFindUnique,
      update: mockEmployeeUpdate,
    },
    leaveBalance: {
      findMany: mockLeaveBalanceFindMany,
    },
    attendanceSummary: {
      findFirst: mockAttendanceSummaryFindFirst,
    },
    payslip: {
      findMany: mockPayslipFindMany,
      count: mockPayslipCount,
      findFirst: mockPayslipFindFirst,
    },
    attendanceRecord: {
      findMany: mockAttendanceRecordFindMany,
      count: mockAttendanceRecordCount,
      findFirst: mockAttendanceRecordFindFirst,
    },
    leaveRequest: {
      findMany: mockLeaveRequestFindMany,
      count: mockLeaveRequestCount,
    },
  },
}));

// Mock encryption
const mockDecrypt = jest.fn<(val: string) => string>();
jest.unstable_mockModule('../../../src/lib/encryption.js', () => ({
  decrypt: mockDecrypt,
}));

const {
  getMyProfile,
  updateMyProfile,
  getMyPayslips,
  getMyAttendance,
  getMyLeaves,
  getMyDashboard,
} = await import('../../../src/modules/self-service/self-service.service.js');

describe('SelfService Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDecrypt.mockImplementation((val: string) => `decrypted_${val}`);
  });

  describe('getMyProfile', () => {
    it('should return decrypted PII, leave balances, and attendance summary', async () => {
      const userId = 'user-123';
      const employeeId = 'emp-123';
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      const mockEmployee = {
        id: employeeId,
        userId,
        employeeCode: 'EMP001',
        firstName: 'John',
        lastName: 'Doe',
        phone: '1234567890',
        dateOfJoining: new Date('2022-01-01'),
        status: 'ACTIVE',
        encryptedAadhaar: 'enc_aadhaar',
        encryptedPan: 'enc_pan',
        encryptedSalary: 'enc_salary',
        department: { id: 'dept-1', name: 'Engineering' },
        designation: { id: 'desig-1', title: 'Software Engineer', level: 'MID' },
        user: { email: 'john@example.com', role: 'EMPLOYEE' },
      };

      const mockLeaveBalances = [
        {
          leaveType: 'CASUAL',
          totalEntitled: 12,
          used: 3,
          carriedForward: 2,
          remaining: 11,
        },
      ];

      const mockAttendanceSummary = {
        month: currentMonth,
        year: currentYear,
        totalPresent: 20,
        totalAbsent: 0,
        totalHalfDays: 1,
        totalLate: 2,
        totalLeaves: 1,
        totalHoursWorked: 160,
      };

      mockEmployeeFindUnique.mockResolvedValue(mockEmployee);
      mockLeaveBalanceFindMany.mockResolvedValue(mockLeaveBalances);
      mockAttendanceSummaryFindFirst.mockResolvedValue(mockAttendanceSummary);

      const result = await getMyProfile(userId);

      expect(mockEmployeeFindUnique).toHaveBeenCalledWith({
        where: { userId },
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, title: true, level: true } },
          user: { select: { email: true, role: true } },
        },
      });

      expect(mockLeaveBalanceFindMany).toHaveBeenCalledWith({
        where: { employeeId, year: currentYear },
      });

      expect(mockAttendanceSummaryFindFirst).toHaveBeenCalledWith({
        where: { employeeId, month: currentMonth, year: currentYear },
      });

      expect(result).toEqual({
        id: employeeId,
        employeeCode: 'EMP001',
        firstName: 'John',
        lastName: 'Doe',
        phone: '1234567890',
        email: 'john@example.com',
        role: 'EMPLOYEE',
        department: { id: 'dept-1', name: 'Engineering' },
        designation: { id: 'desig-1', title: 'Software Engineer', level: 'MID' },
        dateOfJoining: mockEmployee.dateOfJoining,
        status: 'ACTIVE',
        aadhaar: 'decrypted_enc_aadhaar',
        pan: 'decrypted_enc_pan',
        salary: 'decrypted_enc_salary',
        leaveBalances: [
          {
            leaveType: 'CASUAL',
            totalEntitled: 12,
            used: 3,
            carriedForward: 2,
            remaining: 11,
          },
        ],
        currentMonthAttendance: {
          month: currentMonth,
          year: currentYear,
          totalPresent: 20,
          totalAbsent: 0,
          totalHalfDays: 1,
          totalLate: 2,
          totalLeaves: 1,
          totalHoursWorked: 160,
        },
      });

      expect(mockDecrypt).toHaveBeenCalledTimes(3);
    });

    it('should throw 404 when employee not found', async () => {
      mockEmployeeFindUnique.mockResolvedValue(null);

      await expect(getMyProfile('unknown-user')).rejects.toThrow('Employee record not found');
    });

    it('should handle null attendance summary', async () => {
      const mockEmployee = {
        id: 'emp-123',
        userId: 'user-123',
        employeeCode: 'EMP001',
        firstName: 'John',
        lastName: 'Doe',
        phone: '1234567890',
        dateOfJoining: new Date('2022-01-01'),
        status: 'ACTIVE',
        encryptedAadhaar: null,
        encryptedPan: null,
        encryptedSalary: null,
        department: { id: 'dept-1', name: 'Engineering' },
        designation: { id: 'desig-1', title: 'Software Engineer', level: 'MID' },
        user: { email: 'john@example.com', role: 'EMPLOYEE' },
      };

      mockEmployeeFindUnique.mockResolvedValue(mockEmployee);
      mockLeaveBalanceFindMany.mockResolvedValue([]);
      mockAttendanceSummaryFindFirst.mockResolvedValue(null);

      const result = await getMyProfile('user-123');

      expect(result.currentMonthAttendance).toBeNull();
      expect(result.aadhaar).toBeNull();
      expect(result.pan).toBeNull();
      expect(result.salary).toBeNull();
    });
  });

  describe('updateMyProfile', () => {
    it('should update allowed fields and return updated employee', async () => {
      const userId = 'user-123';
      const employeeId = 'emp-123';

      const mockEmployee = { id: employeeId };
      const updatedEmployee = {
        id: employeeId,
        employeeCode: 'EMP001',
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
      };

      mockEmployeeFindUnique.mockResolvedValue(mockEmployee);
      mockEmployeeUpdate.mockResolvedValue(updatedEmployee);

      const result = await updateMyProfile(userId, {
        phone: '9876543210',
      });

      expect(mockEmployeeUpdate).toHaveBeenCalledWith({
        where: { id: employeeId },
        data: { phone: '9876543210' },
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      });

      expect(result).toEqual(updatedEmployee);
    });

    it('should throw 404 when employee not found', async () => {
      mockEmployeeFindUnique.mockResolvedValue(null);

      await expect(updateMyProfile('unknown-user', { phone: '1234567890' })).rejects.toThrow(
        'Employee record not found',
      );
    });

    it('should handle empty update data', async () => {
      const userId = 'user-123';
      const employeeId = 'emp-123';

      const mockEmployee = { id: employeeId };
      const updatedEmployee = {
        id: employeeId,
        employeeCode: 'EMP001',
        firstName: 'John',
        lastName: 'Doe',
        phone: '1234567890',
      };

      mockEmployeeFindUnique.mockResolvedValue(mockEmployee);
      mockEmployeeUpdate.mockResolvedValue(updatedEmployee);

      const result = await updateMyProfile(userId, {});

      expect(mockEmployeeUpdate).toHaveBeenCalledWith({
        where: { id: employeeId },
        data: {},
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      });

      expect(result).toEqual(updatedEmployee);
    });
  });

  describe('getMyPayslips', () => {
    it('should return own decrypted payslips with pagination', async () => {
      const userId = 'user-123';
      const employeeId = 'emp-123';

      const mockEmployee = { id: employeeId };
      const mockPayslips = [
        {
          id: 'pay-1',
          employeeId,
          month: 12,
          year: 2023,
          basicPay: 'enc_basic',
          hra: 'enc_hra',
          grossPay: 'enc_gross',
          netPay: 'enc_net',
        },
      ];

      mockEmployeeFindUnique.mockResolvedValue(mockEmployee);
      mockPayslipFindMany.mockResolvedValue(mockPayslips);
      mockPayslipCount.mockResolvedValue(1);

      const result = await getMyPayslips(userId, {
        page: 1,
        limit: 20,
        year: 2023,
      });

      expect(mockPayslipFindMany).toHaveBeenCalledWith({
        where: { employeeId, year: 2023 },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip: 0,
        take: 20,
      });

      expect(mockPayslipCount).toHaveBeenCalledWith({
        where: { employeeId, year: 2023 },
      });

      expect(result.data[0].basicPay).toBe('decrypted_enc_basic');
      expect(result.data[0].netPay).toBe('decrypted_enc_net');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should throw 404 when employee not found', async () => {
      mockEmployeeFindUnique.mockResolvedValue(null);

      await expect(getMyPayslips('unknown-user', { page: 1, limit: 20 })).rejects.toThrow(
        'Employee record not found',
      );
    });
  });

  describe('getMyAttendance', () => {
    it('should return own attendance records with summary and pagination', async () => {
      const userId = 'user-123';
      const employeeId = 'emp-123';
      const year = 2023;
      const month = 12;

      const mockEmployee = { id: employeeId };
      const mockRecords = [
        {
          id: 'att-1',
          employeeId,
          date: new Date(2023, 11, 15),
          status: 'PRESENT',
          checkIn: new Date(2023, 11, 15, 9, 0),
          checkOut: new Date(2023, 11, 15, 18, 0),
          hoursWorked: 8,
        },
      ];
      const mockSummary = {
        month,
        year,
        totalPresent: 20,
        totalAbsent: 0,
        totalHalfDays: 1,
        totalLate: 2,
        totalLeaves: 1,
        totalHoursWorked: 160,
      };

      mockEmployeeFindUnique.mockResolvedValue(mockEmployee);
      mockAttendanceRecordFindMany.mockResolvedValue(mockRecords);
      mockAttendanceRecordCount.mockResolvedValue(1);
      mockAttendanceSummaryFindFirst.mockResolvedValue(mockSummary);

      const result = await getMyAttendance(userId, {
        year,
        month,
        page: 1,
        limit: 20,
      });

      expect(mockAttendanceRecordFindMany).toHaveBeenCalled();
      expect(result.data).toEqual(mockRecords);
      expect(result.summary).toEqual(mockSummary);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should use current month/year when not provided', async () => {
      const userId = 'user-123';
      const employeeId = 'emp-123';

      const mockEmployee = { id: employeeId };

      mockEmployeeFindUnique.mockResolvedValue(mockEmployee);
      mockAttendanceRecordFindMany.mockResolvedValue([]);
      mockAttendanceRecordCount.mockResolvedValue(0);
      mockAttendanceSummaryFindFirst.mockResolvedValue(null);

      await getMyAttendance(userId, { page: 1, limit: 20 });

      // Should be called with current date-based filters
      expect(mockAttendanceRecordFindMany).toHaveBeenCalled();
    });

    it('should throw 404 when employee not found', async () => {
      mockEmployeeFindUnique.mockResolvedValue(null);

      await expect(getMyAttendance('unknown-user', { page: 1, limit: 20 })).rejects.toThrow(
        'Employee record not found',
      );
    });
  });

  describe('getMyLeaves', () => {
    it('should return own leave requests with balances and pagination', async () => {
      const userId = 'user-123';
      const employeeId = 'emp-123';
      const currentYear = new Date().getFullYear();

      const mockEmployee = { id: employeeId };
      const mockRequests = [
        {
          id: 'leave-1',
          employeeId,
          leaveType: 'CASUAL',
          startDate: new Date(2023, 11, 20),
          endDate: new Date(2023, 11, 22),
          status: 'APPROVED',
          reason: 'Personal',
          createdAt: new Date(),
        },
      ];
      const mockBalances = [
        {
          leaveType: 'CASUAL',
          totalEntitled: 12,
          used: 3,
          remaining: 9,
        },
      ];

      mockEmployeeFindUnique.mockResolvedValue(mockEmployee);
      mockLeaveRequestFindMany.mockResolvedValue(mockRequests);
      mockLeaveRequestCount.mockResolvedValue(1);
      mockLeaveBalanceFindMany.mockResolvedValue(mockBalances);

      const result = await getMyLeaves(userId, {
        page: 1,
        limit: 20,
        status: 'APPROVED',
        year: 2023,
      });

      expect(mockLeaveRequestFindMany).toHaveBeenCalled();
      expect(mockLeaveBalanceFindMany).toHaveBeenCalledWith({
        where: { employeeId, year: currentYear },
      });

      expect(result.data).toEqual(mockRequests);
      expect(result.balances).toEqual([
        {
          leaveType: 'CASUAL',
          totalEntitled: 12,
          used: 3,
          remaining: 9,
        },
      ]);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should throw 404 when employee not found', async () => {
      mockEmployeeFindUnique.mockResolvedValue(null);

      await expect(getMyLeaves('unknown-user', { page: 1, limit: 20 })).rejects.toThrow(
        'Employee record not found',
      );
    });
  });

  describe('getMyDashboard', () => {
    it('should return aggregated dashboard data', async () => {
      const userId = 'user-123';
      const employeeId = 'emp-123';

      const mockEmployee = {
        id: employeeId,
        firstName: 'John',
        lastName: 'Doe',
      };

      const mockTodayAttendance = {
        status: 'PRESENT',
        checkIn: new Date(2023, 11, 15, 9, 0),
        checkOut: new Date(2023, 11, 15, 18, 0),
        hoursWorked: 8,
      };

      const mockLatestPayslip = {
        month: 11,
        year: 2023,
      };

      mockEmployeeFindUnique.mockResolvedValue(mockEmployee);
      mockAttendanceRecordFindFirst.mockResolvedValue(mockTodayAttendance);
      mockLeaveRequestCount.mockResolvedValue(2);
      mockPayslipFindFirst.mockResolvedValue(mockLatestPayslip);

      const result = await getMyDashboard(userId);

      expect(result).toEqual({
        employee: {
          id: employeeId,
          firstName: 'John',
          lastName: 'Doe',
        },
        todayAttendance: {
          status: 'PRESENT',
          checkIn: mockTodayAttendance.checkIn,
          checkOut: mockTodayAttendance.checkOut,
          hoursWorked: 8,
        },
        pendingLeaveRequests: 2,
        latestPayslip: { month: 11, year: 2023 },
      });
    });

    it('should handle missing data gracefully', async () => {
      const userId = 'user-123';
      const employeeId = 'emp-123';

      const mockEmployee = {
        id: employeeId,
        firstName: 'John',
        lastName: 'Doe',
      };

      mockEmployeeFindUnique.mockResolvedValue(mockEmployee);
      mockAttendanceRecordFindFirst.mockResolvedValue(null);
      mockLeaveRequestCount.mockResolvedValue(0);
      mockPayslipFindFirst.mockResolvedValue(null);

      const result = await getMyDashboard(userId);

      expect(result.todayAttendance).toBeNull();
      expect(result.pendingLeaveRequests).toBe(0);
      expect(result.latestPayslip).toBeNull();
    });

    it('should throw 404 when employee not found', async () => {
      mockEmployeeFindUnique.mockResolvedValue(null);

      await expect(getMyDashboard('unknown-user')).rejects.toThrow('Employee record not found');
    });
  });
});
