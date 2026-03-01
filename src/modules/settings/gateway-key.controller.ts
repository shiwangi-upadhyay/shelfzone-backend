import { FastifyRequest, FastifyReply } from 'fastify';
import * as gatewayKeyService from './gateway-key.service.js';

/**
 * POST /api/settings/gateway-key
 * Create a new gateway key
 */
export async function createGatewayKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await gatewayKeyService.createGatewayKey(request.user!.userId);
    return reply.send({ data: result });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply.status(e.statusCode ?? 500).send({ 
      error: e.error ?? 'Internal Error', 
      message: e.message 
    });
  }
}

/**
 * GET /api/settings/gateway-key
 * Get gateway key status (masked)
 */
export async function getGatewayKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await gatewayKeyService.getGatewayKeyStatus(request.user!.userId);
    return reply.send({ data: result });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply.status(e.statusCode ?? 500).send({ 
      error: e.error ?? 'Internal Error', 
      message: e.message 
    });
  }
}

/**
 * POST /api/settings/gateway-key/regenerate
 * Regenerate gateway key
 */
export async function regenerateGatewayKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await gatewayKeyService.regenerateGatewayKey(request.user!.userId);
    return reply.send({ data: result });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply.status(e.statusCode ?? 500).send({ 
      error: e.error ?? 'Internal Error', 
      message: e.message 
    });
  }
}

/**
 * POST /api/settings/gateway-key/test
 * Test gateway connection
 */
export async function testGatewayKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await gatewayKeyService.testGatewayConnection(request.user!.userId);
    return reply.send({ data: result });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply.status(e.statusCode ?? 500).send({ 
      error: e.error ?? 'Internal Error', 
      message: e.message 
    });
  }
}
