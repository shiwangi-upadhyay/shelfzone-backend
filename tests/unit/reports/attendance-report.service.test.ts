import { jest } from '@jest/globals';
import type { AttendanceStatus, Role } from '@prisma/client';

// Mock data
const mockDepartment = { id: 'dept-1', name: 'Engineering' };

const mockEmployees = [
  {
    id: 'emp-1',
    employeeCode: 'EMP-00001',
    firstName: 'John',
    lastName: 'Doe',
    departmentId: 'dept-1',
    department: mockDepartment,
    status: 'ACTIVE',
  },
  {
    id: 'emp-2',
    employeeCode: 'EMP-00002',
    firstName: 'Jane',
    lastName: 'Smith',
    departmentId: 'dept-1',
    department: mockDepartment,
    status: 'ACTIVE',
  },
];

const mockAttendanceRecords = [
  {
    employeeId: 'emp-1',
    status: 'PRESENT' as AttendanceStatus,
    checkIn: new Date('2024-02-27T09:00:00.000Z'),
    checkOut: new Date('2024-02-27T18:00:00.000Z'),
    hoursWorked: 9,
  },
  {
    employeeId: 'emp-2',
    status: 'LATE' as AttendanceStatus,
    checkIn: new Date('2024-02-27T10:30:00.000Z'),
    checkOut: new Date('2024-02-27T19:00:00.000Z'),
    hoursWorked: 8.5,
  },
];

const mockAttendanceSummaries = [
  {
    employeeId: 'emp-1',
    month: 2,
    year: 2024,
    totalPresent: 18,
    totalAbsent: 2,
    totalLate: 1,
    totalHalfDays: 0,
    totalLeaves: 1,
    totalHolidays: 2,
    totalHoursWorked: 160,
    totalOvertimeHours: 8,
  },
  {
    employeeId: 'emp-2',
    month: 2,
    year: 2024,
    totalPresent: 20,
    totalAbsent: 0,
    totalLate: 2,
    totalHalfDays: 1,
    totalLeaves: 0,
    totalHolidays: 2,
    totalHoursWorked: 170,
    totalOvertimeHours: 10,
  },
];

// Mock Prisma methods
const mockFindUnique = jest.fn<(...args: any[]) => Promise<any>>();
const mockFindMany = jest.fn<(...args: any[]) => Promise<any>>();
const mockFindFirst = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: {
    employee: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      findFirst: mockFindFirst,
    },
    attendanceRecord: {
      findMany: mockFindMany,
    },
    attendanceSummary: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
    },
  },
}));

const { getDailyReport, getWeeklyReport, getMonthlyReport } = await import(
  '../../../src/modules/reports/attendance-report.service.js'
);

