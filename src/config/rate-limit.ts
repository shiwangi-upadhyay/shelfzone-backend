import type { RateLimitPluginOptions } from '@fastify/rate-limit';

export const globalRateLimitConfig: RateLimitPluginOptions = {
  max: 100,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
  }),
};

export const loginRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
    },
  },
};

export const registerRateLimit = {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 minute',
    },
  },
};
