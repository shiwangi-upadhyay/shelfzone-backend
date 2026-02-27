import { type NotificationType, type Prisma, type Role } from '@prisma/client';
import prisma from '../../lib/prisma.js';

/**
 * Fire-and-forget notification creation. Never throws, never blocks.
 */
export function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Prisma.InputJsonValue,
): void {
  prisma.notification
    .create({
      data: {
        userId,
        type,
        title,
        message,
        metadata: metadata ?? undefined,
      },
    })
    .then(() => {
      sendEmailHook(userId, type, title, message);
    })
    .catch(() => {
      // Silently swallow — notifications must never crash the app
    });
}

/**
 * Get paginated notifications for a user, optionally filtered by read status.
 */
export async function getNotifications(
  userId: string,
  query: { isRead?: boolean; page?: number; limit?: number },
) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    userId,
    ...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    data: notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Mark a single notification as read. Returns null if not found or not owned.
 */
export async function markAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) return null;

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  return { updated: result.count };
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return { count };
}

/**
 * Send a notification to all users with a given role.
 * Fire-and-forget for each user.
 */
export function sendNotificationToRole(
  role: Role,
  type: NotificationType,
  title: string,
  message: string,
): void {
  prisma.user
    .findMany({
      where: { role, isActive: true },
      select: { id: true },
    })
    .then((users) => {
      for (const user of users) {
        createNotification(user.id, type, title, message);
      }
    })
    .catch(() => {
      // Silently swallow
    });
}

/**
 * Placeholder email hook. Logs intent; actual email integration later.
 */
export function sendEmailHook(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
): void {
  console.log(`EMAIL_HOOK: would send email to ${userId} — [${type}] ${title}: ${message}`);
}
