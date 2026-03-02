import { prisma } from '../../lib/prisma.js';

interface ConversationMessage {
  role: string;
  content: string;
  createdAt: Date;
}

interface ConversationData {
  id: string;
  title: string;
  agentName: string;
  messages: ConversationMessage[];
  totalCost: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get conversation with all messages for export
 */
export async function getConversationForExport(
  conversationId: string,
  userId: string
): Promise<ConversationData | null> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
    include: {
      agent: {
        select: {
          name: true,
        },
      },
      messages: {
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          role: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) {
    return null;
  }

  // Calculate total cost from trace sessions linked to this conversation
  const traceSessions = await prisma.traceSession.findMany({
    where: {
      conversationId,
    },
    select: {
      totalCost: true,
    },
  });

  const totalCost = traceSessions.reduce((sum, session) => {
    return sum + (Number(session.totalCost) || 0);
  }, 0);

  return {
    id: conversation.id,
    title: conversation.title,
    agentName: conversation.agent.name,
    messages: conversation.messages,
    totalCost,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

/**
 * Export conversation as Markdown
 */
export function exportAsMarkdown(data: ConversationData): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${data.title}`);
  lines.push('');
  lines.push(`**Agent:** ${data.agentName}`);
  lines.push(`**Created:** ${data.createdAt.toLocaleString()}`);
  lines.push(`**Updated:** ${data.updatedAt.toLocaleString()}`);
  lines.push(`**Total Cost:** $${data.totalCost.toFixed(4)}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Messages
  for (const msg of data.messages) {
    const timestamp = msg.createdAt.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const role = msg.role === 'user' ? 'You' : data.agentName;

    lines.push(`## ${role} (${timestamp})`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`*Exported from ShelfZone Command Center on ${new Date().toLocaleString()}*`);

  return lines.join('\n');
}

/**
 * Export conversation as JSON
 */
export function exportAsJSON(data: ConversationData): string {
  return JSON.stringify(
    {
      id: data.id,
      title: data.title,
      agent: data.agentName,
      created_at: data.createdAt.toISOString(),
      updated_at: data.updatedAt.toISOString(),
      total_cost: data.totalCost,
      messages: data.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
      })),
      exported_at: new Date().toISOString(),
    },
    null,
    2
  );
}
