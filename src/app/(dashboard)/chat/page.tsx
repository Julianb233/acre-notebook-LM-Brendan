'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Plus,
  Clock,
  Search,
  MoreVertical,
  Trash2,
  Edit2,
  Loader2,
  Sparkles,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatRelativeTime } from '@/lib/utils';
import type { Conversation, ApiResponse } from '@/types';

export default function ChatPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch conversations
  useEffect(() => {
    async function fetchConversations() {
      try {
        const response = await fetch('/api/chat');
        const result: ApiResponse<{ conversations: Conversation[] }> = await response.json();

        if (!response.ok) {
          throw new Error(result.error?.message || 'Failed to fetch conversations');
        }

        setConversations(result.data?.conversations || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching conversations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load conversations');
      } finally {
        setIsLoading(false);
      }
    }

    fetchConversations();
  }, []);

  // Filter conversations by search
  const filteredConversations = conversations.filter((conv) =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewChat = () => {
    // Navigate to new chat - we'll create the conversation on first message
    router.push('/chat/new');
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      // TODO: Implement delete API
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chat</h1>
          <p className="text-gray-500 mt-1">
            Ask questions about your documents and get AI-powered answers with sources
          </p>
        </div>
        <Button onClick={handleNewChat} className="gap-2">
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Conversations</p>
                <p className="text-2xl font-bold">{conversations.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">This Week</p>
                <p className="text-2xl font-bold text-blue-600">
                  {conversations.filter((c) => {
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return new Date(c.created_at) > weekAgo;
                  }).length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-green-50">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">AI Provider</p>
                <p className="text-2xl font-bold text-purple-600">Multi</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-50">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-500">Loading conversations...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversations List */}
      {!isLoading && !error && (
        <>
          {filteredConversations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Conversations</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <div className="divide-y">
                    {filteredConversations.map((conversation) => (
                      <Link
                        key={conversation.id}
                        href={`/chat/${conversation.id}`}
                        className="block"
                      >
                        <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <MessageSquare className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-medium text-gray-900 truncate">
                                {conversation.title}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Clock className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-500">
                                  {formatRelativeTime(conversation.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Edit2 className="h-4 w-4 mr-2" /> Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={(e) => handleDeleteConversation(conversation.id, e as any)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </Link>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchQuery ? 'No conversations found' : 'No conversations yet'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchQuery
                      ? 'Try a different search term'
                      : 'Start a new chat to ask questions about your documents'}
                  </p>
                  {!searchQuery && (
                    <Button onClick={handleNewChat}>
                      <Plus className="h-4 w-4 mr-2" />
                      Start New Chat
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Quick Start Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Start</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-gray-50">
              <FileText className="h-6 w-6 text-blue-600 mb-2" />
              <h4 className="font-medium text-gray-900 mb-1">Upload Documents</h4>
              <p className="text-sm text-gray-500">
                Upload PDFs, DOCXs, or text files to make them searchable
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gray-50">
              <Sparkles className="h-6 w-6 text-purple-600 mb-2" />
              <h4 className="font-medium text-gray-900 mb-1">Ask Questions</h4>
              <p className="text-sm text-gray-500">
                Get AI-powered answers based on your document content
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gray-50">
              <MessageSquare className="h-6 w-6 text-green-600 mb-2" />
              <h4 className="font-medium text-gray-900 mb-1">View Sources</h4>
              <p className="text-sm text-gray-500">
                Every answer includes citations so you know where info comes from
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
