import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import BridgeEventEmitter from './event-emitter.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'shelfzone-secret-change-in-production';

// OpenClaw Protocol v3 Message Types
interface RequestMessage {
  type: 'req';
  id: string;
  method: string;
  params: any;
}

interface ResponseMessage {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: any;
  error?: {
    code: string;
    message: string;
  };
}

interface EventMessage {
  type: 'event';
  event: string;
  payload: any;
  seq?: number;
  stateVersion?: string;
}

type Message = RequestMessage | ResponseMessage | EventMessage;

// Connect request parameters
interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
  };
  role: string;
  scopes?: string[];
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  auth?: {
    token?: string;
    deviceToken?: string;
  };
  locale?: string;
  userAgent?: string;
  device?: {
    id: string;
    publicKey: string;
    signature: string;
    signedAt: number;
    nonce: string;
  };
}

// Node.invoke parameters
interface NodeInvokeParams {
  nodeId?: string;
  deviceId?: string;
  command: string;
  params: any;
}

// Connected node state
interface ConnectedNode {
  nodeId: string;
  deviceId?: string;
  userId: string;
  socket: WebSocket;
  role: string;
  capabilities: string[];
  commands: string[];
  permissions: Record<string, boolean>;
  connectedAt: Date;
  lastPing: Date;
  platform?: string;
  challengeNonce?: string;
}

// Store active connections by nodeId
const connectedNodes = new Map<string, ConnectedNode>();
// Store pending requests (for node.invoke responses)
const pendingRequests = new Map<string, {
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timeout: NodeJS.Timeout;
}>();

// Event sequence counter
let eventSeq = 1;

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 60000;

/**
 * Initialize WebSocket server for Agent Bridge (OpenClaw Protocol v3)
 */
export function initializeBridgeWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/bridge',
    perMessageDeflate: false, // Disable compression to prevent RSV1 errors
    maxPayload: 100 * 1024 * 1024, // 100MB max payload
    skipUTF8Validation: false
  });

  logger.info('🌉 Agent Bridge WebSocket server initialized on /ws/bridge (OpenClaw Protocol v3)');

  wss.on('connection', async (ws: WebSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    logger.info(`📡 New WebSocket connection attempt from ${req.socket.remoteAddress}`);

    let nodeState: ConnectedNode | null = null;
    let authenticated = false;

    // Generate challenge nonce for this connection
    const challengeNonce = crypto.randomBytes(32).toString('base64');
    const challengeTs = Date.now();

    // Send connect.challenge event after ensuring connection is ready
    setImmediate(() => {
      if (ws.readyState === WebSocket.OPEN) {
        sendEvent(ws, 'connect.challenge', {
          nonce: challengeNonce,
          ts: challengeTs
        });
      }
    });

    // Handle incoming messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message: Message = JSON.parse(data.toString());
        
        if (message.type === 'req') {
          await handleRequest(ws, message as RequestMessage, challengeNonce, (node) => {
            nodeState = node;
            authenticated = true;
          });
        } else if (message.type === 'res') {
          await handleResponse(message as ResponseMessage);
        }
      } catch (err) {
        logger.error('❌ Error processing message:', err);
        sendErrorResponse(ws, 'unknown', 'INVALID_MESSAGE', 'Invalid message format');
      }
    });

    // Handle disconnection
    ws.on('close', async () => {
      if (nodeState) {
        logger.info(`🔌 Node ${nodeState.nodeId} disconnected`);
        connectedNodes.delete(nodeState.nodeId);

        await prisma.node.update({
          where: { id: nodeState.nodeId },
          data: { status: 'OFFLINE', lastSeenAt: new Date() }
        }).catch(err => logger.error('Error updating node status:', err));
      }
    });

    ws.on('error', (error) => {
      logger.error('❌ WebSocket error:', error);
    });
  });

  // Start heartbeat interval
  setInterval(() => {
    heartbeatCheck();
  }, HEARTBEAT_INTERVAL);

  return wss;
}

/**
 * Handle request messages
 */
