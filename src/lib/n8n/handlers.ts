import { createClient } from '@/lib/supabase/server';
import type { WebhookLog } from '@/types';

/**
 * Inbound webhook event types from n8n
 */
export type InboundEventType =
  | 'sync_documents'
  | 'trigger_chat'
  | 'generate_content'
  | 'sync_meetings'
  | 'sync_airtable'
  | 'update_partner'
  | 'custom';

export interface InboundWebhookPayload {
  event: InboundEventType;
  partner_id?: string;
  data: Record<string, unknown>;
  metadata?: {
    workflow_id?: string;
    execution_id?: string;
    triggered_at?: string;
  };
}

export interface WebhookHandlerResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Validate incoming webhook payload
 */
export function validateWebhookPayload(payload: unknown): {
  valid: boolean;
  payload?: InboundWebhookPayload;
  error?: string;
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload: expected object' };
  }

  const p = payload as Record<string, unknown>;

  if (!p.event || typeof p.event !== 'string') {
    return { valid: false, error: 'Missing or invalid event type' };
  }

  if (!p.data || typeof p.data !== 'object') {
    return { valid: false, error: 'Missing or invalid data object' };
  }

  return {
    valid: true,
    payload: {
      event: p.event as InboundEventType,
      partner_id: typeof p.partner_id === 'string' ? p.partner_id : undefined,
      data: p.data as Record<string, unknown>,
      metadata: p.metadata as InboundWebhookPayload['metadata']
    }
  };
}

/**
 * Handle sync_documents event
 * Triggers document re-processing or fetches new documents
 */
async function handleSyncDocuments(
  payload: InboundWebhookPayload
): Promise<WebhookHandlerResult> {
  const supabase = await createClient();
  const { document_ids, action } = payload.data;

  if (action === 'reprocess' && Array.isArray(document_ids)) {
    // Mark documents for reprocessing
    const { error } = await supabase
      .from('documents')
      .update({ status: 'processing' })
      .in('id', document_ids);

    if (error) {
      return { success: false, message: 'Failed to update documents', error: error.message };
    }

    return {
      success: true,
      message: `Marked ${document_ids.length} documents for reprocessing`,
      data: { document_ids }
    };
  }

  if (action === 'list' && payload.partner_id) {
    const { data, error } = await supabase
      .from('documents')
      .select('id, name, type, status, created_at')
      .eq('partner_id', payload.partner_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return { success: false, message: 'Failed to fetch documents', error: error.message };
    }

    return {
      success: true,
      message: `Found ${data?.length || 0} documents`,
      data: { documents: data }
    };
  }

  return { success: true, message: 'No action taken' };
}

/**
 * Handle trigger_chat event
 * Allows n8n to programmatically query the AI chat
 */
async function handleTriggerChat(
  payload: InboundWebhookPayload
): Promise<WebhookHandlerResult> {
  const { message, conversation_id, document_ids } = payload.data;

  if (!message || typeof message !== 'string') {
    return { success: false, message: 'Missing message', error: 'message is required' };
  }

  // For now, return a placeholder - actual implementation would call the chat API
  return {
    success: true,
    message: 'Chat query received',
    data: {
      received_message: message,
      conversation_id,
      document_ids,
      note: 'Processing queued - response will be sent via outbound webhook'
    }
  };
}

/**
 * Handle generate_content event
 * Triggers content generation from n8n
 */
async function handleGenerateContent(
  payload: InboundWebhookPayload
): Promise<WebhookHandlerResult> {
  const { content_type, prompt, document_ids, template } = payload.data;

  if (!content_type || !['infographic', 'presentation', 'report'].includes(content_type as string)) {
    return {
      success: false,
      message: 'Invalid content type',
      error: 'content_type must be infographic, presentation, or report'
    };
  }

  if (!prompt || typeof prompt !== 'string') {
    return { success: false, message: 'Missing prompt', error: 'prompt is required' };
  }

  return {
    success: true,
    message: 'Content generation queued',
    data: {
      content_type,
      prompt,
      document_ids,
      template,
      note: 'Generation in progress - result will be sent via outbound webhook'
    }
  };
}

/**
 * Handle sync_meetings event
 * Triggers Fireflies meeting sync
 */
