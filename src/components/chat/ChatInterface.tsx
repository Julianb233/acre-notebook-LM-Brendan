'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
import { Settings, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SourceCitationsList } from './SourceCitation';
import type { SourceCitation, AIProvider } from '@/types';

interface ChatInterfaceProps {
  conversationId?: string;
  partnerId?: string;
  documentIds?: string[];
  initialMessages?: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  onConversationCreated?: (conversationId: string) => void;
}

export function ChatInterface({
  conversationId: initialConversationId,
  partnerId,
  documentIds,
  initialMessages = [],
  onConversationCreated,
}: ChatInterfaceProps) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [useRAG, setUseRAG] = useState(true);
  const [sourceCitations, setSourceCitations] = useState<SourceCitation[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const lastResponseIdRef = useRef<string | null>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    setMessages,
    append,
  } = useChat({
    api: '/api/chat',
    id: conversationId,
    initialMessages: initialMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    })),
    body: {
      conversationId,
      partnerId,
      documentIds,
      provider,
      useRAG,
    },
    onResponse: async (response) => {
      // Extract conversation ID from response headers
      const newConversationId = response.headers.get('X-Conversation-Id');
      if (newConversationId && !conversationId) {
        setConversationId(newConversationId);
        onConversationCreated?.(newConversationId);
      }

      // Extract source citations from headers
      const sourcesBase64 = response.headers.get('X-Sources');
      if (sourcesBase64) {
        try {
          const sourcesJson = atob(sourcesBase64);
          const sources: SourceCitation[] = JSON.parse(sourcesJson);
          setSourceCitations(sources);
        } catch (e) {
          console.error('Failed to parse sources:', e);
        }
      } else {
        setSourceCitations([]);
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // Send message handler for ChatInput
  const handleSend = useCallback((content: string) => {
    append({
      role: 'user',
      content,
    });
  }, [append]);

  // Map messages to include sources for the last assistant message
  const messagesWithSources = messages.map((message, index) => {
    const isLastAssistant =
      message.role === 'assistant' &&
      index === messages.length - 1;

    return {
      id: message.id,
      role: message.role as 'user' | 'assistant' | 'system',
      content: message.content,
      sources: isLastAssistant ? sourceCitations : undefined,
      isStreaming: isLastAssistant && isLoading,
    };
  });

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">AI Assistant</h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Badge variant="outline" className="text-xs capitalize">
                {provider}
              </Badge>
              {useRAG && (
                <Badge variant="secondary" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  RAG enabled
                </Badge>
              )}
              {documentIds && documentIds.length > 0 && (
                <span>{documentIds.length} doc(s) selected</span>
              )}
            </div>
          </div>
        </div>

        <Sheet open={showSettings} onOpenChange={setShowSettings}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Chat Settings</SheetTitle>
              <SheetDescription>
                Configure AI provider and retrieval settings
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* AI Provider */}
              <div className="space-y-2">
                <Label htmlFor="provider">AI Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => setProvider(v as AIProvider)}
                >
                  <SelectTrigger id="provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="google">Google (Gemini)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Choose which AI model to use for responses
                </p>
              </div>

              {/* RAG Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="rag">Document Retrieval (RAG)</Label>
                  <p className="text-xs text-gray-500">
                    Search your documents for relevant context
                  </p>
                </div>
                <Switch
                  id="rag"
                  checked={useRAG}
                  onCheckedChange={setUseRAG}
                />
              </div>

              {/* Conversation info */}
              {conversationId && (
                <div className="pt-4 border-t">
                  <Label className="text-xs text-gray-500">Conversation ID</Label>
                  <p className="text-xs font-mono text-gray-400 mt-1 truncate">
                    {conversationId}
                  </p>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Messages */}
      <MessageList
        messages={messagesWithSources}
        isLoading={isLoading}
      />

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-sm text-red-600 text-center">
            {error.message || 'An error occurred. Please try again.'}
          </p>
        </div>
      )}

      {/* Expanded source citations when not streaming */}
      {!isLoading && sourceCitations.length > 0 && messages.length > 0 && (
        <div className="px-4 py-3 bg-white border-t">
          <div className="max-w-3xl mx-auto">
            <SourceCitationsList citations={sourceCitations} />
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        onStop={stop}
        placeholder={
          documentIds && documentIds.length > 0
            ? 'Ask about your selected documents...'
            : 'Ask a question about your documents...'
        }
      />
    </div>
  );
}
