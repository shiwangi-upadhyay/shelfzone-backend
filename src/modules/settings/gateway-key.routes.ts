import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/index.js';
import { 
  createGatewayKeyHandler, 
  getGatewayKeyHandler,
  regenerateGatewayKeyHandler,
  testGatewayKeyHandler,
} from './gateway-key.controller.js';

export default async function gatewayKeyRoutes(app: FastifyInstance) {
  // Create new gateway key
  app.post(
    '/api/settings/gateway-key', 
    { preHandler: [authenticate] }, 
    createGatewayKeyHandler
  );

  // Get gateway key status (masked)
  app.get(
    '/api/settings/gateway-key', 
    { preHandler: [authenticate] }, 
    getGatewayKeyHandler
  );

  // Regenerate gateway key
  app.post(
    '/api/settings/gateway-key/regenerate', 
    { preHandler: [authenticate] }, 
    regenerateGatewayKeyHandler
  );

  // Test gateway connection
  app.post(
    '/api/settings/gateway-key/test', 
    { preHandler: [authenticate] }, 
    testGatewayKeyHandler
  );
}
