import { type Static, Type } from '@sinclair/typebox';

export const ListNotificationsQuerySchema = Type.Object({
  isRead: Type.Optional(Type.Boolean()),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});

export type ListNotificationsQuery = Static<typeof ListNotificationsQuerySchema>;

export const MarkReadParamsSchema = Type.Object({
  id: Type.String(),
});

export type MarkReadParams = Static<typeof MarkReadParamsSchema>;
