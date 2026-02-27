import { randomBytes, createHash } from 'crypto';
import prisma from '../../../lib/prisma.js';

const KEY_PREFIX_LENGTH = 8;

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function generateRawKey(): string {
  const bytes = randomBytes(32);
  return `sk-${bytes.toString('base64url')}`;
}

export async function generateKey(
  agentId: string,
  name: string,
  scopes: string[],
  userId: string,
  expiresAt?: Date,
) {
  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, KEY_PREFIX_LENGTH);

  await prisma.agentApiKey.create({
    data: {
      agentId,
      keyHash,
      keyPrefix,
      name,
      scopes,
      createdBy: userId,
      expiresAt: expiresAt ?? null,
    },
  });

  return { key: rawKey, prefix: keyPrefix };
}

export async function rotateKey(keyId: string, userId: string) {
  const existing = await prisma.agentApiKey.findUnique({ where: { id: keyId } });
  if (!existing) throw new Error('API key not found');

  // Revoke old key
  await prisma.agentApiKey.update({
    where: { id: keyId },
    data: { isActive: false, revokedAt: new Date() },
  });

  // Generate new key for the same agent
  return generateKey(
    existing.agentId,
    existing.name,
    existing.scopes as string[],
    userId,
    existing.expiresAt ?? undefined,
  );
}

export async function revokeKey(keyId: string, _userId: string) {
  const existing = await prisma.agentApiKey.findUnique({ where: { id: keyId } });
  if (!existing) throw new Error('API key not found');

  await prisma.agentApiKey.update({
    where: { id: keyId },
    data: { isActive: false, revokedAt: new Date() },
  });

  return { success: true };
}

export async function listKeys(agentId: string) {
  const keys = await prisma.agentApiKey.findMany({
    where: { agentId },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
      scopes: true,
      isActive: true,
      lastUsedAt: true,
      expiresAt: true,
      createdBy: true,
      createdAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return keys;
}

export async function validateKey(rawKey: string) {
  const prefix = rawKey.slice(0, KEY_PREFIX_LENGTH);
  const keyHash = hashKey(rawKey);

  const apiKey = await prisma.agentApiKey.findUnique({ where: { keyHash } });
  if (!apiKey) return null;
  if (!apiKey.isActive) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;
  if (apiKey.keyPrefix !== prefix) return null;

  // Update last used
  await prisma.agentApiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    id: apiKey.id,
    agentId: apiKey.agentId,
    scopes: apiKey.scopes as string[],
  };
}
