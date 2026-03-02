import { FastifyRequest, FastifyReply } from 'fastify';
import { sendMessageSchema } from './command-center.schemas.js';
import { DelegationService } from './delegation.service.js';
import { getUserDecryptedKey } from '../api-keys/api-key.service.js';
import { getToolsForAgent } from './delegation-tools.js';
import { MASTER_AGENT_CONFIG } from './agents-config.js';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

const COST_RATES: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 0.8, output: 4 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number) {
  const safeInputTokens = Math.max(0, inputTokens || 0);
  const safeOutputTokens = Math.max(0, outputTokens || 0);
  const rateKey = Object.keys(COST_RATES).find((k) => model.includes(k)) || 'claude-sonnet-4-5';
  const rates = COST_RATES[rateKey];
  const inputCost = (safeInputTokens / 1_000_000) * rates.input;
  const outputCost = (safeOutputTokens / 1_000_000) * rates.output;
  const totalCost = inputCost + outputCost;
  return { inputCost: Math.max(0, inputCost), outputCost: Math.max(0, outputCost), totalCost: Math.max(0, totalCost) };
}

/**
 * Handle message with delegation support
 * Uses multi-turn conversation to handle tool_use
 */
export async function handleDelegationMessage(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const validation = sendMessageSchema.safeParse(request.body);
  if (!validation.success) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: validation.error.issues.map((e: any) => e.message).join(', '),
    });
  }

  const { agentId, conversationId, message } = validation.data;
  const userId = request.user!.userId;

  try {
    // Get API key
    const apiKey = await getUserDecryptedKey(userId);
    if (!apiKey) {
      return reply.status(403).send({ error: 'No API key configured' });
    }

    // Load SHIWANGI agent
    const agent = await prisma.agentRegistry.findFirst({
      where: { name: 'SHIWANGI' },
    });

    if (!agent) {
      return reply.status(404).send({ error: 'SHIWANGI agent not found' });
    }

    // Get or create conversation
    const activeTab = await prisma.conversationTab.findFirst({
      where: { userId, isActive: true },
    });

    let conversation = await prisma.conversation.findFirst({
      where: { userId, agentId: agent.id, tabId: activeTab?.id || null },
    });

    if (!conversation) {
      const title = message.length > 50 ? message.substring(0, 50) + '...' : message;
      conversation = await prisma.conversation.create({
        data: { userId, agentId: agent.id, tabId: activeTab?.id || null, title },
      });
    }

    // Load conversation history
    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { role: true, content: true },
    });

    // Save user message
    await prisma.message.create({
      data: { conversationId: conversation.id, role: 'user', content: message },
    });

    // Build messages array
    const messages: any[] = history.reverse().map((m) => ({ role: m.role, content: m.content }));
    messages.push({ role: 'user', content: message });

    // Create trace records
    const startedAt = new Date();
    const taskTrace = await prisma.taskTrace.create({
      data: {
        ownerId: userId,
        masterAgentId: agent.id,
        instruction: message,
        status: 'running',
        startedAt,
      },
    });

    const traceSession = await prisma.traceSession.create({
      data: {
        taskTraceId: taskTrace.id,
        agentId: agent.id,
        instruction: message,
        status: 'running',
        modelUsed: MASTER_AGENT_CONFIG.model,
        sessionType: 'command-center-delegation',
        startedAt,
      },
    });

    // STEP 1: Call SHIWANGI with tools
    const requestBody: any = {
      model: MASTER_AGENT_CONFIG.model,
      max_tokens: MASTER_AGENT_CONFIG.maxTokens,
      temperature: MASTER_AGENT_CONFIG.temperature,
      system: MASTER_AGENT_CONFIG.systemPrompt,
      messages,
      tools: getToolsForAgent('SHIWANGI'),
    };

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!anthropicRes.ok) {
      return reply.status(500).send({ error: 'Anthropic API error' });
    }

    const response = await anthropicRes.json();

    // STEP 2: Check for tool_use
    const toolUses = response.content?.filter((block: any) => block.type === 'tool_use') || [];

    if (toolUses.length > 0) {
      // Handle delegations
      const delegationService = new DelegationService(apiKey, userId, traceSession.id);
      const toolResults = [];

      for (const toolUse of toolUses) {
        if (toolUse.name === 'delegate') {
          const { agentName, instruction, reason } = toolUse.input;

          // Execute delegation
          const delegationResult = await delegationService.delegateToAgent(agentName, instruction, reason);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: delegationResult.result,
          });
        }
      }

      // STEP 3: Send tool_results back to SHIWANGI
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      const followUpBody = {
        model: MASTER_AGENT_CONFIG.model,
        max_tokens: MASTER_AGENT_CONFIG.maxTokens,
        temperature: MASTER_AGENT_CONFIG.temperature,
        system: MASTER_AGENT_CONFIG.systemPrompt,
        messages,
      };

      const followUpRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(followUpBody),
      });

      const finalResponse = await followUpRes.json();
      const finalText = finalResponse.content?.find((b: any) => b.type === 'text')?.text || '';

      // Save assistant response
      await prisma.message.create({
        data: { conversationId: conversation.id, role: 'assistant', content: finalText, traceSessionId: traceSession.id },
      });

      // Update trace
      const completedAt = new Date();
      await prisma.traceSession.update({
        where: { id: traceSession.id },
        data: { status: 'success', completedAt, durationMs: completedAt.getTime() - startedAt.getTime() },
      });

      return reply.send({ data: { message: finalText, delegations: toolUses.map((t: any) => t.input) } });
    } else {
      // No delegation - simple response
      const text = response.content?.find((b: any) => b.type === 'text')?.text || '';

      await prisma.message.create({
        data: { conversationId: conversation.id, role: 'assistant', content: text, traceSessionId: traceSession.id },
      });

      const completedAt = new Date();
      await prisma.traceSession.update({
        where: { id: traceSession.id },
        data: { status: 'success', completedAt, durationMs: completedAt.getTime() - startedAt.getTime() },
      });

      return reply.send({ data: { message: text } });
    }
  } catch (error: any) {
    return reply.status(500).send({ error: error.message || 'Internal server error' });
  }
}
