import { EventEmitter } from 'events';
import { BridgeEvent } from '@prisma/client';

/**
 * Singleton event emitter for bridge events
 * Connects WebSocket server to SSE streams
 */
class BridgeEventEmitter extends EventEmitter {
  private static instance: BridgeEventEmitter;

  private constructor() {
    super();
  }

  static getInstance(): BridgeEventEmitter {
    if (!this.instance) {
      this.instance = new BridgeEventEmitter();
    }
    return this.instance;
  }

  emitBridgeEvent(event: BridgeEvent): void {
    this.emit('bridge_event', event);
  }
}

export default BridgeEventEmitter;
