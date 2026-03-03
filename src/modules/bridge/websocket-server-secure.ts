/**
 * Enhanced Secure WebSocket Server for Agent Bridge
 * Implements OpenClaw protocol v3 with full security:
 * - JWT device tokens
 * - Device signature validation  * - Command sandboxing
 * - Rate limiting
 * - Pairing approval flow
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import BridgeEventEmitter from './event-emitter.js';
import { 
  generateDeviceToken, 
  verifyDeviceToken, 
  generateChallenge,
  validateDeviceSignature,
  DeviceTokenPayload 
} from '../../lib/device-auth.js';
import { 
  validateCommand, 
  logSecurityEvent,
  DevicePermissions 
} from '../../lib/command-sandbox.js';

const AUTO_APPROVE_LOCAL = process.env.DEVICE_PAIRING_AUTO_APPROVE_LOCAL === 'true';

// Challenge nonce storage (in production, use Redis)
const challengeNonces = new Map<string, { nonce: string; timestamp: number }>();

// Connection rate limiting (per IP)
const connectionAttempts = new Map<string, number[]>();
const MAX_CONNECTIONS_PER_MINUTE = 10;

// Connected node state
interface ConnectedNode {
  nodeId: string;
  deviceId: string;
  userId: string;
  socket: WebSocket;
  capabilities: string[];
  permissions: DevicePermissions;
  connectedAt: Date;
  lastPing: Date;
  platform?: string;
}

const connectedNodes = new Map<string, ConnectedNode>();

const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 60000;

/**
 * Initialize secure WebSocket server
 */
export function initializeSecureBridgeWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/bridge/secure'
  });

  logger.info('🔒 Secure Agent Bridge WebSocket server initialized on /ws/bridge/secure');

  wss.on('connection', async (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    logger.info(`🔌 New secure connection from ${clientIp}`);

    // Rate limit check
    const now = Date.now();
    const attempts = connectionAttempts.get(clientIp) || [];
    const recentAttempts = attempts.filter(t => now - t < 60000);

    if (recentAttempts.length >= MAX_CONNECTIONS_PER_MINUTE) {
      logger.warn(`⚠️ Rate limit exceeded for ${clientIp}: ${recentAttempts.length} connections in 1 minute`);
      ws.close(1008, 'Too many connection attempts');
      return;
    }

    recentAttempts.push(now);
    connectionAttempts.set(clientIp, recentAttempts);

    // Step 1: Send challenge BEFORE any authentication
    const { nonce, timestamp } = generateChallenge();
    const socketId = `${clientIp}-${Date.now()}`;
    challengeNonces.set(socketId, { nonce, timestamp });

    const challengeEvent = {
      type: 'event',
      event: 'connect.challenge',
      payload: {
        nonce,
        ts: timestamp
      }
    };

    ws.send(JSON.stringify(challengeEvent));
    logger.debug(`🎲 Challenge sent to ${clientIp}: ${nonce.substring(0, 16)}...`);

    let nodeState: ConnectedNode | null = null;
    let authenticated = false;

    // Message handler
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        logger.debug(`📨 Message from ${clientIp}: ${message.type} ${message.method || message.event || ''}`);

        if (message.type === 'req' && message.method === 'connect') {
          await handleSecureConnect(ws, socketId, message, clientIp, (node) => {
            nodeState = node;
            authenticated = true;
          });
        } else if (!authenticated) {
          logger.warn(`⚠️ Unauthenticated message from ${clientIp}, ignoring`);
          sendError(ws, message.id, 'AUTH_REQUIRED', 'Must authenticate first');
        } else if (message.type === 'req') {
          await handleNodeRequest(ws, nodeState!, message);
        } else if (message.type === 'res') {
          await handleNodeResponse(nodeState!, message);
        }
      } catch (error) {
        logger.error('❌ Error processing message:', error);
        sendError(ws, 'unknown', 'INTERNAL_ERROR', 'Message processing failed');
      }
    });

    // Disconnection handler
    ws.on('close', async () => {
      if (nodeState) {
        logger.info(`🔌 Node ${nodeState.nodeId} disconnected`);
        connectedNodes.delete(nodeState.nodeId);

        await prisma.node.update({
          where: { id: nodeState.nodeId },
          data: { status: 'OFFLINE', lastSeenAt: new Date() }
        }).catch(err => logger.error('Error updating node status:', err));

        await logSecurityEvent(
          nodeState.deviceId,
          nodeState.nodeId,
          'device_disconnected',
          'info',
          { clientIp }
        );
      }
      challengeNonces.delete(socketId);
    });

    ws.on('error', (error) => {
      logger.error('❌ WebSocket error:', error);
    });
  });

  // Heartbeat
  setInterval(() => {
    heartbeatCheck();
  }, HEARTBEAT_INTERVAL);

  // Cleanup old connection attempts
  setInterval(() => {
    const now = Date.now();
    for (const [ip, attempts] of connectionAttempts.entries()) {
      const recent = attempts.filter(t => now - t < 60000);
      if (recent.length === 0) {
        connectionAttempts.delete(ip);
      } else {
        connectionAttempts.set(ip, recent);
      }
    }
  }, 60000); // Clean every minute

  return wss;
}

