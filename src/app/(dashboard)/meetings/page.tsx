'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RefreshCw,
  Search,
  Calendar,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  Video,
  FileText
} from 'lucide-react';

interface Meeting {
  id: string;
  fireflies_id: string;
  title: string;
  date: string;
  duration_minutes: number;
  participants: string[];
  summary: string | null;
  synced_at: string;
}

interface SyncStatus {
  total_meetings: number;
  total_chunks: number;
  last_sync: string | null;
  api_configured: boolean;
}

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch meetings and sync status
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [meetingsRes, statusRes] = await Promise.all([
          fetch('/api/fireflies?source=local'),
          fetch('/api/fireflies/sync')
        ]);

        if (!meetingsRes.ok || !statusRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const meetingsData = await meetingsRes.json();
        const statusData = await statusRes.json();

        setMeetings(meetingsData.local_meetings || []);
        setSyncStatus(statusData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load meetings');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Sync recent meetings
  async function handleSync() {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch('/api/fireflies/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_recent', limit: 10 })
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const result = await response.json();

      if (result.success) {
        // Refresh the meetings list
        const meetingsRes = await fetch('/api/fireflies?source=local');
        const meetingsData = await meetingsRes.json();
        setMeetings(meetingsData.local_meetings || []);

        // Refresh sync status
        const statusRes = await fetch('/api/fireflies/sync');
        const statusData = await statusRes.json();
        setSyncStatus(statusData);
      } else if (result.errors?.length > 0) {
        setError(result.errors.join(', '));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  // Filter meetings by search
  const filteredMeetings = meetings.filter(meeting =>
    meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    meeting.participants.some(p => p.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Format date
  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Format duration
  function formatDuration(minutes: number) {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meetings</h1>
          <p className="text-muted-foreground">
            Synced meeting transcripts from Fireflies.ai
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing || !syncStatus?.api_configured}>
          {syncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Meetings
            </>
          )}
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Meetings</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-16" /> : syncStatus?.total_meetings || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Indexed Chunks</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? <Skeleton className="h-8 w-16" /> : syncStatus?.total_chunks || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Sync</CardDescription>
            <CardTitle className="text-lg">
              {loading ? (
                <Skeleton className="h-6 w-24" />
              ) : syncStatus?.last_sync ? (
                formatDate(syncStatus.last_sync)
              ) : (
                'Never'
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>API Status</CardDescription>
            <CardTitle className="flex items-center gap-2">
              {loading ? (
                <Skeleton className="h-6 w-24" />
              ) : syncStatus?.api_configured ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Connected
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  Not Configured
                </>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search meetings by title or participants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Meetings List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-1/3 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredMeetings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No meetings found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? 'No meetings match your search.'
                : 'Sync your Fireflies.ai meetings to get started.'}
            </p>
            {!searchQuery && syncStatus?.api_configured && (
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredMeetings.map((meeting) => (
            <Card
              key={meeting.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => router.push(`/meetings/${meeting.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{meeting.title}</h3>
                    {meeting.summary && (
                      <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                        {meeting.summary}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(meeting.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDuration(meeting.duration_minutes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {meeting.participants.length} participants
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="secondary">
                      <FileText className="h-3 w-3 mr-1" />
                      Indexed
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