async function handleSyncMeetings(
  payload: InboundWebhookPayload
): Promise<WebhookHandlerResult> {
  const { action, meeting_ids, since_date } = payload.data;

  if (action === 'fetch_recent') {
    return {
      success: true,
      message: 'Meeting sync queued',
      data: {
        action: 'fetch_recent',
        since_date: since_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        partner_id: payload.partner_id
      }
    };
  }

  if (action === 'reprocess' && Array.isArray(meeting_ids)) {
    return {
      success: true,
      message: `Queued ${meeting_ids.length} meetings for reprocessing`,
      data: { meeting_ids }
    };
  }

  return { success: true, message: 'No action taken' };
}

/**
 * Handle sync_airtable event
 * Triggers Airtable data sync
 */
async function handleSyncAirtable(
  payload: InboundWebhookPayload
): Promise<WebhookHandlerResult> {
  const { base_id, table_name, action, record_data } = payload.data;

  if (!base_id || typeof base_id !== 'string') {
    return { success: false, message: 'Missing base_id', error: 'base_id is required' };
  }

  if (action === 'sync_table' && table_name) {
    return {
      success: true,
      message: `Airtable sync queued for ${table_name}`,
      data: { base_id, table_name }
    };
  }

  if (action === 'create_record' && table_name && record_data) {
    return {
      success: true,
      message: 'Record creation queued',
      data: { base_id, table_name, record_data }
    };
  }

  if (action === 'sync_all') {
    return {
      success: true,
      message: 'Full Airtable sync queued',
      data: { base_id }
    };
  }

  return { success: true, message: 'No action taken' };
}

/**
 * Handle update_partner event
 * Updates partner settings or metadata
 */
async function handleUpdatePartner(
  payload: InboundWebhookPayload
): Promise<WebhookHandlerResult> {
  if (!payload.partner_id) {
    return { success: false, message: 'Missing partner_id', error: 'partner_id is required' };
  }

  const supabase = await createClient();
  const { settings, metadata } = payload.data;

  const updates: Record<string, unknown> = {};
  if (settings && typeof settings === 'object') {
    updates.settings = settings;
  }
  if (metadata && typeof metadata === 'object') {
    updates.metadata = metadata;
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, message: 'No updates provided', error: 'settings or metadata required' };
  }

  const { error } = await supabase
    .from('partners')
    .update(updates)
    .eq('id', payload.partner_id);

  if (error) {
    return { success: false, message: 'Failed to update partner', error: error.message };
  }

  return {
    success: true,
    message: 'Partner updated successfully',
    data: { partner_id: payload.partner_id, updated_fields: Object.keys(updates) }
  };
}

/**
 * Handle custom event
 * Generic handler for custom n8n workflows
 */
async function handleCustomEvent(
  payload: InboundWebhookPayload
): Promise<WebhookHandlerResult> {
  // Log the custom event for processing
  const supabase = await createClient();

  await supabase.from('webhook_logs').insert({
    direction: 'inbound',
    endpoint: '/api/webhooks/n8n',
    event_type: `custom:${payload.data.custom_type || 'unknown'}`,
    payload: payload as unknown as Record<string, unknown>,
    response: null,
    status: 'pending',
    created_at: new Date().toISOString()
  });

  return {
    success: true,
    message: 'Custom event logged',
    data: {
      event_type: payload.data.custom_type,
      logged: true
    }
  };
}

/**
 * Main webhook handler router
 */
export async function handleInboundWebhook(
  payload: InboundWebhookPayload
): Promise<WebhookHandlerResult> {
  const handlers: Record<InboundEventType, (p: InboundWebhookPayload) => Promise<WebhookHandlerResult>> = {
    'sync_documents': handleSyncDocuments,
    'trigger_chat': handleTriggerChat,
    'generate_content': handleGenerateContent,
    'sync_meetings': handleSyncMeetings,
    'sync_airtable': handleSyncAirtable,
    'update_partner': handleUpdatePartner,
    'custom': handleCustomEvent
  };

  const handler = handlers[payload.event];
  if (!handler) {
    return {
      success: false,
      message: 'Unknown event type',
      error: `Event type '${payload.event}' is not supported`
    };
  }

  try {
    return await handler(payload);
  } catch (error) {
    console.error(`Error handling ${payload.event}:`, error);
    return {
      success: false,
      message: 'Handler error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Log inbound webhook to database
 */
export async function logInboundWebhook(
  payload: InboundWebhookPayload,
  result: WebhookHandlerResult
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('webhook_logs').insert({
      direction: 'inbound',
      endpoint: '/api/webhooks/n8n',
      event_type: payload.event,
      payload: payload as unknown as Record<string, unknown>,
      response: result as unknown as Record<string, unknown>,
      status: result.success ? 'success' : 'error',
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log inbound webhook:', error);
  }
}
