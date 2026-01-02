import type { Meeting } from '@/types';

const FIREFLIES_API_URL = 'https://api.fireflies.ai/graphql';
const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY;

export interface FirefliesTranscript {
  id: string;
  title: string;
  date: string;
  duration: number;
  participants: string[];
  transcript_url: string;
  audio_url: string;
  summary: {
    overview: string;
    action_items: string[];
    keywords: string[];
  };
  sentences: Array<{
    speaker_name: string;
    text: string;
    start_time: number;
    end_time: number;
  }>;
}

export interface FirefliesListResponse {
  transcripts: FirefliesTranscript[];
  hasMore: boolean;
  cursor: string | null;
}

export interface FirefliesClientOptions {
  timeout?: number;
}

/**
 * Fireflies.ai GraphQL Client
 * Handles communication with Fireflies API for meeting transcripts
 */
export class FirefliesClient {
  private apiKey: string;
  private timeout: number;

  constructor(options: FirefliesClientOptions = {}) {
    if (!FIREFLIES_API_KEY) {
      console.warn('FIREFLIES_API_KEY not configured');
    }
    this.apiKey = FIREFLIES_API_KEY || '';
    this.timeout = options.timeout || 30000;
  }

  /**
   * Execute GraphQL query against Fireflies API
   */
  private async query<T>(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Fireflies API key not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(FIREFLIES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fireflies API error ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }

      return result.data as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get current user info
   */
  async getUser(): Promise<{ id: string; email: string; name: string }> {
    const query = `
      query {
        user {
          id
          email
          name
        }
      }
    `;

    const data = await this.query<{ user: { id: string; email: string; name: string } }>(query);
    return data.user;
  }

  /**
   * List recent transcripts
   */
  async listTranscripts(options: {
    limit?: number;
    cursor?: string;
    fromDate?: string;
  } = {}): Promise<FirefliesListResponse> {
    const { limit = 20, cursor, fromDate } = options;

    const query = `
      query Transcripts($limit: Int, $cursor: String, $fromDate: DateTime) {
        transcripts(limit: $limit, cursor: $cursor, fromDate: $fromDate) {
          id
          title
          date
          duration
          participants
          transcript_url
          audio_url
          summary {
            overview
            action_items
            keywords
          }
        }
      }
    `;

    const data = await this.query<{
      transcripts: Omit<FirefliesTranscript, 'sentences'>[];
    }>(query, { limit, cursor, fromDate });

    return {
      transcripts: data.transcripts.map(t => ({ ...t, sentences: [] })),
      hasMore: data.transcripts.length === limit,
      cursor: data.transcripts.length > 0
        ? data.transcripts[data.transcripts.length - 1].id
        : null,
    };
  }

  /**
   * Get full transcript with sentences
   */
  async getTranscript(id: string): Promise<FirefliesTranscript> {
    const query = `
      query Transcript($id: String!) {
        transcript(id: $id) {
          id
          title
          date
          duration
          participants
          transcript_url
          audio_url
          summary {
            overview
            action_items
            keywords
          }
          sentences {
            speaker_name
            text
            start_time
            end_time
          }
        }
      }
    `;

    const data = await this.query<{ transcript: FirefliesTranscript }>(query, { id });
    return data.transcript;
  }

  /**
   * Search transcripts by keyword
   */
  async searchTranscripts(keyword: string, limit: number = 10): Promise<FirefliesTranscript[]> {
    const query = `
      query SearchTranscripts($keyword: String!, $limit: Int) {
        transcripts(search: $keyword, limit: $limit) {
          id
          title
          date
          duration
          participants
          transcript_url
          summary {
            overview
            action_items
          }
        }
      }
    `;

    const data = await this.query<{ transcripts: Omit<FirefliesTranscript, 'sentences' | 'audio_url'>[] }>(
      query,
      { keyword, limit }
    );

    return data.transcripts.map(t => ({ ...t, sentences: [], audio_url: '' }));
  }

  /**
   * Convert Fireflies transcript to our Meeting format
   */
  transcriptToMeeting(
    transcript: FirefliesTranscript,
    partnerId: string
  ): Omit<Meeting, 'id' | 'created_at' | 'synced_at'> {
    // Combine all sentences into full transcript text
    const fullTranscript = transcript.sentences
      .map(s => `[${this.formatTime(s.start_time)}] ${s.speaker_name}: ${s.text}`)
      .join('\n');

    return {
      partner_id: partnerId,
      fireflies_id: transcript.id,
      title: transcript.title,
      participants: transcript.participants,
      transcript: fullTranscript || transcript.summary?.overview || '',
      summary: transcript.summary?.overview || null,
      action_items: transcript.summary?.action_items || [],
      date: transcript.date,
      duration_minutes: Math.round(transcript.duration / 60),
    };
  }

  /**
   * Format seconds to HH:MM:SS
   */
  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  }
}

/**
 * Singleton client instance
 */
let clientInstance: FirefliesClient | null = null;

export function getFirefliesClient(): FirefliesClient {
  if (!clientInstance) {
    clientInstance = new FirefliesClient();
  }
  return clientInstance;
}

export default FirefliesClient;
