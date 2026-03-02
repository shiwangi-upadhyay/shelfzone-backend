import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { searchConversations } from './search.service.js';

const searchSchema = z.object({
  query: z.string().min(1, 'Search query required'),
  limit: z.number().min(1).max(50).optional(),
});

export async function handleSearch(
  request: FastifyRequest<{ Querystring: { query: string; limit?: string } }>,
  reply: FastifyReply
) {
  try {
    const { query, limit } = request.query;
    const userId = request.user!.userId;

    const validation = searchSchema.safeParse({
      query,
      limit: limit ? parseInt(limit) : undefined,
    });

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: validation.error.issues.map((e) => e.message).join(', '),
      });
    }

    const results = await searchConversations(
      userId,
      validation.data.query,
      validation.data.limit
    );

    return reply.send({ data: results });
  } catch (error: any) {
    console.error('Search error:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to search conversations',
    });
  }
}
