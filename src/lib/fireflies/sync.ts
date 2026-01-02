import { createClient } from '@/lib/supabase/server';
import { generateEmbeddings, formatEmbeddingForPgvector } from '@/lib/ai/embeddings';
import { getFirefliesClient, type FirefliesTranscript } from './client';
import type { Meeting, MeetingChunk } from '@/types';

export interface SyncResult {
  success: boolean;
  meetingsProcessed: number;
  chunksCreated: number;
  errors: string[];
}

export interface ChunkOptions {
  maxChunkSize?: number;
  overlapSize?: number;
}

/**
 * Chunk meeting transcript into smaller pieces for embedding
 */
export function chunkTranscript(
  transcript: string,
  options: ChunkOptions = {}
): Array<{ content: string; metadata: { timestamp?: string; speaker?: string } }> {
  const { maxChunkSize = 1000, overlapSize = 200 } = options;

  // Split by speaker turns (lines starting with [timestamp] Speaker:)
  const lines = transcript.split('\n');
  const chunks: Array<{ content: string; metadata: { timestamp?: string; speaker?: string } }> = [];

  let currentChunk = '';
  let currentTimestamp: string | undefined;
  let currentSpeaker: string | undefined;

  for (const line of lines) {
    // Extract timestamp and speaker from line format: [00:00] Speaker: text
    const match = line.match(/^\[(\d+:\d+(?::\d+)?)\]\s*([^:]+):\s*(.*)$/);

    if (match) {
      const [, timestamp, speaker, text] = match;

      // If adding this line would exceed chunk size, save current and start new
      if (currentChunk.length + text.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: { timestamp: currentTimestamp, speaker: currentSpeaker }
        });

        // Start new chunk with overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(overlapSize / 5));
        currentChunk = overlapWords.join(' ') + '\n';
      }

      if (!currentTimestamp) {
        currentTimestamp = timestamp;
        currentSpeaker = speaker;
      }

      currentChunk += `${speaker}: ${text}\n`;
    } else if (line.trim()) {
      // Non-formatted line, add to current chunk
      currentChunk += line + '\n';
    }
  }

  // Add remaining content
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: { timestamp: currentTimestamp, speaker: currentSpeaker }
    });
  }

  // If no speaker-formatted content, fall back to simple chunking
  if (chunks.length === 0 && transcript.length > 0) {
    const words = transcript.split(' ');
    let chunk = '';

    for (const word of words) {
      if (chunk.length + word.length + 1 > maxChunkSize && chunk.length > 0) {
        chunks.push({ content: chunk.trim(), metadata: {} });
        const overlapWords = chunk.split(' ').slice(-Math.floor(overlapSize / 5));
        chunk = overlapWords.join(' ') + ' ';
      }
      chunk += word + ' ';
    }

    if (chunk.trim()) {
      chunks.push({ content: chunk.trim(), metadata: {} });
    }
  }

  return chunks;
}

/**
 * Sync and embed a single meeting from Fireflies
 */
