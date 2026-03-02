import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';

/**
 * GET /api/agents/users
 * Get all users with employee data for agent sharing
 */
export async function handleGetUsersForSharing(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        email: 'asc',
      },
    });

    // Filter out users without employee records (optional)
    const usersWithEmployees = users.filter((u) => u.employee !== null);

    return reply.send({ data: usersWithEmployees });
  } catch (error: any) {
    return reply.status(500).send({ error: error.message || 'Failed to fetch users' });
  }
}
