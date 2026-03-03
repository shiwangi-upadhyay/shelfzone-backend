import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { disconnectNode } from './websocket-server.js';
import crypto from 'crypto';

const SERVER_URL = process.env.PUBLIC_URL || 'http://157.10.98.227:3001';

/**
 * Generate pairing token endpoint
 */
async function generateToken(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  
  const userId = request.user!.userId;

  // Generate random token with prefix
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const token = `shz-pair-${randomBytes}`;

  // Token expires in 15 minutes
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Store in database
  await prisma.pairingToken.create({
    data: {
      token,
      userId,
      expiresAt
    }
  });

  return reply.send({
    data: {
      token,
      expiresAt: expiresAt.toISOString(),
      instructions: `Run on your machine:\n\nopenclaw nodes pair --server ${SERVER_URL} --token ${token}\n\nToken expires in 15 minutes.`
    }
  });
}

/**
 * List nodes endpoint
 */
async function listNodes(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  
  const userId = request.user!.userId;

  const nodes = await prisma.node.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      status: true,
      lastSeenAt: true,
      platform: true,
      agents: true,
      connectedAt: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return reply.send({
    data: nodes
  });
}

/**
 * Unpair node endpoint
 */
async function unpairNode(request: FastifyRequest<{ Params: { nodeId: string } }>, reply: FastifyReply) {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  
  const userId = request.user!.userId;
  const { nodeId } = request.params;

  // Verify ownership
  const node = await prisma.node.findUnique({
    where: { id: nodeId }
  });

  if (!node) {
    return reply.code(404).send({
      error: 'Node not found'
    });
  }

  if (node.userId !== userId) {
    return reply.code(403).send({
      error: 'You do not own this node'
    });
  }

  // If node is online, disconnect it
  if (node.status === 'ONLINE') {
    await disconnectNode(nodeId);
  }

  // Delete from database
  await prisma.node.delete({
    where: { id: nodeId }
  });

  return reply.send({
    message: 'Node unpaired successfully'
  });
}

/**
 * Register bridge routes
 */
export async function bridgeRoutes(fastify: FastifyInstance) {
  // Generate pairing token
  fastify.post(
    '/generate-token',
    { preHandler: authenticate },
    generateToken
  );

  // List nodes
  fastify.get(
    '/',
    { preHandler: authenticate },
    listNodes
  );

  // Unpair node
  fastify.delete(
    '/:nodeId',
    { preHandler: authenticate },
    unpairNode
  );
}
