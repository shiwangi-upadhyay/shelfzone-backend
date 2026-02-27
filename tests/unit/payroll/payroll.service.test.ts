import { jest } from '@jest/globals';
import type { AccessTokenPayload } from '../../../src/modules/auth/auth.service.js';
import { Role } from '@prisma/client';

// Mock encryption module
const mockEncrypt = jest.fn((val: string) => `encrypted:${val}`);
const mockDecrypt = jest.fn((val: string) => val.replace('encrypted:', ''));

jest.unstable_mockModule('../../../src/lib/encryption.js', () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
}));

// Mock Prisma
const mockPrisma = {
  employee: {
    findUnique: jest.fn() as any,
    findMany: jest.fn() as any,
  },
  salaryStructure: {
    create: jest.fn() as any,
    findFirst: jest.fn() as any,
    updateMany: jest.fn() as any,
  },
  payrollRun: {
    create: jest.fn() as any,
    findUnique: jest.fn() as any,
    update: jest.fn() as any,
  },
  payslip: {
    create: jest.fn() as any,
    findUnique: jest.fn() as any,
    findMany: jest.fn() as any,
    count: jest.fn() as any,
  },
};

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: mockPrisma,
}));

const {
  createSalaryStructure,
  getSalaryStructure,
  createPayrollRun,
  processPayrollRun,
  getPayslipById,
  getPayslips,
} = await import('../../../src/modules/payroll/payroll.service.js');

