import { NextRequest } from 'next/server';
import { streamText, convertToModelMessages, type Message as AIMessage } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { getModel, getDefaultProvider, validateProvider, SYSTEM_PROMPT, type AIProvider } from '@/lib/ai/providers';
import { retrieveRelevantChunks, formatChunksForContext, formatSourceCitations } from '@/lib/ai/rag';
import type { SourceCitation } from '@/types';

interface ChatRequestBody {
  messages: AIMessage[];
  conversationId?: string;
  partnerId?: string;
  documentIds?: string[];
  provider?: AIProvider;
  useRAG?: boolean;
}

/**
 * POST /api/chat
 * Streaming chat endpoint with RAG integration
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ChatRequestBody = await request.json();
    const {
      messages,
      conversationId,
      partnerId,
      documentIds,
      provider: requestedProvider,
      useRAG = true,
    } = body;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the last user message for RAG query
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const query = lastUserMessage?.content as string || '';

    // Determine AI provider
    let provider: AIProvider = requestedProvider || getDefaultProvider();

    // If partnerId provided, check their preferred provider
    if (partnerId && !requestedProvider) {
      const { data: partner } = await supabase
        .from('partners')
        .select('settings')
        .eq('id', partnerId)
        .single();

      if (partner?.settings?.default_ai_provider) {
        provider = partner.settings.default_ai_provider as AIProvider;
      }
    }

    // Validate provider
    const validation = validateProvider(provider);
    if (!validation.valid) {
      // Fallback to any available provider
      const available = ['openai', 'anthropic', 'google'].find(p =>
        validateProvider(p as AIProvider).valid
      ) as AIProvider | undefined;

      if (!available) {
        return new Response(
          JSON.stringify({ error: 'No AI providers configured. Please set API keys.' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      provider = available;
    }

    // RAG: Retrieve relevant context
    let ragContext = '';
    let sourceCitations: SourceCitation[] = [];

    if (useRAG && query) {
      try {
        const ragResult = await retrieveRelevantChunks(query, {
          topK: 5,
          similarityThreshold: 0.7,
          documentIds,
          partnerId,
          maxTokens: 4000,
        });

        if (ragResult.chunks.length > 0) {
          ragContext = formatChunksForContext(ragResult.chunks);

          // Format source citations for the response
          sourceCitations = formatSourceCitations(ragResult.chunks).map((citation) => ({
            id: citation.id,
            type: 'document' as const,
            source_name: citation.documentName,
            source_id: citation.documentId,
            location: {
              chunk_index: citation.chunkIndex,
            },
            excerpt: citation.excerpt,
            relevance_score: citation.similarity,
            last_updated: new Date().toISOString(),
          }));
        }
      } catch (ragError) {
        console.error('RAG retrieval error:', ragError);
        // Continue without RAG context
      }
    }

    // Build the system message with RAG context
    const systemMessage = ragContext
      ? `${SYSTEM_PROMPT}\n\n---\n\n${ragContext}`
      : SYSTEM_PROMPT;

    // Get the AI model
    const model = getModel({ provider });

    // Create or update conversation record
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      // Create new conversation
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          partner_id: partnerId || user.id,
          title: query.slice(0, 100) || 'New Conversation',
        })
        .select()
        .single();

      if (convError) {
        console.error('Failed to create conversation:', convError);
      } else {
        currentConversationId = newConversation.id;
      }
    }

    // Store user message
    if (currentConversationId) {
      await supabase.from('messages').insert({
        conversation_id: currentConversationId,
        role: 'user',
        content: query,
        sources: [],
      });
    }

    // Stream the response
    const result = streamText({
      model,
      system: systemMessage,
      messages: convertToModelMessages(messages),
      temperature: 0.7,
      maxTokens: 2000,
      onFinish: async ({ text }) => {
        // Store assistant message after streaming completes
        if (currentConversationId) {
          await supabase.from('messages').insert({
            conversation_id: currentConversationId,
            role: 'assistant',
            content: text,
            sources: sourceCitations,
          });

          // Update conversation title if it was auto-generated
          if (!conversationId) {
            // Use first 50 chars of response as a better title
            const betterTitle = text.slice(0, 50).replace(/\n/g, ' ') + '...';
            await supabase
              .from('conversations')
              .update({ title: betterTitle })
              .eq('id', currentConversationId);
          }
        }
      },
    });

    // Return the streaming response with metadata headers
    const response = result.toDataStreamResponse();

    // Add custom headers for client-side use
    response.headers.set('X-Conversation-Id', currentConversationId || '');
    response.headers.set('X-Provider', provider);
    response.headers.set('X-Sources-Count', String(sourceCitations.length));

    // Include source citations in a custom header (base64 encoded for safety)
    if (sourceCitations.length > 0) {
      const citationsJson = JSON.stringify(sourceCitations);
      response.headers.set('X-Sources', Buffer.from(citationsJson).toString('base64'));
    }

    return response;

  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /api/chat?conversationId=xxx
 * Get conversation history
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (conversationId) {
      // Get specific conversation with messages
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (convError || !conversation) {
        return new Response(
          JSON.stringify({ error: 'Conversation not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (msgError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch messages' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ conversation, messages }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // List all conversations for the user
    const partnerId = searchParams.get('partnerId');

    let query = supabase
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (partnerId) {
      query = query.eq('partner_id', partnerId);
    }

    const { data: conversations, error: listError } = await query;

    if (listError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch conversations' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ conversations }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Chat GET error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
