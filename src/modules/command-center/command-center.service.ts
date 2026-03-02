import { prisma } from '../../lib/prisma.js';
import { getUserDecryptedKey } from '../api-keys/api-key.service.js';
import { Prisma } from '@prisma/client';

// Cost rates per million tokens
const COST_RATES: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 0.8, output: 4 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number) {
  const safeInputTokens = Math.max(0, inputTokens || 0);
  const safeOutputTokens = Math.max(0, outputTokens || 0);

  // Find matching rate by checking if model contains the key
  const rateKey = Object.keys(COST_RATES).find((k) => model.includes(k)) || 'claude-sonnet-4-5';
  const rates = COST_RATES[rateKey];
  const inputCost = (safeInputTokens / 1_000_000) * rates.input;
  const outputCost = (safeOutputTokens / 1_000_000) * rates.output;
  const totalCost = inputCost + outputCost;

  return {
    inputCost: Math.max(0, inputCost),
    outputCost: Math.max(0, outputCost),
    totalCost: Math.max(0, totalCost),
  };
}

interface StreamResult {
  body: ReadableStream<Uint8Array>;
  traceSessionId: string;
  taskTraceId: string;
  conversationId: string;
  agentModel: string;
  startedAt: Date;
}

export async function streamMessage(
  userId: string,
  agentId: string,
  conversationId: string | null | undefined,
  message: string,
): Promise<StreamResult> {
  // 1. Get user's Anthropic API key
  const apiKey = await getUserDecryptedKey(userId);
  if (!apiKey) {
    throw { statusCode: 403, error: 'Forbidden', message: 'No Anthropic API key configured. Please add your API key first.' };
  }

  // 2. Load agent config
  const agent = await prisma.agentRegistry.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      name: true,
      model: true,
      systemPrompt: true,
      temperature: true,
      maxTokens: true,
      status: true,
    },
  });

  if (!agent) {
    throw { statusCode: 404, error: 'Not Found', message: `Agent with ID ${agentId} not found` };
  }

  if (agent.status !== 'ACTIVE') {
    throw { statusCode: 400, error: 'Bad Request', message: `Agent ${agent.name} is not active (status: ${agent.status})` };
  }

  // 3. Get or create conversation (linked to active tab)
  // First, get the active tab for this user
  const activeTab = await prisma.conversationTab.findFirst({
    where: { userId, isActive: true },
  });

  // If conversationId is provided, use it; otherwise find/create for this agent+tab
  let conversation;
  if (conversationId) {
    conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) {
      throw { statusCode: 404, error: 'Not Found', message: 'Conversation not found' };
    }
  } else {
    // Find conversation for this agent in the active tab
    conversation = await prisma.conversation.findFirst({
      where: {
        userId,
        agentId,
        tabId: activeTab?.id || null,
      },
    });

    if (!conversation) {
      // Auto-generate title from first user message (max 50 chars)
      const title = message.length > 50 ? message.substring(0, 50) + '...' : message;
      conversation = await prisma.conversation.create({
        data: {
          userId,
          agentId,
          tabId: activeTab?.id || null,
          title,
        },
      });
    }
  }

  // 4. Load conversation history (last 10 messages)
  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      role: true,
      content: true,
    },
  });

  // Reverse to get chronological order (oldest first)
  const messages: Array<{ role: string; content: string }> = history.reverse();

  // 5. Save user message to database BEFORE API call
  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: message,
    },
  });

  // Add current user message to context
  messages.push({ role: 'user', content: message });

  // Build request body
  const requestBody: any = {
    model: agent.model,
    max_tokens: agent.maxTokens,
    temperature: agent.temperature,
    messages,
    stream: true, // ← Enable streaming
  };

  // Add system prompt if provided
  if (agent.systemPrompt) {
    requestBody.system = agent.systemPrompt;
  }

  const startedAt = new Date();

  // 4. Create trace records
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
      modelUsed: agent.model,
      sessionType: 'command-center',
      startedAt,
    },
  });

  // 5. Call Anthropic API with streaming
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });

  if (!anthropicRes.ok || !anthropicRes.body) {
    const errorBody = await anthropicRes.text();
    
    // Log failure
    const completedAt = new Date();
    await prisma.traceSession.update({
      where: { id: traceSession.id },
      data: {
        status: 'failed',
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    });
    await prisma.taskTrace.update({
      where: { id: taskTrace.id },
      data: {
        status: 'failed',
        completedAt,
      },
    });

    throw {
      statusCode: anthropicRes.status,
      error: 'API Error',
      message: errorBody || 'Failed to call Anthropic API',
    };
  }

  // Return the body directly - let controller handle streaming
  return {
    body: anthropicRes.body,
    traceSessionId: traceSession.id,
    taskTraceId: taskTrace.id,
    conversationId: conversation.id,
    agentModel: agent.model,
    startedAt,
  };
}

// Helper functions for controller to use
export { calculateCost };