async function handleRequest(
  ws: WebSocket,
  message: RequestMessage,
  challengeNonce: string,
  onNodeConnected: (node: ConnectedNode) => void
) {
  const { id, method, params } = message;

  try {
    switch (method) {
      case 'connect':
        await handleConnect(ws, id, params as ConnectParams, challengeNonce, onNodeConnected);
        break;

      case 'health':
        sendResponse(ws, id, true, { status: 'ok', timestamp: Date.now() });
        break;

      case 'node.invoke':
        // This is from server to node, but if node sends it, ignore
        sendErrorResponse(ws, id, 'METHOD_NOT_ALLOWED', 'node.invoke is server->node only');
        break;

      default:
        sendErrorResponse(ws, id, 'UNKNOWN_METHOD', `Unknown method: ${method}`);
    }
  } catch (error: any) {
    logger.error(`❌ Error handling ${method}:`, error);
    sendErrorResponse(ws, id, 'INTERNAL_ERROR', error.message);
  }
}

/**
 * Handle connect request (node pairing)
 */
async function handleConnect(
  ws: WebSocket,
  requestId: string,
  params: ConnectParams,
  challengeNonce: string,
  onNodeConnected: (node: ConnectedNode) => void
) {
  // Validate protocol version
  if (params.minProtocol > 3 || params.maxProtocol < 3) {
    sendErrorResponse(ws, requestId, 'PROTOCOL_VERSION_MISMATCH', 
      `Server only supports protocol v3, client requires ${params.minProtocol}-${params.maxProtocol}`);
    return;
  }

  // Validate role
  if (params.role !== 'node') {
    sendErrorResponse(ws, requestId, 'INVALID_ROLE', 'Only "node" role is supported');
    return;
  }

  // Extract auth token
  const token = params.auth?.token || params.auth?.deviceToken;
  if (!token) {
    sendErrorResponse(ws, requestId, 'AUTH_FAILED', 'No token provided');
    return;
  }

  let userId: string;
  let deviceId: string | undefined;

  // Check if it's a device token (JWT)
  if (token.startsWith('eyJ')) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.userId;
      deviceId = decoded.deviceId;
      
      // Verify device pairing
      const pairing = await prisma.devicePairing.findUnique({
        where: { deviceId }
      });

      if (!pairing || pairing.status !== 'APPROVED') {
        sendErrorResponse(ws, requestId, 'PAIRING_REQUIRED', 'Device not paired or approved');
        return;
      }
    } catch (err) {
      sendErrorResponse(ws, requestId, 'AUTH_FAILED', 'Invalid device token');
      return;
    }
  } else {
    // Gateway/pairing token
    const pairingToken = await prisma.$queryRaw<Array<{ userId: string; expiresAt: Date }>>`
      SELECT user_id as "userId", expires_at as "expiresAt" 
      FROM pairing_tokens 
      WHERE token = ${token}
      LIMIT 1
    `;

    if (!pairingToken || pairingToken.length === 0) {
      sendErrorResponse(ws, requestId, 'AUTH_FAILED', 'Invalid token');
      return;
    }

    const tokenData = pairingToken[0];

    if (new Date() > tokenData.expiresAt) {
      sendErrorResponse(ws, requestId, 'AUTH_FAILED', 'Token expired');
      return;
    }

    userId = tokenData.userId;

    // If device identity provided, handle pairing
    if (params.device) {
      deviceId = params.device.id;

      // Verify signature (simplified - in production, verify cryptographically)
      if (params.device.nonce !== challengeNonce) {
        sendErrorResponse(ws, requestId, 'AUTH_FAILED', 'Invalid challenge signature');
        return;
      }

      // Create or update device pairing
      await prisma.devicePairing.upsert({
        where: { deviceId },
        update: {
          publicKey: params.device.publicKey,
          role: params.role,
          scopes: params.scopes || [],
          status: 'APPROVED' // Auto-approve for now
        },
        create: {
          deviceId,
          publicKey: params.device.publicKey,
          role: params.role,
          scopes: params.scopes || [],
          status: 'APPROVED' // Auto-approve for now
        }
      });
    }

    // Delete pairing token (single-use)
    await prisma.$executeRaw`DELETE FROM pairing_tokens WHERE token = ${token}`;
  }

  // Create or update node in database
  const nodeKey = params.client.id || crypto.randomBytes(16).toString('hex');
  const node = await prisma.node.upsert({
    where: { nodeKey },
    update: {
      status: 'ONLINE',
      lastSeenAt: new Date(),
      connectedAt: new Date(),
      deviceId: deviceId,
      platform: params.client.platform,
      capabilities: params.caps || [],
      commands: params.commands || [],
      permissions: params.permissions || {}
    },
    create: {
      userId,
      name: `${params.client.platform || 'Node'} - ${nodeKey.substring(0, 8)}`,
      nodeKey,
      deviceId: deviceId,
      status: 'ONLINE',
      lastSeenAt: new Date(),
      connectedAt: new Date(),
      platform: params.client.platform,
      capabilities: params.caps || [],
      commands: params.commands || [],
      permissions: params.permissions || {}
    }
  });

  logger.info(`✅ Node connected: ${node.id}, deviceId: ${deviceId}`);

  // Register node in connected nodes map
  const connectedNode: ConnectedNode = {
    nodeId: node.id,
    deviceId: deviceId,
    userId,
    socket: ws,
    role: params.role,
    capabilities: params.caps || [],
    commands: params.commands || [],
    permissions: params.permissions || {},
    connectedAt: new Date(),
    lastPing: new Date(),
    platform: params.client.platform
  };

  connectedNodes.set(node.id, connectedNode);
  onNodeConnected(connectedNode);

  // Generate device token (JWT)
  const deviceToken = jwt.sign(
    {
      userId,
      deviceId: deviceId || node.id,
      role: params.role,
      scopes: params.scopes || []
    },
    JWT_SECRET,
    { expiresIn: '365d' }
  );

  // Send hello-ok response
  sendResponse(ws, requestId, true, {
    type: 'hello-ok',
    protocol: 3,
    policy: {
      tickIntervalMs: HEARTBEAT_INTERVAL
    },
    auth: {
      deviceToken,
      role: params.role,
      scopes: params.scopes || []
    }
  });

  logger.info(`🎉 Node ${node.id} successfully paired and online`);
}

