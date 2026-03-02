import { prisma } from '../../lib/prisma';
import type { FastifyReply } from 'fastify';

export interface ActivityEvent {
  type: 'delegation_start' | 'delegation_progress' | 'delegation_complete' | 'delegation_error' | 'agent_switch' | 'token_update';
  timestamp: number;
  data: {
    agentId?: string;
    agentName?: string;
    task?: string;
    progress?: number;
    status?: string;
    tokenUsage?: {
      used: number;
      limit: number;
      percentage: number;
    };
    error?: string;
    traceSessionId?: string;
  };
}

class ActivityService {
  private clients: Map<string, FastifyReply> = new Map();

  /**
   * Register SSE client for activity stream
   */
  registerClient(userId: string, reply: FastifyReply): void {
    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    });

    // Store client
    this.clients.set(userId, reply);

    // Send initial connection event
    this.sendToClient(userId, {
      type: 'agent_switch',
      timestamp: Date.now(),
      data: {
        status: 'connected',
      },
    });

    // Handle client disconnect
    reply.raw.on('close', () => {
      this.clients.delete(userId);
    });
  }

  /**
   * Send event to specific client
   */
  private sendToClient(userId: string, event: ActivityEvent): void {
    const client = this.clients.get(userId);
    if (!client) return;

    try {
      const data = JSON.stringify(event);
      client.raw.write(`data: ${data}\n\n`);
    } catch (error) {
      console.error('[ActivityService] Failed to send to client:', error);
      this.clients.delete(userId);
    }
  }

  /**
   * Broadcast event to specific user
   */
  broadcast(userId: string, event: ActivityEvent): void {
    this.sendToClient(userId, event);
  }

  /**
   * Notify delegation start
   */
  notifyDelegationStart(userId: string, agentId: string, agentName: string, task: string, traceSessionId: string): void {
    this.broadcast(userId, {
      type: 'delegation_start',
      timestamp: Date.now(),
      data: {
        agentId,
        agentName,
        task,
        status: 'started',
        traceSessionId,
      },
    });
  }

  /**
   * Notify delegation progress
   */
  notifyDelegationProgress(userId: string, agentId: string, progress: number, traceSessionId: string): void {
    this.broadcast(userId, {
      type: 'delegation_progress',
      timestamp: Date.now(),
      data: {
        agentId,
        progress,
        traceSessionId,
      },
    });
  }

  /**
   * Notify delegation complete
   */
  notifyDelegationComplete(userId: string, agentId: string, traceSessionId: string): void {
    this.broadcast(userId, {
      type: 'delegation_complete',
      timestamp: Date.now(),
      data: {
        agentId,
        status: 'completed',
        traceSessionId,
      },
    });
  }

  /**
   * Notify delegation error
   */
  notifyDelegationError(userId: string, agentId: string, error: string, traceSessionId: string): void {
    this.broadcast(userId, {
      type: 'delegation_error',
      timestamp: Date.now(),
      data: {
        agentId,
        error,
        status: 'error',
        traceSessionId,
      },
    });
  }

  /**
   * Notify token usage update
   */
  async notifyTokenUpdate(userId: string, agentId: string): Promise<void> {
    try {
      const context = await prisma.agentContext.findFirst({
        where: { userId, agentId },
      });

      if (!context) return;

      this.broadcast(userId, {
        type: 'token_update',
        timestamp: Date.now(),
        data: {
          agentId,
          tokenUsage: {
            used: context.totalTokens,
            limit: context.tokenLimit,
            percentage: (context.totalTokens / context.tokenLimit) * 100,
          },
        },
      });
    } catch (error) {
      console.error('[ActivityService] Failed to fetch token usage:', error);
    }
  }

  /**
   * Get active clients count
   */
  getActiveClientsCount(): number {
    return this.clients.size;
  }
}

export const activityService = new ActivityService();
