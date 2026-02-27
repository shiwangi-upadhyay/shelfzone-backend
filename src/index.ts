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
import payrollRoutes from './modules/payroll/payroll.routes.js';
import selfServiceRoutes from './modules/self-service/self-service.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import agentRoutes from './modules/agent-portal/agents/agent.routes.js';
import teamRoutes from './modules/agent-portal/teams/team.routes.js';
import analyticsRoutes from './modules/agent-portal/analytics/analytics.routes.js';
import sessionLogRoutes from './modules/agent-portal/session-logs/session-log.routes.js';
import costRoutes from './modules/agent-portal/costs/cost.routes.js';
import budgetRoutes from './modules/agent-portal/budgets/budget.routes.js';
import configRoutes from './modules/agent-portal/config/config.routes.js';
import commandRoutes from './modules/agent-portal/commands/command.routes.js';
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
await app.register(payrollRoutes);
await app.register(selfServiceRoutes);
await app.register(notificationRoutes);

// Agent Portal
await app.register(agentRoutes);
await app.register(teamRoutes);
await app.register(analyticsRoutes);
await app.register(sessionLogRoutes);
await app.register(costRoutes);
await app.register(budgetRoutes);
await app.register(configRoutes);
await app.register(commandRoutes);

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
