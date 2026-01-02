'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  MessageSquare,
  Sparkles,
  Database,
  Video,
  Upload,
  TrendingUp,
  Clock,
  ArrowRight,
  Plus,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime, getDataFreshness } from '@/lib/utils';

// Mock data - will be replaced with real data from Supabase
const stats = {
  documents: { count: 24, trend: '+3 this week' },
  conversations: { count: 12, trend: '+5 this week' },
  meetings: { count: 8, trend: '+2 this week' },
  generated: { count: 15, trend: '+4 this week' },
};

const recentDocuments = [
  { id: '1', name: 'Q4 Financial Report.pdf', type: 'document', uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), status: 'processed' },
  { id: '2', name: 'Marketing Strategy 2025.docx', type: 'document', uploadedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), status: 'processed' },
  { id: '3', name: 'Product Roadmap.pdf', type: 'document', uploadedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), status: 'processing' },
];

const recentConversations = [
  { id: '1', title: 'Analyzing Q4 revenue trends', lastMessage: new Date(Date.now() - 30 * 60 * 1000), messageCount: 8 },
  { id: '2', title: 'Marketing campaign ideas', lastMessage: new Date(Date.now() - 3 * 60 * 60 * 1000), messageCount: 15 },
  { id: '3', title: 'Product feature comparison', lastMessage: new Date(Date.now() - 6 * 60 * 60 * 1000), messageCount: 6 },
];

const dataSources = [
  { id: '1', name: 'Documents', icon: FileText, count: 24, lastSync: new Date(Date.now() - 1 * 60 * 60 * 1000), status: 'connected' },
  { id: '2', name: 'Fireflies Meetings', icon: Video, count: 8, lastSync: new Date(Date.now() - 4 * 60 * 60 * 1000), status: 'connected' },
  { id: '3', name: 'Airtable Data', icon: Database, count: 156, lastSync: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), status: 'stale' },
];

export default function DashboardPage() {
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const handleSync = async (sourceId: string) => {
    setIsSyncing(sourceId);
    // Simulate sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSyncing(null);
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening with your knowledge base</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Documents</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.documents.count}</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              {stats.documents.trend}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversations.count}</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              {stats.conversations.trend}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Meetings</CardTitle>
            <Video className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.meetings.count}</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              {stats.meetings.trend}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Generated</CardTitle>
            <Sparkles className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.generated.count}</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              {stats.generated.trend}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/documents?upload=true">
          <Card className="hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer group">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 rounded-xl bg-blue-100 group-hover:bg-blue-200 transition-colors">
                <Upload className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Upload Document</h3>
                <p className="text-sm text-gray-500">Add PDFs, DOCs to your knowledge base</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/chat">
          <Card className="hover:border-purple-300 hover:bg-purple-50/50 transition-all cursor-pointer group">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 rounded-xl bg-purple-100 group-hover:bg-purple-200 transition-colors">
                <MessageSquare className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Start Chat</h3>
                <p className="text-sm text-gray-500">Ask questions about your data</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/generate">
          <Card className="hover:border-orange-300 hover:bg-orange-50/50 transition-all cursor-pointer group">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 rounded-xl bg-orange-100 group-hover:bg-orange-200 transition-colors">
                <Sparkles className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Generate Content</h3>
                <p className="text-sm text-gray-500">Create reports, slides, infographics</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Documents */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Documents</CardTitle>
              <CardDescription>Your latest uploaded files</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/documents" className="flex items-center gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{doc.name}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(doc.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={doc.status === 'processed' ? 'default' : 'secondary'}>
                    {doc.status === 'processed' ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Ready
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Processing
                      </span>
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data Sources Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Data Sources</CardTitle>
              <CardDescription>Connection status</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sources" className="flex items-center gap-1">
                Manage <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dataSources.map((source) => {
                const freshness = getDataFreshness(source.lastSync);
                const SourceIcon = source.icon;

                return (
                  <div key={source.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gray-50">
                        <SourceIcon className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{source.name}</p>
                        <p className="text-xs text-gray-500">{source.count} items</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${freshness.color}`}>
                        {freshness.emoji}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleSync(source.id)}
                        disabled={isSyncing === source.id}
                      >
                        <RefreshCw className={`h-3 w-3 ${isSyncing === source.id ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Conversations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Conversations</CardTitle>
            <CardDescription>Continue where you left off</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/chat" className="flex items-center gap-1">
              <Plus className="h-4 w-4" /> New Chat
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentConversations.map((conv) => (
              <Link key={conv.id} href={`/chat/${conv.id}`}>
                <div className="p-4 rounded-lg border hover:border-purple-300 hover:bg-purple-50/30 transition-all cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-50">
                      <MessageSquare className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{conv.title}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                        <span>{conv.messageCount} messages</span>
                        <span>•</span>
                        <span>{formatRelativeTime(conv.lastMessage)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
