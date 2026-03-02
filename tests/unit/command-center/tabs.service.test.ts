import { jest } from '@jest/globals';
import { TabsService } from '../../../src/modules/command-center/tabs.service.js';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  conversationTab: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
} as unknown as PrismaClient;

describe('TabsService', () => {
  let tabsService: TabsService;
  const userId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    tabsService = new TabsService(mockPrisma);
  });

  // ─── getUserTabs ────────────────────────────────────────────────────

  describe('getUserTabs', () => {
    it('should return all tabs for a user ordered by position', async () => {
      const mockTabs = [
        { id: 'tab1', userId, title: 'Tab 1', position: 0, isActive: true, conversations: [] },
        { id: 'tab2', userId, title: 'Tab 2', position: 1, isActive: false, conversations: [] },
      ];

      (mockPrisma.conversationTab.findMany as jest.Mock).mockResolvedValue(mockTabs);

      const result = await tabsService.getUserTabs(userId);

      expect(mockPrisma.conversationTab.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { position: 'asc' },
        include: {
          conversations: {
            select: {
              id: true,
              title: true,
              agentId: true,
              updatedAt: true,
            },
          },
        },
      });
      expect(result).toEqual(mockTabs);
    });

    it('should return empty array when user has no tabs', async () => {
      (mockPrisma.conversationTab.findMany as jest.Mock).mockResolvedValue([]);

      const result = await tabsService.getUserTabs(userId);

      expect(result).toEqual([]);
    });
  });

  // ─── createTab ──────────────────────────────────────────────────────

  describe('createTab', () => {
    it('should create a new tab with default title', async () => {
      const mockTab = {
        id: 'tab1',
        userId,
        title: 'New Conversation',
        position: 0,
        isActive: true,
      };

      (mockPrisma.conversationTab.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.conversationTab.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (mockPrisma.conversationTab.create as jest.Mock).mockResolvedValue(mockTab);

      const result = await tabsService.createTab(userId, {});

      expect(mockPrisma.conversationTab.count).toHaveBeenCalledWith({ where: { userId } });
      expect(mockPrisma.conversationTab.updateMany).toHaveBeenCalledWith({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
      expect(mockPrisma.conversationTab.create).toHaveBeenCalledWith({
        data: {
          userId,
          title: 'New Conversation',
          position: 0,
          isActive: true,
        },
      });
      expect(result).toEqual(mockTab);
    });

    it('should create a tab with custom title', async () => {
      const customTitle = 'My Custom Tab';
      const mockTab = {
        id: 'tab1',
        userId,
        title: customTitle,
        position: 0,
        isActive: true,
      };

      (mockPrisma.conversationTab.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.conversationTab.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (mockPrisma.conversationTab.create as jest.Mock).mockResolvedValue(mockTab);

      const result = await tabsService.createTab(userId, { title: customTitle });

      expect(mockPrisma.conversationTab.create).toHaveBeenCalledWith({
        data: {
          userId,
          title: customTitle,
          position: 0,
          isActive: true,
        },
      });
      expect(result.title).toBe(customTitle);
    });

    it('should set correct position for second tab', async () => {
      (mockPrisma.conversationTab.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue({ position: 0 });
      (mockPrisma.conversationTab.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.conversationTab.create as jest.Mock).mockResolvedValue({
        id: 'tab2',
        userId,
        title: 'New Conversation',
        position: 1,
        isActive: true,
      });

      await tabsService.createTab(userId, {});

      expect(mockPrisma.conversationTab.create).toHaveBeenCalledWith({
        data: {
          userId,
          title: 'New Conversation',
          position: 1,
          isActive: true,
        },
      });
    });

    it('should throw error when user has 5 tabs already', async () => {
      (mockPrisma.conversationTab.count as jest.Mock).mockResolvedValue(5);

      await expect(tabsService.createTab(userId, {})).rejects.toThrow(
        'Maximum 5 tabs allowed per user'
      );
    });

    it('should deactivate other active tabs', async () => {
      (mockPrisma.conversationTab.count as jest.Mock).mockResolvedValue(2);
      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue({ position: 1 });
      (mockPrisma.conversationTab.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.conversationTab.create as jest.Mock).mockResolvedValue({
        id: 'tab3',
        userId,
        title: 'New Conversation',
        position: 2,
        isActive: true,
      });

      await tabsService.createTab(userId, {});

      expect(mockPrisma.conversationTab.updateMany).toHaveBeenCalledWith({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    });
  });

  // ─── updateTab ──────────────────────────────────────────────────────

  describe('updateTab', () => {
    const tabId = 'tab-123';

    it('should update tab title', async () => {
      const existingTab = {
        id: tabId,
        userId,
        title: 'Old Title',
        position: 0,
        isActive: false,
      };

      const updatedTab = { ...existingTab, title: 'New Title' };

      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(existingTab);
      (mockPrisma.conversationTab.update as jest.Mock).mockResolvedValue(updatedTab);

      const result = await tabsService.updateTab(userId, tabId, { title: 'New Title' });

      expect(mockPrisma.conversationTab.update).toHaveBeenCalledWith({
        where: { id: tabId },
        data: { title: 'New Title' },
      });
      expect(result.title).toBe('New Title');
    });

    it('should throw error if tab not found', async () => {
      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        tabsService.updateTab(userId, tabId, { title: 'New Title' })
      ).rejects.toThrow('Tab not found');
    });

    it('should throw error if tab belongs to different user', async () => {
      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        tabsService.updateTab('different-user', tabId, { title: 'New Title' })
      ).rejects.toThrow('Tab not found');
    });

    it('should deactivate other tabs when setting isActive to true', async () => {
      const existingTab = {
        id: tabId,
        userId,
        title: 'Tab',
        position: 0,
        isActive: false,
      };

      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(existingTab);
      (mockPrisma.conversationTab.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      (mockPrisma.conversationTab.update as jest.Mock).mockResolvedValue({
        ...existingTab,
        isActive: true,
      });

      await tabsService.updateTab(userId, tabId, { isActive: true });

      expect(mockPrisma.conversationTab.updateMany).toHaveBeenCalledWith({
        where: { userId, isActive: true, id: { not: tabId } },
        data: { isActive: false },
      });
    });

    it('should handle position reordering (move right)', async () => {
      const existingTab = {
        id: tabId,
        userId,
        title: 'Tab',
        position: 1,
        isActive: false,
      };

      const mockTabs = [
        { id: 'tab1', position: 0 },
        { id: tabId, position: 1 },
        { id: 'tab3', position: 2 },
        { id: 'tab4', position: 3 },
      ];

      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(existingTab);
      (mockPrisma.conversationTab.findMany as jest.Mock).mockResolvedValue(mockTabs);
      (mockPrisma.conversationTab.update as jest.Mock).mockResolvedValue(existingTab);

      await tabsService.updateTab(userId, tabId, { position: 3 });

      // Tabs between old (1) and new position (3) should shift left
      expect(mockPrisma.conversationTab.update).toHaveBeenCalledTimes(3); // tab3, tab4, tabId
    });
  });

  // ─── deleteTab ──────────────────────────────────────────────────────

  describe('deleteTab', () => {
    const tabId = 'tab-to-delete';

    it('should delete a tab successfully', async () => {
      const mockTab = {
        id: tabId,
        userId,
        title: 'Tab',
        position: 0,
        isActive: false,
      };

      const mockTabs = [mockTab];

      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(mockTab);
      (mockPrisma.conversationTab.findMany as jest.Mock).mockResolvedValue(mockTabs);
      (mockPrisma.conversationTab.delete as jest.Mock).mockResolvedValue(mockTab);

      const result = await tabsService.deleteTab(userId, tabId);

      expect(mockPrisma.conversationTab.delete).toHaveBeenCalledWith({
        where: { id: tabId },
      });
      expect(result).toEqual({ deleted: true });
    });

    it('should throw error if tab not found', async () => {
      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(tabsService.deleteTab(userId, tabId)).rejects.toThrow('Tab not found');
    });

    it('should throw error if tab belongs to different user', async () => {
      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(tabsService.deleteTab('different-user', tabId)).rejects.toThrow(
        'Tab not found'
      );
    });

    it('should shift positions after deleting middle tab', async () => {
      const mockTab = {
        id: tabId,
        userId,
        title: 'Tab 2',
        position: 1,
        isActive: false,
      };

      const mockTabs = [
        { id: 'tab1', position: 0 },
        { id: tabId, position: 1 },
        { id: 'tab3', position: 2 },
        { id: 'tab4', position: 3 },
      ];

      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(mockTab);
      (mockPrisma.conversationTab.findMany as jest.Mock).mockResolvedValue(mockTabs);
      (mockPrisma.conversationTab.delete as jest.Mock).mockResolvedValue(mockTab);
      (mockPrisma.conversationTab.update as jest.Mock).mockResolvedValue({});

      await tabsService.deleteTab(userId, tabId);

      // Tabs after deleted position (1) should shift down
      expect(mockPrisma.conversationTab.update).toHaveBeenCalledWith({
        where: { id: 'tab3' },
        data: { position: 1 },
      });
      expect(mockPrisma.conversationTab.update).toHaveBeenCalledWith({
        where: { id: 'tab4' },
        data: { position: 2 },
      });
    });

    it('should activate previous tab if deleted tab was active', async () => {
      const mockTab = {
        id: tabId,
        userId,
        title: 'Tab 2',
        position: 1,
        isActive: true, // Active tab
      };

      const mockTabs = [
        { id: 'tab1', position: 0 },
        { id: tabId, position: 1 },
        { id: 'tab3', position: 2 },
      ];

      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(mockTab);
      (mockPrisma.conversationTab.findMany as jest.Mock).mockResolvedValue(mockTabs);
      (mockPrisma.conversationTab.delete as jest.Mock).mockResolvedValue(mockTab);
      (mockPrisma.conversationTab.update as jest.Mock).mockResolvedValue({});

      await tabsService.deleteTab(userId, tabId);

      // Previous tab (tab1) should be activated
      expect(mockPrisma.conversationTab.update).toHaveBeenCalledWith({
        where: { id: 'tab1' },
        data: { isActive: true },
      });
    });

    it('should activate next tab if deleted first active tab', async () => {
      const mockTab = {
        id: tabId,
        userId,
        title: 'Tab 1',
        position: 0,
        isActive: true,
      };

      const mockTabs = [
        { id: tabId, position: 0 },
        { id: 'tab2', position: 1 },
      ];

      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(mockTab);
      (mockPrisma.conversationTab.findMany as jest.Mock).mockResolvedValue(mockTabs);
      (mockPrisma.conversationTab.delete as jest.Mock).mockResolvedValue(mockTab);
      (mockPrisma.conversationTab.update as jest.Mock).mockResolvedValue({});

      await tabsService.deleteTab(userId, tabId);

      // Next tab (tab2) should be activated (after filtering out deleted tab)
      expect(mockPrisma.conversationTab.update).toHaveBeenCalledWith({
        where: { id: 'tab2' },
        data: { isActive: true },
      });
    });

    it('should handle deleting last remaining tab', async () => {
      const mockTab = {
        id: tabId,
        userId,
        title: 'Only Tab',
        position: 0,
        isActive: true,
      };

      const mockTabs = [mockTab];

      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(mockTab);
      (mockPrisma.conversationTab.findMany as jest.Mock).mockResolvedValue(mockTabs);
      (mockPrisma.conversationTab.delete as jest.Mock).mockResolvedValue(mockTab);

      const result = await tabsService.deleteTab(userId, tabId);

      expect(result).toEqual({ deleted: true });
    });

    // ─── DELETE ENDPOINT - 400 BAD REQUEST TESTS ────────────────────

    it('should accept valid CUID format tab IDs', async () => {
      const validCuidId = 'cmm8vm6fk0002ypf3cke5hdfi'; // From user's error
      const mockTab = {
        id: validCuidId,
        userId,
        title: 'Tab',
        position: 0,
        isActive: false,
      };

      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(mockTab);
      (mockPrisma.conversationTab.findMany as jest.Mock).mockResolvedValue([mockTab]);
      (mockPrisma.conversationTab.delete as jest.Mock).mockResolvedValue(mockTab);

      const result = await tabsService.deleteTab(userId, validCuidId);

      expect(mockPrisma.conversationTab.delete).toHaveBeenCalledWith({
        where: { id: validCuidId },
      });
      expect(result).toEqual({ deleted: true });
    });

    it('should accept short string IDs (non-CUID)', async () => {
      const shortId = 'tab123';
      const mockTab = {
        id: shortId,
        userId,
        title: 'Tab',
        position: 0,
        isActive: false,
      };

      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(mockTab);
      (mockPrisma.conversationTab.findMany as jest.Mock).mockResolvedValue([mockTab]);
      (mockPrisma.conversationTab.delete as jest.Mock).mockResolvedValue(mockTab);

      const result = await tabsService.deleteTab(userId, shortId);

      expect(result).toEqual({ deleted: true });
    });

    it('should accept UUID format IDs', async () => {
      const uuidId = '550e8400-e29b-41d4-a716-446655440000';
      const mockTab = {
        id: uuidId,
        userId,
        title: 'Tab',
        position: 0,
        isActive: false,
      };

      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(mockTab);
      (mockPrisma.conversationTab.findMany as jest.Mock).mockResolvedValue([mockTab]);
      (mockPrisma.conversationTab.delete as jest.Mock).mockResolvedValue(mockTab);

      const result = await tabsService.deleteTab(userId, uuidId);

      expect(result).toEqual({ deleted: true });
    });
  });

  // ─── getActiveTab ───────────────────────────────────────────────────

  describe('getActiveTab', () => {
    it('should return active tab for user', async () => {
      const mockTab = {
        id: 'tab1',
        userId,
        title: 'Active Tab',
        position: 0,
        isActive: true,
      };

      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(mockTab);

      const result = await tabsService.getActiveTab(userId);

      expect(mockPrisma.conversationTab.findFirst).toHaveBeenCalledWith({
        where: { userId, isActive: true },
      });
      expect(result).toEqual(mockTab);
    });

    it('should return null when no active tab exists', async () => {
      (mockPrisma.conversationTab.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await tabsService.getActiveTab(userId);

      expect(result).toBeNull();
    });
  });
});
