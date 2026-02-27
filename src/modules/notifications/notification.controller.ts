import { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from './notification.service.js';

export async function listNotificationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as { isRead?: string; page?: string; limit?: string };

  const isRead = query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined;
  const page = query.page ? parseInt(query.page, 10) : undefined;
  const limit = query.limit ? parseInt(query.limit, 10) : undefined;

  const result = await getNotifications(request.user!.userId, { isRead, page, limit });
  return reply.send(result);
}

export async function unreadCountHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await getUnreadCount(request.user!.userId);
  return reply.send(result);
}

export async function markReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string };
  const notification = await markAsRead(params.id, request.user!.userId);

  if (!notification) {
    return reply.status(404).send({ error: 'Notification not found' });
  }

  return reply.send(notification);
}

export async function markAllReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await markAllAsRead(request.user!.userId);
  return reply.send(result);
}
