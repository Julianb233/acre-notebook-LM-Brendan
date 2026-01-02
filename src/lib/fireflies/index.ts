// Fireflies.ai Integration Module
// Provides meeting transcript fetching, syncing, and embedding for RAG

export {
  FirefliesClient,
  getFirefliesClient,
  type FirefliesTranscript,
  type FirefliesListResponse,
  type FirefliesClientOptions
} from './client';

export {
  syncMeeting,
  syncRecentMeetings,
  reembedMeeting,
  searchMeetingChunks,
  chunkTranscript,
  type SyncResult,
  type ChunkOptions
} from './sync';
