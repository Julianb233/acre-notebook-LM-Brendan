export interface TextChunk {
  content: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
  metadata: {
    wordCount: number;
    tokenEstimate: number;
  };
}

export interface ChunkingOptions {
  /**
   * Target size for each chunk in characters
   * Default: 1500 (roughly 300-400 tokens)
   */
  chunkSize?: number;

  /**
   * Overlap between chunks in characters
   * Default: 200 (helps preserve context at boundaries)
   */
  chunkOverlap?: number;

  /**
   * Separators to split on, in order of preference
   */
  separators?: string[];
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  chunkSize: 1500,
  chunkOverlap: 200,
  separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' '],
};

/**
 * Estimate token count from text
 * Rough approximation: ~4 characters per token for English
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks using recursive character splitting
 * Tries to split on natural boundaries (paragraphs, sentences, etc.)
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { chunkSize, chunkOverlap, separators } = opts;

  // Clean and normalize text
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '    ')
    .trim();

  if (!cleanedText) {
    return [];
  }

  // If text is small enough, return as single chunk
  if (cleanedText.length <= chunkSize) {
    return [{
      content: cleanedText,
      chunkIndex: 0,
      startChar: 0,
      endChar: cleanedText.length,
      metadata: {
        wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
        tokenEstimate: estimateTokens(cleanedText),
      },
    }];
  }

  const chunks: TextChunk[] = [];
  let currentPosition = 0;
  let chunkIndex = 0;

  while (currentPosition < cleanedText.length) {
    // Determine end position for this chunk
    let endPosition = Math.min(currentPosition + chunkSize, cleanedText.length);

    // If not at the end, try to find a good break point
    if (endPosition < cleanedText.length) {
      const searchWindow = cleanedText.slice(
        Math.max(currentPosition + chunkSize - 200, currentPosition),
        endPosition
      );

      // Try each separator in order of preference
      let bestBreakOffset = -1;
      for (const sep of separators) {
        const lastIndex = searchWindow.lastIndexOf(sep);
        if (lastIndex !== -1) {
          bestBreakOffset = lastIndex + sep.length;
          break;
        }
      }

      if (bestBreakOffset !== -1) {
        endPosition = Math.max(currentPosition + chunkSize - 200, currentPosition) + bestBreakOffset;
      }
    }

    // Extract chunk content
    const chunkContent = cleanedText.slice(currentPosition, endPosition).trim();

    if (chunkContent) {
      chunks.push({
        content: chunkContent,
        chunkIndex,
        startChar: currentPosition,
        endChar: endPosition,
        metadata: {
          wordCount: chunkContent.split(/\s+/).filter(Boolean).length,
          tokenEstimate: estimateTokens(chunkContent),
        },
      });
      chunkIndex++;
    }

    // Move position forward, accounting for overlap
    currentPosition = endPosition - chunkOverlap;

    // Ensure we always make progress
    if (currentPosition <= chunks[chunks.length - 1]?.startChar) {
      currentPosition = endPosition;
    }
  }

  return chunks;
}

/**
 * Chunk a document with context-aware splitting
 * Adds document-level context to each chunk for better RAG retrieval
 */
export function chunkDocumentWithContext(
  text: string,
  documentName: string,
  options: ChunkingOptions = {}
): TextChunk[] {
  const chunks = chunkText(text, options);

  // Add document context prefix to each chunk
  // This helps the LLM understand the source
  return chunks.map((chunk, index) => ({
    ...chunk,
    content: `[Document: ${documentName}, Chunk ${index + 1}/${chunks.length}]\n\n${chunk.content}`,
    metadata: {
      ...chunk.metadata,
      // Recalculate after adding context
      tokenEstimate: estimateTokens(`[Document: ${documentName}, Chunk ${index + 1}/${chunks.length}]\n\n${chunk.content}`),
    },
  }));
}

/**
 * Merge small chunks together if they're under a threshold
 * Useful for post-processing to avoid very small chunks
 */
export function mergeSmallChunks(
  chunks: TextChunk[],
  minSize: number = 200
): TextChunk[] {
  if (chunks.length <= 1) return chunks;

  const merged: TextChunk[] = [];
  let currentChunk: TextChunk | null = null;

  for (const chunk of chunks) {
    if (!currentChunk) {
      currentChunk = { ...chunk };
      continue;
    }

    // If current chunk is small, try to merge with next
    if (currentChunk.content.length < minSize) {
      currentChunk = {
        ...currentChunk,
        content: currentChunk.content + '\n\n' + chunk.content,
        endChar: chunk.endChar,
        metadata: {
          wordCount: currentChunk.metadata.wordCount + chunk.metadata.wordCount,
          tokenEstimate: estimateTokens(currentChunk.content + '\n\n' + chunk.content),
        },
      };
    } else {
      merged.push(currentChunk);
      currentChunk = { ...chunk };
    }
  }

  if (currentChunk) {
    merged.push(currentChunk);
  }

  // Re-index chunks
  return merged.map((chunk, index) => ({
    ...chunk,
    chunkIndex: index,
  }));
}
