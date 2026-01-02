import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAirtableConfigured } from '@/lib/airtable';

export interface SourceStatus {
  source: string;
  name: string;
  icon: string;
  description: string;
  configured: boolean;
  status: 'connected' | 'syncing' | 'error' | 'disconnected' | 'pending';
  lastSync: string | null;
  itemCount: number;
  lastError: string | null;
  viewHref: string | null;
  externalHref: string | null;
}

/**
 * GET /api/sources
 * Get status of all data sources
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get status from data_source_status table
    const { data: statusRecords } = await supabase
      .from('data_source_status')
      .select('*');

    const statusMap = new Map(
      (statusRecords || []).map(s => [s.source, s])
    );

    // Get document count
    const { count: documentCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    // Get document chunks count (for embeddings)
    const { count: chunkCount } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true });

    // Get meeting count
    const { count: meetingCount } = await supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true });

    // Get airtable record count
    const { count: airtableCount } = await supabase
      .from('airtable_records')
      .select('*', { count: 'exact', head: true });

    // Check configurations
    const firefliesConfigured = !!process.env.FIREFLIES_API_KEY;
    const airtableConfigured = isAirtableConfigured();

    // Build source statuses
    const sources: SourceStatus[] = [
      {
        source: 'documents',
        name: 'Documents',
        icon: '📄',
        description: 'PDFs, Word documents, and text files you upload',
        configured: true, // Always available
        status: (documentCount || 0) > 0 ? 'connected' : 'pending',
        lastSync: statusMap.get('documents')?.last_sync || null,
        itemCount: documentCount || 0,
        lastError: statusMap.get('documents')?.last_error || null,
        viewHref: '/documents',
        externalHref: null,
      },
      {
        source: 'fireflies',
        name: 'Fireflies.ai',
        icon: '🎙️',
        description: 'Meeting transcripts and recordings',
        configured: firefliesConfigured,
        status: !firefliesConfigured
          ? 'disconnected'
          : statusMap.get('fireflies')?.status || 'pending',
        lastSync: statusMap.get('fireflies')?.last_sync || null,
        itemCount: meetingCount || 0,
        lastError: statusMap.get('fireflies')?.last_error || null,
        viewHref: '/meetings',
        externalHref: firefliesConfigured ? 'https://app.fireflies.ai' : null,
      },
      {
        source: 'airtable',
        name: 'Airtable',
        icon: '📊',
        description: 'Synced data from your Airtable bases',
        configured: airtableConfigured,
        status: !airtableConfigured
          ? 'disconnected'
          : statusMap.get('airtable')?.status || 'pending',
        lastSync: statusMap.get('airtable')?.last_sync || null,
        itemCount: airtableCount || 0,
        lastError: statusMap.get('airtable')?.last_error || null,
        viewHref: '/data',
        externalHref: airtableConfigured && process.env.AIRTABLE_BASE_ID
          ? `https://airtable.com/${process.env.AIRTABLE_BASE_ID}`
          : null,
      },
    ];

    // Calculate totals
    const totalItems = (documentCount || 0) + (meetingCount || 0) + (airtableCount || 0);
    const totalEmbeddings = (chunkCount || 0);
    const connectedSources = sources.filter(s => s.status === 'connected').length;
    const errorSources = sources.filter(s => s.status === 'error').length;

    return NextResponse.json({
      sources,
      summary: {
        totalSources: sources.length,
        connectedSources,
        errorSources,
        totalItems,
        totalEmbeddings,
        lastActivity: sources
          .map(s => s.lastSync)
          .filter(Boolean)
          .sort()
          .reverse()[0] || null,
      },
    });
  } catch (error) {
    console.error('Sources API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch source statuses' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sources
 * Trigger sync for a specific source or all sources
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { source } = body;

    const results: { source: string; success: boolean; message: string }[] = [];

    // Sync specific source or all
    const sourcesToSync = source ? [source] : ['documents', 'fireflies', 'airtable'];

    for (const src of sourcesToSync) {
      try {
        let response;

        switch (src) {
          case 'documents':
            // Documents don't have a separate sync - they're always up to date
            results.push({
              source: src,
              success: true,
              message: 'Documents are always current',
            });
            break;

          case 'fireflies':
            response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/fireflies/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) {
              throw new Error('Fireflies sync failed');
            }
            const firefliesResult = await response.json();
            results.push({
              source: src,
              success: true,
              message: `Synced ${firefliesResult.synced || 0} meetings`,
            });
            break;

          case 'airtable':
            response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/airtable/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ embedRecords: true }),
            });
            if (!response.ok) {
              throw new Error('Airtable sync failed');
            }
            const airtableResult = await response.json();
            results.push({
              source: src,
              success: airtableResult.success,
              message: `Synced ${airtableResult.totalRecords || 0} records`,
            });
            break;

          default:
            results.push({
              source: src,
              success: false,
              message: 'Unknown source',
            });
        }
      } catch (error) {
        results.push({
          source: src,
          success: false,
          message: error instanceof Error ? error.message : 'Sync failed',
        });
      }
    }

    const allSuccess = results.every(r => r.success);

    return NextResponse.json({
      success: allSuccess,
      results,
    });
  } catch (error) {
    console.error('Sources sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync sources' },
      { status: 500 }
    );
  }
}
