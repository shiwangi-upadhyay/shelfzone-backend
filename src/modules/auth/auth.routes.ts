import { FastifyInstance } from 'fastify';
import { registerHandler, loginHandler, refreshHandler, logoutHandler } from './auth.controller.js';
import { meHandler } from './me.controller.js';
import { authenticate, requireRole } from '../../middleware/index.js';

export default async function authRoutes(app: FastifyInstance) {
  app.post(
    '/api/auth/register',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    registerHandler,
  );
  app.post('/api/auth/login', loginHandler);
  app.post('/api/auth/refresh', refreshHandler);
  app.post('/api/auth/logout', { preHandler: [authenticate] }, logoutHandler);
  app.get(
    '/api/auth/me',
    {
      preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE')],
    },
    meHandler,
  );
}
