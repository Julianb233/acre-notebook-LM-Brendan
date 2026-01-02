'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SyncStatusBadge, type SyncStatus } from './SyncStatusBadge';
import { FreshnessIndicator } from './FreshnessIndicator';
import { SourceExplainer, type SourceType } from './SourceExplainer';
import { cn } from '@/lib/utils';

interface DataSourceCardProps {
  source: SourceType;
  name: string;
  description: string;
  icon: string;
  status: SyncStatus;
  lastSync: string | null;
  itemCount: number;
  lastError?: string | null;
  configured: boolean;
  onSync?: () => Promise<void>;
  onConfigure?: () => void;
  viewHref?: string;
  externalHref?: string;
}

export function DataSourceCard({
  source,
  name,
  description,
  icon,
  status,
  lastSync,
  itemCount,
  lastError,
  configured,
  onSync,
  onConfigure,
  viewHref,
  externalHref,
}: DataSourceCardProps) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    if (!onSync) return;
    setSyncing(true);
    setError(null);
    try {
      await onSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className={cn(
      'transition-all',
      !configured && 'opacity-60',
      status === 'error' && 'border-red-200 dark:border-red-800'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            <div>
              <CardTitle className="flex items-center gap-2">
                {name}
                <SourceExplainer source={source} trigger="icon" />
              </CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
          <SyncStatusBadge status={syncing ? 'syncing' : status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-2xl font-bold">
              {configured ? itemCount.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-muted-foreground">
              {source === 'documents' && 'Documents'}
              {source === 'fireflies' && 'Meetings'}
              {source === 'airtable' && 'Records'}
              {source === 'supabase' && 'Total Items'}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <FreshnessIndicator
              lastUpdated={lastSync}
              showLabel={true}
              showTime={false}
              size="sm"
            />
            <div className="text-xs text-muted-foreground mt-1">
              {lastSync
                ? new Date(lastSync).toLocaleDateString()
                : 'Never synced'}
            </div>
          </div>
        </div>

        {/* Error display */}
        {(lastError || error) && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-700 dark:text-red-400">
              ⚠️ {error || lastError}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {configured ? (
            <>
              {onSync && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? (
                    <>
                      <span className="animate-spin mr-2">⟳</span>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">🔄</span>
                      Sync Now
                    </>
                  )}
                </Button>
              )}
              {viewHref && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={viewHref}>
                    <span className="mr-2">👁️</span>
                    View All
                  </a>
                </Button>
              )}
              {externalHref && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={externalHref} target="_blank" rel="noopener noreferrer">
                    <span className="mr-2">↗️</span>
                    Open in {name}
                  </a>
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={onConfigure}
            >
              <span className="mr-2">⚙️</span>
              Configure
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
