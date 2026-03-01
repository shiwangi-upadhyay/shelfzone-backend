import { prisma } from '../../lib/prisma.js';
import { getUserDecryptedKey } from '../api-keys/api-key.service.js';

// Cost rates per million tokens
const COST_RATES: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 0.8, output: 4 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number) {
  // Validate inputs - must be >= 0
  const safeInputTokens = Math.max(0, inputTokens || 0);
  const safeOutputTokens = Math.max(0, outputTokens || 0);

  // Find matching rate by checking if model contains the key
  const rateKey = Object.keys(COST_RATES).find((k) => model.includes(k)) || Object.keys(COST_RATES)[0];
  const rates = COST_RATES[rateKey] || COST_RATES['claude-sonnet-4-5'];
  const inputCost = (safeInputTokens / 1_000_000) * rates.input;
  const outputCost = (safeOutputTokens / 1_000_000) * rates.output;
  const totalCost = inputCost + outputCost;

  // Final safety check - cost must be >= 0
  return {
    inputCost: Math.max(0, inputCost),
    outputCost: Math.max(0, outputCost),
    totalCost: Math.max(0, totalCost),
  };
}

// Track active simulations so we can cancel them
const activeSimulations = new Map<string, NodeJS.Timeout[]>();

export async function createTraceWithSession(
  ownerId: string,
  instruction: string,
  masterAgentId?: string,
) {
  let agentId = masterAgentId;
  if (!agentId) {
    const agent = await prisma.agentRegistry.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    if (!agent) throw { statusCode: 400, error: 'Bad Request', message: 'No active agent found' };
    agentId = agent.id;
  }

  // Validate that the agent exists and is active
  const agent = await prisma.agentRegistry.findUnique({
    where: { id: agentId },
  });

  if (!agent) {
    throw { statusCode: 404, error: 'Not Found', message: `Agent with ID ${agentId} not found` };
  }

  if (agent.status !== 'ACTIVE') {
    throw { statusCode: 400, error: 'Bad Request', message: `Agent ${agent.name} is not active (status: ${agent.status})` };
  }

  const trace = await prisma.taskTrace.create({
    data: { ownerId, masterAgentId: agentId, instruction, status: 'running' },
  });

  const session = await prisma.traceSession.create({
    data: { taskTraceId: trace.id, agentId, instruction, status: 'running' },
  });

  return { traceId: trace.id, sessionId: session.id, agentId };
}

export async function executeRealAnthropicCall(
  traceId: string,
  sessionId: string,
  agentId: string,
  userId: string,
  instruction: string,
) {
  // Get user's API key
  const apiKey = await getUserDecryptedKey(userId);
  if (!apiKey) {
    await createErrorEvent(sessionId, agentId, 'Set your Anthropic API key in settings before using the Command Center');
    await completeTrace(traceId, sessionId, 'error');
    throw { statusCode: 403, error: 'API Key Required', message: 'Set your Anthropic API key in settings before using the Command Center' };
  }

  // Get agent config
  const agent = await prisma.agentRegistry.findUnique({ where: { id: agentId } });
  if (!agent) {
    await createErrorEvent(sessionId, agentId, 'Agent not found');
    await completeTrace(traceId, sessionId, 'error');
    throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };
  }

  // Create "thinking" event
  await prisma.sessionEvent.create({
    data: {
      sessionId,
      type: 'agent:thinking',
      content: 'Processing instruction with Anthropic API...',
      fromAgentId: agentId,
      tokenCount: 0,
      cost: 0,
      metadata: { model: agent.model },
    },
  });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: agent.model,
        max_tokens: agent.maxTokens,
        ...(agent.systemPrompt ? { system: agent.systemPrompt } : {}),
        messages: [{ role: 'user', content: instruction }],
        stream: true,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      let errMsg = `Anthropic API error: ${res.status}`;
      try {
        const parsed = JSON.parse(errBody);
        errMsg = parsed?.error?.message || errMsg;
      } catch {}
      await createErrorEvent(sessionId, agentId, errMsg);
      await completeTrace(traceId, sessionId, 'error');
      return;
    }

    // Parse SSE stream
    const reader = res.body?.getReader();
    if (!reader) {
      await createErrorEvent(sessionId, agentId, 'No response body from Anthropic');
      await completeTrace(traceId, sessionId, 'error');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      // Check if cancelled
      const trace = await prisma.taskTrace.findUnique({ where: { id: traceId } });
      if (trace?.status === 'cancelled') {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);

          if (event.type === 'message_start' && event.message?.usage) {
            inputTokens = event.message.usage.input_tokens || 0;
          }

          if (event.type === 'content_block_delta' && event.delta?.text) {
            fullResponse += event.delta.text;
          }

          if (event.type === 'message_delta') {
            if (event.usage?.output_tokens) outputTokens = event.usage.output_tokens;
          }
        } catch {}
      }
    }

    // Create message event with full response
    const costs = calculateCost(agent.model, inputTokens, outputTokens);

    if (fullResponse) {
      await prisma.sessionEvent.create({
        data: {
          sessionId,
          type: 'agent:message',
          content: fullResponse,
          fromAgentId: agentId,
          tokenCount: inputTokens + outputTokens,
          cost: costs.totalCost,
          metadata: {
            model: agent.model,
            inputTokens,
            outputTokens,
            inputCost: costs.inputCost,
            outputCost: costs.outputCost,
          },
        },
      });
    }

    // Completion event
    await prisma.sessionEvent.create({
      data: {
        sessionId,
        type: 'trace:completed',
        content: 'Task completed successfully',
        fromAgentId: agentId,
        tokenCount: 0,
        cost: 0,
        metadata: { totalCost: costs.totalCost, totalTokens: inputTokens + outputTokens },
      },
    });

    await prisma.traceSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        cost: costs.totalCost,
        tokensIn: inputTokens,
        tokensOut: outputTokens,
      },
    });

    await prisma.taskTrace.update({
      where: { id: traceId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        totalCost: costs.totalCost,
        totalTokens: inputTokens + outputTokens,
        agentsUsed: 1,
      },
    });
  } catch (err: any) {
    if (err?.statusCode) throw err; // Re-throw structured errors
    console.error('Anthropic API call failed:', err);
    await createErrorEvent(sessionId, agentId, err?.message || 'Unknown error');
    await completeTrace(traceId, sessionId, 'error');
  }
}

