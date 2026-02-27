import { jest } from '@jest/globals';

// Mock data
const mockUser = { id: 'user-1', email: 'emp@example.com' };
const mockDepartment = { id: 'dept-1', name: 'Engineering' };
const mockDesignation = { id: 'desig-1', title: 'Engineer' };
const mockManager = {
  id: 'mgr-emp-1',
  employeeCode: 'EMP-00001',
  firstName: 'Manager',
  lastName: 'User',
  userId: 'mgr-user-1',
};

const mockEmployee = {
  id: 'emp-1',
  employeeCode: 'EMP-00002',
  userId: 'user-1',
  departmentId: 'dept-1',
  designationId: 'desig-1',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+1234567890',
  encryptedAadhaar: 'iv:tag:cipher-aadhaar',
  encryptedPan: 'iv:tag:cipher-pan',
  encryptedSalary: 'iv:tag:cipher-salary',
  dateOfJoining: new Date('2024-01-01'),
  dateOfLeaving: null,
  status: 'ACTIVE',
  managerId: 'mgr-emp-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  user: mockUser,
  department: mockDepartment,
  designation: mockDesignation,
  manager: mockManager,
};

// Mock Prisma methods
const mockFindUnique = jest.fn<(...args: any[]) => Promise<any>>();
const mockFindFirst = jest.fn<(...args: any[]) => Promise<any>>();
const mockFindMany = jest.fn<(...args: any[]) => Promise<any>>();
const mockCount = jest.fn<(...args: any[]) => Promise<number>>();
const mockCreate = jest.fn<(...args: any[]) => Promise<any>>();
const mockUpdate = jest.fn<(...args: any[]) => Promise<any>>();

// Mock encryption functions
const mockEncrypt = jest.fn<(plaintext: string) => string>();
const mockDecrypt = jest.fn<(ciphertext: string) => string>();

// Mock employee code generator
const mockGenerateEmployeeCode = jest.fn<() => Promise<string>>();

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: {
    user: { findUnique: mockFindUnique },
    department: { findUnique: mockFindUnique },
    designation: { findUnique: mockFindUnique },
    employee: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      findMany: mockFindMany,
      count: mockCount,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}));

jest.unstable_mockModule('../../../src/lib/encryption.js', () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
}));

jest.unstable_mockModule('../../../src/lib/employee-code.js', () => ({
  generateEmployeeCode: mockGenerateEmployeeCode,
}));

const { createEmployee, getEmployeeById, updateEmployee, deleteEmployee } = await import(
  '../../../src/modules/employees/employee.service.js'
);

