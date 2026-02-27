import { FastifyRequest, FastifyReply } from 'fastify';
import { generateKey, listKeys, rotateKey, revokeKey } from './api-key.service.js';
import { logAudit } from '../../../lib/audit.js';

export async function createApiKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  const { agentId } = request.params as { agentId: string };
  const { name, scopes, expiresAt } = request.body as {
    name: string;
    scopes: string[];
    expiresAt?: string;
  };
  const userId = request.user!.userId;

  const result = await generateKey(
    agentId,
    name,
    scopes,
    userId,
    expiresAt ? new Date(expiresAt) : undefined,
  );

  logAudit({
    userId,
    action: 'AGENT_API_KEY_CREATED',
    resource: 'AgentApiKey',
    resourceId: result.prefix,
    details: { agentId, name, scopes },
  });

  return reply.status(201).send({
    message: 'API key created. Store this key securely — it will not be shown again.',
    key: result.key,
    prefix: result.prefix,
  });
}

export async function listApiKeysHandler(request: FastifyRequest, reply: FastifyReply) {
  const { agentId } = request.params as { agentId: string };
  const keys = await listKeys(agentId);
  return reply.send({ data: keys });
}

export async function rotateApiKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const userId = request.user!.userId;
  const result = await rotateKey(id, userId);

  logAudit({
    userId,
    action: 'AGENT_API_KEY_ROTATED',
    resource: 'AgentApiKey',
    resourceId: id,
  });

  return reply.send({
    message: 'Key rotated. Store this new key securely — it will not be shown again.',
    key: result.key,
    prefix: result.prefix,
  });
}

export async function revokeApiKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const userId = request.user!.userId;
  await revokeKey(id, userId);

  logAudit({
    userId,
    action: 'AGENT_API_KEY_REVOKED',
    resource: 'AgentApiKey',
    resourceId: id,
  });

  return reply.send({ message: 'API key revoked successfully' });
}
