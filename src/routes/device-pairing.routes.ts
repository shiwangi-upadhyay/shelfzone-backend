/**
 * Device Pairing Approval API
 * GET /api/devices/pending - List pending pairing requests
 * POST /api/devices/:id/approve - Approve a pairing request
 * POST /api/devices/:id/reject - Reject a pairing request
 */

import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { generateDeviceToken } from '../lib/device-auth.js';
import { logSecurityEvent } from '../lib/command-sandbox.js';

const devicePairingRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/devices/pending
   * List pending device pairing requests
   */
  app.get('/pending', async (req, reply) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Get pending requests for this user
      const pendingRequests = await prisma.$queryRaw<Array<any>>`
        SELECT 
          id,
          device_id as "deviceId",
          public_key as "publicKey",
          node_key as "nodeKey",
          platform,
          ip_address as "ipAddress",
          user_agent as "userAgent",
          capabilities,
          status,
          created_at as "createdAt",
          expires_at as "expiresAt"
        FROM device_pairing_requests
        WHERE user_id = ${userId}
          AND status = 'pending'
          AND expires_at > NOW()
        ORDER BY created_at DESC
      `;

      logger.info(`📋 Retrieved ${pendingRequests.length} pending pairing requests for user ${userId}`);

      return reply.send({
        success: true,
        requests: pendingRequests
      });
    } catch (error) {
      logger.error('❌ Error fetching pending pairing requests:', error);
      return reply.code(500).send({ 
        error: 'Failed to fetch pending pairing requests' 
      });
    }
  });

  /**
   * POST /api/devices/:id/approve
   * Approve a device pairing request
   */
  app.post<{ Params: { id: string } }>('/:id/approve', async (req, reply) => {
    try {
      const userId = (req as any).user?.id;
      const requestId = req.params.id;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Get pairing request
      const pairingRequest = await prisma.$queryRaw<Array<any>>`
        SELECT *
        FROM device_pairing_requests
        WHERE id = ${requestId}
          AND user_id = ${userId}
          AND status = 'pending'
        LIMIT 1
      `;

      if (!pairingRequest || pairingRequest.length === 0) {
        return reply.code(404).send({ 
          error: 'Pairing request not found or already processed' 
        });
      }

      const request = pairingRequest[0];

      // Check if expired
      if (new Date() > new Date(request.expires_at)) {
        await prisma.$executeRaw`
          UPDATE device_pairing_requests
          SET status = 'expired'
          WHERE id = ${requestId}
        `;

        return reply.code(400).send({ 
          error: 'Pairing request has expired' 
        });
      }

      // Find or create node
      let node = await prisma.node.findFirst({
        where: { nodeKey: request.node_key }
      });

      if (!node) {
        return reply.code(400).send({ 
          error: 'Node not found - device must connect first' 
        });
      }

      // Generate device token
      const deviceToken = generateDeviceToken(
        request.device_id,
        node.id,
        userId,
        request.capabilities || []
      );

      // Hash the token for storage
      const crypto = await import('crypto');
      const tokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');

      // Update node with pairing approval
      await prisma.$executeRaw`
        UPDATE nodes
        SET 
          device_id = ${request.device_id},
          public_key = ${request.public_key},
          device_token_hash = ${tokenHash},
          capabilities = ${JSON.stringify(request.capabilities)}::jsonb,
          pairing_approved = true,
          pairing_approved_at = NOW(),
          pairing_approved_by = ${userId},
          auto_approved = false,
          token_expires_at = NOW() + INTERVAL '30 days'
        WHERE id = ${node.id}
      `;

      // Update pairing request status
      await prisma.$executeRaw`
        UPDATE device_pairing_requests
        SET 
          status = 'approved',
          approved_by = ${userId},
          approved_at = NOW()
        WHERE id = ${requestId}
      `;

      // Log security event
      await logSecurityEvent(
        request.device_id,
        node.id,
        'device_pairing_approved',
        'info',
        {
          approvedBy: userId,
          platform: request.platform,
          capabilities: request.capabilities
        }
      );

      logger.info(`✅ Device pairing approved: ${request.device_id} by user ${userId}`);

      return reply.send({
        success: true,
        message: 'Device pairing approved',
        deviceToken,
        nodeId: node.id,
        expiresIn: '30 days'
      });
    } catch (error) {
      logger.error('❌ Error approving device pairing:', error);
      return reply.code(500).send({ 
        error: 'Failed to approve device pairing' 
      });
    }
  });

  /**
   * POST /api/devices/:id/reject
   * Reject a device pairing request
   */
  app.post<{ 
    Params: { id: string };
    Body: { reason?: string };
  }>('/:id/reject', async (req, reply) => {
    try {
      const userId = (req as any).user?.id;
      const requestId = req.params.id;
      const { reason } = req.body;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Get pairing request
      const pairingRequest = await prisma.$queryRaw<Array<any>>`
        SELECT *
        FROM device_pairing_requests
        WHERE id = ${requestId}
          AND user_id = ${userId}
          AND status = 'pending'
        LIMIT 1
      `;

      if (!pairingRequest || pairingRequest.length === 0) {
        return reply.code(404).send({ 
          error: 'Pairing request not found or already processed' 
        });
      }

      const request = pairingRequest[0];

      // Update pairing request status
      await prisma.$executeRaw`
        UPDATE device_pairing_requests
        SET 
          status = 'rejected',
          rejected_reason = ${reason || 'Rejected by user'},
          approved_by = ${userId},
          approved_at = NOW()
        WHERE id = ${requestId}
      `;

      // Disconnect node if connected
      const node = await prisma.node.findFirst({
        where: { nodeKey: request.node_key }
      });

      if (node) {
        await prisma.node.update({
          where: { id: node.id },
          data: { status: 'OFFLINE' }
        });
      }

      // Log security event
      await logSecurityEvent(
        request.device_id,
        node?.id || 'unknown',
        'device_pairing_rejected',
        'warning',
        {
          rejectedBy: userId,
          reason: reason || 'User rejection',
          platform: request.platform
        }
      );

      logger.info(`❌ Device pairing rejected: ${request.device_id} by user ${userId}`);

      return reply.send({
        success: true,
        message: 'Device pairing rejected'
      });
    } catch (error) {
      logger.error('❌ Error rejecting device pairing:', error);
      return reply.code(500).send({ 
        error: 'Failed to reject device pairing' 
      });
    }
  });

  /**
   * GET /api/devices/paired
   * List all paired devices for current user
   */
  app.get('/paired', async (req, reply) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const pairedDevices = await prisma.node.findMany({
        where: {
          userId,
          pairingApproved: true
        },
        select: {
          id: true,
          deviceId: true,
          name: true,
          platform: true,
          status: true,
          capabilities: true,
          connectedAt: true,
          lastSeenAt: true,
          pairingApprovedAt: true,
          autoApproved: true,
          tokenExpiresAt: true
        },
        orderBy: {
          pairingApprovedAt: 'desc'
        }
      });

      return reply.send({
        success: true,
        devices: pairedDevices
      });
    } catch (error) {
      logger.error('❌ Error fetching paired devices:', error);
      return reply.code(500).send({ 
        error: 'Failed to fetch paired devices' 
      });
    }
  });

  /**
   * POST /api/devices/:nodeId/revoke
   * Revoke device pairing and invalidate token
   */
  app.post<{ Params: { nodeId: string } }>('/:nodeId/revoke', async (req, reply) => {
    try {
      const userId = (req as any).user?.id;
      const nodeId = req.params.nodeId;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Check ownership
      const node = await prisma.node.findFirst({
        where: {
          id: nodeId,
          userId
        }
      });

      if (!node) {
        return reply.code(404).send({ 
          error: 'Device not found or access denied' 
        });
      }

      // Revoke pairing
      await prisma.node.update({
        where: { id: nodeId },
        data: {
          pairingApproved: false,
          deviceTokenHash: null,
          status: 'OFFLINE'
        }
      });

      // Log security event
      await logSecurityEvent(
        node.deviceId || 'unknown',
        nodeId,
        'device_pairing_revoked',
        'warning',
        {
          revokedBy: userId
        }
      );

      logger.info(`🔒 Device pairing revoked: ${nodeId} by user ${userId}`);

      return reply.send({
        success: true,
        message: 'Device pairing revoked'
      });
    } catch (error) {
      logger.error('❌ Error revoking device pairing:', error);
      return reply.code(500).send({ 
        error: 'Failed to revoke device pairing' 
      });
    }
  });
};

export default devicePairingRoutes;
