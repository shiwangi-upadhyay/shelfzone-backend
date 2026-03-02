import { FastifyRequest, FastifyReply } from 'fastify';
import { processUploadedFile, saveUploadedFile } from './file-upload.service.js';

interface UploadFileRequest {
  Body: {
    file: any; // multipart file
  };
}

export async function handleFileUpload(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const data = await request.file();
    
    if (!data) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No file uploaded',
      });
    }

    // Read file buffer
    const buffer = await data.toBuffer();
    const filename = data.filename;
    const mimeType = data.mimetype;

    // Process file (convert to base64 for images, text for code)
    const processed = await processUploadedFile(buffer, filename, mimeType);

    // Save file to disk for audit
    const filepath = await saveUploadedFile(buffer, filename);

    return reply.send({
      data: {
        ...processed,
        filepath, // Internal reference
      },
    });
  } catch (error: any) {
    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        error: error.error || 'Error',
        message: error.message,
      });
    }

    console.error('File upload error:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to process uploaded file',
    });
  }
}
