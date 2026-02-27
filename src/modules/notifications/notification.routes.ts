import { type FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/index.js';
import {
  listNotificationsHandler,
  unreadCountHandler,
  markReadHandler,
  markAllReadHandler,
} from './notification.controller.js';
import { ListNotificationsQuerySchema, MarkReadParamsSchema } from './notification.schemas.js';

export default async function notificationRoutes(app: FastifyInstance) {
  app.get(
    '/api/notifications',
    {
      preHandler: [authenticate],
      schema: { querystring: ListNotificationsQuerySchema },
    },
    listNotificationsHandler,
  );

  app.get(
    '/api/notifications/unread-count',
    {
      preHandler: [authenticate],
    },
    unreadCountHandler,
  );

  app.put(
    '/api/notifications/:id/read',
    {
      preHandler: [authenticate],
      schema: { params: MarkReadParamsSchema },
    },
    markReadHandler,
  );

  app.put(
    '/api/notifications/read-all',
    {
      preHandler: [authenticate],
    },
    markAllReadHandler,
  );
}
