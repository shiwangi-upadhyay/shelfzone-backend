import { FastifyInstance } from 'fastify';
import { TabsService } from './tabs.service.js';
import { createTabSchema, updateTabSchema, tabIdParamSchema } from './tabs.schemas.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { prisma } from '../../lib/prisma.js';

const tabsService = new TabsService(prisma);

export async function tabsRoutes(app: FastifyInstance) {
  // Get all tabs for current user
  app.get(
    '/tabs',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const tabs = await tabsService.getUserTabs(userId);
      return reply.send({ data: tabs });
    }
  );

  // Create new tab
  app.post(
    '/tabs',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      
      // Validate body
      const bodyValidation = createTabSchema.safeParse(request.body);
      if (!bodyValidation.success) {
        return reply.code(400).send({ 
          error: 'Validation Error',
          message: bodyValidation.error.issues.map((e) => e.message).join(', ')
        });
      }
      
      const input = bodyValidation.data;

      try {
        const tab = await tabsService.createTab(userId, input);
        return reply.code(201).send({ data: tab });
      } catch (error: any) {
        if (error.message === 'Maximum 5 tabs allowed per user') {
          return reply.code(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Update tab
  app.patch(
    '/tabs/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      
      // Validate params
      const paramsValidation = tabIdParamSchema.safeParse(request.params);
      if (!paramsValidation.success) {
        return reply.code(400).send({ 
          error: 'Validation Error',
          message: paramsValidation.error.issues.map((e) => e.message).join(', ')
        });
      }
      
      const { id } = paramsValidation.data;
      
      // Validate body
      const bodyValidation = updateTabSchema.safeParse(request.body);
      if (!bodyValidation.success) {
        return reply.code(400).send({ 
          error: 'Validation Error',
          message: bodyValidation.error.issues.map((e) => e.message).join(', ')
        });
      }
      
      const input = bodyValidation.data;

      try {
        const tab = await tabsService.updateTab(userId, id, input);
        return reply.send({ data: tab });
      } catch (error: any) {
        if (error.message === 'Tab not found') {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Delete tab
  app.delete(
    '/tabs/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      
      // Debug logging
      console.log('[DELETE /tabs/:id] Request params:', request.params);
      console.log('[DELETE /tabs/:id] Param type:', typeof request.params);
      console.log('[DELETE /tabs/:id] ID value:', (request.params as any).id);
      
      // Validate params
      const paramsValidation = tabIdParamSchema.safeParse(request.params);
      if (!paramsValidation.success) {
        console.error('[DELETE /tabs/:id] Validation failed:', paramsValidation.error);
        console.error('[DELETE /tabs/:id] Validation issues:', JSON.stringify(paramsValidation.error.issues, null, 2));
        return reply.code(400).send({ 
          error: 'Validation Error',
          message: paramsValidation.error.issues.map((e) => e.message).join(', '),
          details: paramsValidation.error.issues, // Add detailed error info
        });
      }
      
      console.log('[DELETE /tabs/:id] Validation passed, ID:', paramsValidation.data.id);
      const { id } = paramsValidation.data;

      try {
        const result = await tabsService.deleteTab(userId, id);
        return reply.send({ data: result });
      } catch (error: any) {
        if (error.message === 'Tab not found') {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Get active tab
  app.get(
    '/tabs/active',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const tab = await tabsService.getActiveTab(userId);
      return reply.send({ data: tab });
    }
  );
}
