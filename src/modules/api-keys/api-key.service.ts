import { prisma } from '../../lib/prisma.js';
import { encrypt, decrypt } from '../../lib/encryption.js';

const PROVIDER_PREFIXES: Record<string, string> = {
  anthropic: 'sk-ant-',
};

export async function verifyAnthropicKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    if (res.ok) return { valid: true };
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) return { valid: false, error: 'Invalid API key' };
    // 400 with overloaded/rate limit still means key is valid
    if (res.status === 429 || res.status === 529) return { valid: true };
    return { valid: false, error: (body as any)?.error?.message || `API returned ${res.status}` };
  } catch (err) {
    return { valid: false, error: 'Failed to connect to Anthropic API' };
  }
}

export async function setApiKey(userId: string, apiKey: string, provider: string = 'anthropic') {
  const prefix = PROVIDER_PREFIXES[provider];
  if (prefix && !apiKey.startsWith(prefix)) {
    throw { statusCode: 400, error: 'Validation Error', message: `API key must start with "${prefix}" for ${provider}` };
  }

  // Verify key
  if (provider === 'anthropic') {
    const { valid, error } = await verifyAnthropicKey(apiKey);
    if (!valid) {
      throw { statusCode: 400, error: 'Invalid API Key', message: error || 'Key verification failed' };
    }
  }

  const encryptedKey = encrypt(apiKey);
  const keyPrefix = apiKey.substring(0, 10) + '...';

  const result = await prisma.userApiKey.upsert({
    where: { userId },
    update: { encryptedKey, keyPrefix, provider, isValid: true, lastVerified: new Date() },
    create: { userId, encryptedKey, keyPrefix, provider, isValid: true, lastVerified: new Date() },
  });

  return { success: true, keyPrefix: result.keyPrefix };
}

export async function getApiKeyStatus(userId: string) {
  const key = await prisma.userApiKey.findUnique({ where: { userId } });
  if (!key) return { hasKey: false };
  return {
    hasKey: true,
    keyPrefix: key.keyPrefix,
    provider: key.provider,
    isValid: key.isValid,
    lastVerified: key.lastVerified?.toISOString(),
  };
}

export async function deleteApiKey(userId: string) {
  const key = await prisma.userApiKey.findUnique({ where: { userId } });
  if (!key) throw { statusCode: 404, error: 'Not Found', message: 'No API key found' };
  await prisma.userApiKey.delete({ where: { userId } });
  return { success: true };
}

export async function getUserDecryptedKey(userId: string): Promise<string | null> {
  const key = await prisma.userApiKey.findUnique({ where: { userId } });
  if (!key) return null;
  return decrypt(key.encryptedKey);
}