async function createErrorEvent(sessionId: string, agentId: string, message: string) {
  await prisma.sessionEvent.create({
    data: {
      sessionId,
      type: 'agent:error',
      content: message,
      fromAgentId: agentId,
      tokenCount: 0,
      cost: 0,
      metadata: {},
    },
  });
}

async function completeTrace(traceId: string, sessionId: string, status: string) {
  await prisma.traceSession.update({
    where: { id: sessionId },
    data: { status, completedAt: new Date() },
  });
  await prisma.taskTrace.update({
    where: { id: traceId },
    data: { status, completedAt: new Date() },
  });
}

// ─── Simulation (fallback) ───────────────────────────────────────

export async function simulateAgentWork(traceId: string, masterSessionId: string, masterAgentId: string) {
  const timeouts: NodeJS.Timeout[] = [];

  const schedule = (ms: number, fn: () => Promise<void>) => {
    const t = setTimeout(async () => {
      try {
        const trace = await prisma.taskTrace.findUnique({ where: { id: traceId } });
        if (!trace || trace.status === 'cancelled') return;
        if (trace.status === 'paused') { schedule(2000, fn); return; }
        await fn();
      } catch (e) { console.error('Simulation error:', e); }
    }, ms);
    timeouts.push(t);
  };

  activeSimulations.set(traceId, timeouts);

  schedule(200, async () => {
    await prisma.sessionEvent.create({ data: { sessionId: masterSessionId, type: 'trace:started', content: 'Task trace initiated', fromAgentId: masterAgentId, tokenCount: 0, cost: 0, metadata: {} } });
  });

  schedule(1000, async () => {
    await prisma.sessionEvent.create({ data: { sessionId: masterSessionId, type: 'agent:thinking', content: 'Analyzing instruction and planning execution strategy...', fromAgentId: masterAgentId, tokenCount: 245, cost: 0.0037, durationMs: 820, metadata: { model: 'claude-opus-4-6' } } });
  });

  schedule(2000, async () => {
    const subAgents = await prisma.agentRegistry.findMany({ where: { status: 'ACTIVE', id: { not: masterAgentId } }, take: 3 });
    for (const sub of subAgents) {
      await prisma.sessionEvent.create({ data: { sessionId: masterSessionId, type: 'agent:delegation', content: `Delegating sub-task to ${sub.name}`, fromAgentId: masterAgentId, toAgentId: sub.id, tokenCount: 180, cost: 0.0027, metadata: { delegatedAgent: sub.name, subTask: `Handle ${sub.type.toLowerCase()} operations` } } });
      const subSession = await prisma.traceSession.create({ data: { taskTraceId: traceId, agentId: sub.id, parentSessionId: masterSessionId, delegatedBy: masterAgentId, instruction: `Sub-task for ${sub.name}`, status: 'running' } });
      schedule(3000 + Math.random() * 1000, async () => { await prisma.sessionEvent.create({ data: { sessionId: subSession.id, type: 'agent:thinking', content: `${sub.name} analyzing delegated task...`, fromAgentId: sub.id, tokenCount: 320, cost: 0.0048, durationMs: 650, metadata: { model: 'claude-opus-4-6' } } }); });
      schedule(4000 + Math.random() * 1000, async () => { await prisma.sessionEvent.create({ data: { sessionId: subSession.id, type: 'agent:tool_call', content: 'Executing database query', fromAgentId: sub.id, tokenCount: 150, cost: 0.0023, durationMs: 340, metadata: { tool: 'prisma_query', args: { table: 'employees' } } } }); });
      schedule(5500 + Math.random() * 1000, async () => { await prisma.sessionEvent.create({ data: { sessionId: subSession.id, type: 'agent:tool_result', content: 'Query returned 42 records', fromAgentId: sub.id, tokenCount: 85, cost: 0.0013, durationMs: 120, metadata: { tool: 'prisma_query', resultSize: 42 } } }); });
      schedule(6500 + Math.random() * 1500, async () => {
        await prisma.sessionEvent.create({ data: { sessionId: subSession.id, type: 'agent:completion', content: `${sub.name} completed sub-task successfully`, fromAgentId: sub.id, tokenCount: 210, cost: 0.0032, durationMs: 450, metadata: { status: 'success' } } });
        await prisma.traceSession.update({ where: { id: subSession.id }, data: { status: 'completed', completedAt: new Date(), cost: 0.0143, tokensIn: 520, tokensOut: 295 } });
      });
    }
    await prisma.taskTrace.update({ where: { id: traceId }, data: { agentsUsed: subAgents.length + 1 } });
  });

  schedule(7500, async () => { await prisma.sessionEvent.create({ data: { sessionId: masterSessionId, type: 'cost:update', content: 'Running cost update', fromAgentId: masterAgentId, tokenCount: 0, cost: 0, metadata: { totalCost: 0.0389, totalTokens: 1845 } } }); });
  schedule(8000, async () => { await prisma.sessionEvent.create({ data: { sessionId: masterSessionId, type: 'agent:message', content: 'All sub-agents have completed their tasks. Compiling final results...', fromAgentId: masterAgentId, tokenCount: 185, cost: 0.0028, durationMs: 380, metadata: {} } }); });
  schedule(9000, async () => {
    await prisma.sessionEvent.create({ data: { sessionId: masterSessionId, type: 'trace:completed', content: 'Task completed successfully', fromAgentId: masterAgentId, tokenCount: 95, cost: 0.0014, metadata: { totalCost: 0.0452, totalTokens: 2130, duration: 9000 } } });
    await prisma.traceSession.update({ where: { id: masterSessionId }, data: { status: 'completed', completedAt: new Date(), cost: 0.0452, tokensIn: 1280, tokensOut: 850 } });
    await prisma.taskTrace.update({ where: { id: traceId }, data: { status: 'completed', completedAt: new Date(), totalCost: 0.0452, totalTokens: 2130 } });
    activeSimulations.delete(traceId);
  });
}

