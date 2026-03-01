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

export async function executeMultiAgent(
  ownerId: string,
  agentIds: string[],
  instruction: string,
  mode: 'parallel' | 'sequential' | 'delegate',
) {
  // Validate all agents exist and are active
  const agents = await prisma.agentRegistry.findMany({
    where: { id: { in: agentIds } },
  });

  if (agents.length !== agentIds.length) {
    const foundIds = agents.map(a => a.id);
    const missing = agentIds.filter(id => !foundIds.includes(id));
    throw { statusCode: 404, error: 'Not Found', message: `Agent(s) not found: ${missing.join(', ')}` };
  }

  const inactive = agents.filter(a => a.status !== 'ACTIVE');
  if (inactive.length > 0) {
    throw { statusCode: 400, error: 'Bad Request', message: `Inactive agent(s): ${inactive.map(a => a.name).join(', ')}` };
  }

  // Create master trace
  const masterAgentId = agentIds[0]; // First agent is master for tracking
  const trace = await prisma.taskTrace.create({
    data: {
      ownerId,
      masterAgentId,
      instruction,
      status: 'running',
      agentsUsed: agentIds.length,
    },
  });

  if (mode === 'delegate') {
    // Delegate mode: Send to first agent (should be master like SHIWANGI) and let them delegate
    const session = await prisma.traceSession.create({
      data: {
        taskTraceId: trace.id,
        agentId: masterAgentId,
        instruction,
        status: 'running',
      },
    });

    // Emit delegation event
    await prisma.sessionEvent.create({
      data: {
        sessionId: session.id,
        type: 'agent:decision',
        content: `Delegating to master agent: ${agents[0].name}`,
        fromAgentId: masterAgentId,
        tokenCount: 0,
        cost: 0,
        metadata: { mode: 'delegate', totalAgents: agentIds.length },
      },
    });

    // Execute
    executeRealAnthropicCall(trace.id, session.id, masterAgentId, ownerId, instruction).catch(console.error);
  } else if (mode === 'parallel') {
    // Parallel: Execute all agents simultaneously
    const sessions = await Promise.all(
      agents.map(agent =>
        prisma.traceSession.create({
          data: {
            taskTraceId: trace.id,
            agentId: agent.id,
            instruction,
            status: 'running',
          },
        })
      )
    );

    // Emit parallel execution events
    for (const [idx, session] of sessions.entries()) {
      await prisma.sessionEvent.create({
        data: {
          sessionId: session.id,
          type: 'agent:executing',
          content: `Starting parallel execution: ${agents[idx].name}`,
          fromAgentId: agents[idx].id,
          tokenCount: 0,
          cost: 0,
          metadata: { mode: 'parallel', agentIndex: idx, totalAgents: agents.length },
        },
      });

      executeRealAnthropicCall(trace.id, session.id, agents[idx].id, ownerId, instruction).catch(console.error);
    }
  } else if (mode === 'sequential') {
    // Sequential: Execute agents one by one
    executeSequentialAgents(trace.id, agents, instruction, ownerId).catch(console.error);
  }

  return { traceId: trace.id };
}

async function executeSequentialAgents(
  traceId: string,
  agents: any[],
  instruction: string,
  ownerId: string,
) {
  for (const [idx, agent] of agents.entries()) {
    const session = await prisma.traceSession.create({
      data: {
        taskTraceId: traceId,
        agentId: agent.id,
        instruction,
        status: 'running',
      },
    });

    await prisma.sessionEvent.create({
      data: {
        sessionId: session.id,
        type: 'agent:executing',
        content: `Sequential execution (${idx + 1}/${agents.length}): ${agent.name}`,
        fromAgentId: agent.id,
        tokenCount: 0,
        cost: 0,
        metadata: { mode: 'sequential', agentIndex: idx, totalAgents: agents.length },
      },
    });

    await executeRealAnthropicCall(traceId, session.id, agent.id, ownerId, instruction);

    // Wait for this session to complete before next
    await new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const updatedSession = await prisma.traceSession.findUnique({
          where: { id: session.id },
        });
        if (updatedSession?.status === 'completed' || updatedSession?.status === 'error') {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 1000);
    });
  }

  // Mark trace as complete after all sequential executions
  await prisma.taskTrace.update({
    where: { id: traceId },
    data: { status: 'completed', completedAt: new Date() },
  });
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
            const chunk = event.delta.text;
            fullResponse += chunk;
            
            // Emit chunk event immediately for real-time streaming
            await prisma.sessionEvent.create({
              data: {
                sessionId,
                type: 'agent:message_chunk',
                content: chunk,
                fromAgentId: agentId,
                tokenCount: 0,
                cost: 0,
                metadata: { model: agent.model },
              },
            });
          }

          if (event.type === 'message_delta') {
            if (event.usage?.output_tokens) outputTokens = event.usage.output_tokens;
          }
        } catch {}
      }
    }

    // Calculate final costs
    const costs = calculateCost(agent.model, inputTokens, outputTokens);

    // Create final message event with full response for storage
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

// ─── Trace management ────────────────────────────────────────────

export async function cancelTrace(traceId: string, ownerId: string) {
  const trace = await prisma.taskTrace.findFirst({ where: { id: traceId, ownerId } });
  if (!trace) throw { statusCode: 404, error: 'Not Found', message: 'Trace not found' };
  if (trace.status === 'completed' || trace.status === 'cancelled')
    throw { statusCode: 400, error: 'Bad Request', message: `Trace is already ${trace.status}` };

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
