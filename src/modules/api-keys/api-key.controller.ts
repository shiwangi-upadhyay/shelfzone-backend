import { FastifyRequest, FastifyReply } from 'fastify';
import { setApiKeySchema } from './api-key.schemas.js';
import * as apiKeyService from './api-key.service.js';

export async function setApiKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = setApiKeySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }
  try {
    const result = await apiKeyService.setApiKey(request.user!.userId, parsed.data.apiKey, parsed.data.provider);
    return reply.send({ data: result });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply.status(e.statusCode ?? 500).send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function getApiKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await apiKeyService.getApiKeyStatus(request.user!.userId);
  return reply.send({ data: result });
}

export async function deleteApiKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await apiKeyService.deleteApiKey(request.user!.userId);
    return reply.send({ data: result });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply.status(e.statusCode ?? 500).send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}
