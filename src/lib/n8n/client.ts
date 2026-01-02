import type { N8nEvent, WebhookLog } from '@/types';
import { createClient } from '@/lib/supabase/server';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

export interface N8nClientOptions {
  timeout?: number;
  retries?: number;
}

export interface N8nTriggerResponse {
  success: boolean;
  executionId?: string;
  error?: string;
}

/**
 * n8n Webhook Client
 * Handles outbound communication to n8n workflows
 */
export class N8nClient {
  private baseUrl: string;
  private apiKey: string | undefined;
  private timeout: number;
  private maxRetries: number;

  constructor(options: N8nClientOptions = {}) {
    if (!N8N_WEBHOOK_URL) {
      console.warn('N8N_WEBHOOK_URL not configured');
    }
    this.baseUrl = N8N_WEBHOOK_URL || '';
    this.apiKey = N8N_API_KEY;
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.retries || 3;
  }

  /**
   * Trigger an n8n workflow via webhook
   */
  async trigger(event: N8nEvent): Promise<N8nTriggerResponse> {
    if (!this.baseUrl) {
      return { success: false, error: 'n8n webhook URL not configured' };
    }

    const endpoint = this.getEndpointForEvent(event.type);
    const fullUrl = `${this.baseUrl}${endpoint}`;

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < this.maxRetries) {
      attempt++;

      try {
        const response = await this.makeRequest(fullUrl, event);

        // Log successful webhook
        await this.logWebhook({
          direction: 'outbound',
          endpoint: fullUrl,
          event_type: event.type,
          payload: event as unknown as Record<string, unknown>,
          response: response,
          status: 'success'
        });

        return {
          success: true,
          executionId: response.executionId
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`n8n trigger attempt ${attempt} failed:`, lastError.message);

        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    // Log failed webhook
    await this.logWebhook({
      direction: 'outbound',
      endpoint: fullUrl,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      response: { error: lastError?.message },
      status: 'error'
    });

    return {
      success: false,
      error: lastError?.message || 'Unknown error'
    };
  }

  /**
   * Make HTTP request to n8n
   */
  private async makeRequest(url: string, event: N8nEvent): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`n8n returned ${response.status}: ${errorText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get the specific endpoint for an event type
   */
  private getEndpointForEvent(eventType: N8nEvent['type']): string {
    const endpoints: Record<N8nEvent['type'], string> = {
      'new_document': '/webhook/document',
      'chat_query': '/webhook/chat',
      'content_generated': '/webhook/content',
      'meeting_synced': '/webhook/meeting',
      'airtable_updated': '/webhook/airtable'
    };

    return endpoints[eventType] || '/webhook/general';
  }

  /**
   * Log webhook call to database
   */
  private async logWebhook(log: Omit<WebhookLog, 'id' | 'created_at'>): Promise<void> {
    try {
      const supabase = await createClient();
      await supabase.from('webhook_logs').insert({
        ...log,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log webhook:', error);
    }
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create n8n event payload
 */
export function createN8nEvent(
  type: N8nEvent['type'],
  partnerId: string,
  data: Record<string, unknown>
): N8nEvent {
  return {
    type,
    partner_id: partnerId,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Singleton client instance
 */
let clientInstance: N8nClient | null = null;

export function getN8nClient(): N8nClient {
  if (!clientInstance) {
    clientInstance = new N8nClient();
  }
  return clientInstance;
}

/**
 * Convenience function to trigger n8n workflow
 */
export async function triggerN8nWorkflow(
  type: N8nEvent['type'],
  partnerId: string,
  data: Record<string, unknown>
): Promise<N8nTriggerResponse> {
  const client = getN8nClient();
  const event = createN8nEvent(type, partnerId, data);
  return client.trigger(event);
}

/**
 * Event-specific trigger functions
 */
export const n8nTriggers = {
  /**
   * Trigger when a new document is uploaded and processed
   */
  async documentUploaded(partnerId: string, document: {
    id: string;
    name: string;
    type: string;
    pageCount?: number;
  }): Promise<N8nTriggerResponse> {
    return triggerN8nWorkflow('new_document', partnerId, {
      document_id: document.id,
      document_name: document.name,
      document_type: document.type,
      page_count: document.pageCount
    });
  },

  /**
   * Trigger when a chat query is made
   */
  async chatQuery(partnerId: string, query: {
    conversationId: string;
    message: string;
    sourcesUsed: number;
  }): Promise<N8nTriggerResponse> {
    return triggerN8nWorkflow('chat_query', partnerId, {
      conversation_id: query.conversationId,
      message: query.message,
      sources_used: query.sourcesUsed
    });
  },

  /**
   * Trigger when content is generated
   */
  async contentGenerated(partnerId: string, content: {
    id: string;
    type: 'infographic' | 'presentation' | 'report';
    title: string;
  }): Promise<N8nTriggerResponse> {
    return triggerN8nWorkflow('content_generated', partnerId, {
      content_id: content.id,
      content_type: content.type,
      title: content.title
    });
  },

  /**
   * Trigger when a meeting is synced from Fireflies
   */
  async meetingSynced(partnerId: string, meeting: {
    id: string;
    firefliesId: string;
    title: string;
    participants: string[];
    duration: number;
  }): Promise<N8nTriggerResponse> {
    return triggerN8nWorkflow('meeting_synced', partnerId, {
      meeting_id: meeting.id,
      fireflies_id: meeting.firefliesId,
      title: meeting.title,
      participants: meeting.participants,
      duration_minutes: meeting.duration
    });
  },

  /**
   * Trigger when Airtable data is updated
   */
  async airtableUpdated(partnerId: string, update: {
    baseId: string;
    tableName: string;
    recordId: string;
    action: 'create' | 'update' | 'delete';
  }): Promise<N8nTriggerResponse> {
    return triggerN8nWorkflow('airtable_updated', partnerId, {
      base_id: update.baseId,
      table_name: update.tableName,
      record_id: update.recordId,
      action: update.action
    });
  }
};

export default N8nClient;