describe('Attendance Report Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDailyReport', () => {
    it('should return status counts and records for a date', async () => {
      mockFindMany.mockResolvedValueOnce(mockEmployees); // Employees
      mockFindMany.mockResolvedValueOnce(mockAttendanceRecords); // Attendance records

      const result = await getDailyReport(
        '2024-02-27',
        undefined,
        { userId: 'hr-user-1', email: 'hr@example.com', role: 'HR_ADMIN' as Role }
      );

      expect(result.date).toBe('2024-02-27');
      expect(result.summary.present).toBe(1);
      expect(result.summary.late).toBe(1);
      expect(result.summary.total).toBe(2);
      expect(result.records).toHaveLength(2);
      expect(result.records[0].name).toBe('John Doe');
      expect(result.records[0].status).toBe('PRESENT');
    });

    it('should mark employees as ABSENT when no attendance record exists', async () => {
      mockFindMany.mockResolvedValueOnce(mockEmployees);
      mockFindMany.mockResolvedValueOnce([mockAttendanceRecords[0]]); // Only one record

      const result = await getDailyReport(
        '2024-02-27',
        undefined,
        { userId: 'hr-user-1', email: 'hr@example.com', role: 'HR_ADMIN' as Role }
      );

      const emp2Record = result.records.find((r: any) => r.employeeId === 'emp-2');
      expect(emp2Record?.status).toBe('ABSENT');
      expect(result.summary.absent).toBe(1);
    });

    it('should respect department filter', async () => {
      mockFindMany.mockResolvedValueOnce([mockEmployees[0]]); // Filtered by dept
      mockFindMany.mockResolvedValueOnce([mockAttendanceRecords[0]]);

      const result = await getDailyReport(
        '2024-02-27',
        'dept-1',
        { userId: 'hr-user-1', email: 'hr@example.com', role: 'HR_ADMIN' as Role }
      );

      const findManyCall = mockFindMany.mock.calls[0][0];
      expect(findManyCall.where.departmentId).toBe('dept-1');
    });

    it('should filter by manager team for MANAGER role', async () => {
      const managerEmp = {
        id: 'mgr-1',
        userId: 'mgr-user-1',
        departmentId: 'dept-1',
      };

      mockFindUnique.mockResolvedValue(managerEmp); // Manager lookup
      mockFindMany.mockResolvedValueOnce([mockEmployees[0]]); // Direct reports
      mockFindMany.mockResolvedValueOnce([mockAttendanceRecords[0]]);

      await getDailyReport(
        '2024-02-27',
        undefined,
        { userId: 'mgr-user-1', email: 'mgr@example.com', role: 'MANAGER' as Role }
      );

      const findManyCall = mockFindMany.mock.calls[0][0];
      expect(findManyCall.where.managerId).toBe('mgr-1');
    });
  });

  describe('getWeeklyReport', () => {
    it('should return 7-day aggregation per employee', async () => {
      const weeklyRecords = [
        { ...mockAttendanceRecords[0], date: new Date('2024-02-27') },
        { ...mockAttendanceRecords[0], date: new Date('2024-02-28'), status: 'LATE' as AttendanceStatus },
        { ...mockAttendanceRecords[0], date: new Date('2024-02-29'), status: 'PRESENT' as AttendanceStatus },
      ];

      mockFindMany.mockResolvedValueOnce(mockEmployees);
      mockFindMany.mockResolvedValueOnce(weeklyRecords);

      const result = await getWeeklyReport(
        '2024-02-27',
        undefined,
        { userId: 'hr-user-1', email: 'hr@example.com', role: 'HR_ADMIN' as Role }
      );

      expect(result.startDate).toBe('2024-02-27');
      expect(result.endDate).toBe('2024-03-04');
      expect(result.summary.totalEmployees).toBe(2);
      expect(result.summary.totalPresent).toBeGreaterThan(0);
      expect(result.employees).toHaveLength(2);

      const emp1Summary = result.employees.find((e: any) => e.employeeId === 'emp-1');
      expect(emp1Summary).toBeDefined();
      expect(emp1Summary!.daysPresent).toBe(2);
      expect(emp1Summary!.daysLate).toBe(1);
      expect(emp1Summary!.totalHoursWorked).toBeGreaterThan(0);
    });

    it('should calculate hours worked correctly', async () => {
      const weeklyRecords = [
        { employeeId: 'emp-1', status: 'PRESENT' as AttendanceStatus, hoursWorked: 8.5 },
        { employeeId: 'emp-1', status: 'PRESENT' as AttendanceStatus, hoursWorked: 9 },
        { employeeId: 'emp-1', status: 'PRESENT' as AttendanceStatus, hoursWorked: 8 },
      ];

      mockFindMany.mockResolvedValueOnce([mockEmployees[0]]);
      mockFindMany.mockResolvedValueOnce(weeklyRecords);

      const result = await getWeeklyReport(
        '2024-02-27',
        undefined,
        { userId: 'hr-user-1', email: 'hr@example.com', role: 'HR_ADMIN' as Role }
      );

      const emp1 = result.employees.find((e: any) => e.employeeId === 'emp-1');
      expect(emp1).toBeDefined();
      expect(emp1!.totalHoursWorked).toBe(25.5);
    });

    it('should respect RBAC for manager', async () => {
      const managerEmp = {
        id: 'mgr-1',
        userId: 'mgr-user-1',
        departmentId: 'dept-1',
      };

      mockFindUnique.mockResolvedValue(managerEmp);
      mockFindMany.mockResolvedValueOnce([mockEmployees[0]]);
      mockFindMany.mockResolvedValueOnce([mockAttendanceRecords[0]]);

      await getWeeklyReport(
        '2024-02-27',
        undefined,
        { userId: 'mgr-user-1', email: 'mgr@example.com', role: 'MANAGER' as Role }
      );

      const findManyCall = mockFindMany.mock.calls[0][0];
      expect(findManyCall.where.managerId).toBe('mgr-1');
    });
  });

  describe('getMonthlyReport', () => {
    it('should use AttendanceSummary data', async () => {
      mockFindMany.mockResolvedValueOnce(mockEmployees);
      mockFindMany.mockResolvedValueOnce(mockAttendanceSummaries);

      const result = await getMonthlyReport(
        2,
        2024,
        undefined,
        undefined,
        { userId: 'hr-user-1', email: 'hr@example.com', role: 'HR_ADMIN' as Role }
      );

      expect(result.month).toBe(2);
      expect(result.year).toBe(2024);
      expect(result.summary).toBeDefined();
      expect(result.summary!.totalEmployees).toBe(2);
      expect(result.summary!.totalPresent).toBe(38); // 18 + 20
      expect(result.summary!.totalLate).toBe(3); // 1 + 2
      expect(result.summary!.totalHoursWorked).toBe(330); // 160 + 170
      expect(result.employees).toHaveLength(2);
    });

    it('should return single employee monthly report when employeeId provided', async () => {
      mockFindFirst.mockResolvedValue({
        ...mockEmployees[0],
      });

      mockFindUnique.mockResolvedValue(mockAttendanceSummaries[0]);

      const result = await getMonthlyReport(
        2,
        2024,
        undefined,
        'emp-1',
        { userId: 'hr-user-1', email: 'hr@example.com', role: 'HR_ADMIN' as Role }
      );

      expect(result.employees).toHaveLength(1);
      expect(result.employees[0].employeeId).toBe('emp-1');
      expect(result.employees[0].totalPresent).toBe(18);
      expect(result.summary?.totalPresent).toBe(18);
    });

    it('should handle employees without summary data', async () => {
      mockFindMany.mockResolvedValueOnce(mockEmployees);
      mockFindMany.mockResolvedValueOnce([mockAttendanceSummaries[0]]); // Only one summary

      const result = await getMonthlyReport(
        2,
        2024,
        undefined,
        undefined,
        { userId: 'hr-user-1', email: 'hr@example.com', role: 'HR_ADMIN' as Role }
      );

      const emp2 = result.employees.find((e: any) => e.employeeId === 'emp-2');
      expect(emp2).toBeDefined();
      expect(emp2!.totalPresent).toBe(0);
      expect(emp2!.totalHoursWorked).toBe(0);
    });

    it('should respect department filter', async () => {
      mockFindMany.mockResolvedValueOnce([mockEmployees[0]]);
      mockFindMany.mockResolvedValueOnce([mockAttendanceSummaries[0]]);

      await getMonthlyReport(
        2,
        2024,
        'dept-1',
        undefined,
        { userId: 'hr-user-1', email: 'hr@example.com', role: 'HR_ADMIN' as Role }
      );

      const findManyCall = mockFindMany.mock.calls[0][0];
      expect(findManyCall.where.departmentId).toBe('dept-1');
    });

    it('should allow MANAGER to see only team reports', async () => {
      const managerEmp = {
        id: 'mgr-1',
        userId: 'mgr-user-1',
        departmentId: 'dept-1',
      };

      mockFindUnique.mockResolvedValue(managerEmp);
      mockFindMany.mockResolvedValueOnce([mockEmployees[0]]);
      mockFindMany.mockResolvedValueOnce([mockAttendanceSummaries[0]]);

      await getMonthlyReport(
        2,
        2024,
        undefined,
        undefined,
        { userId: 'mgr-user-1', email: 'mgr@example.com', role: 'MANAGER' as Role }
      );

      const findManyCall = mockFindMany.mock.calls[0][0];
      expect(findManyCall.where.managerId).toBe('mgr-1');
    });

    it('should reject MANAGER access to other department', async () => {
      const managerEmp = {
        id: 'mgr-1',
        userId: 'mgr-user-1',
        departmentId: 'dept-1',
      };

      mockFindUnique.mockResolvedValue(managerEmp);

      await expect(
        getMonthlyReport(
          2,
          2024,
          'dept-2', // Different department
          undefined,
          { userId: 'mgr-user-1', email: 'mgr@example.com', role: 'MANAGER' as Role }
        )
      ).rejects.toThrow('Managers can only view reports for their own department');
    });

    it('should aggregate hours and overtime correctly', async () => {
      mockFindMany.mockResolvedValueOnce(mockEmployees);
      mockFindMany.mockResolvedValueOnce(mockAttendanceSummaries);

      const result = await getMonthlyReport(
        2,
        2024,
        undefined,
        undefined,
        { userId: 'hr-user-1', email: 'hr@example.com', role: 'HR_ADMIN' as Role }
      );

      expect(result.summary).toBeDefined();
      expect(result.summary!.totalHoursWorked).toBe(330);
      expect(result.summary!.totalOvertimeHours).toBe(18); // 8 + 10
    });
  });

  describe('RBAC - Cross-cutting concerns', () => {
    it('should enforce RBAC for managers across report types', async () => {
      const managerUser = { userId: 'mgr-1', email: 'mgr@example.com', role: 'MANAGER' as Role };

      // Manager should trigger RBAC checks
      mockFindUnique.mockResolvedValue({ 
        id: 'mgr-emp-1', 
        userId: 'mgr-1', 
        departmentId: 'dept-1' 
      });
      mockFindMany.mockResolvedValue([]);

      // Should not throw, but should be filtered
      await getDailyReport('2024-02-27', undefined, managerUser);

      // Verify employee lookup was called (RBAC check)
      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'mgr-1' },
        })
      );
    });
  });
});
