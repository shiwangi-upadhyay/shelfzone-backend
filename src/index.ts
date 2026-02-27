import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { globalRateLimitConfig } from './config/rate-limit.js';
import authRoutes from './modules/auth/auth.routes.js';
import departmentRoutes from './modules/departments/department.routes.js';
import designationRoutes from './modules/designations/designation.routes.js';
import employeeRoutes from './modules/employees/employee.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import leaveRoutes from './modules/leave/leave.routes.js';
import leaveAdminRoutes from './modules/leave-admin/leave-admin.routes.js';
import reportRoutes from './modules/reports/report.routes.js';
import { sanitizeBody } from './middleware/sanitize.middleware.js';

const app = Fastify({ logger: true });

await app.register(cors);
await app.register(helmet);
await app.register(cookie);
await app.register(rateLimit, globalRateLimitConfig);

// Global input sanitization
app.addHook('preHandler', sanitizeBody);

await app.register(authRoutes);
await app.register(departmentRoutes);
await app.register(designationRoutes);
await app.register(employeeRoutes);
await app.register(attendanceRoutes);
await app.register(leaveRoutes);
await app.register(leaveAdminRoutes);
await app.register(reportRoutes);

app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
}));

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down gracefully...`);
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