export async function syncMeeting(
  firefliesId: string,
  partnerId: string
): Promise<{ success: boolean; meeting?: Meeting; chunksCreated: number; error?: string }> {
  try {
    const supabase = await createClient();
    const client = getFirefliesClient();

    // Check if meeting already exists
    const { data: existingMeeting } = await supabase
      .from('meetings')
      .select('id')
      .eq('fireflies_id', firefliesId)
      .single();

    if (existingMeeting) {
      return {
        success: true,
        chunksCreated: 0,
        error: 'Meeting already synced'
      };
    }

    // Fetch full transcript from Fireflies
    const transcript = await client.getTranscript(firefliesId);

    // Convert to our meeting format
    const meetingData = client.transcriptToMeeting(transcript, partnerId);

    // Insert meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        ...meetingData,
        synced_at: new Date().toISOString()
      })
      .select()
      .single();

    if (meetingError) {
      throw new Error(`Failed to insert meeting: ${meetingError.message}`);
    }

    // Chunk and embed transcript
    const chunks = chunkTranscript(meetingData.transcript);

    if (chunks.length === 0) {
      return { success: true, meeting, chunksCreated: 0 };
    }

    // Generate embeddings for all chunks
    const embeddingResults = await generateEmbeddings(chunks.map(c => c.content));

    // Prepare chunk records
    const chunkRecords = chunks.map((chunk, index) => ({
      meeting_id: meeting.id,
      content: chunk.content,
      embedding: formatEmbeddingForPgvector(embeddingResults[index].embedding),
      chunk_index: index,
      metadata: chunk.metadata
    }));

    // Insert chunks
    const { error: chunksError } = await supabase
      .from('meeting_chunks')
      .insert(chunkRecords);

    if (chunksError) {
      console.error('Failed to insert meeting chunks:', chunksError);
      // Don't fail the whole sync, meeting is already saved
    }

    return {
      success: true,
      meeting,
      chunksCreated: chunkRecords.length
    };
  } catch (error) {
    console.error('Meeting sync error:', error);
    return {
      success: false,
      chunksCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Sync recent meetings for a partner
 */
export async function syncRecentMeetings(
  partnerId: string,
  options: { limit?: number; fromDate?: string } = {}
): Promise<SyncResult> {
  const { limit = 10, fromDate } = options;
  const result: SyncResult = {
    success: true,
    meetingsProcessed: 0,
    chunksCreated: 0,
    errors: []
  };

  try {
    const client = getFirefliesClient();
    const supabase = await createClient();

    // Fetch recent transcripts from Fireflies
    const { transcripts } = await client.listTranscripts({ limit, fromDate });

    // Get already synced meeting IDs
    const { data: existingMeetings } = await supabase
      .from('meetings')
      .select('fireflies_id')
      .eq('partner_id', partnerId);

    const syncedIds = new Set(existingMeetings?.map(m => m.fireflies_id) || []);

    // Filter to only new meetings
    const newTranscripts = transcripts.filter(t => !syncedIds.has(t.id));

    // Sync each new meeting
    for (const transcript of newTranscripts) {
      const syncResult = await syncMeeting(transcript.id, partnerId);

      if (syncResult.success) {
        result.meetingsProcessed++;
        result.chunksCreated += syncResult.chunksCreated;
      } else if (syncResult.error) {
        result.errors.push(`${transcript.title}: ${syncResult.error}`);
      }
    }

    if (result.errors.length > 0) {
      result.success = result.meetingsProcessed > 0;
    }

    return result;
  } catch (error) {
    console.error('Batch sync error:', error);
    return {
      success: false,
      meetingsProcessed: 0,
      chunksCreated: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

/**
 * Re-embed an existing meeting (for updating embeddings)
 */
export async function reembedMeeting(meetingId: string): Promise<{
  success: boolean;
  chunksUpdated: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      throw new Error('Meeting not found');
    }

    // Delete existing chunks
    await supabase
      .from('meeting_chunks')
      .delete()
      .eq('meeting_id', meetingId);

    // Re-chunk and embed
    const chunks = chunkTranscript(meeting.transcript);

    if (chunks.length === 0) {
      return { success: true, chunksUpdated: 0 };
    }

    const embeddingResults = await generateEmbeddings(chunks.map(c => c.content));

    const chunkRecords = chunks.map((chunk, index) => ({
      meeting_id: meetingId,
      content: chunk.content,
      embedding: formatEmbeddingForPgvector(embeddingResults[index].embedding),
      chunk_index: index,
      metadata: chunk.metadata
    }));

    const { error: chunksError } = await supabase
      .from('meeting_chunks')
      .insert(chunkRecords);

    if (chunksError) {
      throw new Error(`Failed to insert chunks: ${chunksError.message}`);
    }

    return { success: true, chunksUpdated: chunkRecords.length };
  } catch (error) {
    console.error('Re-embed error:', error);
    return {
      success: false,
      chunksUpdated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Search meeting chunks by semantic similarity
 */
export async function searchMeetingChunks(
  query: string,
  options: {
    partnerId?: string;
    meetingId?: string;
    limit?: number;
    threshold?: number;
  } = {}
): Promise<Array<MeetingChunk & { similarity: number; meeting_title?: string }>> {
  const { partnerId, meetingId, limit = 10, threshold = 0.7 } = options;

  try {
    const supabase = await createClient();
    const { generateEmbedding } = await import('@/lib/ai/embeddings');

    // Generate query embedding
    const { embedding } = await generateEmbedding(query);
    const queryVector = formatEmbeddingForPgvector(embedding);

    // Build the query
    let rpcQuery = supabase.rpc('match_meeting_chunks', {
      query_embedding: queryVector,
      match_threshold: threshold,
      match_count: limit
    });

    const { data, error } = await rpcQuery;

    if (error) {
      console.error('Meeting chunk search error:', error);
      return [];
    }

    // Filter by partner or meeting if specified
    let results = data || [];

    if (partnerId || meetingId) {
      const meetingIds = meetingId ? [meetingId] : [];

      if (partnerId && !meetingId) {
        const { data: partnerMeetings } = await supabase
          .from('meetings')
          .select('id')
          .eq('partner_id', partnerId);

        meetingIds.push(...(partnerMeetings?.map(m => m.id) || []));
      }

      results = results.filter((r: MeetingChunk) => meetingIds.includes(r.meeting_id));
    }

    return results;
  } catch (error) {
    console.error('Search meeting chunks error:', error);
    return [];
  }
}
