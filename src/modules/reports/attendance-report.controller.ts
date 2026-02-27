import { FastifyRequest, FastifyReply } from 'fastify';
import { getDailyReport, getWeeklyReport, getMonthlyReport } from './attendance-report.service.js';
import type { DailyReportQuery, WeeklyReportQuery, MonthlyReportQuery } from './report.schemas.js';

export async function dailyReportHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { date, departmentId } = request.query as DailyReportQuery;
    const report = await getDailyReport(date, departmentId, request.user!);
    return reply.send(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate daily report';
    return reply.status(400).send({ error: message });
  }
}

export async function weeklyReportHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { startDate, departmentId } = request.query as WeeklyReportQuery;
    const report = await getWeeklyReport(startDate, departmentId, request.user!);
    return reply.send(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate weekly report';
    return reply.status(400).send({ error: message });
  }
}

export async function monthlyReportHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { month, year, departmentId, employeeId } = request.query as MonthlyReportQuery;
    const report = await getMonthlyReport(month, year, departmentId, employeeId, request.user!);
    return reply.send(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate monthly report';
    return reply.status(400).send({ error: message });
  }
}
