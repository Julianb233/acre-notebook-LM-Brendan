'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage as Message } from 'ai';
import { Headphones } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SourceCitationsList } from './SourceCitation';
import { AudioOverview } from './AudioOverview';
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

const SUGGESTED_QUESTIONS = [
  "Summarize the key points",
  "What are the main risks?",
  "Create a briefing doc",
  "Compare Q3 vs Q4"
];

export function ChatInterface({
  conversationId: initialConversationId,
  partnerId,
  documentIds,
  initialMessages = [],
  onConversationCreated,
}: ChatInterfaceProps) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [provider, setProvider] = useState<AIProvider>('google');
  const [useRAG, setUseRAG] = useState(true);
  const [sourceCitations, setSourceCitations] = useState<SourceCitation[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const lastResponseIdRef = useRef<string | null>(null);

  const {
    messages,
    status,
    error,
    stop,
    setMessages,
    append,
  } = useChat({
    api: '/api/chat',
    body: {
      conversationId,
      partnerId,
      documentIds,
      provider,
      useRAG,
    },
    id: conversationId,
  } as any) as any;

  // Load initial messages on mount
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      })));
    }
  }, [initialMessages, messages.length, setMessages]);

  // Extract metadata from responses
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant' && lastMessage.id !== lastResponseIdRef.current) {
      lastResponseIdRef.current = lastMessage.id;

      // Store conversation ID if created
      if (!conversationId && lastMessage.id) {
        const newConvId = lastMessage.id.split('-')[0];
        if (newConvId && newConvId !== lastMessage.id) {
          setConversationId(newConvId);
          onConversationCreated?.(newConvId);
        }
      }
    }
  }, [messages, conversationId, onConversationCreated]);

  // Check if currently loading (streaming or submitted)
  const isLoading = status === 'streaming' || status === 'submitted';

  // Send message handler for ChatInput
  const handleSend = useCallback((content: string) => {
    append({
      role: 'user',
      content: content,
    });
  }, [append]);

  const handleSuggestionClick = (question: string) => {
    append({
      role: 'user',
      content: question,
    });
  };

  // Map messages to include sources for the last assistant message
  const messagesWithSources = (messages as any[]).map((message: any, index) => {
    const isLastAssistant =
      message.role === 'assistant' &&
      index === messages.length - 1;

    // Extract text content
    let content = message.content || '';

    // Fallback to parts if content is empty (e.g. multimodal)
    if (!content && message.parts) {
      content = message.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');
    }

    return {
      id: message.id,
      role: message.role as 'user' | 'assistant' | 'system',
      content,
      sources: isLastAssistant ? sourceCitations : undefined,
      isStreaming: isLastAssistant && isLoading,
    };
  });

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">
      {
        activeTab === 'chat' ? (
          <>
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

            {/* Input Area */}
            <div className="bg-white border-t p-4 pb-6">
              {/* Suggestion Chips */}
              {messages.length === 0 && (
                <div className="flex gap-2 overflow-x-auto pb-3 max-w-3xl mx-auto scrollbar-hide">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(q)}
                      className="whitespace-nowrap px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium border border-blue-100 hover:bg-blue-100 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

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
          </>
        ) : (
          <div className="flex-1 bg-white">
            <AudioOverview />
          </div>
        )
      }
    </div >
  );
}
