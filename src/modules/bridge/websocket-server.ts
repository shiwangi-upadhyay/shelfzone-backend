import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import BridgeEventEmitter from './event-emitter.js';

// Message types
interface NodeMessage {
  type: 'handshake' | 'pong' | 'result' | 'file_change' | 'command_output' | 'error';
  nodeKey?: string;
  agents?: string[];
  platform?: string;
  sessionId?: string;
  content?: string;
  done?: boolean;
  filePath?: string;
  diff?: string;
  output?: string;
  error?: string;
}

interface ServerMessage {
  type: 'ping' | 'execute' | 'stop' | 'auth_ok' | 'handshake_complete' | 'error';
  nodeId?: string;
  sessionId?: string;
  agentId?: string;
  instruction?: string;
  message?: string;
}

// Connected node state
interface ConnectedNode {
  nodeId: string;
  userId: string;
  socket: WebSocket;
  agents: string[];
  connectedAt: Date;
  lastPing: Date;
  nodeKey: string;
  platform?: string;
}

// Store active connections
const connectedNodes = new Map<string, ConnectedNode>();

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 60000;

/**
 * Initialize WebSocket server for Agent Bridge
 */
export function initializeBridgeWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/bridge'
  });

  logger.info('🌉 Agent Bridge WebSocket server initialized on /ws/bridge');

  // Handle new connections
  wss.on('connection', async (ws: WebSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    logger.info(`📡 New WebSocket connection attempt from ${req.socket.remoteAddress}`);

    if (!token) {
      logger.warn('⚠️ Connection rejected: No token provided');
      ws.close(1008, 'Authentication required');
      return;
    }

    try {
      // Verify pairing token
      const pairingToken = await prisma.$queryRaw<Array<{ userId: string; expiresAt: Date }>>`
        SELECT user_id as "userId", expires_at as "expiresAt" 
        FROM pairing_tokens 
        WHERE token = ${token}
        LIMIT 1
      `;

      if (!pairingToken || pairingToken.length === 0) {
        logger.warn(`⚠️ Connection rejected: Invalid token ${token.substring(0, 10)}...`);
        ws.close(1008, 'Invalid token');
        return;
      }

      const { userId, expiresAt } = pairingToken[0];

      // Check if token expired
      if (new Date() > expiresAt) {
        logger.warn(`⚠️ Connection rejected: Token expired for user ${userId}`);
        ws.close(1008, 'Token expired');
        return;
      }

      logger.info(`✅ Token verified for user ${userId}`);

      // Send auth_ok
      const authOkMsg: ServerMessage = { type: 'auth_ok' };
      ws.send(JSON.stringify(authOkMsg));

      // Set up message handler
      let nodeState: ConnectedNode | null = null;

      ws.on('message', async (data: Buffer) => {
        try {
          const message: NodeMessage = JSON.parse(data.toString());
          
          logger.debug(`📨 Received message from ${nodeState?.nodeId || 'pending'}: ${message.type}`);

          switch (message.type) {
            case 'handshake':
              await handleHandshake(ws, userId, token, message, (node) => {
                nodeState = node;
              });
              break;

            case 'pong':
              if (nodeState) {
                nodeState.lastPing = new Date();
              }
              break;

            case 'result':
              if (nodeState && message.sessionId) {
                await handleResult(nodeState.nodeId, message.sessionId, message.content || '', message.done || false);
              }
              break;

            case 'file_change':
              if (nodeState && message.sessionId && message.filePath) {
                await handleFileChange(nodeState.nodeId, message.sessionId, message.filePath, message.diff || '');
              }
              break;

            case 'command_output':
              if (nodeState && message.sessionId && message.output) {
                await handleCommandOutput(nodeState.nodeId, message.sessionId, message.output);
              }
              break;

            case 'error':
              if (nodeState && message.sessionId && message.error) {
                await handleError(nodeState.nodeId, message.sessionId, message.error);
              }
              break;

            default:
              logger.warn(`⚠️ Unknown message type: ${(message as any).type}`);
          }
        } catch (err) {
          logger.error('❌ Error processing message:', err);
          const errorMsg: ServerMessage = { 
            type: 'error', 
            message: 'Invalid message format' 
          };
          ws.send(JSON.stringify(errorMsg));
        }
      });

      // Handle disconnection
      ws.on('close', async () => {
        if (nodeState) {
          logger.info(`🔌 Node ${nodeState.nodeId} disconnected`);
          connectedNodes.delete(nodeState.nodeId);

          // Update node status in DB
          await prisma.node.update({
            where: { id: nodeState.nodeId },
            data: { status: 'OFFLINE', lastSeenAt: new Date() }
          });
        }
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error('❌ WebSocket error:', error);
      });

    } catch (error) {
      logger.error('❌ Error handling WebSocket connection:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  // Start heartbeat interval
  setInterval(() => {
    heartbeatCheck(wss);
  }, HEARTBEAT_INTERVAL);

  return wss;
}

/**
 * Handle handshake message
 */
async function handleHandshake(
  ws: WebSocket, 
  userId: string, 
  token: string, 
  message: NodeMessage,
  onComplete: (node: ConnectedNode) => void
) {
  if (!message.nodeKey || !message.agents) {
    const errorMsg: ServerMessage = { 
      type: 'error', 
      message: 'Invalid handshake: missing nodeKey or agents' 
    };
    ws.send(JSON.stringify(errorMsg));
    return;
  }

  const { nodeKey, agents, platform } = message;

  logger.info(`🤝 Handshake from nodeKey: ${nodeKey}, platform: ${platform}, agents: ${agents.length}`);

  try {
    // Create or update node in database
    const node = await prisma.node.upsert({
      where: { nodeKey },
      update: {
        status: 'ONLINE',
        lastSeenAt: new Date(),
        connectedAt: new Date(),
        agents: agents,
        platform: platform || null,
        ipAddress: null // TODO: Extract from request
      },
      create: {
        userId,
        name: `${platform || 'Node'} - ${nodeKey.substring(0, 8)}`,
        nodeKey,
        status: 'ONLINE',
        lastSeenAt: new Date(),
        connectedAt: new Date(),
        agents: agents,
        platform: platform || null
      }
    });

    logger.info(`✅ Node created/updated: ${node.id}`);

    // Register agents on this node
    for (const agentName of agents) {
      try {
        // Check if agent exists in registry
        const agent = await prisma.agentRegistry.findFirst({
          where: {
            createdBy: userId,
            name: agentName
          }
        });

        if (agent) {
          // Update existing agent with nodeId
          await prisma.agentRegistry.update({
            where: { id: agent.id },
            data: { nodeId: node.id }
          });
          logger.info(`✅ Updated agent ${agentName} with nodeId ${node.id}`);
        } else {
          // Create new agent entry
          await prisma.agentRegistry.create({
            data: {
              name: agentName,
              slug: `${agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
              description: `Remote agent running on ${node.name}`,
              model: 'remote',
              type: 'INTEGRATION',
              status: 'ACTIVE',
              nodeId: node.id,
              createdBy: userId
            }
          });
          logger.info(`✅ Created new agent ${agentName} on nodeId ${node.id}`);
        }
      } catch (agentError) {
        logger.error(`❌ Error registering agent ${agentName}:`, agentError);
      }
    }

    // Store in active connections
    const connectedNode: ConnectedNode = {
      nodeId: node.id,
      userId,
      socket: ws,
      agents,
      connectedAt: new Date(),
      lastPing: new Date(),
      nodeKey,
      platform
    };

    connectedNodes.set(node.id, connectedNode);
    onComplete(connectedNode);

    // Delete pairing token (single-use)
    await prisma.$executeRaw`DELETE FROM pairing_tokens WHERE token = ${token}`;

    logger.info(`🗑️ Pairing token deleted for ${nodeKey}`);

    // Send handshake complete
    const completeMsg: ServerMessage = { 
      type: 'handshake_complete', 
      nodeId: node.id 
    };
    ws.send(JSON.stringify(completeMsg));

    logger.info(`🎉 Node ${node.id} successfully paired and online`);

  } catch (error) {
    logger.error('❌ Error during handshake:', error);
    const errorMsg: ServerMessage = { 
      type: 'error', 
      message: 'Handshake failed' 
    };
    ws.send(JSON.stringify(errorMsg));
  }
}

/**
 * Handle result message from node
 */
async function handleResult(nodeId: string, sessionId: string, content: string, done: boolean) {
  logger.debug(`📊 Result from node ${nodeId}, session ${sessionId}, done: ${done}`);
  
  try {
    // Store event in database
    const event = await prisma.bridgeEvent.create({
      data: {
        bridgeSessionId: sessionId,
        type: 'RESPONSE',
        content,
        metadata: { done }
      }
    });

    // Emit to SSE stream
    BridgeEventEmitter.getInstance().emitBridgeEvent(event);

    // If done, update session status
    if (done) {
      await prisma.bridgeSession.update({
        where: { id: sessionId },
        data: { 
          status: 'COMPLETED',
          endedAt: new Date()
        }
      });
      logger.info(`✅ Session ${sessionId} completed`);
    }
  } catch (error) {
    logger.error('❌ Error handling result:', error);
  }
}

/**
 * Handle file change message from node
 */
async function handleFileChange(nodeId: string, sessionId: string, filePath: string, diff: string) {
  logger.debug(`📝 File change from node ${nodeId}, session ${sessionId}: ${filePath}`);
  
  try {
    const event = await prisma.bridgeEvent.create({
      data: {
        bridgeSessionId: sessionId,
        type: 'FILE_CHANGE',
        fileChanged: filePath,
        metadata: { diff }
      }
    });

    // Emit to SSE stream
    BridgeEventEmitter.getInstance().emitBridgeEvent(event);
  } catch (error) {
    logger.error('❌ Error handling file change:', error);
  }
}

/**
 * Handle command output message from node
 */
async function handleCommandOutput(nodeId: string, sessionId: string, output: string) {
  logger.debug(`💻 Command output from node ${nodeId}, session ${sessionId}`);
  
  try {
    const event = await prisma.bridgeEvent.create({
      data: {
        bridgeSessionId: sessionId,
        type: 'COMMAND',
        content: output
      }
    });

    // Emit to SSE stream
    BridgeEventEmitter.getInstance().emitBridgeEvent(event);
  } catch (error) {
    logger.error('❌ Error handling command output:', error);
  }
}

/**
 * Handle error message from node
 */
async function handleError(nodeId: string, sessionId: string, error: string) {
  logger.error(`❌ Error from node ${nodeId}, session ${sessionId}: ${error}`);
  
  try {
    const event = await prisma.bridgeEvent.create({
      data: {
        bridgeSessionId: sessionId,
        type: 'ERROR',
        content: error
      }
    });

    // Emit to SSE stream
    BridgeEventEmitter.getInstance().emitBridgeEvent(event);

    await prisma.bridgeSession.update({
      where: { id: sessionId },
      data: { 
        status: 'ERROR',
        endedAt: new Date()
      }
    });
  } catch (err) {
    logger.error('❌ Error handling error message:', err);
  }
}

/**
 * Send ping to all connected nodes and check for timeouts
 */
function heartbeatCheck(wss: WebSocketServer) {
  const now = new Date();
  
  connectedNodes.forEach((node, nodeId) => {
    const timeSinceLastPing = now.getTime() - node.lastPing.getTime();

    // If no pong received for 60s, disconnect
    if (timeSinceLastPing > HEARTBEAT_TIMEOUT) {
      logger.warn(`⚠️ Node ${nodeId} timed out (${timeSinceLastPing}ms since last pong)`);
      node.socket.close(1000, 'Heartbeat timeout');
      connectedNodes.delete(nodeId);

      // Update DB
      prisma.node.update({
        where: { id: nodeId },
        data: { status: 'OFFLINE', lastSeenAt: new Date() }
      }).catch(err => logger.error('Error updating node status:', err));
      
      return;
    }

    // Send ping
    const pingMsg: ServerMessage = { type: 'ping' };
    try {
      node.socket.send(JSON.stringify(pingMsg));
    } catch (error) {
      logger.error(`❌ Error sending ping to node ${nodeId}:`, error);
    }
  });
}

/**
 * Send instruction to a specific node
 */
export async function sendInstructionToNode(
  nodeId: string, 
  sessionId: string, 
  agentId: string, 
  instruction: string
): Promise<boolean> {
  const node = connectedNodes.get(nodeId);

  if (!node) {
    logger.warn(`⚠️ Cannot send instruction: Node ${nodeId} not connected`);
    return false;
  }

  const executeMsg: ServerMessage = {
    type: 'execute',
    sessionId,
    agentId,
    instruction
  };

  try {
    node.socket.send(JSON.stringify(executeMsg));
    logger.info(`✅ Instruction sent to node ${nodeId}, session ${sessionId}`);
    return true;
  } catch (error) {
    logger.error(`❌ Error sending instruction to node ${nodeId}:`, error);
    return false;
  }
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

  const stopMsg: ServerMessage = {
    type: 'stop',
    sessionId
  };

  try {
    node.socket.send(JSON.stringify(stopMsg));
    logger.info(`🛑 Stop signal sent to node ${nodeId}, session ${sessionId}`);
    return true;
  } catch (error) {
    logger.error(`❌ Error sending stop signal to node ${nodeId}:`, error);
    return false;
  }
}

/**
 * Get all connected nodes
 */
export function getConnectedNodes(): ConnectedNode[] {
  return Array.from(connectedNodes.values());
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
