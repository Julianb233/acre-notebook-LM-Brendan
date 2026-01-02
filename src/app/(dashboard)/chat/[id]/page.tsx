'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInterface } from '@/components/chat/ChatInterface';
import type { Conversation, Message, ApiResponse } from '@/types';

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const isNewChat = conversationId === 'new';

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(!isNewChat);
  const [error, setError] = useState<string | null>(null);

  // Fetch conversation and messages
  useEffect(() => {
    if (isNewChat) {
      setIsLoading(false);
      return;
    }

    async function fetchConversation() {
      try {
        const response = await fetch(`/api/chat?conversationId=${conversationId}`);
        const result: ApiResponse<{ conversation: Conversation; messages: Message[] }> =
          await response.json();

        if (!response.ok) {
          throw new Error(result.error?.message || 'Failed to fetch conversation');
        }

        setConversation(result.data?.conversation || null);
        setMessages(result.data?.messages || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching conversation:', err);
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
      } finally {
        setIsLoading(false);
      }
    }

    fetchConversation();
  }, [conversationId, isNewChat]);

  // Handle new conversation created
  const handleConversationCreated = (newId: string) => {
    // Update URL without full page reload
    router.replace(`/chat/${newId}`, { scroll: false });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-500">Loading conversation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Conversation</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => router.push('/chat')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chats
            </Button>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  // Map messages to the format expected by ChatInterface
  const initialMessages = messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Back navigation */}
      <div className="flex items-center gap-4 px-4 py-2 bg-white border-b">
        <Button variant="ghost" size="sm" onClick={() => router.push('/chat')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          All Chats
        </Button>
        {conversation && (
          <div className="flex-1 min-w-0">
            <h1 className="font-medium text-gray-900 truncate">{conversation.title}</h1>
          </div>
        )}
      </div>

      {/* Chat Interface */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface
          conversationId={isNewChat ? undefined : conversationId}
          initialMessages={initialMessages}
          onConversationCreated={handleConversationCreated}
        />
      </div>
    </div>
  );
}
