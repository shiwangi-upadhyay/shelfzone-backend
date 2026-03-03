/**
 * OpenClaw Gateway WebSocket Client (Simplified)
 * 
 * Connects as operator client without device pairing.
 * Uses gateway.controlUi.dangerouslyDisableDeviceAuth = true
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../lib/logger.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface OpenClawConfig {
  gateway: {
    auth: {
      token: string;
    };
    port?: number;
    host?: string;
  };
}

interface Agent {
  id: string;
  label?: string;
  model?: string;
  thinking?: string;
}

interface ConnectChallenge {
  nonce: string;
  ts: number;
}

export class OpenClawGatewayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private connected = false;
  private authenticated = false;
  private config: OpenClawConfig | null = null;
  private gatewayToken: string | null = null;
  private requestId = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;
  private challenge: ConnectChallenge | null = null;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      
      if (!this.gatewayToken) {
        throw new Error('Gateway token not found in OpenClaw config');
      }

      await this.connect();
      
      logger.info('🔗 OpenClaw Gateway Client initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize OpenClaw Gateway Client:', error);
      throw error;
    }
  }

  private async loadConfig(): Promise<void> {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(configData);
      this.gatewayToken = this.config?.gateway?.auth?.token || null;
      
      logger.info('✅ Loaded OpenClaw config');
    } catch (error) {
      logger.error('❌ Failed to load OpenClaw config:', error);
      throw new Error('OpenClaw config not found');
    }
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const host = this.config?.gateway?.host || 'localhost';
      const port = this.config?.gateway?.port || 18789;
      const wsUrl = `ws://${host}:${port}`;

      logger.info(`📡 Connecting to OpenClaw Gateway at ${wsUrl}`);

      this.ws = new WebSocket(wsUrl, {
        perMessageDeflate: false
      });

      this.ws.on('open', () => {
        logger.info('✅ WebSocket connected to OpenClaw Gateway');
        this.connected = true;
        this.reconnectAttempts = 0;
      });

      this.ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(message);
          
          if (this.authenticated && !this.ws) {
            resolve();
          }
        } catch (error) {
          logger.error('❌ Error processing message:', error);
        }
      });

      this.ws.on('error', (error) => {
        logger.error('❌ WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        logger.warn(`🔌 Connection closed: ${code} - ${reason.toString()}`);
        this.connected = false;
        this.authenticated = false;
        this.emit('disconnected');
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          logger.info(`🔄 Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.connect(), this.reconnectDelay);
        }
      });

      setTimeout(() => {
        if (!this.authenticated) {
          reject(new Error('Connection timeout - authentication not completed'));
        }
      }, 10000);
    });
  }

  private async handleMessage(message: any): Promise<void> {
    logger.debug('📨 Received:', message.type, message.event || message.method);

    switch (message.type) {
      case 'event':
        await this.handleEvent(message);
        break;
      
      case 'res':
        this.handleResponse(message);
        break;
    }
  }

  private async handleEvent(message: any): Promise<void> {
    const { event, payload } = message;

    switch (event) {
      case 'connect.challenge':
        this.challenge = payload;
        logger.info('🔐 Received connect challenge');
        await this.authenticate();
        break;
      
      case 'agent':
        this.emit('agent-event', payload);
        break;
      
      case 'presence':
        this.emit('presence', payload);
        break;
    }
  }

  private handleResponse(message: any): void {
    const { id, ok, payload, error } = message;
    const pending = this.pendingRequests.get(id);

    if (!pending) {
      logger.warn('⚠️ Response for unknown request:', id);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(id);

    if (ok) {
      pending.resolve(payload);
    } else {
      pending.reject(new Error(error?.message || 'Request failed'));
    }
  }

  private async authenticate(): Promise<void> {
    if (!this.challenge) {
      throw new Error('No challenge received');
    }

    const connectRequest = {
      type: 'req',
      id: this.generateRequestId(),
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'cli',
          version: '1.0.0',
          platform: 'linux',
          mode: 'cli'
        },
        role: 'operator',
        scopes: ['operator.read', 'operator.write', 'operator.admin'],
        caps: [],
        commands: [],
        permissions: {},
        auth: {
          token: this.gatewayToken
        },
        locale: 'en-US',
        userAgent: 'shelfzone-backend/1.0.0'
      }
    };

    logger.info('📤 Sending connect request');
    
    try {
      const response = await this.sendRequest('connect', connectRequest.params, connectRequest.id);
      
      if (response.type === 'hello-ok') {
        this.authenticated = true;
        logger.info('🎉 Authenticated with OpenClaw Gateway', { 
          protocol: response.protocol,
          auth: response.auth 
        });
        this.emit('authenticated');
      }
    } catch (error) {
      logger.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  private sendRequest(method: string, params: any, requestId?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        return reject(new Error('Not connected to gateway'));
      }

      const id = requestId || this.generateRequestId();
      const request = {
        type: 'req',
        id,
        method,
        params
      };

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.ws.send(JSON.stringify(request));
      logger.debug('📤 Sent request:', method, id);
    });
  }

  private generateRequestId(): string {
    return `req-${++this.requestId}`;
  }

  async getAgentList(): Promise<Agent[]> {
    if (!this.authenticated) {
      throw new Error('Not authenticated with gateway');
    }

    try {
      const response = await this.sendRequest('agents.list', {});
      
      const agents = (response.agents || []).map((agent: any) => ({
        id: agent.id,
        label: agent.name || agent.id,
        model: agent.model,
        thinking: agent.thinking
      }));
      
      logger.info(`✅ Loaded ${agents.length} agents from OpenClaw Gateway`);
      return agents;
    } catch (error) {
      logger.error('❌ Failed to get agent list:', error);
      throw error;
    }
  }

  async spawnAgent(agentId: string, task: string, mode: 'run' | 'session' = 'run'): Promise<any> {
    try {
      // Use OpenClaw CLI agent command for execution (works on same machine)
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      logger.info(`📤 Executing task via OpenClaw agent CLI: ${agentId}`);
      
      const command = `openclaw agent --agent ${agentId} --message "${task.replace(/"/g, '\\"')}" --json`;
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 300000, // 5 minutes
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });
      
      if (stderr && !stderr.includes('warn')) {
        logger.warn('⚠️ OpenClaw stderr:', stderr);
      }
      
      logger.info('✅ OpenClaw agent execution completed');
      
      // Parse JSON output
      let result;
      try {
        result = JSON.parse(stdout);
      } catch (e) {
        // If not JSON, return as plain text
        result = { response: stdout.trim() };
      }
      
      return {
        success: true,
        agentId,
        mode,
        result,
        message: 'Task executed successfully via OpenClaw agent CLI'
      };
    } catch (error: any) {
      logger.error('❌ Failed to execute task:', error);
      throw new Error(error.message || 'OpenClaw agent execution failed');
    }
  }

  async sendMessage(sessionKey: string, message: string): Promise<any> {
    if (!this.authenticated) {
      throw new Error('Not authenticated with gateway');
    }

    try {
      const response = await this.sendRequest('sessions.send', {
        sessionKey,
        message,
        timeoutSeconds: 300
      });

      return response;
    } catch (error) {
      logger.error('❌ Failed to send message:', error);
      throw error;
    }
  }

  async getSessionHistory(sessionKey: string, limit: number = 50): Promise<any> {
    if (!this.authenticated) {
      throw new Error('Not authenticated with gateway');
    }

    try {
      const response = await this.sendRequest('sessions.history', {
        sessionKey,
        limit
      });

      return response;
    } catch (error) {
      logger.error('❌ Failed to get session history:', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.connected && this.authenticated;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.authenticated = false;
  }
}

export const openclawGateway = new OpenClawGatewayClient();
