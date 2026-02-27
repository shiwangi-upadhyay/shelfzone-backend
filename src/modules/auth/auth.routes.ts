import { FastifyInstance } from 'fastify';
import { registerHandler, loginHandler, refreshHandler, logoutHandler } from './auth.controller.js';
import { meHandler } from './me.controller.js';
import { authenticate, requireRole } from '../../middleware/index.js';
import { loginRateLimit, registerRateLimit } from '../../config/rate-limit.js';

export default async function authRoutes(app: FastifyInstance) {
  app.post(
    '/api/auth/register',
    {
      ...registerRateLimit,
      preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')],
    },
    registerHandler,
  );
  app.post('/api/auth/login', { ...loginRateLimit }, loginHandler);
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
