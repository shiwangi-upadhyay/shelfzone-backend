import { FastifyRequest, FastifyReply } from 'fastify';
import {
  createConversationSchema,
  updateConversationSchema,
} from './conversation.schemas.js';
import {
  listConversations,
  getConversation,
  createConversation,
  updateConversationTitle,
  deleteConversation,
} from './conversation.service.js';

export async function handleListConversations(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = request.user!.userId;

  try {
    const result = await listConversations(userId);
    return reply.status(200).send(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: error.error || 'Error',
      message: error.message || 'Internal server error',
    });
  }
}

export async function handleGetConversation(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const userId = request.user!.userId;
  const conversationId = request.params.id;

  try {
    const result = await getConversation(userId, conversationId);
    return reply.status(200).send(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: error.error || 'Error',
      message: error.message || 'Internal server error',
    });
  }
}

export async function handleCreateConversation(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const validation = createConversationSchema.safeParse(request.body);
  if (!validation.success) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: validation.error.issues.map((e) => e.message).join(', '),
    });
  }

  const userId = request.user!.userId;
  const { agentId, title } = validation.data;

  try {
    const result = await createConversation(userId, agentId, title);
    return reply.status(201).send(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: error.error || 'Error',
      message: error.message || 'Internal server error',
    });
  }
}

export async function handleUpdateConversation(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const validation = updateConversationSchema.safeParse(request.body);
  if (!validation.success) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: validation.error.issues.map((e) => e.message).join(', '),
    });
  }

  const userId = request.user!.userId;
  const conversationId = request.params.id;
  const { title } = validation.data;

  try {
    const result = await updateConversationTitle(userId, conversationId, title);
    return reply.status(200).send(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: error.error || 'Error',
      message: error.message || 'Internal server error',
    });
  }
}

export async function handleDeleteConversation(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const userId = request.user!.userId;
  const conversationId = request.params.id;

  try {
    const result = await deleteConversation(userId, conversationId);
    return reply.status(200).send(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: error.error || 'Error',
      message: error.message || 'Internal server error',
    });
  }
}
