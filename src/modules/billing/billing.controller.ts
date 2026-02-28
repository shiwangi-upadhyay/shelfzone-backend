import { FastifyRequest, FastifyReply } from 'fastify';
import { dateRangeSchema, exportQuerySchema } from './billing.schemas.js';
import * as billingService from './billing.service.js';

export async function summaryHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = dateRangeSchema.parse(request.query);
  const data = await billingService.getSummary(query.from, query.to);
  return reply.send(data);
}

export async function byAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = dateRangeSchema.parse(request.query);
  const data = await billingService.getByAgent(query.from, query.to);
  return reply.send(data);
}

export async function byEmployeeHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = dateRangeSchema.parse(request.query);
  const data = await billingService.getByEmployee(query.from, query.to);
  return reply.send(data);
}

export async function byModelHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = dateRangeSchema.parse(request.query);
  const data = await billingService.getByModel(query.from, query.to);
  return reply.send(data);
}

export async function invoicesHandler(_request: FastifyRequest, reply: FastifyReply) {
  const data = await billingService.getInvoices();
  return reply.send(data);
}

export async function exportHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = exportQuerySchema.parse(request.query);
  const csv = await billingService.getExportCsv(query.from, query.to);
  return reply
    .header('Content-Type', 'text/csv')
    .header('Content-Disposition', 'attachment; filename="billing-export.csv"')
    .send(csv);
}
