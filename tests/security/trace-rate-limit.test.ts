import {
  acquireSSESlot,
  releaseSSESlot,
  traceListingLimit,
  eventCreationLimit,
  _resetForTesting,
} from '../../src/middleware/trace-rate-limit.js';

beforeEach(() => {
  _resetForTesting();
});

describe('SSE concurrent connections', () => {
  it('allows up to 5 concurrent SSE connections per user', () => {
    for (let i = 0; i < 5; i++) {
      expect(acquireSSESlot('user1')).toBe(true);
    }
    expect(acquireSSESlot('user1')).toBe(false);
  });

  it('releases slots correctly', () => {
    for (let i = 0; i < 5; i++) acquireSSESlot('user1');
    releaseSSESlot('user1');
    expect(acquireSSESlot('user1')).toBe(true);
  });

  it('tracks users independently', () => {
    for (let i = 0; i < 5; i++) acquireSSESlot('user1');
    expect(acquireSSESlot('user2')).toBe(true);
  });
});

describe('trace listing rate limit', () => {
  it('allows 30 requests per minute', () => {
    for (let i = 0; i < 30; i++) {
      expect(traceListingLimit('user1')).toBe(true);
    }
    expect(traceListingLimit('user1')).toBe(false);
  });
});

describe('event creation rate limit', () => {
  it('allows 100 events per minute per session', () => {
    for (let i = 0; i < 100; i++) {
      expect(eventCreationLimit('session1')).toBe(true);
    }
    expect(eventCreationLimit('session1')).toBe(false);
  });
});
