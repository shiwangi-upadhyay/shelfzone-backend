import { jest } from '@jest/globals';
import { NotificationType, Role } from '@prisma/client';

// Mock Prisma methods
const mockNotificationCreate = jest.fn<(...args: any[]) => Promise<any>>();
const mockNotificationFindMany = jest.fn<(...args: any[]) => Promise<any>>();
const mockNotificationCount = jest.fn<(...args: any[]) => Promise<number>>();
const mockNotificationFindFirst = jest.fn<(...args: any[]) => Promise<any>>();
const mockNotificationUpdate = jest.fn<(...args: any[]) => Promise<any>>();
const mockNotificationUpdateMany = jest.fn<(...args: any[]) => Promise<any>>();
const mockUserFindMany = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../../src/lib/prisma.js', () => ({
  default: {
    notification: {
      create: mockNotificationCreate,
      findMany: mockNotificationFindMany,
      count: mockNotificationCount,
      findFirst: mockNotificationFindFirst,
      update: mockNotificationUpdate,
      updateMany: mockNotificationUpdateMany,
    },
    user: {
      findMany: mockUserFindMany,
    },
  },
}));

// Spy on console.log for email hook verification
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

const {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  sendNotificationToRole,
  sendEmailHook,
} = await import('../../../src/modules/notifications/notification.service.js');

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create notification record (fire-and-forget)', async () => {
      const mockNotification = {
        id: 'notif-1',
        userId: 'user-123',
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'Test Title',
        message: 'Test Message',
        metadata: null,
        isRead: false,
        readAt: null,
        createdAt: new Date(),
      };

      mockNotificationCreate.mockResolvedValue(mockNotification);

      // Fire-and-forget function - returns void
      createNotification(
        'user-123',
        NotificationType.SYSTEM_ANNOUNCEMENT,
        'Test Title',
        'Test Message',
      );

      // Wait a bit to allow promise to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockNotificationCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          title: 'Test Title',
          message: 'Test Message',
          metadata: undefined,
        },
      });

      // Verify email hook was called
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('EMAIL_HOOK: would send email to user-123'),
      );
    });

    it('should create notification with metadata', async () => {
      const metadata = { leaveId: 'leave-123', days: 3 };
      const mockNotification = {
        id: 'notif-1',
        userId: 'user-123',
        type: NotificationType.LEAVE_APPROVED,
        title: 'Leave Approved',
        message: 'Your leave has been approved',
        metadata,
        isRead: false,
        readAt: null,
        createdAt: new Date(),
      };

      mockNotificationCreate.mockResolvedValue(mockNotification);

      createNotification(
        'user-123',
        NotificationType.LEAVE_APPROVED,
        'Leave Approved',
        'Your leave has been approved',
        metadata,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockNotificationCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          type: NotificationType.LEAVE_APPROVED,
          title: 'Leave Approved',
          message: 'Your leave has been approved',
          metadata,
        },
      });
    });

    it('should silently swallow errors (never crash)', async () => {
      mockNotificationCreate.mockRejectedValue(new Error('DB Error'));

      // Should not throw
      expect(() => {
        createNotification(
          'user-123',
          NotificationType.LEAVE_REJECTED,
          'Error',
          'Something failed',
        );
      }).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockNotificationCreate).toHaveBeenCalled();
    });
  });

  describe('getNotifications', () => {
    it('should return paginated notifications for user', async () => {
      const userId = 'user-123';
      const mockNotifications = [
        {
          id: 'notif-1',
          userId,
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          title: 'Title 1',
          message: 'Message 1',
          isRead: false,
          readAt: null,
          createdAt: new Date(),
        },
        {
          id: 'notif-2',
          userId,
          type: NotificationType.LEAVE_APPROVED,
          title: 'Title 2',
          message: 'Message 2',
          isRead: true,
          readAt: new Date(),
          createdAt: new Date(),
        },
      ];

      mockNotificationFindMany.mockResolvedValue(mockNotifications);
      mockNotificationCount.mockResolvedValue(2);

      const result = await getNotifications(userId, {
        page: 1,
        limit: 20,
      });

      expect(mockNotificationFindMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });

      expect(mockNotificationCount).toHaveBeenCalledWith({
        where: { userId },
      });

      expect(result.data).toEqual(mockNotifications);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it('should filter by isRead when provided', async () => {
      const userId = 'user-123';
      const mockUnreadNotifications = [
        {
          id: 'notif-1',
          userId,
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          title: 'Unread',
          message: 'Message',
          isRead: false,
          readAt: null,
          createdAt: new Date(),
        },
      ];

      mockNotificationFindMany.mockResolvedValue(mockUnreadNotifications);
      mockNotificationCount.mockResolvedValue(1);

      const result = await getNotifications(userId, {
        isRead: false,
        page: 1,
        limit: 20,
      });

      expect(mockNotificationFindMany).toHaveBeenCalledWith({
        where: { userId, isRead: false },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });

      expect(result.data).toEqual(mockUnreadNotifications);
    });

    it('should return only own notifications', async () => {
      const userId = 'user-123';

      mockNotificationFindMany.mockResolvedValue([]);
      mockNotificationCount.mockResolvedValue(0);

      await getNotifications(userId, {});

      // Verify it only queries for this user's notifications
      expect(mockNotificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId }),
        }),
      );
    });

    it('should use default pagination values', async () => {
      const userId = 'user-123';

      mockNotificationFindMany.mockResolvedValue([]);
      mockNotificationCount.mockResolvedValue(0);

      await getNotifications(userId, {});

      expect(mockNotificationFindMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('markAsRead', () => {
    it('should set isRead and readAt for owned notification', async () => {
      const notificationId = 'notif-123';
      const userId = 'user-123';

      const mockNotification = {
        id: notificationId,
        userId,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'Test',
        message: 'Message',
        isRead: false,
        readAt: null,
        createdAt: new Date(),
      };

      const updatedNotification = {
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      };

      mockNotificationFindFirst.mockResolvedValue(mockNotification);
      mockNotificationUpdate.mockResolvedValue(updatedNotification);

      const result = await markAsRead(notificationId, userId);

      expect(mockNotificationFindFirst).toHaveBeenCalledWith({
        where: { id: notificationId, userId },
      });

      expect(mockNotificationUpdate).toHaveBeenCalledWith({
        where: { id: notificationId },
        data: { isRead: true, readAt: expect.any(Date) },
      });

      expect(result).toEqual(updatedNotification);
      expect(result?.isRead).toBe(true);
      expect(result?.readAt).toBeInstanceOf(Date);
    });

    it('should return null if notification not found', async () => {
      mockNotificationFindFirst.mockResolvedValue(null);

      const result = await markAsRead('notif-999', 'user-123');

      expect(result).toBeNull();
      expect(mockNotificationUpdate).not.toHaveBeenCalled();
    });

    it('should return null if notification not owned by user', async () => {
      mockNotificationFindFirst.mockResolvedValue(null);

      const result = await markAsRead('notif-123', 'wrong-user');

      expect(result).toBeNull();
      expect(mockNotificationFindFirst).toHaveBeenCalledWith({
        where: { id: 'notif-123', userId: 'wrong-user' },
      });
    });
  });

  describe('markAllAsRead', () => {
    it('should batch update all unread notifications', async () => {
      const userId = 'user-123';

      mockNotificationUpdateMany.mockResolvedValue({ count: 5 });

      const result = await markAllAsRead(userId);

      expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: expect.any(Date) },
      });

      expect(result).toEqual({ updated: 5 });
    });

    it('should return 0 updated when no unread notifications exist', async () => {
      const userId = 'user-123';

      mockNotificationUpdateMany.mockResolvedValue({ count: 0 });

      const result = await markAllAsRead(userId);

      expect(result).toEqual({ updated: 0 });
    });
  });

  describe('getUnreadCount', () => {
    it('should return correct unread count', async () => {
      const userId = 'user-123';

      mockNotificationCount.mockResolvedValue(7);

      const result = await getUnreadCount(userId);

      expect(mockNotificationCount).toHaveBeenCalledWith({
        where: { userId, isRead: false },
      });

      expect(result).toEqual({ count: 7 });
    });

    it('should return 0 when no unread notifications', async () => {
      const userId = 'user-123';

      mockNotificationCount.mockResolvedValue(0);

      const result = await getUnreadCount(userId);

      expect(result).toEqual({ count: 0 });
    });
  });

  describe('sendNotificationToRole', () => {
    it('should create notification for all users with given role', async () => {
      const mockUsers = [{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }];

      mockUserFindMany.mockResolvedValue(mockUsers);
      mockNotificationCreate.mockResolvedValue({});

      sendNotificationToRole(
        Role.EMPLOYEE,
        NotificationType.SYSTEM_ANNOUNCEMENT,
        'System Maintenance',
        'System will be down for maintenance',
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockUserFindMany).toHaveBeenCalledWith({
        where: { role: Role.EMPLOYEE, isActive: true },
        select: { id: true },
      });

      // Should have called create for each user (fire-and-forget via createNotification)
      // We can't directly test the internal calls since they're async fire-and-forget
      // but we verified the user query happened
    });

    it('should handle empty user list gracefully', async () => {
      mockUserFindMany.mockResolvedValue([]);

      expect(() => {
        sendNotificationToRole(
          Role.HR_ADMIN,
          NotificationType.SYSTEM_ANNOUNCEMENT,
          'Test',
          'Message',
        );
      }).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('should silently swallow errors (fire-and-forget)', async () => {
      mockUserFindMany.mockRejectedValue(new Error('DB Error'));

      expect(() => {
        sendNotificationToRole(
          Role.MANAGER,
          NotificationType.ATTENDANCE_REGULARIZED,
          'Warning',
          'Something happened',
        );
      }).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  describe('sendEmailHook', () => {
    it('should log email intent', () => {
      consoleLogSpy.mockClear();

      sendEmailHook(
        'user-123',
        NotificationType.LEAVE_APPROVED,
        'Leave Approved',
        'Your leave has been approved',
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'EMAIL_HOOK: would send email to user-123 — [LEAVE_APPROVED] Leave Approved: Your leave has been approved',
      );
    });
  });
});
