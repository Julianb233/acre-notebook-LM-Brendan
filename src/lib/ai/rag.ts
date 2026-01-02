import { createClient } from '@/lib/supabase/server';
import { generateEmbedding, formatEmbeddingForPgvector } from './embeddings';

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  similarity: number;
  chunkIndex: number;
  metadata: {
    startChar: number;
    endChar: number;
    wordCount: number;
    tokenEstimate: number;
  };
}

export interface RAGResult {
  chunks: RetrievedChunk[];
  query: string;
  totalTokens: number;
}

export interface RAGOptions {
  /**
   * Maximum number of chunks to retrieve
   * Default: 5
   */
  topK?: number;

  /**
   * Minimum similarity threshold (0-1)
   * Default: 0.7
   */
  similarityThreshold?: number;

  /**
   * Filter to specific document IDs
   */
  documentIds?: string[];

  /**
   * Filter to specific partner ID
   */
  partnerId?: string;

  /**
   * Maximum total tokens across all chunks
   * Default: 4000
   */
  maxTokens?: number;
}

const DEFAULT_OPTIONS: Required<Omit<RAGOptions, 'documentIds' | 'partnerId'>> = {
  topK: 5,
  similarityThreshold: 0.7,
  maxTokens: 4000,
};

/**
 * Retrieve relevant document chunks using vector similarity search
 * Uses pgvector's cosine distance operator for efficient similarity matching
 */
export async function retrieveRelevantChunks(
  query: string,
  options: RAGOptions = {}
): Promise<RAGResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const supabase = await createClient();

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Build the similarity search query using pgvector
  // Using the <=> operator for cosine distance (1 - cosine_similarity)
  // So we need to order ascending and convert to similarity
  let rpcQuery = supabase.rpc('match_document_chunks', {
    query_embedding: formatEmbeddingForPgvector(queryEmbedding.embedding),
    match_threshold: opts.similarityThreshold,
    match_count: opts.topK * 2, // Fetch extra to allow filtering
  });

  const { data: matchedChunks, error: searchError } = await rpcQuery;

  if (searchError) {
    console.error('Vector search error:', searchError);
    throw new Error(`Failed to search documents: ${searchError.message}`);
  }

  if (!matchedChunks || matchedChunks.length === 0) {
    return {
      chunks: [],
      query,
      totalTokens: queryEmbedding.tokenCount,
    };
  }

  // Get document details for matched chunks
  const documentIds = [...new Set(matchedChunks.map((c: any) => c.document_id))];

  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('id, name, partner_id')
    .in('id', documentIds);

  if (docError) {
    console.error('Document fetch error:', docError);
    throw new Error(`Failed to fetch document details: ${docError.message}`);
  }

  const documentMap = new Map(documents?.map(d => [d.id, d]) || []);

  // Apply filters and token limit
  let totalTokens = queryEmbedding.tokenCount;
  const filteredChunks: RetrievedChunk[] = [];

  for (const chunk of matchedChunks) {
    // Apply document filter if specified
    if (opts.documentIds && !opts.documentIds.includes(chunk.document_id)) {
      continue;
    }

    // Apply partner filter if specified
    const doc = documentMap.get(chunk.document_id);
    if (opts.partnerId && doc?.partner_id !== opts.partnerId) {
      continue;
    }

    // Check token budget
    const chunkTokens = chunk.metadata?.tokenEstimate || Math.ceil(chunk.content.length / 4);
    if (totalTokens + chunkTokens > opts.maxTokens) {
      break;
    }

    totalTokens += chunkTokens;

    filteredChunks.push({
      id: chunk.id,
      documentId: chunk.document_id,
      documentName: doc?.name || 'Unknown Document',
      content: chunk.content,
      similarity: chunk.similarity,
      chunkIndex: chunk.chunk_index,
      metadata: chunk.metadata || {
        startChar: 0,
        endChar: chunk.content.length,
        wordCount: chunk.content.split(/\s+/).length,
        tokenEstimate: chunkTokens,
      },
    });

    // Stop if we have enough chunks
    if (filteredChunks.length >= opts.topK) {
      break;
    }
  }

  return {
    chunks: filteredChunks,
    query,
    totalTokens,
  };
}

/**
 * Format retrieved chunks into context for the LLM
 * Includes source attribution for transparency
 */
export function formatChunksForContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return 'No relevant documents found.';
  }

  const contextParts = chunks.map((chunk, index) => {
    return `[Source ${index + 1}: ${chunk.documentName} (Chunk ${chunk.chunkIndex + 1})]
${chunk.content}
---`;
  });

  return `Here is the relevant information from the uploaded documents:

${contextParts.join('\n\n')}

Use the above sources to answer the question. Always cite which source you're referencing.`;
}

/**
 * Format chunks as source citations for display in UI
 */
export function formatSourceCitations(chunks: RetrievedChunk[]): Array<{
  id: string;
  documentId: string;
  documentName: string;
  excerpt: string;
  similarity: number;
  chunkIndex: number;
}> {
  return chunks.map((chunk) => ({
    id: chunk.id,
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    excerpt: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? '...' : ''),
    similarity: chunk.similarity,
    chunkIndex: chunk.chunkIndex,
  }));
}

/**
 * Hybrid search combining vector similarity with keyword matching
 * Useful when exact terms matter (e.g., product names, dates)
 */
export async function hybridSearch(
  query: string,
  options: RAGOptions & { keywordBoost?: number } = {}
): Promise<RAGResult> {
  const { keywordBoost = 0.3, ...ragOptions } = options;

  // Get vector search results
  const vectorResults = await retrieveRelevantChunks(query, {
    ...ragOptions,
    topK: (ragOptions.topK || 5) * 2, // Get more for reranking
  });

  if (vectorResults.chunks.length === 0) {
    return vectorResults;
  }

  // Extract keywords from query (simple approach)
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3);

  // Rerank based on keyword presence
  const rerankedChunks = vectorResults.chunks.map((chunk) => {
    const contentLower = chunk.content.toLowerCase();
    const keywordMatches = keywords.filter(kw => contentLower.includes(kw)).length;
    const keywordScore = keywords.length > 0 ? keywordMatches / keywords.length : 0;

    // Combine vector similarity with keyword score
    const combinedScore = chunk.similarity * (1 - keywordBoost) + keywordScore * keywordBoost;

    return {
      ...chunk,
      similarity: combinedScore,
    };
  });

  // Sort by combined score and take top K
  rerankedChunks.sort((a, b) => b.similarity - a.similarity);
  const topChunks = rerankedChunks.slice(0, ragOptions.topK || 5);

  return {
    chunks: topChunks,
    query,
    totalTokens: vectorResults.totalTokens,
  };
}
