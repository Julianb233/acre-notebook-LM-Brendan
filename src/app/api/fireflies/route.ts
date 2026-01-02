import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFirefliesClient } from '@/lib/fireflies';

/**
 * GET /api/fireflies
 * Fetch meetings from Fireflies and/or local database
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source') || 'local'; // 'local', 'fireflies', 'both'
    const limit = parseInt(searchParams.get('limit') || '20');
    const fromDate = searchParams.get('from_date');

    const result: {
      local_meetings?: unknown[];
      fireflies_meetings?: unknown[];
      sync_status?: string;
    } = {};

    // Fetch from local database
    if (source === 'local' || source === 'both') {
      let query = supabase
        .from('meetings')
        .select('*')
        .eq('partner_id', user.id)
        .order('date', { ascending: false })
        .limit(limit);

      if (fromDate) {
        query = query.gte('date', fromDate);
      }

      const { data: localMeetings, error: localError } = await query;

      if (localError) {
        console.error('Error fetching local meetings:', localError);
      } else {
        result.local_meetings = localMeetings;
      }
    }

    // Fetch from Fireflies API
    if (source === 'fireflies' || source === 'both') {
      try {
        const client = getFirefliesClient();
        const { transcripts } = await client.listTranscripts({
          limit,
          fromDate: fromDate || undefined
        });

        result.fireflies_meetings = transcripts.map(t => ({
          fireflies_id: t.id,
          title: t.title,
          date: t.date,
          duration_minutes: Math.round(t.duration / 60),
          participants: t.participants,
          summary: t.summary?.overview,
          synced: false // Will be updated below
        }));

        // Mark which ones are already synced
        if (result.local_meetings && result.fireflies_meetings) {
          const syncedIds = new Set(
            (result.local_meetings as { fireflies_id: string }[]).map(m => m.fireflies_id)
          );
          result.fireflies_meetings = result.fireflies_meetings.map((m: { fireflies_id: string; synced: boolean }) => ({
            ...m,
            synced: syncedIds.has(m.fireflies_id)
          }));
        }

        result.sync_status = 'connected';
      } catch (error) {
        console.error('Fireflies API error:', error);
        result.sync_status = error instanceof Error ? error.message : 'disconnected';
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Fireflies route error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fireflies
 * Get Fireflies connection status and user info
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
    const { action } = body;

    if (action === 'test_connection') {
      try {
        const client = getFirefliesClient();
        const firefliesUser = await client.getUser();

        return NextResponse.json({
          connected: true,
          user: firefliesUser
        });
      } catch (error) {
        return NextResponse.json({
          connected: false,
          error: error instanceof Error ? error.message : 'Connection failed'
        });
      }
    }

    if (action === 'search') {
      const { keyword, limit } = body;

      if (!keyword) {
        return NextResponse.json(
          { error: 'keyword is required for search' },
          { status: 400 }
        );
      }

      try {
        const client = getFirefliesClient();
        const transcripts = await client.searchTranscripts(keyword, limit || 10);

        return NextResponse.json({ transcripts });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Search failed' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: test_connection, search' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Fireflies POST error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