/**
 * Handle secure connect with device identity
 */
async function handleSecureConnect(
  ws: WebSocket,
  socketId: string,
  message: any,
  clientIp: string,
  onComplete: (node: ConnectedNode) => void
) {
  const params = message.params;

  // Validate protocol version
  if (params.minProtocol > 3 || params.maxProtocol < 3) {
    sendError(ws, message.id, 'PROTOCOL_VERSION_MISMATCH', 'Protocol v3 required');
    ws.close(1008, 'Incompatible protocol version');
    return;
  }

  // Check for device identity
  if (!params.device) {
    sendError(ws, message.id, 'DEVICE_IDENTITY_REQUIRED', 'Device identity missing');
    ws.close(1008, 'Device identity required');
    return;
  }

  const device = params.device;
  const challenge = challengeNonces.get(socketId);

  if (!challenge) {
    sendError(ws, message.id, 'CHALLENGE_EXPIRED', 'Challenge not found or expired');
    ws.close(1008, 'Challenge expired');
    return;
  }

  // Validate device signature
  const signatureValid = validateDeviceSignature(device, challenge.nonce);

  if (!signatureValid) {
    await logSecurityEvent(
      device.id,
      'pending',
      'invalid_device_signature',
      'critical',
      { clientIp, deviceId: device.id }
    );
    sendError(ws, message.id, 'INVALID_SIGNATURE', 'Device signature validation failed');
    ws.close(1008, 'Invalid signature');
    return;
  }

  logger.info(`✅ Device signature validated for ${device.id}`);

  // Check if device has existing token in auth
  let deviceToken: DeviceTokenPayload | null = null;
  
  if (params.auth?.deviceToken) {
    deviceToken = verifyDeviceToken(params.auth.deviceToken);
    
    if (!deviceToken) {
      logger.warn(`⚠️ Invalid or expired device token from ${device.id}`);
      // Fall through to pairing flow
    } else if (deviceToken.deviceId !== device.id) {
      await logSecurityEvent(
        device.id,
        'pending',
        'device_id_mismatch',
        'critical',
        { tokenDeviceId: deviceToken.deviceId, actualDeviceId: device.id }
      );
      sendError(ws, message.id, 'DEVICE_ID_MISMATCH', 'Token device ID does not match');
      ws.close(1008, 'Device ID mismatch');
      return;
    }
  }

  // If no valid device token, check for gateway token (pairing flow)
  let pairingTokenToDelete: string | null = null;
  
  if (!deviceToken && params.auth?.token) {
    const result = await handleDevicePairing(
      device,
      params,
      clientIp,
      params.auth.token
    );

    if (!result.success) {
      sendError(ws, message.id, result.errorCode!, result.errorMessage!);
      ws.close(1008, result.errorMessage);
      return;
    }

    deviceToken = result.deviceToken!;
    pairingTokenToDelete = result.gatewayToken || null;
  }

  if (!deviceToken) {
    sendError(ws, message.id, 'AUTH_REQUIRED', 'No valid authentication provided');
    ws.close(1008, 'Authentication required');
    return;
  }

  // Find node in database
  const node = await prisma.node.findUnique({
    where: { id: deviceToken.nodeId }
  });

  if (!node) {
    sendError(ws, message.id, 'NODE_NOT_FOUND', 'Node not found in database');
    ws.close(1008, 'Node not found');
    return;
  }

  // Check pairing approval
  if (!node.pairingApproved) {
    sendError(ws, message.id, 'PAIRING_APPROVAL_REQUIRED', 'Device pairing not yet approved');
    ws.close(1008, 'Awaiting approval');
    return;
  }

  // Update node status
  await prisma.node.update({
    where: { id: node.id },
    data: {
      status: 'ONLINE',
      lastSeenAt: new Date(),
      connectedAt: new Date(),
      ipAddress: clientIp,
      capabilities: params.caps || [],
      platform: params.client.platform
    }
  });

  // Extract permissions from node
  const permissions: DevicePermissions = (node.permissions as any) || {};

  // Create connected node state
  const connectedNode: ConnectedNode = {
    nodeId: node.id,
    deviceId: device.id,
    userId: deviceToken.userId,
    socket: ws,
    capabilities: params.caps || [],
    permissions,
    connectedAt: new Date(),
    lastPing: new Date(),
    platform: params.client.platform
  };

  connectedNodes.set(node.id, connectedNode);
  onComplete(connectedNode);

  // Send hello-ok response
  const response = {
    type: 'res',
    id: message.id,
    ok: true,
    payload: {
      type: 'hello-ok',
      protocol: 3,
      policy: {
        tickIntervalMs: 15000
      },
      auth: {
        deviceToken: null, // Don't send token back (already has it)
        role: 'node',
        scopes: deviceToken.scopes
      },
      nodeId: node.id
    }
  };

  ws.send(JSON.stringify(response));

  // NOW delete the pairing token after successful hello-ok
  if (pairingTokenToDelete) {
    await prisma.$executeRaw`DELETE FROM pairing_tokens WHERE token = ${pairingTokenToDelete}`;
    logger.debug(`🗑️ Pairing token consumed after successful connection`);
  }

  await logSecurityEvent(
    device.id,
    node.id,
    'device_connected',
    'info',
    { clientIp, platform: params.client.platform }
  );

  logger.info(`🎉 Node ${node.id} (${device.id}) connected securely`);
}