describe('Payroll Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createHRUser = (): AccessTokenPayload => ({
    userId: 'user-hr',
    email: 'hr@example.com',
    role: Role.HR_ADMIN,
  });

  const createEmployeeUser = (userId = 'user-001', email = 'emp@example.com'): AccessTokenPayload => ({
    userId,
    email,
    role: Role.EMPLOYEE,
  });

  const createManagerUser = (): AccessTokenPayload => ({
    userId: 'user-mgr',
    email: 'mgr@example.com',
    role: Role.MANAGER,
  });

  describe('createSalaryStructure', () => {
    it('should encrypt all salary components and calculate gross correctly', async () => {
      const employeeId = 'emp-001';
      const input = {
        employeeId,
        basicSalary: 50000,
        hra: 20000,
        da: 5000,
        specialAllowance: 10000,
        medicalAllowance: 2000,
        transportAllowance: 3000,
        effectiveFrom: '2025-01-01',
      };

      mockPrisma.employee.findUnique.mockResolvedValue({ id: employeeId });
      mockPrisma.salaryStructure.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.salaryStructure.create.mockResolvedValue({
        id: 'ss-001',
        employeeId,
        basicSalary: 'encrypted:50000',
        hra: 'encrypted:20000',
        da: 'encrypted:5000',
        specialAllowance: 'encrypted:10000',
        medicalAllowance: 'encrypted:2000',
        transportAllowance: 'encrypted:3000',
        grossSalary: 'encrypted:90000',
        effectiveFrom: new Date('2025-01-01'),
        isActive: true,
      });

      const result = await createSalaryStructure(input);

      expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({ where: { id: employeeId } });
      expect(mockPrisma.salaryStructure.updateMany).toHaveBeenCalledWith({
        where: { employeeId, isActive: true },
        data: { isActive: false, effectiveTo: expect.any(Date) },
      });

      const createCall = mockPrisma.salaryStructure.create.mock.calls[0][0] as any;
      expect(createCall.data.basicSalary).toBe('encrypted:50000');
      expect(createCall.data.hra).toBe('encrypted:20000');
      expect(createCall.data.grossSalary).toBe('encrypted:90000');
      expect(createCall.data.isActive).toBe(true);

      expect(result).toEqual({
        id: 'ss-001',
        employeeId,
        effectiveFrom: expect.any(Date),
      });
    });

    it('should deactivate existing active salary structures', async () => {
      const employeeId = 'emp-002';
      const input = {
        employeeId,
        basicSalary: 60000,
        effectiveFrom: '2025-02-01',
      };

      mockPrisma.employee.findUnique.mockResolvedValue({ id: employeeId });
      mockPrisma.salaryStructure.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.salaryStructure.create.mockResolvedValue({
        id: 'ss-002',
        employeeId,
        basicSalary: 'encrypted:60000',
        grossSalary: 'encrypted:60000',
        effectiveFrom: new Date('2025-02-01'),
        isActive: true,
      });

      await createSalaryStructure(input);

      expect(mockPrisma.salaryStructure.updateMany).toHaveBeenCalledWith({
        where: { employeeId, isActive: true },
        data: { isActive: false, effectiveTo: expect.any(Date) },
      });
    });

    it('should handle optional allowances correctly', async () => {
      const employeeId = 'emp-003';
      const input = {
        employeeId,
        basicSalary: 40000,
        effectiveFrom: '2025-01-01',
      };

      mockPrisma.employee.findUnique.mockResolvedValue({ id: employeeId });
      mockPrisma.salaryStructure.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.salaryStructure.create.mockResolvedValue({
        id: 'ss-003',
        employeeId,
        basicSalary: 'encrypted:40000',
        hra: null,
        da: null,
        specialAllowance: null,
        medicalAllowance: null,
        transportAllowance: null,
        grossSalary: 'encrypted:40000',
        effectiveFrom: new Date('2025-01-01'),
        isActive: true,
      });

      await createSalaryStructure(input);

      const createCall = mockPrisma.salaryStructure.create.mock.calls[0][0] as any;
      expect(createCall.data.hra).toBeNull();
      expect(createCall.data.da).toBeNull();
      expect(createCall.data.grossSalary).toBe('encrypted:40000');
    });

    it('should throw 404 if employee not found', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        createSalaryStructure({
          employeeId: 'invalid-emp',
          basicSalary: 50000,
          effectiveFrom: '2025-01-01',
        })
      ).rejects.toThrow('Employee not found');
    });
  });

  describe('getSalaryStructure', () => {
    it('should return decrypted salary structure for HR_ADMIN', async () => {
      const employeeId = 'emp-001';
      const hrUser = createHRUser();

      mockPrisma.salaryStructure.findFirst.mockResolvedValue({
        id: 'ss-001',
        employeeId,
        basicSalary: 'encrypted:50000',
        hra: 'encrypted:20000',
        da: 'encrypted:5000',
        specialAllowance: 'encrypted:10000',
        medicalAllowance: 'encrypted:2000',
        transportAllowance: 'encrypted:3000',
        grossSalary: 'encrypted:90000',
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: null,
        isActive: true,
      });

      const result = await getSalaryStructure(employeeId, hrUser);

      expect(result.basicSalary).toBe(50000);
      expect(result.hra).toBe(20000);
      expect(result.grossSalary).toBe(90000);
      expect(mockDecrypt).toHaveBeenCalled();
    });

    it('should return decrypted salary structure for EMPLOYEE viewing own data', async () => {
      const employeeId = 'emp-001';
      const empUser = createEmployeeUser();

      mockPrisma.employee.findUnique.mockResolvedValue({ id: employeeId, userId: 'user-001' });
      mockPrisma.salaryStructure.findFirst.mockResolvedValue({
        id: 'ss-001',
        employeeId,
        basicSalary: 'encrypted:50000',
        hra: 'encrypted:20000',
        da: null,
        specialAllowance: null,
        medicalAllowance: null,
        transportAllowance: null,
        grossSalary: 'encrypted:70000',
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: null,
        isActive: true,
      });

      const result = await getSalaryStructure(employeeId, empUser);

      expect(result.basicSalary).toBe(50000);
      expect(result.hra).toBe(20000);
      expect(result.da).toBeNull();
    });

    it('should throw 403 for MANAGER role', async () => {
      const managerUser = createManagerUser();

      await expect(getSalaryStructure('emp-001', managerUser)).rejects.toMatchObject({
        message: 'Managers cannot view salary data',
        statusCode: 403,
      });
    });

    it('should throw 403 for EMPLOYEE viewing others data', async () => {
      const empUser = createEmployeeUser('user-002', 'emp2@example.com');

      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-002', userId: 'user-002' });

      await expect(getSalaryStructure('emp-001', empUser)).rejects.toMatchObject({
        message: 'You can only view your own salary structure',
        statusCode: 403,
      });
    });

    it('should throw 404 if no active salary structure found', async () => {
      const hrUser = createHRUser();

      mockPrisma.salaryStructure.findFirst.mockResolvedValue(null);

      await expect(getSalaryStructure('emp-999', hrUser)).rejects.toMatchObject({
        message: 'No active salary structure found',
        statusCode: 404,
      });
    });
  });

  describe('createPayrollRun', () => {
    it('should create payroll run successfully', async () => {
      const input = { month: 1, year: 2025 };
      mockPrisma.payrollRun.findUnique.mockResolvedValue(null);
      mockPrisma.payrollRun.create.mockResolvedValue({
        id: 'pr-001',
        month: 1,
        year: 2025,
        status: 'DRAFT',
        createdAt: new Date(),
      });

      const result = await createPayrollRun(input);

      expect(result.status).toBe('DRAFT');
      expect(result.month).toBe(1);
      expect(result.year).toBe(2025);
    });

    it('should reject duplicate month/year combination', async () => {
      const input = { month: 1, year: 2025 };
      mockPrisma.payrollRun.findUnique.mockResolvedValue({
        id: 'pr-001',
        month: 1,
        year: 2025,
        status: 'COMPLETED',
      });

      await expect(createPayrollRun(input)).rejects.toMatchObject({
        message: 'Payroll run already exists for 1/2025',
        statusCode: 409,
      });
    });
  });

  describe('processPayrollRun', () => {
    it('should generate payslips for all active employees with salary structures', async () => {
      const payrollRunId = 'pr-001';
      const processedBy = 'user-hr';

      mockPrisma.payrollRun.findUnique.mockResolvedValue({
        id: payrollRunId,
        month: 1,
        year: 2025,
        status: 'DRAFT',
      });

      mockPrisma.payrollRun.update.mockResolvedValue({
        id: payrollRunId,
        status: 'COMPLETED',
        totalEmployees: 2,
        processedAt: new Date(),
      });

      mockPrisma.employee.findMany.mockResolvedValue([
        {
          id: 'emp-001',
          status: 'ACTIVE',
          salaryStructure: {
            id: 'ss-001',
            basicSalary: 'encrypted:50000',
            hra: 'encrypted:20000',
            da: null,
            specialAllowance: null,
            medicalAllowance: null,
            transportAllowance: null,
            grossSalary: 'encrypted:70000',
            isActive: true,
          },
        },
        {
          id: 'emp-002',
          status: 'ACTIVE',
          salaryStructure: {
            id: 'ss-002',
            basicSalary: 'encrypted:40000',
            hra: 'encrypted:15000',
            da: null,
            specialAllowance: null,
            medicalAllowance: null,
            transportAllowance: null,
            grossSalary: 'encrypted:55000',
            isActive: true,
          },
        },
      ]);

      mockPrisma.payslip.create.mockResolvedValue({ id: 'payslip-001' });

      const result = await processPayrollRun(payrollRunId, processedBy);

      expect(result.status).toBe('COMPLETED');
      expect(result.totalEmployees).toBe(2);
      expect(mockPrisma.payslip.create).toHaveBeenCalledTimes(2);
    });

    it('should calculate PF correctly (12% of basic, capped at 15000)', async () => {
      const payrollRunId = 'pr-002';

      mockPrisma.payrollRun.findUnique.mockResolvedValue({
        id: payrollRunId,
        month: 2,
        year: 2025,
        status: 'DRAFT',
      });

      mockPrisma.payrollRun.update.mockResolvedValue({
        id: payrollRunId,
        status: 'COMPLETED',
        totalEmployees: 1,
      });

      // Basic = 50000, PF should be 50000 * 0.12 = 6000 (both employee and employer)
      mockPrisma.employee.findMany.mockResolvedValue([
        {
          id: 'emp-001',
          status: 'ACTIVE',
          salaryStructure: {
            basicSalary: 'encrypted:50000',
            hra: null,
            da: null,
            specialAllowance: null,
            medicalAllowance: null,
            transportAllowance: null,
            isActive: true,
          },
        },
      ]);

      mockPrisma.payslip.create.mockResolvedValue({ id: 'payslip-001' });

      await processPayrollRun(payrollRunId, 'user-hr');

      const payslipData = (mockPrisma.payslip.create.mock.calls[0][0] as any).data;
      expect(payslipData.pfEmployee).toBe('encrypted:6000');
      expect(payslipData.pfEmployer).toBe('encrypted:6000');
    });

    it('should calculate ESI correctly (threshold check at 21000)', async () => {
      const payrollRunId = 'pr-003';

      mockPrisma.payrollRun.findUnique.mockResolvedValue({
        id: payrollRunId,
        month: 3,
        year: 2025,
        status: 'DRAFT',
      });

      mockPrisma.payrollRun.update.mockResolvedValue({
        id: payrollRunId,
        status: 'COMPLETED',
        totalEmployees: 2,
      });

      mockPrisma.employee.findMany.mockResolvedValue([
        {
          id: 'emp-low',
          status: 'ACTIVE',
          salaryStructure: {
            basicSalary: 'encrypted:15000',
            hra: 'encrypted:5000',
            da: null,
            specialAllowance: null,
            medicalAllowance: null,
            transportAllowance: null,
            isActive: true,
          },
        },
        {
          id: 'emp-high',
          status: 'ACTIVE',
          salaryStructure: {
            basicSalary: 'encrypted:50000',
            hra: null,
            da: null,
            specialAllowance: null,
            medicalAllowance: null,
            transportAllowance: null,
            isActive: true,
          },
        },
      ]);

      mockPrisma.payslip.create.mockResolvedValue({ id: 'payslip-001' });

      await processPayrollRun(payrollRunId, 'user-hr');

      // Employee 1: gross = 20000, ESI applies (0.75% emp, 3.25% employer)
      const payslip1 = (mockPrisma.payslip.create.mock.calls[0][0] as any).data;
      expect(payslip1.esiEmployee).toBe('encrypted:150'); // 20000 * 0.0075 = 150
      expect(payslip1.esiEmployer).toBe('encrypted:650'); // 20000 * 0.0325 = 650

      // Employee 2: gross = 50000, ESI does not apply
      const payslip2 = (mockPrisma.payslip.create.mock.calls[1][0] as any).data;
      expect(payslip2.esiEmployee).toBe('encrypted:0');
      expect(payslip2.esiEmployer).toBe('encrypted:0');
    });

    it('should calculate professional tax correctly', async () => {
      const payrollRunId = 'pr-004';

      mockPrisma.payrollRun.findUnique.mockResolvedValue({
        id: payrollRunId,
        month: 4,
        year: 2025,
        status: 'DRAFT',
      });

      mockPrisma.payrollRun.update.mockResolvedValue({
        id: payrollRunId,
        status: 'COMPLETED',
        totalEmployees: 1,
      });

      mockPrisma.employee.findMany.mockResolvedValue([
        {
          id: 'emp-001',
          status: 'ACTIVE',
          salaryStructure: {
            basicSalary: 'encrypted:50000',
            hra: null,
            da: null,
            specialAllowance: null,
            medicalAllowance: null,
            transportAllowance: null,
            isActive: true,
          },
        },
      ]);

      mockPrisma.payslip.create.mockResolvedValue({ id: 'payslip-001' });

      await processPayrollRun(payrollRunId, 'user-hr');

      const payslipData = (mockPrisma.payslip.create.mock.calls[0][0] as any).data;
      expect(payslipData.professionalTax).toBe('encrypted:200');
    });

    it('should calculate net pay = gross - total deductions', async () => {
      const payrollRunId = 'pr-005';

      mockPrisma.payrollRun.findUnique.mockResolvedValue({
        id: payrollRunId,
        month: 5,
        year: 2025,
        status: 'DRAFT',
      });

      mockPrisma.payrollRun.update.mockResolvedValue({
        id: payrollRunId,
        status: 'COMPLETED',
        totalEmployees: 1,
      });

      mockPrisma.employee.findMany.mockResolvedValue([
        {
          id: 'emp-001',
          status: 'ACTIVE',
          salaryStructure: {
            basicSalary: 'encrypted:50000',
            hra: 'encrypted:20000',
            da: null,
            specialAllowance: null,
            medicalAllowance: null,
            transportAllowance: null,
            isActive: true,
          },
        },
      ]);

      mockPrisma.payslip.create.mockResolvedValue({ id: 'payslip-001' });

      await processPayrollRun(payrollRunId, 'user-hr');

      const payslipData = (mockPrisma.payslip.create.mock.calls[0][0] as any).data;

      // Gross = 70000
      // PF = 6000 (12% of 50000)
      // ESI = 0 (gross > 21000)
      // PT = 200
      // TDS = 0
      // Total deductions = 6200
      // Net = 63800

      expect(payslipData.grossPay).toBe('encrypted:70000');
      expect(payslipData.totalDeductions).toBe('encrypted:6200');
      expect(payslipData.netPay).toBe('encrypted:63800');
    });

    it('should verify all monetary values are encrypted in storage', async () => {
      const payrollRunId = 'pr-006';

      mockPrisma.payrollRun.findUnique.mockResolvedValue({
        id: payrollRunId,
        month: 6,
        year: 2025,
        status: 'DRAFT',
      });

      mockPrisma.payrollRun.update.mockResolvedValue({
        id: payrollRunId,
        status: 'COMPLETED',
        totalEmployees: 1,
      });

      mockPrisma.employee.findMany.mockResolvedValue([
        {
          id: 'emp-001',
          status: 'ACTIVE',
          salaryStructure: {
            basicSalary: 'encrypted:40000',
            hra: 'encrypted:15000',
            da: 'encrypted:3000',
            specialAllowance: 'encrypted:5000',
            medicalAllowance: 'encrypted:2000',
            transportAllowance: 'encrypted:1000',
            isActive: true,
          },
        },
      ]);

      mockPrisma.payslip.create.mockResolvedValue({ id: 'payslip-001' });

      await processPayrollRun(payrollRunId, 'user-hr');

      const payslipData = (mockPrisma.payslip.create.mock.calls[0][0] as any).data;

      // Verify all monetary fields start with 'encrypted:'
      expect(payslipData.basicPay).toMatch(/^encrypted:/);
      expect(payslipData.hra).toMatch(/^encrypted:/);
      expect(payslipData.da).toMatch(/^encrypted:/);
      expect(payslipData.specialAllowance).toMatch(/^encrypted:/);
      expect(payslipData.medicalAllowance).toMatch(/^encrypted:/);
      expect(payslipData.transportAllowance).toMatch(/^encrypted:/);
      expect(payslipData.grossPay).toMatch(/^encrypted:/);
      expect(payslipData.pfEmployee).toMatch(/^encrypted:/);
      expect(payslipData.pfEmployer).toMatch(/^encrypted:/);
      expect(payslipData.esiEmployee).toMatch(/^encrypted:/);
      expect(payslipData.esiEmployer).toMatch(/^encrypted:/);
      expect(payslipData.professionalTax).toMatch(/^encrypted:/);
      expect(payslipData.tds).toMatch(/^encrypted:/);
      expect(payslipData.totalDeductions).toMatch(/^encrypted:/);
      expect(payslipData.netPay).toMatch(/^encrypted:/);
    });

    it('should throw 404 if payroll run not found', async () => {
      mockPrisma.payrollRun.findUnique.mockResolvedValue(null);

      await expect(processPayrollRun('invalid-pr', 'user-hr')).rejects.toMatchObject({
        message: 'Payroll run not found',
        statusCode: 404,
      });
    });

    it('should throw 400 if payroll run is not in DRAFT status', async () => {
      mockPrisma.payrollRun.findUnique.mockResolvedValue({
        id: 'pr-001',
        status: 'COMPLETED',
      });

      await expect(processPayrollRun('pr-001', 'user-hr')).rejects.toMatchObject({
        message: 'Only DRAFT payroll runs can be processed',
        statusCode: 400,
      });
    });
  });

  describe('getPayslipById', () => {
    it('should return decrypted payslip for HR_ADMIN', async () => {
      const payslipId = 'ps-001';
      const hrUser = createHRUser();

      mockPrisma.payslip.findUnique.mockResolvedValue({
        id: payslipId,
        payrollRunId: 'pr-001',
        employeeId: 'emp-001',
        month: 1,
        year: 2025,
        basicPay: 'encrypted:50000',
        hra: 'encrypted:20000',
        da: null,
        specialAllowance: null,
        medicalAllowance: null,
        transportAllowance: null,
        grossPay: 'encrypted:70000',
        pfEmployee: 'encrypted:6000',
        pfEmployer: 'encrypted:6000',
        esiEmployee: 'encrypted:0',
        esiEmployer: 'encrypted:0',
        professionalTax: 'encrypted:200',
        tds: 'encrypted:0',
        totalDeductions: 'encrypted:6200',
        netPay: 'encrypted:63800',
        createdAt: new Date('2025-01-15'),
        employee: {
          id: 'emp-001',
          firstName: 'John',
          lastName: 'Doe',
          userId: 'user-001',
        },
      });

      const result = await getPayslipById(payslipId, hrUser);

      expect(result.basicPay).toBe(50000);
      expect(result.grossPay).toBe(70000);
      expect(result.netPay).toBe(63800);
      expect(result.employeeName).toBe('John Doe');
      expect(mockDecrypt).toHaveBeenCalled();
    });

    it('should return decrypted payslip for EMPLOYEE viewing own data', async () => {
      const payslipId = 'ps-001';
      const empUser = createEmployeeUser();

      mockPrisma.payslip.findUnique.mockResolvedValue({
        id: payslipId,
        payrollRunId: 'pr-001',
        employeeId: 'emp-001',
        month: 1,
        year: 2025,
        basicPay: 'encrypted:50000',
        hra: 'encrypted:20000',
        da: null,
        specialAllowance: null,
        medicalAllowance: null,
        transportAllowance: null,
        grossPay: 'encrypted:70000',
        pfEmployee: 'encrypted:6000',
        pfEmployer: 'encrypted:6000',
        esiEmployee: 'encrypted:0',
        esiEmployer: 'encrypted:0',
        professionalTax: 'encrypted:200',
        tds: 'encrypted:0',
        totalDeductions: 'encrypted:6200',
        netPay: 'encrypted:63800',
        createdAt: new Date('2025-01-15'),
        employee: {
          id: 'emp-001',
          firstName: 'John',
          lastName: 'Doe',
          userId: 'user-001',
        },
      });

      const result = await getPayslipById(payslipId, empUser);

      expect(result.basicPay).toBe(50000);
      expect(result.netPay).toBe(63800);
    });

    it('should throw 403 for MANAGER role', async () => {
      const managerUser = createManagerUser();

      await expect(getPayslipById('ps-001', managerUser)).rejects.toMatchObject({
        message: 'Managers cannot view payslips',
        statusCode: 403,
      });
    });

    it('should throw 403 for EMPLOYEE viewing others payslip', async () => {
      const empUser = createEmployeeUser('user-002', 'emp2@example.com');

      mockPrisma.payslip.findUnique.mockResolvedValue({
        id: 'ps-001',
        employee: {
          userId: 'user-001',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      await expect(getPayslipById('ps-001', empUser)).rejects.toMatchObject({
        message: 'You can only view your own payslips',
        statusCode: 403,
      });
    });

    it('should throw 404 if payslip not found', async () => {
      const hrUser = createHRUser();

      mockPrisma.payslip.findUnique.mockResolvedValue(null);

      await expect(getPayslipById('invalid-ps', hrUser)).rejects.toMatchObject({
        message: 'Payslip not found',
        statusCode: 404,
      });
    });
  });

  describe('getPayslips (list)', () => {
    it('should return metadata only (no salary data) for HR_ADMIN', async () => {
      const hrUser = createHRUser();

      const query = { page: 1, limit: 10 };

      mockPrisma.payslip.findMany.mockResolvedValue([
        {
          id: 'ps-001',
          payrollRunId: 'pr-001',
          employeeId: 'emp-001',
          month: 1,
          year: 2025,
          createdAt: new Date('2025-01-15'),
          employee: { firstName: 'John', lastName: 'Doe' },
        },
        {
          id: 'ps-002',
          payrollRunId: 'pr-001',
          employeeId: 'emp-002',
          month: 1,
          year: 2025,
          createdAt: new Date('2025-01-15'),
          employee: { firstName: 'Jane', lastName: 'Smith' },
        },
      ]);

      mockPrisma.payslip.count.mockResolvedValue(2);

      const result = await getPayslips(query, hrUser);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: 'ps-001',
        payrollRunId: 'pr-001',
        employeeId: 'emp-001',
        employeeName: 'John Doe',
        month: 1,
        year: 2025,
        createdAt: expect.any(Date),
      });
      // Verify no salary data is returned
      expect(result.data[0]).not.toHaveProperty('basicPay');
      expect(result.data[0]).not.toHaveProperty('netPay');
    });

    it('should filter to own payslips for EMPLOYEE role', async () => {
      const empUser = createEmployeeUser();

      const query = { page: 1, limit: 10 };

      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-001', userId: 'user-001' });
      mockPrisma.payslip.findMany.mockResolvedValue([
        {
          id: 'ps-001',
          payrollRunId: 'pr-001',
          employeeId: 'emp-001',
          month: 1,
          year: 2025,
          createdAt: new Date('2025-01-15'),
          employee: { firstName: 'John', lastName: 'Doe' },
        },
      ]);

      mockPrisma.payslip.count.mockResolvedValue(1);

      const result = await getPayslips(query, empUser);

      expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-001' } });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].employeeId).toBe('emp-001');
    });

    it('should throw 403 for MANAGER role', async () => {
      const managerUser = createManagerUser();

      await expect(getPayslips({ page: 1, limit: 10 }, managerUser)).rejects.toMatchObject({
        message: 'Managers cannot view payslips',
        statusCode: 403,
      });
    });

    it('should support pagination', async () => {
      const hrUser = createHRUser();

      const query = { page: 2, limit: 5 };

      mockPrisma.payslip.findMany.mockResolvedValue([]);
      mockPrisma.payslip.count.mockResolvedValue(12);

      const result = await getPayslips(query, hrUser);

      expect(result.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 12,
        totalPages: 3,
      });

      expect(mockPrisma.payslip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        })
      );
    });

    it('should filter by month and year', async () => {
      const hrUser = createHRUser();

      const query = { page: 1, limit: 10, month: 1, year: 2025 };

      mockPrisma.payslip.findMany.mockResolvedValue([]);
      mockPrisma.payslip.count.mockResolvedValue(0);

      await getPayslips(query, hrUser);

      expect(mockPrisma.payslip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            month: 1,
            year: 2025,
          }),
        })
      );
    });
  });
});
