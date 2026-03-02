import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { activityService } from '../../../src/modules/command-center/activity.service.js';
import type { FastifyReply } from 'fastify';

describe('ActivityService', () => {
  let mockReply: Partial<FastifyReply>;
  let writtenData: string[] = [];

  beforeEach(() => {
    writtenData = [];
    mockReply = {
      raw: {
        writeHead: jest.fn(),
        write: jest.fn((data: string) => {
          writtenData.push(data);
          return true;
        }),
        on: jest.fn(),
      } as any,
    };
  });

  afterEach(() => {
    // Clean up any registered clients
    jest.clearAllMocks();
  });

  describe('registerClient', () => {
    it('should register a new SSE client', () => {
      const userId = 'user-123';
      activityService.registerClient(userId, mockReply as FastifyReply);

      expect(mockReply.raw?.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      });
    });

    it('should send initial connection event', () => {
      const userId = 'user-123';
      activityService.registerClient(userId, mockReply as FastifyReply);

      expect(writtenData.length).toBeGreaterThan(0);
      const lastEvent = writtenData[writtenData.length - 1];
      expect(lastEvent).toContain('data: ');
      
      const eventData = JSON.parse(lastEvent.replace('data: ', '').trim());
      expect(eventData.type).toBe('agent_switch');
      expect(eventData.data.status).toBe('connected');
    });
  });

  describe('notifyDelegationStart', () => {
    it('should broadcast delegation start event to user', () => {
      const userId = 'user-123';
      activityService.registerClient(userId, mockReply as FastifyReply);
      writtenData = []; // Clear connection event

      activityService.notifyDelegationStart(
        userId,
        'agent-456',
        'BackendForge',
        'Build API endpoint',
        'trace-789'
      );

      expect(writtenData.length).toBe(1);
      const event = JSON.parse(writtenData[0].replace('data: ', '').trim());
      
      expect(event.type).toBe('delegation_start');
      expect(event.data.agentId).toBe('agent-456');
      expect(event.data.agentName).toBe('BackendForge');
      expect(event.data.task).toBe('Build API endpoint');
      expect(event.data.status).toBe('started');
      expect(event.data.traceSessionId).toBe('trace-789');
    });
  });

  describe('notifyDelegationComplete', () => {
    it('should broadcast delegation complete event', () => {
      const userId = 'user-123';
      activityService.registerClient(userId, mockReply as FastifyReply);
      writtenData = [];

      activityService.notifyDelegationComplete(userId, 'agent-456', 'trace-789');

      expect(writtenData.length).toBe(1);
      const event = JSON.parse(writtenData[0].replace('data: ', '').trim());
      
      expect(event.type).toBe('delegation_complete');
      expect(event.data.agentId).toBe('agent-456');
      expect(event.data.status).toBe('completed');
      expect(event.data.traceSessionId).toBe('trace-789');
    });
  });

  describe('notifyDelegationError', () => {
    it('should broadcast delegation error event', () => {
      const userId = 'user-123';
      activityService.registerClient(userId, mockReply as FastifyReply);
      writtenData = [];

      activityService.notifyDelegationError(
        userId,
        'agent-456',
        'API rate limit exceeded',
        'trace-789'
      );

      expect(writtenData.length).toBe(1);
      const event = JSON.parse(writtenData[0].replace('data: ', '').trim());
      
      expect(event.type).toBe('delegation_error');
      expect(event.data.agentId).toBe('agent-456');
      expect(event.data.error).toBe('API rate limit exceeded');
      expect(event.data.status).toBe('error');
      expect(event.data.traceSessionId).toBe('trace-789');
    });
  });

  describe('getActiveClientsCount', () => {
    it('should return 0 when no clients connected', () => {
      expect(activityService.getActiveClientsCount()).toBe(0);
    });

    it('should return correct count of connected clients', () => {
      activityService.registerClient('user-1', mockReply as FastifyReply);
      expect(activityService.getActiveClientsCount()).toBeGreaterThan(0);
    });
  });
});
