'use client';

import { FileText, Calendar, Database, ExternalLink, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SourceCitation as SourceCitationType } from '@/types';
import { formatRelativeTime } from '@/lib/utils';

interface SourceCitationProps {
  citation: SourceCitationType;
  index: number;
  compact?: boolean;
}

export function SourceCitation({ citation, index, compact = false }: SourceCitationProps) {
  const getSourceIcon = () => {
    switch (citation.type) {
      case 'document':
        return <FileText className="h-3.5 w-3.5" />;
      case 'meeting':
        return <Calendar className="h-3.5 w-3.5" />;
      case 'airtable':
        return <Database className="h-3.5 w-3.5" />;
      default:
        return <FileText className="h-3.5 w-3.5" />;
    }
  };

  const getSourceColor = () => {
    switch (citation.type) {
      case 'document':
        return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
      case 'meeting':
        return 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100';
      case 'airtable':
        return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100';
    }
  };

  const getLocationLabel = () => {
    if (citation.location.page) {
      return `Page ${citation.location.page}`;
    }
    if (citation.location.timestamp) {
      return citation.location.timestamp;
    }
    if (citation.location.field) {
      return citation.location.field;
    }
    if (citation.location.chunk_index !== undefined) {
      return `Section ${citation.location.chunk_index + 1}`;
    }
    return null;
  };

  const getFreshnessColor = () => {
    if (!citation.last_updated) return 'text-gray-400';
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(citation.last_updated).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceUpdate <= 1) return 'text-green-500';
    if (daysSinceUpdate <= 7) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRelevanceLabel = () => {
    if (citation.relevance_score >= 0.9) return 'High match';
    if (citation.relevance_score >= 0.8) return 'Good match';
    if (citation.relevance_score >= 0.7) return 'Relevant';
    return 'Partial match';
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2 text-xs font-normal border ${getSourceColor()} transition-colors`}
            >
              {getSourceIcon()}
              <span className="ml-1">[{index}]</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm">
            <div className="space-y-2">
              <div className="font-medium">{citation.source_name}</div>
              {getLocationLabel() && (
                <div className="text-xs text-muted-foreground">{getLocationLabel()}</div>
              )}
              <p className="text-xs text-muted-foreground line-clamp-3">{citation.excerpt}</p>
              <div className="flex items-center justify-between text-xs">
                <span className={getFreshnessColor()}>
                  <Clock className="h-3 w-3 inline mr-1" />
                  {formatRelativeTime(citation.last_updated)}
                </span>
                <span className="text-muted-foreground">
                  {Math.round(citation.relevance_score * 100)}% match
                </span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div
      className={`rounded-lg border p-3 ${getSourceColor()} transition-colors cursor-pointer`}
      onClick={() => {
        if (citation.edit_url) {
          window.open(citation.edit_url, '_blank');
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0">{getSourceIcon()}</div>
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{citation.source_name}</div>
            {getLocationLabel() && (
              <div className="text-xs opacity-75">{getLocationLabel()}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge variant="secondary" className="text-xs">
            [{index}]
          </Badge>
          {citation.edit_url && (
            <ExternalLink className="h-3 w-3 opacity-50" />
          )}
        </div>
      </div>

      <p className="mt-2 text-xs opacity-80 line-clamp-2">{citation.excerpt}</p>

      <div className="mt-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <Clock className={`h-3 w-3 ${getFreshnessColor()}`} />
          <span className="opacity-75">{formatRelativeTime(citation.last_updated)}</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {getRelevanceLabel()}
        </Badge>
      </div>
    </div>
  );
}

interface SourceCitationsListProps {
  citations: SourceCitationType[];
  compact?: boolean;
}

export function SourceCitationsList({ citations, compact = false }: SourceCitationsListProps) {
  if (citations.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {citations.map((citation, index) => (
          <SourceCitation
            key={citation.id}
            citation={citation}
            index={index + 1}
            compact
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Sources ({citations.length})
      </div>
      <div className="grid gap-2">
        {citations.map((citation, index) => (
          <SourceCitation
            key={citation.id}
            citation={citation}
            index={index + 1}
          />
        ))}
      </div>
    </div>
  );
}
