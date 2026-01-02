import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { triggerN8nWorkflow, n8nTriggers } from '@/lib/n8n';
import type { N8nEvent } from '@/types';

/**
 * POST /api/n8n/trigger
 * Outbound endpoint to manually trigger n8n workflows
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { event_type, partner_id, data } = body;

    // Validate event type
    const validEvents: N8nEvent['type'][] = [
      'new_document',
      'chat_query',
      'content_generated',
      'meeting_synced',
      'airtable_updated'
    ];

    if (!event_type || !validEvents.includes(event_type)) {
      return NextResponse.json(
        {
          error: 'Invalid event_type',
          message: `event_type must be one of: ${validEvents.join(', ')}`
        },
        { status: 400 }
      );
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { error: 'Missing data', message: 'data object is required' },
        { status: 400 }
      );
    }

    // Use partner_id from request or fall back to user.id
    const effectivePartnerId = partner_id || user.id;

    // Trigger the workflow
    const result = await triggerN8nWorkflow(
      event_type as N8nEvent['type'],
      effectivePartnerId,
      data
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Workflow triggered successfully',
        execution_id: result.executionId
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to trigger workflow'
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('n8n trigger error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/n8n/trigger/document
 * Convenience endpoint for document events
 */
export async function documentTrigger(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { document_id, document_name, document_type, page_count, partner_id } = body;

    if (!document_id || !document_name) {
      return NextResponse.json(
        { error: 'Missing required fields', message: 'document_id and document_name are required' },
        { status: 400 }
      );
    }

    const result = await n8nTriggers.documentUploaded(partner_id || user.id, {
      id: document_id,
      name: document_name,
      type: document_type || 'unknown',
      pageCount: page_count
    });

    return NextResponse.json({
      success: result.success,
      execution_id: result.executionId,
      error: result.error
    });
  } catch (error) {
    console.error('Document trigger error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * GET /api/n8n/trigger
 * Get trigger documentation and status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get recent webhook logs
    const { data: recentLogs } = await supabase
      .from('webhook_logs')
      .select('id, direction, event_type, status, created_at')
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      status: 'configured',
      webhook_url: process.env.N8N_WEBHOOK_URL ? 'configured' : 'not configured',
      available_events: [
        {
          type: 'new_document',
          description: 'Triggered when a new document is uploaded and processed',
          required_data: ['document_id', 'document_name', 'document_type']
        },
        {
          type: 'chat_query',
          description: 'Triggered when a chat query is made',
          required_data: ['conversation_id', 'message', 'sources_used']
        },
        {
          type: 'content_generated',
          description: 'Triggered when content (infographic/presentation/report) is generated',
          required_data: ['content_id', 'content_type', 'title']
        },
        {
          type: 'meeting_synced',
          description: 'Triggered when a meeting is synced from Fireflies',
          required_data: ['meeting_id', 'fireflies_id', 'title', 'participants', 'duration_minutes']
        },
        {
          type: 'airtable_updated',
          description: 'Triggered when Airtable data is updated',
          required_data: ['base_id', 'table_name', 'record_id', 'action']
        }
      ],
      recent_triggers: recentLogs || [],
      usage: {
        endpoint: 'POST /api/n8n/trigger',
        body: {
          event_type: 'string (required)',
          partner_id: 'string (optional, defaults to current user)',
          data: 'object (required, event-specific data)'
        }
      }
    });
  } catch (error) {
    console.error('Trigger info error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
