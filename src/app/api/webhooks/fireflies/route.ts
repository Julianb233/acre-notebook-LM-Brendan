import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncMeeting } from '@/lib/fireflies';
import { n8nTriggers } from '@/lib/n8n';

const FIREFLIES_WEBHOOK_SECRET = process.env.FIREFLIES_WEBHOOK_SECRET;

/**
 * Verify Fireflies webhook signature
 */
function verifyWebhookSignature(request: NextRequest): boolean {
  // If no secret configured, allow in development
  if (!FIREFLIES_WEBHOOK_SECRET) {
    console.warn('FIREFLIES_WEBHOOK_SECRET not configured - webhook verification disabled');
    return true;
  }

  // Check for Fireflies signature header
  const signature = request.headers.get('x-fireflies-signature');
  if (!signature) {
    // Also accept custom API key header
    const apiKey = request.headers.get('x-api-key');
    return apiKey === FIREFLIES_WEBHOOK_SECRET;
  }

  // Verify signature matches
  return signature === FIREFLIES_WEBHOOK_SECRET;
}

/**
 * POST /api/webhooks/fireflies
 * Webhook endpoint for Fireflies notifications (new transcript, etc.)
 */
export async function POST(request: NextRequest) {
  // Verify webhook authenticity
  if (!verifyWebhookSignature(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid webhook signature' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Log webhook for debugging
    console.log('Fireflies webhook received:', JSON.stringify(body, null, 2));

    const { event, data } = body;

    // Handle different event types
    switch (event) {
      case 'transcription.complete':
      case 'transcript.ready': {
        const { transcript_id, user_id, meeting_title } = data;

        if (!transcript_id) {
          return NextResponse.json(
            { error: 'Missing transcript_id' },
            { status: 400 }
          );
        }

        // Find the partner associated with this Fireflies user
        // This assumes we store the Fireflies user_id in partner metadata
        const supabase = createAdminClient();

        let partnerId: string | null = null;

        if (user_id) {
          const { data: partner } = await supabase
            .from('partners')
            .select('id')
            .eq('metadata->fireflies_user_id', user_id)
            .single();

          partnerId = partner?.id || null;
        }

        // If no partner found, try to get from request context
        if (!partnerId && data.partner_id) {
          partnerId = data.partner_id;
        }

        if (!partnerId) {
          console.log('No partner found for Fireflies webhook, logging only');

          // Log the webhook for later processing
          await supabase.from('webhook_logs').insert({
            direction: 'inbound',
            endpoint: '/api/webhooks/fireflies',
            event_type: event,
            payload: body,
            status: 'pending_partner',
            created_at: new Date().toISOString()
          });

          return NextResponse.json({
            success: true,
            message: 'Logged for later processing - no partner mapping found'
          });
        }

        // Sync the meeting
        const result = await syncMeeting(transcript_id, partnerId);

        // Trigger n8n webhook
        if (result.success && result.meeting) {
          await n8nTriggers.meetingSynced(partnerId, {
            id: result.meeting.id,
            firefliesId: result.meeting.fireflies_id,
            title: result.meeting.title,
            participants: result.meeting.participants,
            duration: result.meeting.duration_minutes
          }).catch(console.error);
        }

        // Log webhook
        await supabase.from('webhook_logs').insert({
          direction: 'inbound',
          endpoint: '/api/webhooks/fireflies',
          event_type: event,
          payload: body,
          response: result,
          status: result.success ? 'success' : 'error',
          created_at: new Date().toISOString()
        });

        return NextResponse.json({
          success: result.success,
          meeting_id: result.meeting?.id,
          chunks_created: result.chunksCreated,
          error: result.error
        });
      }

      case 'meeting.started':
      case 'meeting.ended': {
        // Just log these events for now
        const supabase = createAdminClient();

        await supabase.from('webhook_logs').insert({
          direction: 'inbound',
          endpoint: '/api/webhooks/fireflies',
          event_type: event,
          payload: body,
          status: 'logged',
          created_at: new Date().toISOString()
        });

        return NextResponse.json({
          success: true,
          message: `Event ${event} logged`
        });
      }

      default: {
        console.log('Unknown Fireflies event:', event);

        return NextResponse.json({
          success: true,
          message: `Unknown event type: ${event}`
        });
      }
    }
  } catch (error) {
    console.error('Fireflies webhook error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/fireflies
 * Health check and webhook info
 */
export async function GET(request: NextRequest) {
  // Basic auth check for info endpoint
  const authHeader = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');

  if (!authHeader && !apiKey) {
    return NextResponse.json({
      status: 'active',
      endpoint: '/api/webhooks/fireflies',
      message: 'Fireflies webhook endpoint is active'
    });
  }

  // With auth, return more details
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/webhooks/fireflies',
    secret_configured: !!FIREFLIES_WEBHOOK_SECRET,
    supported_events: [
      'transcription.complete',
      'transcript.ready',
      'meeting.started',
      'meeting.ended'
    ],
    expected_payload: {
      event: 'string (event type)',
      data: {
        transcript_id: 'string (Fireflies transcript ID)',
        user_id: 'string (optional - Fireflies user ID)',
        meeting_title: 'string (optional)',
        partner_id: 'string (optional - if you want to specify partner directly)'
      }
    }
  });
}