/**
 * Handle response messages (from node.invoke)
 */
async function handleResponse(message: ResponseMessage) {
  const { id, ok, payload, error } = message;

  const pending = pendingRequests.get(id);
  if (!pending) {
    logger.warn(`⚠️ Received response for unknown request: ${id}`);
    return;
  }

  clearTimeout(pending.timeout);
  pendingRequests.delete(id);

  // Emit bridge event for SSE streaming
  try {
    if (ok && payload) {
      // Extract sessionId from request metadata if available
      const sessionId = (pending as any).sessionId;
      
      if (sessionId) {
        const event = await prisma.bridgeEvent.create({
          data: {
            bridgeSessionId: sessionId,
            type: 'RESPONSE',
            content: payload.stdout || JSON.stringify(payload),
            metadata: payload
          }
        });

        BridgeEventEmitter.getInstance().emitBridgeEvent(event);
      }
    }
  } catch (err) {
    logger.error('Error emitting bridge event:', err);
  }

  if (ok) {
    pending.resolve(payload);
  } else {
    pending.reject(new Error(error?.message || 'Unknown error'));
  }
}

/**
 * Send response message
 */
function sendResponse(ws: WebSocket, id: string, ok: boolean, payload?: any, errorCode?: string, errorMessage?: string) {
  const response: ResponseMessage = {
    type: 'res',
    id,
    ok
  };

  if (ok) {
    response.payload = payload;
  } else {
    response.error = {
      code: errorCode || 'UNKNOWN_ERROR',
      message: errorMessage || 'Unknown error'
    };
  }

  ws.send(JSON.stringify(response));
}

/**
 * Send error response
 */
function sendErrorResponse(ws: WebSocket, id: string, code: string, message: string) {
  sendResponse(ws, id, false, undefined, code, message);
}

/**
 * Send event message
 */
function sendEvent(ws: WebSocket, event: string, payload: any) {
  const eventMsg: EventMessage = {
    type: 'event',
    event,
    payload,
    seq: eventSeq++
  };

  ws.send(JSON.stringify(eventMsg));
}

/**
 * Send instruction to a specific node (via node.invoke)
 */
