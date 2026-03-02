import { FastifyRequest, FastifyReply } from 'fastify';
import {
  getConversationForExport,
  exportAsMarkdown,
  exportAsJSON,
} from './export.service.js';

export async function handleExport(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: { format?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { format = 'markdown' } = request.query;
    const userId = request.user!.userId;

    // Validate format
    if (!['markdown', 'json', 'md'].includes(format)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid format. Supported: markdown, json',
      });
    }

    // Get conversation data
    const data = await getConversationForExport(id, userId);

    if (!data) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Conversation not found',
      });
    }

    // Export in requested format
    let content: string;
    let contentType: string;
    let filename: string;

    if (format === 'json') {
      content = exportAsJSON(data);
      contentType = 'application/json';
      filename = `${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    } else {
      // markdown or md
      content = exportAsMarkdown(data);
      contentType = 'text/markdown';
      filename = `${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    }

    // Send as download
    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(content);
  } catch (error: any) {
    console.error('Export error:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to export conversation',
    });
  }
}
