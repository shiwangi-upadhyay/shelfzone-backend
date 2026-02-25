import { FastifyRequest, FastifyReply } from 'fastify';
import { RegisterSchema, LoginSchema, RefreshSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';
import { Role } from '@prisma/client';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

export async function registerHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = RegisterSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
  }

  try {
    const user = await authService.register(parsed.data.email, parsed.data.password, parsed.data.role as Role | undefined);
    return reply.status(201).send({ user });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'EMAIL_EXISTS') {
      // Generic error — don't reveal email exists
      return reply.status(409).send({ error: 'Registration failed' });
    }
    throw err;
  }
}

export async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = LoginSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
  }

  try {
    const result = await authService.login(parsed.data.email, parsed.data.password);
    reply.setCookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
    return reply.send({ user: result.user, accessToken: result.accessToken });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    throw err;
  }
}

export async function refreshHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = RefreshSchema.safeParse(request.body);
  const refreshToken = (request.cookies as Record<string, string>)?.refreshToken
    ?? parsed.data?.refreshToken;

  if (!refreshToken) {
    return reply.status(400).send({ error: 'Refresh token required' });
  }

  try {
    const result = await authService.refresh(refreshToken);
    reply.setCookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
    return reply.send({ accessToken: result.accessToken });
  } catch {
    return reply.status(401).send({ error: 'Invalid refresh token' });
  }
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.userId;
  await authService.logout(userId);
  reply.clearCookie('refreshToken', { path: '/' });
  return reply.send({ message: 'Logged out' });
}
