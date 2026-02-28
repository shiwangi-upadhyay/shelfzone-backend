import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/index.js';
import { setApiKeyHandler, getApiKeyHandler, deleteApiKeyHandler } from './api-key.controller.js';

export default async function userApiKeyRoutes(app: FastifyInstance) {
  app.post('/api/user/api-key', { preHandler: [authenticate] }, setApiKeyHandler);
  app.get('/api/user/api-key', { preHandler: [authenticate] }, getApiKeyHandler);
  app.delete('/api/user/api-key', { preHandler: [authenticate] }, deleteApiKeyHandler);
}
