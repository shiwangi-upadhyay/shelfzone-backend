import { jest } from '@jest/globals';

// Mock data
const mockDepartment = {
  id: 'dept-1',
  name: 'Engineering',
  description: 'Software development',
  managerId: 'mgr-1',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  manager: { id: 'mgr-1', email: 'manager@example.com' },
};

// Mock Prisma methods
const mockFindUnique = jest.fn<(...args: any[]) => Promise<any>>();
const mockCreate = jest.fn<(...args: any[]) => Promise<any>>();
const mockFindMany = jest.fn<(...args: any[]) => Promise<any>>();
const mockCount = jest.fn<(...args: any[]) => Promise<number>>();
const mockUpdate = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: {
    department: {
      findUnique: mockFindUnique,
      create: mockCreate,
      findMany: mockFindMany,
      count: mockCount,
      update: mockUpdate,
    },
  },
}));

const { createDepartment, getDepartments, getDepartmentById, updateDepartment, deleteDepartment } =
  await import('../../../src/modules/departments/department.service.js');

describe('Department Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDepartment', () => {
    it('should create a department successfully', async () => {
      mockFindUnique.mockResolvedValue(null); // No duplicate
      mockCreate.mockResolvedValue(mockDepartment);

      const result = await createDepartment({
        name: 'Engineering',
        description: 'Software development',
        managerId: 'mgr-1',
      });

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { name: 'Engineering' } });
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          name: 'Engineering',
          description: 'Software development',
          managerId: 'mgr-1',
        },
        include: { manager: { select: { id: true, email: true } } },
      });
      expect(result).toEqual(mockDepartment);
    });

    it('should reject duplicate department name', async () => {
      mockFindUnique.mockResolvedValue(mockDepartment);

      await expect(
        createDepartment({
          name: 'Engineering',
          description: 'Duplicate',
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        message: 'Department name already exists',
      });
    });
  });

  describe('getDepartments', () => {
    it('should return paginated departments', async () => {
      const departments = [mockDepartment, { ...mockDepartment, id: 'dept-2', name: 'HR' }];
      mockFindMany.mockResolvedValue(departments);
      mockCount.mockResolvedValue(2);

      const result = await getDepartments({ page: 1, limit: 10 });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { name: 'asc' },
        include: { manager: { select: { id: true, email: true } } },
      });
      expect(mockCount).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({
        data: departments,
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });
    });

    it('should filter by search term', async () => {
      mockFindMany.mockResolvedValue([mockDepartment]);
      mockCount.mockResolvedValue(1);

      await getDepartments({ page: 1, limit: 10, search: 'Eng' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { contains: 'Eng', mode: 'insensitive' } },
        }),
      );
    });

    it('should filter by isActive status', async () => {
      mockFindMany.mockResolvedValue([mockDepartment]);
      mockCount.mockResolvedValue(1);

      await getDepartments({ page: 1, limit: 10, isActive: true });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });
  });

  describe('getDepartmentById', () => {
    it('should return department when found', async () => {
      mockFindUnique.mockResolvedValue(mockDepartment);

      const result = await getDepartmentById('dept-1');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'dept-1' },
        include: { manager: { select: { id: true, email: true } } },
      });
      expect(result).toEqual(mockDepartment);
    });

    it('should throw 404 when not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(getDepartmentById('invalid-id')).rejects.toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: 'Department not found',
      });
    });
  });

  describe('updateDepartment', () => {
    it('should update department successfully', async () => {
      const updated = { ...mockDepartment, description: 'Updated description' };
      mockFindUnique.mockResolvedValue(mockDepartment);
      mockUpdate.mockResolvedValue(updated);

      const result = await updateDepartment('dept-1', { description: 'Updated description' });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'dept-1' },
        data: { description: 'Updated description' },
        include: { manager: { select: { id: true, email: true } } },
      });
      expect(result).toEqual(updated);
    });

    it('should throw 404 if department not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(updateDepartment('invalid-id', { description: 'Test' })).rejects.toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: 'Department not found',
      });
    });

    it('should reject duplicate name on update', async () => {
      mockFindUnique
        .mockResolvedValueOnce(mockDepartment) // First call: department exists
        .mockResolvedValueOnce({ id: 'dept-2', name: 'HR' }); // Second call: new name already exists

      await expect(updateDepartment('dept-1', { name: 'HR' })).rejects.toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        message: 'Department name already exists',
      });
    });
  });

  describe('deleteDepartment', () => {
    it('should soft-delete department with no active employees', async () => {
      const deleted = { ...mockDepartment, isActive: false };
      mockFindUnique.mockResolvedValue({ ...mockDepartment, employees: [] });
      mockUpdate.mockResolvedValue(deleted);

      const result = await deleteDepartment('dept-1');

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'dept-1' },
        data: { isActive: false },
      });
      expect(result).toEqual(deleted);
    });

    it('should throw 404 if department not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(deleteDepartment('invalid-id')).rejects.toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: 'Department not found',
      });
    });

    it('should reject deletion if department has active employees', async () => {
      mockFindUnique.mockResolvedValue({
        ...mockDepartment,
        employees: [{ id: 'emp-1' }],
      });

      await expect(deleteDepartment('dept-1')).rejects.toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Cannot delete department with active employees',
      });
    });
  });
});
