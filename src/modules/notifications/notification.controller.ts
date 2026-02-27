import { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from './notification.service.js';
import { type ListNotificationsQuery, type MarkReadParams } from './notification.schemas.js';

export async function listNotificationsHandler(
  request: FastifyRequest<{ Querystring: ListNotificationsQuery }>,
  reply: FastifyReply,
) {
  const result = await getNotifications(request.user!.userId, request.query);
  return reply.send(result);
}

export async function unreadCountHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await getUnreadCount(request.user!.userId);
  return reply.send(result);
}

export async function markReadHandler(
  request: FastifyRequest<{ Params: MarkReadParams }>,
  reply: FastifyReply,
) {
  const notification = await markAsRead(request.params.id, request.user!.userId);

  if (!notification) {
    return reply.status(404).send({ error: 'Notification not found' });
  }

  return reply.send(notification);
}

export async function markAllReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await markAllAsRead(request.user!.userId);
  return reply.send(result);
}
