'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Video,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Settings,
  History,
  ChevronRight,
  Loader2,
  Zap,
  Shield,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatRelativeTime, getDataFreshness } from '@/lib/utils';

interface DataSource {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  type: 'documents' | 'fireflies' | 'airtable';
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  lastSync: Date | null;
  itemCount: number;
  configured: boolean;
  syncEndpoint: string;
}

interface SyncLog {
  id: string;
  source: string;
  timestamp: Date;
  action: 'sync_started' | 'sync_completed' | 'sync_failed' | 'items_added' | 'items_updated';
  details: string;
  itemsAffected?: number;
}

const initialDataSources: DataSource[] = [
  {
    id: 'documents',
    name: 'Documents',
    description: 'PDFs, Word docs, and other files uploaded directly',
    icon: FileText,
    type: 'documents',
    status: 'connected',
    lastSync: new Date(Date.now() - 1 * 60 * 60 * 1000),
    itemCount: 24,
    configured: true,
    syncEndpoint: '/api/documents/sync',
  },
  {
    id: 'fireflies',
    name: 'Fireflies.ai',
    description: 'Meeting transcripts and summaries from Fireflies',
    icon: Video,
    type: 'fireflies',
    status: 'connected',
    lastSync: new Date(Date.now() - 4 * 60 * 60 * 1000),
    itemCount: 8,
    configured: true,
    syncEndpoint: '/api/fireflies/sync',
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Structured data from your Airtable bases',
    icon: Database,
    type: 'airtable',
    status: 'connected',
    lastSync: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    itemCount: 156,
    configured: true,
    syncEndpoint: '/api/airtable/sync',
  },
];

// Mock sync logs - will be replaced with real data
const mockSyncLogs: SyncLog[] = [
  { id: '1', source: 'fireflies', timestamp: new Date(Date.now() - 30 * 60 * 1000), action: 'sync_completed', details: 'Successfully synced 3 new meeting transcripts', itemsAffected: 3 },
  { id: '2', source: 'airtable', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), action: 'sync_completed', details: 'Synced 12 records from Clients table', itemsAffected: 12 },
  { id: '3', source: 'documents', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), action: 'items_added', details: 'Q4 Financial Report.pdf uploaded and processed', itemsAffected: 1 },
  { id: '4', source: 'fireflies', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), action: 'sync_completed', details: 'Synced 5 meeting transcripts', itemsAffected: 5 },
  { id: '5', source: 'airtable', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000), action: 'sync_failed', details: 'API rate limit exceeded. Will retry in 1 hour.', itemsAffected: 0 },
];

