import { jest } from '@jest/globals';

// Mock data
const mockDesignation = {
  id: 'desig-1',
  title: 'Senior Engineer',
  level: 3,
  description: 'Senior software engineer',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// Mock Prisma methods
const mockFindUnique = jest.fn<(...args: any[]) => Promise<any>>();
const mockCreate = jest.fn<(...args: any[]) => Promise<any>>();
const mockFindMany = jest.fn<(...args: any[]) => Promise<any>>();
const mockCount = jest.fn<(...args: any[]) => Promise<number>>();
const mockUpdate = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: {
    designation: {
      findUnique: mockFindUnique,
      create: mockCreate,
      findMany: mockFindMany,
      count: mockCount,
      update: mockUpdate,
    },
  },
}));

const {
  createDesignation,
  getDesignations,
  getDesignationById,
  updateDesignation,
  deleteDesignation,
} = await import('../../../src/modules/designations/designation.service.js');

describe('Designation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDesignation', () => {
    it('should create a designation successfully', async () => {
      mockFindUnique.mockResolvedValue(null); // No duplicate
      mockCreate.mockResolvedValue(mockDesignation);

      const result = await createDesignation({
        title: 'Senior Engineer',
        level: 3,
        description: 'Senior software engineer',
      });

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { title: 'Senior Engineer' } });
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          title: 'Senior Engineer',
          level: 3,
          description: 'Senior software engineer',
        },
      });
      expect(result).toEqual({ data: mockDesignation });
    });

    it('should reject duplicate designation title', async () => {
      mockFindUnique.mockResolvedValue(mockDesignation);

      const result = await createDesignation({
        title: 'Senior Engineer',
        level: 3,
      });

      expect(result).toEqual({ error: 'DUPLICATE_TITLE' });
    });
  });

  describe('getDesignations', () => {
    it('should return paginated designations', async () => {
      const designations = [
        mockDesignation,
        { ...mockDesignation, id: 'desig-2', title: 'Junior Engineer', level: 1 },
      ];
      mockFindMany.mockResolvedValue(designations);
      mockCount.mockResolvedValue(2);

      const result = await getDesignations({ page: 1, limit: 10 });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockCount).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({
        data: designations,
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });
    });

    it('should filter by search term', async () => {
      mockFindMany.mockResolvedValue([mockDesignation]);
      mockCount.mockResolvedValue(1);

      await getDesignations({ page: 1, limit: 10, search: 'Senior' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { title: { contains: 'Senior', mode: 'insensitive' } },
        }),
      );
    });

    it('should filter by level', async () => {
      mockFindMany.mockResolvedValue([mockDesignation]);
      mockCount.mockResolvedValue(1);

      await getDesignations({ page: 1, limit: 10, level: 3 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { level: 3 },
        }),
      );
    });

    it('should filter by isActive status', async () => {
      mockFindMany.mockResolvedValue([mockDesignation]);
      mockCount.mockResolvedValue(1);

      await getDesignations({ page: 1, limit: 10, isActive: true });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });
  });

  describe('getDesignationById', () => {
    it('should return designation when found', async () => {
      mockFindUnique.mockResolvedValue(mockDesignation);

      const result = await getDesignationById('desig-1');

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'desig-1' } });
      expect(result).toEqual(mockDesignation);
    });

    it('should return null when not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await getDesignationById('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('updateDesignation', () => {
    it('should update designation successfully', async () => {
      const updated = { ...mockDesignation, description: 'Updated description' };
      mockFindUnique.mockResolvedValue(mockDesignation);
      mockUpdate.mockResolvedValue(updated);

      const result = await updateDesignation('desig-1', { description: 'Updated description' });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'desig-1' },
        data: { description: 'Updated description' },
      });
      expect(result).toEqual({ data: updated });
    });

    it('should return error if designation not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await updateDesignation('invalid-id', { description: 'Test' });

      expect(result).toEqual({ error: 'NOT_FOUND' });
    });

    it('should reject duplicate title on update', async () => {
      mockFindUnique
        .mockResolvedValueOnce(mockDesignation) // First call: designation exists
        .mockResolvedValueOnce({ id: 'desig-2', title: 'Manager' }); // Second call: new title exists

      const result = await updateDesignation('desig-1', { title: 'Manager' });

      expect(result).toEqual({ error: 'DUPLICATE_TITLE' });
    });

    it('should allow updating other fields without title change', async () => {
      const updated = { ...mockDesignation, level: 4 };
      mockFindUnique.mockResolvedValue(mockDesignation);
      mockUpdate.mockResolvedValue(updated);

      const result = await updateDesignation('desig-1', { level: 4 });

      expect(mockUpdate).toHaveBeenCalled();
      expect(result).toEqual({ data: updated });
    });
  });

  describe('deleteDesignation', () => {
    it('should soft-delete designation with no active employees', async () => {
      const deleted = { ...mockDesignation, isActive: false };
      mockFindUnique.mockResolvedValue({ ...mockDesignation, employees: [] });
      mockUpdate.mockResolvedValue(deleted);

      const result = await deleteDesignation('desig-1');

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'desig-1' },
        data: { isActive: false },
      });
      expect(result).toEqual({ data: deleted });
    });

    it('should return error if designation not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await deleteDesignation('invalid-id');

      expect(result).toEqual({ error: 'NOT_FOUND' });
    });

    it('should reject deletion if designation has active employees', async () => {
      mockFindUnique.mockResolvedValue({
        ...mockDesignation,
        employees: [{ id: 'emp-1' }],
      });

      const result = await deleteDesignation('desig-1');

      expect(result).toEqual({ error: 'HAS_ACTIVE_EMPLOYEES' });
    });
  });
});