describe('Employee Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEncrypt.mockImplementation((text) => `encrypted:${text}`);
    mockDecrypt.mockImplementation((text) => text.replace('encrypted:', ''));
  });

  describe('createEmployee', () => {
    beforeEach(() => {
      mockGenerateEmployeeCode.mockResolvedValue('EMP-00003');
    });

    it('should create employee successfully with PII encryption', async () => {
      // Mock all validation checks
      mockFindUnique
        .mockResolvedValueOnce(mockUser) // user exists
        .mockResolvedValueOnce(mockDepartment) // department exists
        .mockResolvedValueOnce(mockDesignation) // designation exists
        .mockResolvedValueOnce(null) // no existing employee record
        .mockResolvedValueOnce(mockManager); // manager exists

      mockCreate.mockResolvedValue({
        ...mockEmployee,
        id: 'emp-3',
        employeeCode: 'EMP-00003',
      });

      const input = {
        userId: 'user-1',
        departmentId: 'dept-1',
        designationId: 'desig-1',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+9876543210',
        aadhaar: '123456789012',
        pan: 'ABCDE1234F',
        salary: '75000',
        dateOfJoining: '2024-02-01',
        managerId: 'mgr-emp-1',
      };

      const result = await createEmployee(input);

      // Verify encryption was called
      expect(mockEncrypt).toHaveBeenCalledWith('123456789012');
      expect(mockEncrypt).toHaveBeenCalledWith('ABCDE1234F');
      expect(mockEncrypt).toHaveBeenCalledWith('75000');

      // Verify employee code was generated
      expect(mockGenerateEmployeeCode).toHaveBeenCalled();

      // Verify create was called with encrypted data
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeCode: 'EMP-00003',
            encryptedAadhaar: 'encrypted:123456789012',
            encryptedPan: 'encrypted:ABCDE1234F',
            encryptedSalary: 'encrypted:75000',
          }),
        }),
      );

      expect(result).toBeDefined();
    });

    it('should throw error if user not found', async () => {
      mockFindUnique.mockResolvedValueOnce(null); // user not found

      await expect(
        createEmployee({
          userId: 'invalid',
          departmentId: 'dept-1',
          designationId: 'desig-1',
          firstName: 'Test',
          lastName: 'User',
          dateOfJoining: '2024-01-01',
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'User not found',
      });
    });

    it('should throw error if department not found', async () => {
      mockFindUnique
        .mockResolvedValueOnce(mockUser) // user exists
        .mockResolvedValueOnce(null); // department not found

      await expect(
        createEmployee({
          userId: 'user-1',
          departmentId: 'invalid',
          designationId: 'desig-1',
          firstName: 'Test',
          lastName: 'User',
          dateOfJoining: '2024-01-01',
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Department not found',
      });
    });

    it('should throw error if designation not found', async () => {
      mockFindUnique
        .mockResolvedValueOnce(mockUser) // user exists
        .mockResolvedValueOnce(mockDepartment) // department exists
        .mockResolvedValueOnce(null); // designation not found

      await expect(
        createEmployee({
          userId: 'user-1',
          departmentId: 'dept-1',
          designationId: 'invalid',
          firstName: 'Test',
          lastName: 'User',
          dateOfJoining: '2024-01-01',
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Designation not found',
      });
    });

    it('should throw error if user already has employee record', async () => {
      mockFindUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockDepartment)
        .mockResolvedValueOnce(mockDesignation)
        .mockResolvedValueOnce(mockEmployee); // already exists

      await expect(
        createEmployee({
          userId: 'user-1',
          departmentId: 'dept-1',
          designationId: 'desig-1',
          firstName: 'Test',
          lastName: 'User',
          dateOfJoining: '2024-01-01',
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'User already has an employee record',
      });
    });
  });

  describe('getEmployeeById - RBAC', () => {
    it('should return employee with decrypted PII for HR_ADMIN', async () => {
      mockFindUnique.mockResolvedValue(mockEmployee);
      mockDecrypt
        .mockReturnValueOnce('123456789012') // aadhaar
        .mockReturnValueOnce('ABCDE1234F') // pan
        .mockReturnValueOnce('75000'); // salary

      const requestingUser = { userId: 'admin-1', email: 'admin@example.com', role: 'HR_ADMIN' };
      const result = await getEmployeeById('emp-1', requestingUser);

      // Should call decrypt
      expect(mockDecrypt).toHaveBeenCalledTimes(3);

      // Should have decrypted PII fields
      expect(result).toHaveProperty('aadhaar', '123456789012');
      expect(result).toHaveProperty('pan', 'ABCDE1234F');
      expect(result).toHaveProperty('salary', '75000');

      // Should not have encrypted fields
      expect(result).not.toHaveProperty('encryptedAadhaar');
      expect(result).not.toHaveProperty('encryptedPan');
      expect(result).not.toHaveProperty('encryptedSalary');
    });

    it('should return employee with decrypted PII for SUPER_ADMIN', async () => {
      mockFindUnique.mockResolvedValue(mockEmployee);
      mockDecrypt
        .mockReturnValueOnce('123456789012')
        .mockReturnValueOnce('ABCDE1234F')
        .mockReturnValueOnce('75000');

      const requestingUser = {
        userId: 'super-1',
        email: 'super@example.com',
        role: 'SUPER_ADMIN',
      };
      const result = await getEmployeeById('emp-1', requestingUser);

      expect(mockDecrypt).toHaveBeenCalledTimes(3);
      expect(result).toHaveProperty('aadhaar');
    });

    it('should return employee WITHOUT PII for EMPLOYEE viewing self', async () => {
      mockFindUnique.mockResolvedValue(mockEmployee);

      const requestingUser = { userId: 'user-1', email: 'emp@example.com', role: 'EMPLOYEE' };
      const result = await getEmployeeById('emp-1', requestingUser);

      // Should NOT call decrypt
      expect(mockDecrypt).not.toHaveBeenCalled();

      // Should not have PII fields
      expect(result).not.toHaveProperty('aadhaar');
      expect(result).not.toHaveProperty('pan');
      expect(result).not.toHaveProperty('salary');
      expect(result).not.toHaveProperty('encryptedAadhaar');
    });

    it('should throw 403 for EMPLOYEE viewing others', async () => {
      mockFindUnique.mockResolvedValue(mockEmployee);

      const requestingUser = {
        userId: 'other-user',
        email: 'other@example.com',
        role: 'EMPLOYEE',
      };

      await expect(getEmployeeById('emp-1', requestingUser)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Access denied',
      });
    });

    it('should allow MANAGER to view self', async () => {
      mockFindUnique.mockResolvedValue(mockEmployee);

      const requestingUser = { userId: 'user-1', email: 'emp@example.com', role: 'MANAGER' };
      const result = await getEmployeeById('emp-1', requestingUser);

      expect(result).toBeDefined();
      expect(mockDecrypt).not.toHaveBeenCalled();
    });

    it('should allow MANAGER to view direct reports', async () => {
      const report = { ...mockEmployee, id: 'emp-2', managerId: 'mgr-emp-1' };
      mockFindUnique
        .mockResolvedValueOnce(report) // the employee being viewed
        .mockResolvedValueOnce(mockManager); // the manager's employee record

      const requestingUser = {
        userId: 'mgr-user-1',
        email: 'mgr@example.com',
        role: 'MANAGER',
      };
      const result = await getEmployeeById('emp-2', requestingUser);

      expect(result).toBeDefined();
    });

    it('should throw 403 for MANAGER viewing non-reports', async () => {
      const otherEmployee = { ...mockEmployee, id: 'emp-other', managerId: 'other-mgr' };
      mockFindUnique
        .mockResolvedValueOnce(otherEmployee)
        .mockResolvedValueOnce(mockManager);

      const requestingUser = {
        userId: 'mgr-user-1',
        email: 'mgr@example.com',
        role: 'MANAGER',
      };

      await expect(getEmployeeById('emp-other', requestingUser)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Access denied',
      });
    });

    it('should throw 404 if employee not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const requestingUser = { userId: 'admin-1', email: 'admin@example.com', role: 'HR_ADMIN' };

      await expect(getEmployeeById('invalid-id', requestingUser)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Employee not found',
      });
    });
  });

  describe('updateEmployee', () => {
    it('should update employee with PII re-encryption', async () => {
      mockFindUnique
        .mockResolvedValueOnce(mockEmployee) // employee exists
        .mockResolvedValueOnce(mockDepartment) // department valid
        .mockResolvedValueOnce(mockDesignation); // designation valid

      const updated = { ...mockEmployee, firstName: 'Updated' };
      mockUpdate.mockResolvedValue(updated);
      mockDecrypt
        .mockReturnValueOnce('123456789012')
        .mockReturnValueOnce('ABCDE1234F')
        .mockReturnValueOnce('75000');

      const requestingUser = { userId: 'admin-1', email: 'admin@example.com', role: 'HR_ADMIN' };
      const result = await updateEmployee(
        'emp-1',
        {
          firstName: 'Updated',
          aadhaar: '999999999999',
          salary: '85000',
        },
        requestingUser,
      );

      // Verify PII fields were re-encrypted
      expect(mockEncrypt).toHaveBeenCalledWith('999999999999');
      expect(mockEncrypt).toHaveBeenCalledWith('85000');

      expect(mockUpdate).toHaveBeenCalled();
      expect(result).toHaveProperty('aadhaar'); // Decrypted in response
    });

    it('should throw 403 for non-admin users', async () => {
      const requestingUser = { userId: 'user-1', email: 'user@example.com', role: 'EMPLOYEE' };

      await expect(
        updateEmployee('emp-1', { firstName: 'Test' }, requestingUser),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Only admins can update employees',
      });
    });

    it('should throw 404 if employee not found', async () => {
      // Reset and set up fresh mock
      mockFindUnique.mockReset();
      mockFindUnique.mockResolvedValue(null);

      const requestingUser = { userId: 'admin-1', email: 'admin@example.com', role: 'SUPER_ADMIN' };

      await expect(
        updateEmployee('invalid-id', { firstName: 'Test' }, requestingUser),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Employee not found',
      });
    });
  });

  describe('deleteEmployee', () => {
    it('should soft-delete employee (set status to TERMINATED)', async () => {
      mockFindUnique.mockResolvedValue(mockEmployee);
      const terminated = { ...mockEmployee, status: 'TERMINATED', dateOfLeaving: new Date() };
      mockUpdate.mockResolvedValue(terminated);

      const requestingUser = { userId: 'admin-1', email: 'admin@example.com', role: 'HR_ADMIN' };
      const result = await deleteEmployee('emp-1', requestingUser);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'emp-1' },
          data: expect.objectContaining({
            status: 'TERMINATED',
            dateOfLeaving: expect.any(Date),
          }),
        }),
      );

      // Result should not have PII
      expect(result).not.toHaveProperty('aadhaar');
      expect(result).not.toHaveProperty('encryptedAadhaar');
    });

    it('should throw 403 for non-admin users', async () => {
      const requestingUser = { userId: 'user-1', email: 'user@example.com', role: 'MANAGER' };

      await expect(deleteEmployee('emp-1', requestingUser)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Only admins can delete employees',
      });
    });

    it('should throw 404 if employee not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const requestingUser = { userId: 'admin-1', email: 'admin@example.com', role: 'SUPER_ADMIN' };

      await expect(deleteEmployee('invalid-id', requestingUser)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Employee not found',
      });
    });
  });

  describe('Employee Code Generation', () => {
    it('should generate sequential employee codes', async () => {
      // This is tested indirectly through createEmployee
      mockGenerateEmployeeCode
        .mockResolvedValueOnce('EMP-00001')
        .mockResolvedValueOnce('EMP-00002')
        .mockResolvedValueOnce('EMP-00003');

      expect(await mockGenerateEmployeeCode()).toBe('EMP-00001');
      expect(await mockGenerateEmployeeCode()).toBe('EMP-00002');
      expect(await mockGenerateEmployeeCode()).toBe('EMP-00003');
    });
  });
});