export default function DataSourcesPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>(initialDataSources);
  const [syncLogs] = useState<SyncLog[]>(mockSyncLogs);
  const [syncingSource, setSyncingSource] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  // Fetch actual status from API
  const fetchSourceStatus = useCallback(async (source: DataSource) => {
    try {
      const response = await fetch(source.syncEndpoint);
      if (response.ok) {
        const data = await response.json();
        return {
          configured: data.configured,
          status: data.status?.status || 'disconnected',
          lastSync: data.status?.last_sync ? new Date(data.status.last_sync) : null,
          itemCount: data.totalRecords || data.totalTranscripts || source.itemCount,
        };
      }
    } catch {
      console.error(`Failed to fetch status for ${source.id}`);
    }
    return null;
  }, []);

  useEffect(() => {
    // Fetch status for each source on mount
    dataSources.forEach(async (source) => {
      const status = await fetchSourceStatus(source);
      if (status) {
        setDataSources(prev => prev.map(s =>
          s.id === source.id ? { ...s, ...status } : s
        ));
      }
    });
  }, [fetchSourceStatus, dataSources]);

  const handleSync = async (sourceId: string) => {
    const source = dataSources.find(s => s.id === sourceId);
    if (!source) return;

    setSyncingSource(sourceId);
    setDataSources(prev => prev.map(s =>
      s.id === sourceId ? { ...s, status: 'syncing' } : s
    ));

    try {
      const response = await fetch(source.syncEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setDataSources(prev => prev.map(s =>
          s.id === sourceId
            ? {
                ...s,
                status: 'connected',
                lastSync: new Date(),
                itemCount: data.details?.synced || s.itemCount,
              }
            : s
        ));
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error) {
      console.error(`Sync failed for ${sourceId}:`, error);
      setDataSources(prev => prev.map(s =>
        s.id === sourceId ? { ...s, status: 'error' } : s
      ));
    } finally {
      setSyncingSource(null);
    }
  };

  const getStatusBadge = (source: DataSource) => {
    const freshness = source.lastSync ? getDataFreshness(source.lastSync) : null;

    switch (source.status) {
      case 'connected':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {freshness?.emoji} {freshness?.label || 'Connected'}
          </Badge>
        );
      case 'syncing':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Syncing...
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Disconnected
          </Badge>
        );
    }
  };

  const getActionBadge = (action: SyncLog['action']) => {
    switch (action) {
      case 'sync_completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700">Completed</Badge>;
      case 'sync_started':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Started</Badge>;
      case 'sync_failed':
        return <Badge variant="outline" className="bg-red-50 text-red-700">Failed</Badge>;
      case 'items_added':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700">Added</Badge>;
      case 'items_updated':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Updated</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const totalItems = dataSources.reduce((sum, s) => sum + s.itemCount, 0);
  const connectedSources = dataSources.filter(s => s.status === 'connected').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Sources</h1>
          <p className="text-gray-500 mt-1">
            Manage and monitor your connected data sources
          </p>
        </div>
        <Button
          onClick={() => dataSources.forEach(s => handleSync(s.id))}
          disabled={syncingSource !== null}
        >
          {syncingSource ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sync All
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Database className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Items</p>
                <p className="text-2xl font-bold">{totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Connected Sources</p>
                <p className="text-2xl font-bold">{connectedSources}/{dataSources.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Data Freshness</p>
                <p className="text-2xl font-bold">
                  {dataSources.filter(s => {
                    const f = s.lastSync ? getDataFreshness(s.lastSync) : null;
                    return f?.status === 'fresh';
                  }).length}/{dataSources.length} Fresh
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50">
                <BarChart3 className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Sync Rate</p>
                <p className="text-2xl font-bold">98%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sources" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sources">Data Sources</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="sources">
          {/* Data Sources Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {dataSources.map((source) => {
              const Icon = source.icon;
              const freshness = source.lastSync ? getDataFreshness(source.lastSync) : null;
              const isSelected = selectedSource === source.id;

              return (
                <Card
                  key={source.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedSource(isSelected ? null : source.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          source.status === 'connected' ? 'bg-green-50' :
                          source.status === 'error' ? 'bg-red-50' : 'bg-gray-50'
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            source.status === 'connected' ? 'text-green-600' :
                            source.status === 'error' ? 'text-red-600' : 'text-gray-600'
                          }`} />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{source.name}</CardTitle>
                          <CardDescription className="text-sm">
                            {source.description}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                      {getStatusBadge(source)}
                      <span className="text-sm font-medium text-gray-600">
                        {source.itemCount} items
                      </span>
                    </div>

                    {/* Last Sync */}
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="h-4 w-4" />
                      {source.lastSync ? (
                        <span>Last synced {formatRelativeTime(source.lastSync)}</span>
                      ) : (
                        <span>Never synced</span>
                      )}
                    </div>

                    {/* Freshness Progress */}
                    {freshness && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Data Freshness</span>
                          <span className={freshness.color}>{freshness.label}</span>
                        </div>
                        <Progress
                          value={
                            freshness.status === 'fresh' ? 100 :
                            freshness.status === 'stale' ? 50 :
                            freshness.status === 'outdated' ? 20 : 0
                          }
                          className="h-1.5"
                        />
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSync(source.id);
                        }}
                        disabled={syncingSource === source.id}
                      >
                        {syncingSource === source.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Sync Now
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Expanded Details */}
                    {isSelected && (
                      <div className="pt-4 border-t space-y-3 animate-in slide-in-from-top-2">
                        <div className="text-sm">
                          <span className="text-gray-500">Sync Endpoint:</span>
                          <code className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {source.syncEndpoint}
                          </code>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-500">Configured:</span>
                          <span className={`ml-2 ${source.configured ? 'text-green-600' : 'text-red-600'}`}>
                            {source.configured ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <Button variant="outline" size="sm" className="w-full">
                          View Details <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="activity">
          {/* Activity Log */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Sync Activity
                  </CardTitle>
                  <CardDescription>
                    Recent sync operations and data changes
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  Export Log
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {syncLogs.map((log) => {
                  const source = dataSources.find(s => s.id === log.source);
                  const Icon = source?.icon || FileText;

                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-gray-50">
                        <Icon className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {source?.name || log.source}
                          </span>
                          {getActionBadge(log.action)}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{log.details}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(log.timestamp)}
                          </span>
                          {log.itemsAffected !== undefined && log.itemsAffected > 0 && (
                            <span>{log.itemsAffected} items affected</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
