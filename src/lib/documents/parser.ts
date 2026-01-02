// @ts-expect-error - pdf-parse has no ESM default export
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { createClient } from '@/lib/supabase/server';

export interface ParsedDocument {
  text: string;
  metadata: {
    pages?: number;
    wordCount: number;
    title?: string;
    author?: string;
  };
}

/**
 * Parse a PDF file and extract text content
 */
export async function parsePDF(buffer: Buffer): Promise<ParsedDocument> {
  const data = await pdf(buffer);

  const text = data.text.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    text,
    metadata: {
      pages: data.numpages,
      wordCount,
      title: data.info?.Title || undefined,
      author: data.info?.Author || undefined,
    },
  };
}

/**
 * Parse a DOCX file and extract text content
 */
export async function parseDOCX(buffer: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });

  const text = result.value.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // DOCX doesn't have page count in raw text extraction
  // Estimate based on ~500 words per page
  const estimatedPages = Math.ceil(wordCount / 500);

  return {
    text,
    metadata: {
      pages: estimatedPages,
      wordCount,
    },
  };
}

/**
 * Parse a plain text or markdown file
 */
export async function parseTXT(buffer: Buffer): Promise<ParsedDocument> {
  const text = buffer.toString('utf-8').trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    text,
    metadata: {
      wordCount,
    },
  };
}

/**
 * Detect document type and parse accordingly
 */
export async function parseDocument(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<ParsedDocument> {
  const extension = filename.toLowerCase().split('.').pop();

  switch (extension) {
    case 'pdf':
      return parsePDF(buffer);
    case 'docx':
      return parseDOCX(buffer);
    case 'txt':
    case 'md':
      return parseTXT(buffer);
    default:
      // Try to detect by MIME type
      if (mimeType === 'application/pdf') {
        return parsePDF(buffer);
      }
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return parseDOCX(buffer);
      }
      // Default to text parsing
      return parseTXT(buffer);
  }
}

/**
 * Fetch a document from Supabase Storage and parse it
 */
export async function fetchAndParseDocument(
  storagePath: string,
  filename: string
): Promise<ParsedDocument> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from('documents')
    .download(storagePath);

  if (error) {
    throw new Error(`Failed to download document: ${error.message}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return parseDocument(buffer, filename);
}
