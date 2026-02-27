import { jest } from '@jest/globals';
import type { AttendanceStatus } from '@prisma/client';

// Mock data
const mockEmployee = {
  id: 'emp-1',
  employeeCode: 'EMP-00001',
  userId: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
  departmentId: 'dept-1',
  status: 'ACTIVE',
};

const mockAttendanceRecord = {
  id: 'att-1',
  employeeId: 'emp-1',
  date: new Date('2024-02-27T00:00:00.000Z'),
  checkIn: new Date('2024-02-27T09:00:00.000Z'),
  checkOut: null,
  checkInNote: null,
  checkOutNote: null,
  status: 'PRESENT' as AttendanceStatus,
  hoursWorked: null,
  overtimeHours: null,
  isRegularized: false,
  regularizedBy: null,
  regularizedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDirectReports = [
  { id: 'emp-2' },
  { id: 'emp-3' },
];

// Mock Prisma methods
const mockFindUnique = jest.fn<(...args: any[]) => Promise<any>>();
const mockFindMany = jest.fn<(...args: any[]) => Promise<any>>();
const mockCount = jest.fn<(...args: any[]) => Promise<number>>();
const mockCreate = jest.fn<(...args: any[]) => Promise<any>>();
const mockUpdate = jest.fn<(...args: any[]) => Promise<any>>();
const mockUpsert = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: {
    employee: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
    },
    attendanceRecord: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      count: mockCount,
      create: mockCreate,
      update: mockUpdate,
      upsert: mockUpsert,
    },
    attendanceSummary: {
      findMany: mockFindMany,
      upsert: mockUpsert,
    },
  },
}));

const {
  checkIn,
  checkOut,
  regularizeAttendance,
  getAttendance,
  getAttendanceById,
  updateMonthlySummary,
} = await import('../../../src/modules/attendance/attendance.service.js');

