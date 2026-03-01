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

interface MessageResult {
  message: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  traceSessionId: string;
  taskTraceId: string;
}

export async function streamMessage(
  userId: string,
  agentId: string,
  conversationId: string | null | undefined,
  message: string,
): Promise<MessageResult> {
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

  // 3. Get or create conversation
  let conversation = await prisma.conversation.findUnique({
    where: {
      userId_agentId: {
        userId,
        agentId,
      },
    },
  });

  if (!conversation) {
    // Auto-generate title from first user message (max 50 chars)
    const title = message.length > 50 ? message.substring(0, 50) + '...' : message;
    conversation = await prisma.conversation.create({
      data: {
        userId,
        agentId,
        title,
      },
    });
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
    stream: false, // ← CHANGED FOR NON-STREAMING FALLBACK
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

  // 5. Call Anthropic API (non-streaming)
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

  // 6. Parse JSON response
  const responseData = await anthropicRes.json();

  // Extract text and usage
  const fullText = responseData.content[0]?.text || '';
  const inputTokens = responseData.usage.input_tokens || 0;
  const outputTokens = responseData.usage.output_tokens || 0;

  // Calculate cost
  const cost = calculateCost(agent.model, inputTokens, outputTokens);
  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();

  // Update trace records
  await prisma.traceSession.update({
    where: { id: traceSession.id },
    data: {
      status: 'success',
      cost: new Prisma.Decimal(cost.totalCost.toFixed(6)),
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      durationMs,
      completedAt,
    },
  });

  await prisma.taskTrace.update({
    where: { id: taskTrace.id },
    data: {
      status: 'completed',
      totalCost: new Prisma.Decimal(cost.totalCost.toFixed(6)),
      totalTokens: inputTokens + outputTokens,
      agentsUsed: 1,
      completedAt,
    },
  });

  // Save assistant response to database with link to trace session
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: fullText,
      tokenCount: outputTokens,
      cost: new Prisma.Decimal(cost.totalCost.toFixed(6)),
      traceSessionId: traceSession.id,
    },
  });

  // Return response as JSON (NOT SSE)
  return {
    message: fullText,
    inputTokens,
    outputTokens,
    totalCost: cost.totalCost,
    traceSessionId: traceSession.id,
    taskTraceId: taskTrace.id,
  };
}
