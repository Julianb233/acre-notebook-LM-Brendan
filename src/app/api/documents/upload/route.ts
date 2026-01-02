import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ApiResponse, Document, DocumentMetadata } from '@/types';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'];

function getDocumentType(mimeType: string, fileName: string): Document['type'] {
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) return 'pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) return 'docx';
  if (mimeType === 'text/markdown' || fileName.endsWith('.md')) return 'md';
  return 'txt';
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Document>>> {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to upload documents',
        },
      }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const partnerId = formData.get('partner_id') as string | null;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No file provided',
        },
      }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
      }, { status: 400 });
    }

    // Validate file type
    const isAllowedType = ALLOWED_TYPES.includes(file.type) ||
      file.name.endsWith('.pdf') ||
      file.name.endsWith('.docx') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md');

    if (!isAllowedType) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Only PDF, DOCX, TXT, and MD files are allowed',
        },
      }, { status: 400 });
    }

    // Generate unique file path
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${partnerId || user.id}/${timestamp}_${safeFileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: uploadError.message || 'Failed to upload file to storage',
        },
      }, { status: 500 });
    }

    // Prepare document metadata
    const metadata: DocumentMetadata = {
      size: file.size,
    };

    // Create document record in database
    const documentType = getDocumentType(file.type, file.name);

    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        partner_id: partnerId || user.id,
        name: file.name,
        type: documentType,
        storage_path: uploadData.path,
        status: 'processing',
        metadata,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Attempt to clean up uploaded file
      await supabase.storage.from('documents').remove([storagePath]);

      return NextResponse.json({
        success: false,
        error: {
          code: 'DB_INSERT_FAILED',
          message: dbError.message || 'Failed to create document record',
        },
      }, { status: 500 });
    }

    // Trigger document processing in the background (fire-and-forget)
    // We don't await this so the upload response returns immediately
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    fetch(`${appUrl}/api/documents/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward cookies for auth
        Cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({ documentId: document.id }),
    }).catch((error) => {
      // Log but don't fail the upload if processing trigger fails
      console.error('Failed to trigger document processing:', error);
    });

    return NextResponse.json({
      success: true,
      data: document as Document,
    }, { status: 201 });

  } catch (error) {
    console.error('Upload route error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 });
  }
}

// Handle GET for listing documents (optional convenience)
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Document[]>>> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to view documents',
        },
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partner_id');

    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (partnerId) {
      query = query.eq('partner_id', partnerId);
    }

    const { data: documents, error: dbError } = await query;

    if (dbError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DB_QUERY_FAILED',
          message: dbError.message,
        },
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: documents as Document[],
    });

  } catch (error) {
    console.error('Documents GET error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 });
  }
}