describe('Attendance Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('checkIn', () => {
    it('should successfully check in before 10 AM with PRESENT status', async () => {
      // Mock current time to 09:00 UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-02-27T09:00:00.000Z'));

      mockFindUnique.mockResolvedValue(null); // No existing record
      mockCreate.mockResolvedValue({
        ...mockAttendanceRecord,
        checkIn: new Date('2024-02-27T09:00:00.000Z'),
        status: 'PRESENT',
      });

      const result = await checkIn('emp-1', 'Morning check-in');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: {
          employeeId_date: {
            employeeId: 'emp-1',
            date: new Date('2024-02-27T00:00:00.000Z'),
          },
        },
      });
      expect(mockCreate).toHaveBeenCalled();
      expect(result.status).toBe('PRESENT');

      jest.useRealTimers();
    });

    it('should check in after 10 AM with LATE status', async () => {
      // Mock current time to 11:00 UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-02-27T11:00:00.000Z'));

      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        ...mockAttendanceRecord,
        checkIn: new Date('2024-02-27T11:00:00.000Z'),
        status: 'LATE',
      });

      const result = await checkIn('emp-1');

      expect(result.status).toBe('LATE');

      jest.useRealTimers();
    });

    it('should reject duplicate check-in', async () => {
      mockFindUnique.mockResolvedValue(mockAttendanceRecord);

      await expect(checkIn('emp-1')).rejects.toEqual({
        statusCode: 409,
        error: 'Conflict',
        message: 'Already checked in today',
      });

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('checkOut', () => {
    it('should successfully check out with correct hours calculation', async () => {
      jest.useFakeTimers();
      const checkInTime = new Date('2024-02-27T09:00:00.000Z');
      const checkOutTime = new Date('2024-02-27T18:00:00.000Z'); // 9 hours
      jest.setSystemTime(checkOutTime);

      mockFindUnique.mockResolvedValue({
        ...mockAttendanceRecord,
        checkIn: checkInTime,
        checkOut: null,
      });

      mockUpdate.mockResolvedValue({
        ...mockAttendanceRecord,
        checkIn: checkInTime,
        checkOut: checkOutTime,
        hoursWorked: 9,
        overtimeHours: 1,
      });

      mockFindMany.mockResolvedValue([]);
      mockUpsert.mockResolvedValue({});

      const result = await checkOut('emp-1', 'End of day');

      expect(mockUpdate).toHaveBeenCalled();
      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.data.hoursWorked).toBe(9);
      expect(updateCall.data.overtimeHours).toBe(1);
      expect(mockUpsert).toHaveBeenCalled(); // Monthly summary updated

      jest.useRealTimers();
    });

    it('should calculate overtime hours correctly', async () => {
      jest.useFakeTimers();
      const checkInTime = new Date('2024-02-27T08:00:00.000Z');
      const checkOutTime = new Date('2024-02-27T19:30:00.000Z'); // 11.5 hours
      jest.setSystemTime(checkOutTime);

      mockFindUnique.mockResolvedValue({
        ...mockAttendanceRecord,
        checkIn: checkInTime,
        checkOut: null,
      });

      mockUpdate.mockResolvedValue({});
      mockFindMany.mockResolvedValue([]);
      mockUpsert.mockResolvedValue({});

      await checkOut('emp-1');

      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.data.hoursWorked).toBe(11.5);
      expect(updateCall.data.overtimeHours).toBe(3.5); // 11.5 - 8

      jest.useRealTimers();
    });

    it('should detect half-day when hours < 4', async () => {
      jest.useFakeTimers();
      const checkInTime = new Date('2024-02-27T09:00:00.000Z');
      const checkOutTime = new Date('2024-02-27T12:00:00.000Z'); // 3 hours
      jest.setSystemTime(checkOutTime);

      mockFindUnique.mockResolvedValue({
        ...mockAttendanceRecord,
        checkIn: checkInTime,
        checkOut: null,
        status: 'PRESENT',
      });

      mockUpdate.mockResolvedValue({});
      mockFindMany.mockResolvedValue([]);
      mockUpsert.mockResolvedValue({});

      await checkOut('emp-1');

      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.data.status).toBe('HALF_DAY');
      expect(updateCall.data.hoursWorked).toBe(3);

      jest.useRealTimers();
    });

    it('should reject checkout if not checked in', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(checkOut('emp-1')).rejects.toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'No check-in found for today',
      });

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should reject checkout if already checked out', async () => {
      mockFindUnique.mockResolvedValue({
        ...mockAttendanceRecord,
        checkOut: new Date('2024-02-27T18:00:00.000Z'),
      });

      await expect(checkOut('emp-1')).rejects.toEqual({
        statusCode: 409,
        error: 'Conflict',
        message: 'Already checked out today',
      });

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('regularizeAttendance', () => {
    it('should successfully regularize attendance', async () => {
      mockFindUnique.mockResolvedValue(mockEmployee); // Employee exists

      mockUpsert.mockResolvedValueOnce({
        ...mockAttendanceRecord,
        isRegularized: true,
        regularizedBy: 'hr-user-1',
        regularizedAt: new Date(),
      });

      mockFindMany.mockResolvedValue([]);
      mockUpsert.mockResolvedValueOnce({}); // Monthly summary

      const result = await regularizeAttendance(
        {
          employeeId: 'emp-1',
          date: '2024-02-27',
          checkIn: '2024-02-27T09:00:00.000Z',
          checkOut: '2024-02-27T18:00:00.000Z',
          status: 'PRESENT' as AttendanceStatus,
          note: 'Regularized by HR',
        },
        'hr-user-1'
      );

      expect(mockUpsert).toHaveBeenCalledTimes(2); // Attendance + Summary
      const attendanceUpsert = mockUpsert.mock.calls[0][0];
      expect(attendanceUpsert.create.isRegularized).toBe(true);
      expect(attendanceUpsert.create.regularizedBy).toBe('hr-user-1');
    });

    it('should set isRegularized and regularizedBy fields', async () => {
      mockFindUnique.mockResolvedValue(mockEmployee);
      mockUpsert.mockResolvedValueOnce({});
      mockFindMany.mockResolvedValue([]);
      mockUpsert.mockResolvedValueOnce({});

      await regularizeAttendance(
        {
          employeeId: 'emp-1',
          date: '2024-02-27',
          status: 'ABSENT' as AttendanceStatus,
        },
        'manager-user-1'
      );

      const upsertCall = mockUpsert.mock.calls[0][0];
      expect(upsertCall.create.isRegularized).toBe(true);
      expect(upsertCall.create.regularizedBy).toBe('manager-user-1');
      expect(upsertCall.update.isRegularized).toBe(true);
      expect(upsertCall.update.regularizedBy).toBe('manager-user-1');
    });

    it('should reject if employee not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(
        regularizeAttendance(
          {
            employeeId: 'invalid-emp',
            date: '2024-02-27',
            status: 'PRESENT' as AttendanceStatus,
          },
          'hr-user-1'
        )
      ).rejects.toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Employee not found',
      });
    });
  });

  describe('getAttendance - RBAC filtering', () => {
    it('should allow EMPLOYEE to see only their own records', async () => {
      mockFindUnique.mockResolvedValue(mockEmployee); // Employee lookup
      mockFindMany.mockResolvedValue([mockAttendanceRecord]);
      mockCount.mockResolvedValue(1);

      const result = await getAttendance(
        { page: 1, limit: 10 },
        { userId: 'user-1', email: 'emp@example.com', role: 'EMPLOYEE' }
      );

      expect(mockFindMany).toHaveBeenCalled();
      const findManyCall = mockFindMany.mock.calls[0][0];
      expect(findManyCall.where.employeeId).toBe('emp-1');
      expect(result.data).toHaveLength(1);
    });

    it('should allow MANAGER to see own and team records', async () => {
      mockFindUnique.mockResolvedValue(mockEmployee); // Manager employee record
      mockFindMany.mockResolvedValueOnce(mockDirectReports); // Direct reports
      mockFindMany.mockResolvedValueOnce([mockAttendanceRecord]); // Attendance records
      mockCount.mockResolvedValue(1);

      const result = await getAttendance(
        { page: 1, limit: 10 },
        { userId: 'user-1', email: 'mgr@example.com', role: 'MANAGER' }
      );

      const findManyCall = mockFindMany.mock.calls[1][0];
      expect(findManyCall.where.employeeId.in).toEqual(['emp-1', 'emp-2', 'emp-3']);
    });

    it('should allow HR_ADMIN to see all records', async () => {
      mockFindMany.mockResolvedValue([mockAttendanceRecord]);
      mockCount.mockResolvedValue(1);

      const result = await getAttendance(
        { page: 1, limit: 10, employeeId: 'emp-1' },
        { userId: 'hr-user-1', email: 'hr@example.com', role: 'HR_ADMIN' }
      );

      const findManyCall = mockFindMany.mock.calls[0][0];
      expect(findManyCall.where.employeeId).toBe('emp-1');
    });

    it('should reject MANAGER access to non-team member', async () => {
      mockFindUnique.mockResolvedValue(mockEmployee);
      mockFindMany.mockResolvedValue(mockDirectReports);

      await expect(
        getAttendance(
          { page: 1, limit: 10, employeeId: 'other-emp' },
          { userId: 'user-1', email: 'mgr@example.com', role: 'MANAGER' }
        )
      ).rejects.toEqual({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied',
      });
    });
  });

  describe('updateMonthlySummary', () => {
    it('should upsert monthly summary on checkout', async () => {
      const mockRecords = [
        { ...mockAttendanceRecord, status: 'PRESENT' as AttendanceStatus, hoursWorked: 8, overtimeHours: 0 },
        { ...mockAttendanceRecord, status: 'LATE' as AttendanceStatus, hoursWorked: 9, overtimeHours: 1 },
        { ...mockAttendanceRecord, status: 'HALF_DAY' as AttendanceStatus, hoursWorked: 3.5, overtimeHours: 0 },
      ];

      mockFindMany.mockResolvedValue(mockRecords);
      mockUpsert.mockResolvedValue({});

      await updateMonthlySummary('emp-1', 2, 2024);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            employeeId_month_year: {
              employeeId: 'emp-1',
              month: 2,
              year: 2024,
            },
          },
          create: expect.objectContaining({
            employeeId: 'emp-1',
            month: 2,
            year: 2024,
            totalPresent: 1,
            totalLate: 1,
            totalHalfDays: 1,
            totalHoursWorked: 20.5,
            totalOvertimeHours: 1,
          }),
        })
      );
    });
  });

  describe('getAttendanceById', () => {
    it('should return attendance record with employee details', async () => {
      mockFindUnique.mockResolvedValue({
        ...mockAttendanceRecord,
        employee: {
          id: 'emp-1',
          firstName: 'John',
          lastName: 'Doe',
          employeeCode: 'EMP-00001',
          department: { id: 'dept-1', name: 'Engineering' },
        },
      });

      const result = await getAttendanceById('att-1');

      expect(result.id).toBe('att-1');
      expect(result.employee).toBeDefined();
    });

    it('should reject if record not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(getAttendanceById('invalid-id')).rejects.toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Attendance record not found',
      });
    });
  });
});
