-- Migration: Add match_document_chunks function for RAG vector search
-- This function is called by src/lib/ai/rag.ts for similarity search

-- Create the match_document_chunks function that the RAG module expects
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION match_document_chunks(vector, float, int) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION match_document_chunks IS 'Vector similarity search for document chunks using pgvector cosine distance. Returns chunks with similarity above threshold, ordered by relevance.';
