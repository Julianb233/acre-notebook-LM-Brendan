import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncMeeting, syncRecentMeetings, reembedMeeting } from '@/lib/fireflies';
import { n8nTriggers } from '@/lib/n8n';

/**
 * POST /api/fireflies/sync
 * Sync meetings from Fireflies and embed for RAG
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
    const { action, fireflies_id, meeting_id, limit, from_date } = body;

    // Sync a single meeting by Fireflies ID
    if (action === 'sync_one' && fireflies_id) {
      const result = await syncMeeting(fireflies_id, user.id);

      // Trigger n8n webhook if successful
      if (result.success && result.meeting) {
        await n8nTriggers.meetingSynced(user.id, {
          id: result.meeting.id,
          firefliesId: result.meeting.fireflies_id,
          title: result.meeting.title,
          participants: result.meeting.participants,
          duration: result.meeting.duration_minutes
        }).catch(console.error);
      }

      return NextResponse.json({
        success: result.success,
        meeting: result.meeting,
        chunks_created: result.chunksCreated,
        error: result.error
      });
    }

    // Sync recent meetings
    if (action === 'sync_recent' || !action) {
      const result = await syncRecentMeetings(user.id, {
        limit: limit || 10,
        fromDate: from_date
      });

      return NextResponse.json({
        success: result.success,
        meetings_processed: result.meetingsProcessed,
        chunks_created: result.chunksCreated,
        errors: result.errors
      });
    }

    // Re-embed an existing meeting
    if (action === 'reembed' && meeting_id) {
      // Verify ownership
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('partner_id')
        .eq('id', meeting_id)
        .single();

      if (meetingError || !meeting) {
        return NextResponse.json(
          { error: 'Meeting not found' },
          { status: 404 }
        );
      }

      if (meeting.partner_id !== user.id) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      const result = await reembedMeeting(meeting_id);

      return NextResponse.json({
        success: result.success,
        chunks_updated: result.chunksUpdated,
        error: result.error
      });
    }

    return NextResponse.json(
      {
        error: 'Invalid action',
        message: 'Use: sync_one (with fireflies_id), sync_recent, or reembed (with meeting_id)'
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Fireflies sync error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fireflies/sync
 * Get sync status and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get meeting statistics
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('id, synced_at, date')
      .eq('partner_id', user.id)
      .order('synced_at', { ascending: false });

    if (meetingsError) {
      throw meetingsError;
    }

    // Get chunk count
    const meetingIds = meetings?.map(m => m.id) || [];
    let totalChunks = 0;

    if (meetingIds.length > 0) {
      const { count } = await supabase
        .from('meeting_chunks')
        .select('*', { count: 'exact', head: true })
        .in('meeting_id', meetingIds);

      totalChunks = count || 0;
    }

    const lastSync = meetings?.[0]?.synced_at || null;
    const oldestMeeting = meetings?.length
      ? meetings.reduce((oldest, m) => m.date < oldest.date ? m : oldest)
      : null;
    const newestMeeting = meetings?.length
      ? meetings.reduce((newest, m) => m.date > newest.date ? m : newest)
      : null;

    return NextResponse.json({
      total_meetings: meetings?.length || 0,
      total_chunks: totalChunks,
      last_sync: lastSync,
      date_range: {
        oldest: oldestMeeting?.date || null,
        newest: newestMeeting?.date || null
      },
      api_configured: !!process.env.FIREFLIES_API_KEY
    });
  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
