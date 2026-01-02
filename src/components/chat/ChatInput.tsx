'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Paperclip, Mic, StopCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  onStop?: () => void;
}

export function ChatInput({
  onSend,
  isLoading = false,
  placeholder = 'Ask a question about your documents...',
  disabled = false,
  onStop,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (trimmedInput && !isLoading && !disabled) {
      onSend(trimmedInput);
      setInput('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = input.trim().length > 0 && !isLoading && !disabled;

  return (
    <div className="border-t bg-white p-4">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-2">
          {/* Attachment button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 h-10 w-10 text-gray-500 hover:text-gray-700"
                  disabled={disabled || isLoading}
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Attach files (coming soon)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Input area */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              className={cn(
                'min-h-[44px] max-h-[200px] resize-none pr-12',
                'rounded-2xl border-gray-200 focus:border-blue-300 focus:ring-blue-200',
                'placeholder:text-gray-400'
              )}
              rows={1}
            />

            {/* Character count (subtle) */}
            {input.length > 500 && (
              <span className="absolute right-14 bottom-3 text-xs text-gray-400">
                {input.length}/4000
              </span>
            )}
          </div>

          {/* Voice input button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 h-10 w-10 text-gray-500 hover:text-gray-700"
                  disabled={disabled || isLoading}
                >
                  <Mic className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Voice input (coming soon)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Send/Stop button */}
          {isLoading && onStop ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="flex-shrink-0 h-10 w-10"
                    onClick={onStop}
                  >
                    <StopCircle className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Stop generating
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              size="icon"
              className={cn(
                'flex-shrink-0 h-10 w-10 transition-colors',
                canSend
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
              onClick={handleSend}
              disabled={!canSend}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          )}
        </div>

        {/* Helper text */}
        <p className="text-xs text-gray-400 mt-2 text-center">
          Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">Enter</kbd> to send,{' '}
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">Shift + Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
}
