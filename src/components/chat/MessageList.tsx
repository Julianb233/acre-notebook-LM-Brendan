'use client';

import { useRef, useEffect } from 'react';
import { User, Bot, Loader2, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SourceCitationsList } from './SourceCitation';
import type { Message as MessageType, SourceCitation, ConfidenceScore } from '@/types';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SourceCitation[];
  confidence?: ConfidenceScore;
  isStreaming?: boolean;
}

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

function ConfidenceIndicator({ confidence }: { confidence: ConfidenceScore }) {
  const getConfidenceColor = () => {
    switch (confidence.level) {
      case 'high':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getConfidenceIcon = () => {
    switch (confidence.level) {
      case 'high':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'medium':
        return <AlertCircle className="h-3 w-3" />;
      case 'low':
        return <HelpCircle className="h-3 w-3" />;
      default:
        return <HelpCircle className="h-3 w-3" />;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn('text-xs font-normal cursor-help', getConfidenceColor())}
          >
            {getConfidenceIcon()}
            <span className="ml-1 capitalize">{confidence.level} confidence</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">{confidence.explanation}</p>
          {confidence.sources_count !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              Based on {confidence.sources_count} source{confidence.sources_count !== 1 ? 's' : ''}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <Badge variant="secondary" className="text-xs">
          {message.content}
        </Badge>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex gap-3 py-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className={isUser ? 'bg-blue-600 text-white' : 'bg-gray-200'}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          'flex flex-col max-w-[80%]',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <Card
          className={cn(
            'px-4 py-3 shadow-sm',
            isUser
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white border-gray-200'
          )}
        >
          <div
            className={cn(
              'prose prose-sm max-w-none',
              isUser ? 'prose-invert' : 'prose-gray'
            )}
          >
            {message.content.split('\n').map((line, i) => (
              <p key={i} className={cn('mb-2 last:mb-0', !line && 'h-4')}>
                {line || '\u00A0'}
              </p>
            ))}
          </div>

          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-current opacity-75 animate-pulse ml-1" />
          )}
        </Card>

        {/* Confidence indicator for assistant messages */}
        {!isUser && message.confidence && (
          <div className="mt-2">
            <ConfidenceIndicator confidence={message.confidence} />
          </div>
        )}

        {/* Source citations for assistant messages */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="w-full mt-2">
            <SourceCitationsList citations={message.sources} compact />
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex gap-3 py-4">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="bg-gray-200">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <Card className="px-4 py-3 bg-white border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Thinking...</span>
        </div>
      </Card>
    </div>
  );
}

export function MessageList({ messages, isLoading = false }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <Bot className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Start a conversation
          </h3>
          <p className="text-gray-500 text-sm">
            Ask questions about your documents, meetings, or data. I'll provide
            answers with source citations so you know where the information comes from.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 px-4" ref={scrollRef}>
      <div className="max-w-3xl mx-auto py-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && <LoadingIndicator />}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