/**
 * Handle device pairing flow
 */
async function handleDevicePairing(
  device: any,
  params: any,
  clientIp: string,
  gatewayToken: string
): Promise<{
  success: boolean;
  deviceToken?: DeviceTokenPayload;
  gatewayToken?: string;
  errorCode?: string;
  errorMessage?: string;
}> {
  // Verify gateway/pairing token
  const pairingToken = await prisma.$queryRaw<Array<{ userId: string; expiresAt: Date }>>`
    SELECT user_id as "userId", expires_at as "expiresAt" 
    FROM pairing_tokens 
    WHERE token = ${gatewayToken}
    LIMIT 1
  `;

  if (!pairingToken || pairingToken.length === 0) {
    return {
      success: false,
      errorCode: 'INVALID_TOKEN',
      errorMessage: 'Invalid pairing token'
    };
  }

  const tokenData = pairingToken[0];

  if (new Date() > tokenData.expiresAt) {
    return {
      success: false,
      errorCode: 'TOKEN_EXPIRED',
      errorMessage: 'Pairing token expired'
    };
  }

  const userId = tokenData.userId;
  const isLocal = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp?.startsWith('192.168.');
  const autoApprove = AUTO_APPROVE_LOCAL && isLocal;

  // Create or find node
  const nodeKey = `${device.id}-${Date.now()}`;
  
  const node = await prisma.node.upsert({
    where: { deviceId: device.id },
    create: {
      userId,
      name: `${params.client.platform} - ${device.id.substring(0, 8)}`,
      nodeKey,
      deviceId: device.id,
      publicKey: device.publicKey,
      status: 'OFFLINE',
      platform: params.client.platform,
      capabilities: params.caps || [],
      pairingApproved: autoApprove,
      pairingApprovedAt: autoApprove ? new Date() : null,
      pairingApprovedBy: autoApprove ? userId : null,
      autoApproved: autoApprove
    },
    update: {
      publicKey: device.publicKey,
      platform: params.client.platform,
      capabilities: params.caps || []
    }
  });

  if (!autoApprove) {
    // Create pairing request
    await prisma.$executeRaw`
      INSERT INTO device_pairing_requests (
        device_id, public_key, user_id, node_key, platform, ip_address,
        capabilities, status, created_at, expires_at
      ) VALUES (
        ${device.id}, ${device.publicKey}, ${userId}, ${nodeKey},
        ${params.client.platform}, ${clientIp},
        ${JSON.stringify(params.caps)}::jsonb, 'pending',
        NOW(), NOW() + INTERVAL '24 hours'
      )
    `;

    logger.info(`📋 Pairing request created for device ${device.id} - awaiting approval`);

    return {
      success: false,
      errorCode: 'PAIRING_APPROVAL_REQUIRED',
      errorMessage: 'Device pairing request created - awaiting admin approval'
    };
  }

  // Auto-approved - generate token
  const token = generateDeviceToken(
    device.id,
    node.id,
    userId,
    params.caps || []
  );

  const crypto = await import('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await prisma.node.update({
    where: { id: node.id },
    data: {
      deviceTokenHash: tokenHash,
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  // DON'T delete pairing token yet - wait until hello-ok is sent successfully

  await logSecurityEvent(
    device.id,
    node.id,
    'device_auto_approved',
    'info',
    { reason: 'local_connection', clientIp }
  );

  logger.info(`✅ Device ${device.id} auto-approved (local connection)`);

  const deviceTokenPayload = verifyDeviceToken(token)!;

  return {
    success: true,
    deviceToken: deviceTokenPayload,
    gatewayToken // Return token so it can be deleted after successful handshake
  };
}

/**
 * Handle node.invoke and other requests FROM server TO node
 */
async function handleNodeRequest(ws: WebSocket, node: ConnectedNode, message: any) {
  // This is for handling responses from node to server requests
  // (Not used in current implementation - nodes respond to server commands)
  logger.debug(`📨 Request from node ${node.nodeId}: ${message.method}`);
}

/**
 * Handle responses from node (e.g., to node.invoke)
 */
async function handleNodeResponse(node: ConnectedNode, message: any) {
  logger.debug(`📊 Response from node ${node.nodeId}: ${message.id}`);
  
  // Forward to SSE stream or store in database
  // Implementation depends on your existing result handling
}

/**
 * Send instruction to node with security validation
 */
export async function sendSecureInstruction(
  nodeId: string,
  sessionId: string,
  agentId: string,
  command: string,
  params: any
): Promise<{ success: boolean; error?: string }> {
  const node = connectedNodes.get(nodeId);

  if (!node) {
    return { success: false, error: 'Node not connected' };
  }

  // Validate command
  const validation = await validateCommand(
    command,
    params,
    node.deviceId,
    node.permissions
  );

  if (!validation.allowed) {
    await logSecurityEvent(
      node.deviceId,
      nodeId,
      'command_blocked',
      'warning',
      { command, reason: validation.reason }
    );
    
    logger.warn(`🚫 Command blocked: ${command} - ${validation.reason}`);
    return { success: false, error: validation.reason };
  }

  // Send command
  const requestMsg = {
    type: 'req',
    id: sessionId,
    method: 'node.invoke',
    params: {
      nodeId,
      command,
      params
    }
  };

  try {
    node.socket.send(JSON.stringify(requestMsg));
    
    await logSecurityEvent(
      node.deviceId,
      nodeId,
      'command_sent',
      'info',
      { command, sessionId }
    );

    logger.info(`✅ Secure instruction sent to node ${nodeId}: ${command}`);
    return { success: true };
  } catch (error) {
    logger.error(`❌ Error sending instruction to node ${nodeId}:`, error);
    return { success: false, error: 'Failed to send instruction' };
  }
}

/**
 * Send error response
 */
function sendError(ws: WebSocket, id: string, code: string, message: string) {
  const errorMsg = {
    type: 'res',
    id,
    ok: false,
    error: { code, message }
  };
  ws.send(JSON.stringify(errorMsg));
}

/**
 * Heartbeat check
 */
function heartbeatCheck() {
  const now = new Date();
  
  connectedNodes.forEach((node, nodeId) => {
    const timeSinceLastPing = now.getTime() - node.lastPing.getTime();

    if (timeSinceLastPing > HEARTBEAT_TIMEOUT) {
      logger.warn(`⚠️ Node ${nodeId} timed out`);
      node.socket.close(1000, 'Heartbeat timeout');
      connectedNodes.delete(nodeId);

      prisma.node.update({
        where: { id: nodeId },
        data: { status: 'OFFLINE', lastSeenAt: new Date() }
      }).catch(err => logger.error('Error updating node status:', err));
    }
  });
}

export function getConnectedSecureNodes(): ConnectedNode[] {
  return Array.from(connectedNodes.values());
}

export function isSecureNodeOnline(nodeId: string): boolean {
  return connectedNodes.has(nodeId);
}
