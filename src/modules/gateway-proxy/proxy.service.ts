import prisma from '../../lib/prisma.js';
import { getModelPricing, calculateCost } from './pricing.service.js';
import { Prisma } from '@prisma/client';

interface ProxyResult {
  traceSessionId: string;
  taskTraceId: string;
  response: any;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number };
  cost: number;
}

/**
 * Proxy a chat request to Anthropic, auto-log everything.
 */
export async function proxyChatRequest(
  apiKey: string,
  requestBody: any,
  meta: {
    userId: string;
    agentName?: string;
    taskDescription?: string;
    parentSessionId?: string;
    sessionType?: string;
  },
): Promise<ProxyResult> {
  const model = requestBody.model || 'claude-sonnet-4-20250514';
  const startedAt = new Date();

  // Resolve or create agent
  const agentName = meta.agentName || 'Unknown';
  let agent = await prisma.agentRegistry.findUnique({ where: { name: agentName } });
  if (!agent) {
    const slug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    agent = await prisma.agentRegistry.create({
      data: {
        name: agentName,
        slug: `${slug}-${Date.now()}`,
        type: 'WORKFLOW',
        status: 'ACTIVE',
        model,
        createdBy: meta.userId,
        description: `Auto-registered via gateway proxy`,
      },
    });
  }

  // Create TaskTrace
  const taskTrace = await prisma.taskTrace.create({
    data: {
      ownerId: meta.userId,
      masterAgentId: agent.id,
      instruction: meta.taskDescription || `Gateway proxy: ${model}`,
      status: 'running',
      startedAt,
    },
  });

  // Create TraceSession
  const traceSession = await prisma.traceSession.create({
    data: {
      taskTraceId: taskTrace.id,
      agentId: agent.id,
      parentSessionId: meta.parentSessionId || null,
      instruction: meta.taskDescription || `Gateway proxy call`,
      status: 'running',
      modelUsed: model,
      sessionType: meta.sessionType || 'gateway',
      startedAt,
    },
  });

  // Forward to Anthropic
  let response: any;
  let usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  let status = 'success';

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    response = await anthropicRes.json();

    if (!anthropicRes.ok) {
      status = 'failed';
    } else {
      // Extract usage from Anthropic response
      usage.inputTokens = response.usage?.input_tokens || 0;
      usage.outputTokens = response.usage?.output_tokens || 0;
      usage.cacheReadTokens = response.usage?.cache_read_input_tokens || 0;
      usage.cacheCreationTokens = response.usage?.cache_creation_input_tokens || 0;
    }
  } catch (err: any) {
    status = 'failed';
    response = { error: { type: 'proxy_error', message: err.message } };
  }

  // Calculate cost
  const pricing = await getModelPricing(model);
  const cost = calculateCost(pricing, usage.inputTokens, usage.outputTokens, usage.cacheReadTokens, usage.cacheCreationTokens);

  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();

  // Update trace records
  await prisma.traceSession.update({
    where: { id: traceSession.id },
    data: {
      status,
      cost: new Prisma.Decimal(cost.toFixed(4)),
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens,
      durationMs,
      completedAt,
    },
  });

  await prisma.taskTrace.update({
    where: { id: taskTrace.id },
    data: {
      status: status === 'success' ? 'completed' : 'failed',
      totalCost: new Prisma.Decimal(cost.toFixed(4)),
      totalTokens: usage.inputTokens + usage.outputTokens,
      agentsUsed: 1,
      completedAt,
    },
  });

  return {
    traceSessionId: traceSession.id,
    taskTraceId: taskTrace.id,
    response,
    usage,
    cost,
  };
}

/**
 * Proxy a streaming chat request — returns the Anthropic response stream
 * and logs usage after stream completes.
 */
export async function proxyStreamRequest(
  apiKey: string,
  requestBody: any,
  meta: {
    userId: string;
    agentName?: string;
    taskDescription?: string;
    parentSessionId?: string;
    sessionType?: string;
  },
): Promise<{ stream: ReadableStream<Uint8Array>; traceSessionId: string; taskTraceId: string }> {
  const model = requestBody.model || 'claude-sonnet-4-20250514';
  const startedAt = new Date();

  // Resolve agent
  const agentName = meta.agentName || 'Unknown';
  let agent = await prisma.agentRegistry.findUnique({ where: { name: agentName } });
  if (!agent) {
    const slug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    agent = await prisma.agentRegistry.create({
      data: {
        name: agentName,
        slug: `${slug}-${Date.now()}`,
        type: 'WORKFLOW',
        status: 'ACTIVE',
        model,
        createdBy: meta.userId,
        description: `Auto-registered via gateway proxy`,
      },
    });
  }

  // Create traces
  const taskTrace = await prisma.taskTrace.create({
    data: {
      ownerId: meta.userId,
      masterAgentId: agent.id,
      instruction: meta.taskDescription || `Gateway stream: ${model}`,
      status: 'running',
      startedAt,
    },
  });

  const traceSession = await prisma.traceSession.create({
    data: {
      taskTraceId: taskTrace.id,
      agentId: agent.id,
      parentSessionId: meta.parentSessionId || null,
      instruction: meta.taskDescription || `Gateway stream call`,
      status: 'running',
      modelUsed: model,
      sessionType: meta.sessionType || 'gateway',
      startedAt,
    },
  });

  // Forward to Anthropic with stream: true
  const body = { ...requestBody, stream: true };
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!anthropicRes.ok || !anthropicRes.body) {
    const errorBody = await anthropicRes.text();
    // Log failure
    const completedAt = new Date();
    await prisma.traceSession.update({
      where: { id: traceSession.id },
      data: { status: 'failed', completedAt, durationMs: completedAt.getTime() - startedAt.getTime() },
    });
    await prisma.taskTrace.update({
      where: { id: taskTrace.id },
      data: { status: 'failed', completedAt },
    });
    throw Object.assign(new Error(errorBody), { statusCode: anthropicRes.status });
  }

  // Create a transform stream that passes through SSE data and captures usage from message_delta
  const reader = anthropicRes.body.getReader();
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        // Stream done — log final usage
        const pricing = await getModelPricing(model);
        const cost = calculateCost(pricing, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens);
        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();

        await prisma.traceSession.update({
          where: { id: traceSession.id },
          data: {
            status: 'success',
            cost: new Prisma.Decimal(cost.toFixed(4)),
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
            totalCost: new Prisma.Decimal(cost.toFixed(4)),
            totalTokens: inputTokens + outputTokens,
            agentsUsed: 1,
            completedAt,
          },
        });
        return;
      }

      // Pass through to client
      controller.enqueue(value);

      // Parse SSE chunks for usage data
      const text = new TextDecoder().decode(value);
      const lines = text.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const evt = JSON.parse(jsonStr);
          if (evt.type === 'message_start' && evt.message?.usage) {
            inputTokens = evt.message.usage.input_tokens || 0;
            cacheReadTokens = evt.message.usage.cache_read_input_tokens || 0;
            cacheCreationTokens = evt.message.usage.cache_creation_input_tokens || 0;
          }
          if (evt.type === 'message_delta' && evt.usage) {
            outputTokens = evt.usage.output_tokens || 0;
          }
        } catch { /* not JSON, skip */ }
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return { stream, traceSessionId: traceSession.id, taskTraceId: taskTrace.id };
}