export async function sendInstructionToNode(
  nodeId: string, 
  sessionId: string, 
  agentId: string, 
  instruction: string
): Promise<boolean> {
  const node = connectedNodes.get(nodeId);

  if (!node) {
    throw new Error(`Node ${nodeId} not connected`);
  }

  // Check if node supports system.run
  if (!node.commands.includes('system.run')) {
    throw new Error('Node does not support system.run command');
  }

  const requestId = `invoke-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Store session ID with pending request for event emission
  const pendingRequest: any = {
    resolve: () => {},
    reject: () => {},
    timeout: setTimeout(() => {
      pendingRequests.delete(requestId);
    }, 30000),
    sessionId
  };

  pendingRequests.set(requestId, pendingRequest);

  // Send node.invoke request
  const request: RequestMessage = {
    type: 'req',
    id: requestId,
    method: 'node.invoke',
    params: {
      command: 'system.run',
      params: {
        command: ['bash', '-c', instruction],
        cwd: process.env.HOME || '/tmp',
        commandTimeoutMs: 30000
      }
    }
  };

  try {
    node.socket.send(JSON.stringify(request));
    logger.info(`✅ Instruction sent to node ${nodeId}, request ${requestId}`);
    return true;
  } catch (error) {
    clearTimeout(pendingRequest.timeout);
    pendingRequests.delete(requestId);
    throw error;
  }
}

/**
 * Invoke command on node
 */
export async function invokeNodeCommand(
  nodeId: string,
  command: string,
  params: any
): Promise<any> {
  const node = connectedNodes.get(nodeId);

  if (!node) {
    throw new Error(`Node ${nodeId} not connected`);
  }

  if (!node.commands.includes(command)) {
    throw new Error(`Node does not support command: ${command}`);
  }

  const requestId = `invoke-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Request timeout'));
    }, 60000);

    pendingRequests.set(requestId, { resolve, reject, timeout });

    const request: RequestMessage = {
      type: 'req',
      id: requestId,
      method: 'node.invoke',
      params: {
        command,
        params
      }
    };

    try {
      node.socket.send(JSON.stringify(request));
      logger.info(`✅ Command ${command} invoked on node ${nodeId}, request ${requestId}`);
    } catch (error) {
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
      reject(error);
    }
  });
}

/**
 * Send ping to all connected nodes and check for timeouts
 */
function heartbeatCheck() {
  const now = new Date();
  
  connectedNodes.forEach((node, nodeId) => {
    const timeSinceLastPing = now.getTime() - node.lastPing.getTime();

    if (timeSinceLastPing > HEARTBEAT_TIMEOUT) {
      logger.warn(`⚠️ Node ${nodeId} timed out (${timeSinceLastPing}ms since last pong)`);
      node.socket.close(1000, 'Heartbeat timeout');
      connectedNodes.delete(nodeId);

      prisma.node.update({
        where: { id: nodeId },
        data: { status: 'OFFLINE', lastSeenAt: new Date() }
      }).catch(err => logger.error('Error updating node status:', err));
      
      return;
    }

    // Send ping event
    sendEvent(node.socket, 'health', { status: 'ping', timestamp: now.getTime() });
    
    // Update last ping time when we send ping
    // In real implementation, we'd wait for pong response
    node.lastPing = now;
  });
}

/**
 * Stop execution on a node
 */
export async function stopExecutionOnNode(nodeId: string, sessionId: string): Promise<boolean> {
  const node = connectedNodes.get(nodeId);

  if (!node) {
    logger.warn(`⚠️ Cannot stop execution: Node ${nodeId} not connected`);
    return false;
  }

  // Send stop as a system event
  sendEvent(node.socket, 'system.stop', { sessionId });
  logger.info(`🛑 Stop signal sent to node ${nodeId}, session ${sessionId}`);
  return true;
}

/**
 * Get all connected nodes
 */
export function getConnectedNodes(): Array<{
  nodeId: string;
  deviceId?: string;
  userId: string;
  role: string;
  capabilities: string[];
  commands: string[];
  platform?: string;
  connectedAt: Date;
}> {
  return Array.from(connectedNodes.values()).map(node => ({
    nodeId: node.nodeId,
    deviceId: node.deviceId,
    userId: node.userId,
    role: node.role,
    capabilities: node.capabilities,
    commands: node.commands,
    platform: node.platform,
    connectedAt: node.connectedAt
  }));
}

/**
 * Check if a node is online
 */
export function isNodeOnline(nodeId: string): boolean {
  return connectedNodes.has(nodeId);
}

/**
 * Disconnect a node
 */
export async function disconnectNode(nodeId: string): Promise<boolean> {
  const node = connectedNodes.get(nodeId);

  if (!node) {
    return false;
  }

  try {
    node.socket.close(1000, 'Server-initiated disconnect');
    connectedNodes.delete(nodeId);
    
    await prisma.node.update({
      where: { id: nodeId },
      data: { status: 'OFFLINE', lastSeenAt: new Date() }
    });

    logger.info(`🔌 Node ${nodeId} disconnected by server`);
    return true;
  } catch (error) {
    logger.error(`❌ Error disconnecting node ${nodeId}:`, error);
    return false;
  }
}
