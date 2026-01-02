import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchAndParseDocument } from '@/lib/documents/parser';
import { chunkText, TextChunk } from '@/lib/documents/chunker';
import { generateEmbeddings, formatEmbeddingForPgvector } from '@/lib/ai/embeddings';
import type { ApiResponse } from '@/types';

interface ProcessResult {
  documentId: string;
  chunksCreated: number;
  totalTokens: number;
}

/**
 * POST /api/documents/process
 * Process a document: parse, chunk, and generate embeddings
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<ProcessResult>>> {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to process documents',
        },
      }, { status: 401 });
    }

    // Get document ID from request body
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_DOCUMENT_ID',
          message: 'Document ID is required',
        },
      }, { status: 400 });
    }

    // Fetch document record
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      }, { status: 404 });
    }

    // Check if document is already processed
    if (document.status === 'ready') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ALREADY_PROCESSED',
          message: 'Document has already been processed',
        },
      }, { status: 400 });
    }

    try {
      // Update status to processing
      await supabase
        .from('documents')
        .update({ status: 'processing' })
        .eq('id', documentId);

      // 1. Parse the document
      console.log(`Parsing document: ${document.name}`);
      const parsed = await fetchAndParseDocument(document.storage_path, document.name);

      // 2. Chunk the text
      console.log(`Chunking document: ${parsed.metadata.wordCount} words`);
      const chunks = chunkText(parsed.text, {
        chunkSize: 1500,
        chunkOverlap: 200,
      });

      if (chunks.length === 0) {
        throw new Error('Document produced no text chunks');
      }

      // 3. Generate embeddings for all chunks
      console.log(`Generating embeddings for ${chunks.length} chunks`);
      const chunkTexts = chunks.map(c => c.content);
      const embeddings = await generateEmbeddings(chunkTexts);

      // 4. Store chunks with embeddings in database
      console.log('Storing chunks in database');
      const chunkRecords = chunks.map((chunk, index) => ({
        document_id: documentId,
        content: chunk.content,
        embedding: formatEmbeddingForPgvector(embeddings[index].embedding),
        chunk_index: chunk.chunkIndex,
        metadata: {
          startChar: chunk.startChar,
          endChar: chunk.endChar,
          wordCount: chunk.metadata.wordCount,
          tokenEstimate: chunk.metadata.tokenEstimate,
        },
      }));

      // Delete existing chunks for this document (in case of reprocessing)
      await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId);

      // Insert new chunks
      const { error: insertError } = await supabase
        .from('document_chunks')
        .insert(chunkRecords);

      if (insertError) {
        throw new Error(`Failed to insert chunks: ${insertError.message}`);
      }

      // 5. Update document metadata and status
      const totalTokens = embeddings.reduce((sum, e) => sum + e.tokenCount, 0);

      await supabase
        .from('documents')
        .update({
          status: 'ready',
          metadata: {
            ...document.metadata,
            pages: parsed.metadata.pages,
            wordCount: parsed.metadata.wordCount,
            chunkCount: chunks.length,
            totalTokens,
            processedAt: new Date().toISOString(),
          },
        })
        .eq('id', documentId);

      console.log(`Document processed successfully: ${chunks.length} chunks, ${totalTokens} tokens`);

      return NextResponse.json({
        success: true,
        data: {
          documentId,
          chunksCreated: chunks.length,
          totalTokens,
        },
      });

    } catch (processingError) {
      // Update document status to error
      const errorMessage = processingError instanceof Error ? processingError.message : 'Processing failed';

      await supabase
        .from('documents')
        .update({
          status: 'error',
          metadata: {
            ...document.metadata,
            error_message: errorMessage,
            failedAt: new Date().toISOString(),
          },
        })
        .eq('id', documentId);

      throw processingError;
    }

  } catch (error) {
    console.error('Document processing error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'PROCESSING_FAILED',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
    }, { status: 500 });
  }
}

/**
 * GET /api/documents/process?documentId=xxx
 * Check processing status for a document
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{ status: string; metadata: Record<string, unknown> }>>> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You must be logged in',
        },
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_DOCUMENT_ID',
          message: 'Document ID is required',
        },
      }, { status: 400 });
    }

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('status, metadata')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        status: document.status,
        metadata: document.metadata,
      },
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 });
  }
}
