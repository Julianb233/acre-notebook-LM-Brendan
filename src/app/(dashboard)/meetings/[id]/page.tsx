'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  CheckSquare,
  FileText,
  RefreshCw,
  Loader2,
  MessageSquare,
  Copy,
  Check
} from 'lucide-react';
import type { Meeting } from '@/types';

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [reembedding, setReembedding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMeeting() {
      try {
        setLoading(true);
        const supabase = createClient();

        const { data, error: fetchError } = await supabase
          .from('meetings')
          .select('*')
          .eq('id', meetingId)
          .single();

        if (fetchError) throw fetchError;
        setMeeting(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load meeting');
      } finally {
        setLoading(false);
      }
    }

    if (meetingId) {
      fetchMeeting();
    }
  }, [meetingId]);

  async function handleReembed() {
    try {
      setReembedding(true);
      setError(null);

      const response = await fetch('/api/fireflies/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reembed', meeting_id: meetingId })
      });

      if (!response.ok) throw new Error('Re-embedding failed');

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Re-embedding failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-embedding failed');
    } finally {
      setReembedding(false);
    }
  }

  async function copyTranscript() {
    if (!meeting?.transcript) return;
    await navigator.clipboard.writeText(meeting.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function formatDuration(minutes: number) {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Meeting Not Found</h3>
            <p className="text-muted-foreground mb-4">{error || 'The meeting could not be found.'}</p>
            <Button onClick={() => router.push('/meetings')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Meetings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/meetings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{meeting.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(meeting.date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(meeting.duration_minutes)}
            </span>
          </div>
        </div>
        <Button variant="outline" onClick={handleReembed} disabled={reembedding}>
          {reembedding ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Re-indexing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Re-index
            </>
          )}
        </Button>
      </div>

      {/* Metadata Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participants
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {meeting.participants.map((participant, i) => (
                <Badge key={i} variant="secondary">
                  {participant}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Action Items
            </CardDescription>
          </CardHeader>
          <CardContent>
            {meeting.action_items && meeting.action_items.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {meeting.action_items.slice(0, 3).map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span className="line-clamp-1">{item}</span>
                  </li>
                ))}
                {meeting.action_items.length > 3 && (
                  <li className="text-muted-foreground">
                    +{meeting.action_items.length - 3} more
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No action items</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Use in Chat
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => router.push(`/chat?meeting=${meetingId}`)}
            >
              Ask questions about this meeting
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList>
          <TabsTrigger value="summary">
            <FileText className="h-4 w-4 mr-2" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="transcript">
            <MessageSquare className="h-4 w-4 mr-2" />
            Transcript
          </TabsTrigger>
          <TabsTrigger value="actions">
            <CheckSquare className="h-4 w-4 mr-2" />
            Action Items
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Meeting Summary</CardTitle>
              <CardDescription>
                AI-generated summary from Fireflies.ai
              </CardDescription>
            </CardHeader>
            <CardContent>
              {meeting.summary ? (
                <p className="whitespace-pre-wrap">{meeting.summary}</p>
              ) : (
                <p className="text-muted-foreground">No summary available for this meeting.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcript" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Full Transcript</CardTitle>
                <CardDescription>
                  Complete meeting transcript with speaker attribution
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={copyTranscript}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {meeting.transcript ? (
                <div className="bg-muted p-4 rounded-lg max-h-[600px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {meeting.transcript}
                  </pre>
                </div>
              ) : (
                <p className="text-muted-foreground">No transcript available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Action Items</CardTitle>
              <CardDescription>
                Tasks and follow-ups identified from the meeting
              </CardDescription>
            </CardHeader>
            <CardContent>
              {meeting.action_items && meeting.action_items.length > 0 ? (
                <ul className="space-y-3">
                  {meeting.action_items.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <CheckSquare className="h-5 w-5 text-primary mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No action items identified for this meeting.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
