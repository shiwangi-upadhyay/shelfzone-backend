import { prisma } from '../../lib/prisma.js';

export async function listConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          createdAt: true,
        },
      },
      _count: {
        select: { messages: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return {
    conversations: conversations.map((c) => ({
      id: c.id,
      agentId: c.agentId,
      agentName: c.agent.name,
      title: c.title,
      lastMessageAt: c.messages[0]?.createdAt || c.createdAt,
      messageCount: c._count.messages,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  };
}

export async function getConversation(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          tokenCount: true,
          cost: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) {
    throw {
      statusCode: 404,
      error: 'Not Found',
      message: 'Conversation not found',
    };
  }

  return {
    conversation: {
      id: conversation.id,
      agentId: conversation.agentId,
      agentName: conversation.agent.name,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    },
    messages: conversation.messages,
  };
}

export async function getConversationByAgentAndTab(
  userId: string,
  agentId: string,
  tabId: string | null,
) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      userId,
      agentId,
      tabId: tabId || null,
    },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          tokenCount: true,
          cost: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) {
    return { conversation: null, messages: [] };
  }

  return {
    conversation: {
      id: conversation.id,
      agentId: conversation.agentId,
      agentName: conversation.agent.name,
      title: conversation.title,
      tabId: conversation.tabId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    },
    messages: conversation.messages,
  };
}

export async function createConversation(
  userId: string,
  agentId: string,
  title?: string,
  tabId?: string | null,
) {

  // Verify agent exists
  const agent = await prisma.agentRegistry.findUnique({
    where: { id: agentId },
    select: { id: true, name: true },
  });

  if (!agent) {
    throw {
      statusCode: 404,
      error: 'Not Found',
      message: 'Agent not found',
    };
  }

  const conversation = await prisma.conversation.create({
    data: {
      userId,
      agentId,
      title: title || `New conversation with ${agent.name}`,
    },
  });

  return {
    conversation: {
      id: conversation.id,
      agentId: conversation.agentId,
      agentName: agent.name,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    },
  };
}

export async function updateConversationTitle(
  userId: string,
  conversationId: string,
  title: string,
) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
  });

  if (!conversation) {
    throw {
      statusCode: 404,
      error: 'Not Found',
      message: 'Conversation not found',
    };
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { title },
  });

  return {
    conversation: {
      id: updated.id,
      title: updated.title,
      updatedAt: updated.updatedAt,
    },
  };
}

export async function deleteConversation(
  userId: string,
  conversationId: string,
) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
  });

  if (!conversation) {
    throw {
      statusCode: 404,
      error: 'Not Found',
      message: 'Conversation not found',
    };
  }

  // Delete will cascade to messages automatically
  await prisma.conversation.delete({
    where: { id: conversationId },
  });

  return { success: true };
}
