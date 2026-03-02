import { prisma } from '../../lib/prisma.js';

interface SearchResult {
  id: string;
  content: string;
  agentName: string;
  agentId: string;
  tabTitle: string;
  timestamp: string;
  conversationId: string;
}

export async function searchConversations(
  userId: string,
  query: string,
  limit: number = 20
): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  // Search messages with PostgreSQL full-text search
  const messages = await prisma.message.findMany({
    where: {
      conversation: {
        userId,
      },
      content: {
        contains: query.trim(),
        mode: 'insensitive',
      },
    },
    take: limit,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      conversation: {
        include: {
          agent: {
            select: {
              id: true,
              name: true,
            },
          },
          tab: {
            select: {
              title: true,
            },
          },
        },
      },
    },
  });

  // Format results
  const results: SearchResult[] = messages.map((msg) => ({
    id: msg.id,
    content: msg.content,
    agentName: msg.conversation.agent.name,
    agentId: msg.conversation.agent.id,
    tabTitle: msg.conversation.tab?.title || 'Default',
    timestamp: msg.createdAt.toISOString(),
    conversationId: msg.conversationId,
  }));

  return results;
}
