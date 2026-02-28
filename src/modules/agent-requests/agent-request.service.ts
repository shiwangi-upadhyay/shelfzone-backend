import prisma from '../../lib/prisma.js';

export async function createRequest(requesterId: string, agentId: string, purpose: string, priority: string) {
  // Verify agent exists
  const agent = await prisma.agentRegistry.findUnique({ where: { id: agentId } });
  if (!agent) throw Object.assign(new Error('Agent not found'), { statusCode: 404 });

  return prisma.agentRequest.create({
    data: { requesterId, agentId, purpose, priority },
    include: { agent: { select: { name: true, model: true } }, requester: { select: { email: true } } },
  });
}

export async function listRequests(filters: { status?: string; requesterId?: string; page: number; limit: number }) {
  const where: any = {};
  if (filters.status) where.status = filters.status;
  if (filters.requesterId) where.requesterId = filters.requesterId;

  const [items, total] = await Promise.all([
    prisma.agentRequest.findMany({
      where,
      include: {
        agent: { select: { name: true, model: true, status: true } },
        requester: { select: { email: true } },
        reviewer: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.agentRequest.count({ where }),
  ]);

  return { items, total, page: filters.page, limit: filters.limit, pages: Math.ceil(total / filters.limit) };
}

export async function getRequest(id: string) {
  const req = await prisma.agentRequest.findUnique({
    where: { id },
    include: {
      agent: { select: { name: true, model: true, status: true, description: true } },
      requester: { select: { email: true } },
      reviewer: { select: { email: true } },
    },
  });
  if (!req) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  return req;
}

export async function reviewRequest(id: string, reviewerId: string, status: 'APPROVED' | 'REJECTED', reviewNote?: string) {
  const req = await prisma.agentRequest.findUnique({ where: { id } });
  if (!req) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (req.status !== 'PENDING') throw Object.assign(new Error('Request already reviewed'), { statusCode: 400 });

  return prisma.agentRequest.update({
    where: { id },
    data: { status, reviewerId, reviewNote: reviewNote ?? null, reviewedAt: new Date() },
    include: {
      agent: { select: { name: true } },
      requester: { select: { email: true } },
      reviewer: { select: { email: true } },
    },
  });
}

export async function cancelRequest(id: string, requesterId: string) {
  const req = await prisma.agentRequest.findUnique({ where: { id } });
  if (!req) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (req.requesterId !== requesterId) throw Object.assign(new Error('Not your request'), { statusCode: 403 });
  if (req.status !== 'PENDING') throw Object.assign(new Error('Can only cancel pending requests'), { statusCode: 400 });

  return prisma.agentRequest.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
}

export async function getStats() {
  const [pending, approved, rejected] = await Promise.all([
    prisma.agentRequest.count({ where: { status: 'PENDING' } }),
    prisma.agentRequest.count({ where: { status: 'APPROVED' } }),
    prisma.agentRequest.count({ where: { status: 'REJECTED' } }),
  ]);
  return { pending, approved, rejected, total: pending + approved + rejected };
}
