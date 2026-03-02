import { readFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { writeFile, mkdir } from 'fs/promises';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'command-center');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Supported file types
const SUPPORTED_IMAGES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_CODE = [
  'text/plain',
  'text/javascript',
  'application/javascript',
  'text/typescript',
  'application/json',
  'text/html',
  'text/css',
  'text/markdown',
  'application/xml',
  'text/xml',
];

interface FileUploadResult {
  type: 'image' | 'text' | 'unsupported';
  content: string; // base64 for images, text for code/docs
  metadata: {
    filename: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
  };
}

/**
 * Process uploaded file and convert to format suitable for Anthropic API
 */
export async function processUploadedFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<FileUploadResult> {
  // Validate file size
  if (buffer.length > MAX_FILE_SIZE) {
    throw { statusCode: 400, error: 'Bad Request', message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }

  const metadata = {
    filename,
    mimeType,
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
  };

  // Handle images - convert to base64 for Anthropic vision API
  if (SUPPORTED_IMAGES.includes(mimeType)) {
    const base64 = buffer.toString('base64');
    return {
      type: 'image',
      content: base64,
      metadata,
    };
  }

  // Handle code/text files - extract text content
  if (SUPPORTED_CODE.includes(mimeType) || mimeType.startsWith('text/')) {
    const text = buffer.toString('utf-8');
    return {
      type: 'text',
      content: text,
      metadata,
    };
  }

  // Handle by file extension if mime type is generic
  const ext = path.extname(filename).toLowerCase();
  const codeExtensions = ['.js', '.ts', '.tsx', '.jsx', '.json', '.html', '.css', '.md', '.txt', '.xml', '.yaml', '.yml', '.sh', '.py', '.go', '.rs'];
  
  if (codeExtensions.includes(ext)) {
    const text = buffer.toString('utf-8');
    return {
      type: 'text',
      content: text,
      metadata,
    };
  }

  // Unsupported file type
  throw {
    statusCode: 400,
    error: 'Bad Request',
    message: `Unsupported file type: ${mimeType}. Supported: images (JPEG, PNG, GIF, WebP) and code files (.js, .ts, .json, etc.)`,
  };
}

/**
 * Save uploaded file to disk (for audit/reference)
 */
export async function saveUploadedFile(buffer: Buffer, filename: string): Promise<string> {
  // Ensure upload directory exists
  await mkdir(UPLOAD_DIR, { recursive: true });

  // Generate unique filename
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 12);
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);
  const uniqueFilename = `${basename}-${hash}${ext}`;
  const filepath = path.join(UPLOAD_DIR, uniqueFilename);

  // Save file
  await writeFile(filepath, buffer);

  return filepath;
}

/**
 * Format file content for Anthropic API message
 */
export function formatFileForMessage(file: FileUploadResult): any {
  if (file.type === 'image') {
    // Anthropic vision format
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: file.metadata.mimeType,
        data: file.content,
      },
    };
  }

  if (file.type === 'text') {
    // Include as text with metadata
    return {
      type: 'text',
      text: `[File: ${file.metadata.filename}]\n\`\`\`\n${file.content}\n\`\`\``,
    };
  }

  return null;
}
