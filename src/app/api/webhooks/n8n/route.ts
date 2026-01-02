import { NextRequest, NextResponse } from 'next/server';
import {
  validateWebhookPayload,
  handleInboundWebhook,
  logInboundWebhook
} from '@/lib/n8n';

const N8N_API_KEY = process.env.N8N_API_KEY;

/**
 * Verify webhook authentication
 */
function verifyWebhookAuth(request: NextRequest): boolean {
  // If no API key is configured, allow all requests (development mode)
  if (!N8N_API_KEY) {
    console.warn('N8N_API_KEY not configured - webhook authentication disabled');
    return true;
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const [type, token] = authHeader.split(' ');
    if (type === 'Bearer' && token === N8N_API_KEY) {
      return true;
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader === N8N_API_KEY) {
    return true;
  }

  // Check query parameter (less secure, but sometimes needed for webhooks)
  const url = new URL(request.url);
  const apiKeyParam = url.searchParams.get('api_key');
  if (apiKeyParam === N8N_API_KEY) {
    return true;
  }

  return false;
}

/**
 * POST /api/webhooks/n8n
 * Inbound webhook endpoint for n8n workflows
 */
export async function POST(request: NextRequest) {
  // Verify authentication
  if (!verifyWebhookAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid or missing API key' },
      { status: 401 }
    );
  }

  try {
    // Parse request body
    const body = await request.json();

    // Validate payload structure
    const validation = validateWebhookPayload(body);
    if (!validation.valid || !validation.payload) {
      return NextResponse.json(
        { error: 'Bad Request', message: validation.error },
        { status: 400 }
      );
    }

    // Handle the webhook event
    const result = await handleInboundWebhook(validation.payload);

    // Log the webhook (async, don't wait)
    logInboundWebhook(validation.payload, result).catch(console.error);

    // Return appropriate response
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Handler failed',
          message: result.message
        },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/n8n
 * Health check and webhook info endpoint
 */
export async function GET(request: NextRequest) {
  // Basic auth check
  if (!verifyWebhookAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    status: 'healthy',
    service: 'acre-notebook-lm',
    endpoint: '/api/webhooks/n8n',
    supported_events: [
      'sync_documents',
      'trigger_chat',
      'generate_content',
      'sync_meetings',
      'sync_airtable',
      'update_partner',
      'custom'
    ],
    documentation: {
      payload_format: {
        event: 'string (required) - one of the supported events',
        partner_id: 'string (optional) - partner identifier',
        data: 'object (required) - event-specific data',
        metadata: 'object (optional) - workflow metadata'
      },
      authentication: {
        methods: [
          'Authorization: Bearer <api_key>',
          'X-API-Key: <api_key>',
          '?api_key=<api_key>'
        ]
      }
    }
  });
}