// ─── Trace management ────────────────────────────────────────────

export async function cancelTrace(traceId: string, ownerId: string) {
  const trace = await prisma.taskTrace.findFirst({ where: { id: traceId, ownerId } });
  if (!trace) throw { statusCode: 404, error: 'Not Found', message: 'Trace not found' };
  if (trace.status === 'completed' || trace.status === 'cancelled')
    throw { statusCode: 400, error: 'Bad Request', message: `Trace is already ${trace.status}` };

  const timers = activeSimulations.get(traceId);
  if (timers) { timers.forEach(clearTimeout); activeSimulations.delete(traceId); }

  await prisma.traceSession.updateMany({ where: { taskTraceId: traceId, status: 'running' }, data: { status: 'cancelled', completedAt: new Date() } });
  return prisma.taskTrace.update({ where: { id: traceId }, data: { status: 'cancelled', completedAt: new Date() } });
}

export async function pauseTrace(traceId: string, ownerId: string) {
  const trace = await prisma.taskTrace.findFirst({ where: { id: traceId, ownerId } });
  if (!trace) throw { statusCode: 404, error: 'Not Found', message: 'Trace not found' };
  if (trace.status !== 'running') throw { statusCode: 400, error: 'Bad Request', message: 'Can only pause running traces' };
  return prisma.taskTrace.update({ where: { id: traceId }, data: { status: 'paused' } });
}

export async function resumeTrace(traceId: string, ownerId: string) {
  const trace = await prisma.taskTrace.findFirst({ where: { id: traceId, ownerId } });
  if (!trace) throw { statusCode: 404, error: 'Not Found', message: 'Trace not found' };
  if (trace.status !== 'paused') throw { statusCode: 400, error: 'Bad Request', message: 'Can only resume paused traces' };
  return prisma.taskTrace.update({ where: { id: traceId }, data: { status: 'running' } });
}

export async function getTraceStatus(traceId: string, ownerId: string) {
  const trace = await prisma.taskTrace.findFirst({
    where: { id: traceId, ownerId },
    include: {
      sessions: { include: { agent: { select: { id: true, name: true, type: true } }, events: { orderBy: { timestamp: 'asc' } } }, orderBy: { startedAt: 'asc' } },
      masterAgent: { select: { id: true, name: true, type: true } },
    },
  });
  if (!trace) throw { statusCode: 404, error: 'Not Found', message: 'Trace not found' };
  return trace;
}

export async function getSessionEventsAfter(traceId: string, afterTimestamp?: Date) {
  const sessions = await prisma.traceSession.findMany({ where: { taskTraceId: traceId }, select: { id: true } });
  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length === 0) return [];
  return prisma.sessionEvent.findMany({
    where: { sessionId: { in: sessionIds }, ...(afterTimestamp ? { timestamp: { gt: afterTimestamp } } : {}) },
    include: { fromAgent: { select: { id: true, name: true } }, toAgent: { select: { id: true, name: true } } },
    orderBy: { timestamp: 'asc' },
  });
}
