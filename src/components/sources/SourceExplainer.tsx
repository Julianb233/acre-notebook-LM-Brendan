'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type SourceType = 'documents' | 'fireflies' | 'airtable' | 'supabase';

interface SourceExplainerProps {
  source: SourceType;
  trigger?: 'icon' | 'text' | 'button';
  showDialog?: boolean;
}

const sourceInfo: Record<SourceType, {
  name: string;
  icon: string;
  shortDescription: string;
  fullDescription: string;
  whatIsStored: string[];
  howToAccess: string;
  faq: { q: string; a: string }[];
}> = {
  documents: {
    name: 'Documents',
    icon: '📄',
    shortDescription: 'PDFs, Word docs, and other files you upload',
    fullDescription: 'Documents are files you upload directly to the platform. They are processed, chunked into smaller pieces, and stored with AI embeddings so the chat can search and reference them.',
    whatIsStored: [
      'Original file (PDF, DOCX, TXT, etc.)',
      'Extracted text content',
      'AI embeddings for semantic search',
      'Metadata (filename, upload date, page count)',
    ],
    howToAccess: 'Go to Documents in the sidebar to view, upload, or delete your documents.',
    faq: [
      {
        q: 'Why does the AI sometimes get things wrong from my documents?',
        a: 'The AI searches for relevant chunks of text, but may occasionally miss context or misinterpret complex tables/charts. Check the source citation to verify.',
      },
      {
        q: 'How do I update a document?',
        a: 'Delete the old version and upload the new one. The AI will automatically re-process it.',
      },
    ],
  },
  fireflies: {
    name: 'Fireflies.ai Meetings',
    icon: '🎙️',
    shortDescription: 'Transcripts from your recorded meetings',
    fullDescription: 'Fireflies.ai records and transcribes your meetings. We sync these transcripts so you can search meeting content, extract action items, and ask questions about past discussions.',
    whatIsStored: [
      'Meeting title and date',
      'Participant names',
      'Full transcript text',
      'AI-generated summary',
      'Action items (if extracted by Fireflies)',
    ],
    howToAccess: 'Go to Meetings in the sidebar to see synced transcripts and trigger new syncs.',
    faq: [
      {
        q: 'Why is a meeting missing?',
        a: 'Meetings sync periodically. Click "Sync Now" to fetch recent meetings, or check your Fireflies account to ensure the meeting was recorded.',
      },
      {
        q: 'Can the AI access my calendar?',
        a: 'No, we only access meeting transcripts via Fireflies. We do not have calendar access.',
      },
    ],
  },
  airtable: {
    name: 'Airtable',
    icon: '📊',
    shortDescription: 'Data from your connected Airtable bases',
    fullDescription: 'Airtable is a flexible database platform. We sync records from your configured bases so you can search, reference, and even update data without leaving this app.',
    whatIsStored: [
      'Record data from specified tables',
      'Field names and values',
      'Record creation timestamps',
      'Sync history',
    ],
    howToAccess: 'Go to Data in the sidebar to browse synced records, edit fields, or trigger a fresh sync.',
    faq: [
      {
        q: 'Will changes I make here update Airtable?',
        a: 'Yes! Edits are synced back to Airtable in real-time when you save.',
      },
      {
        q: 'What if data seems old?',
        a: 'Check the freshness indicator. If it shows "Stale" or "Outdated," click "Sync Now" to pull the latest data.',
      },
    ],
  },
  supabase: {
    name: 'Supabase (Database)',
    icon: '🗄️',
    shortDescription: 'The underlying database powering this app',
    fullDescription: 'Supabase is a PostgreSQL database that stores all your data securely. It handles authentication, file storage, and the vector search that powers AI features. You don\'t need to interact with it directly—it works behind the scenes.',
    whatIsStored: [
      'All synced data from other sources',
      'Your conversations and chat history',
      'Generated content (infographics, reports)',
      'User preferences and settings',
    ],
    howToAccess: 'You typically don\'t need to access Supabase directly. All data is surfaced through the app\'s interface.',
    faq: [
      {
        q: 'What is Supabase?',
        a: 'Think of it as the secure vault where all your data lives. It\'s a modern database that handles everything from login to file storage.',
      },
      {
        q: 'Is my data safe?',
        a: 'Yes! Data is encrypted, access is authenticated, and backups are automatic. Your data never leaves secure cloud infrastructure.',
      },
    ],
  },
};

export function SourceExplainer({ source, trigger = 'icon', showDialog = true }: SourceExplainerProps) {
  const [open, setOpen] = useState(false);
  const info = sourceInfo[source];

  const triggerContent = (
    <>
      {trigger === 'icon' && (
        <span className="cursor-help text-muted-foreground hover:text-foreground transition-colors">
          ℹ️
        </span>
      )}
      {trigger === 'text' && (
        <span className="text-sm text-primary underline underline-offset-2 cursor-pointer hover:text-primary/80">
          What is this?
        </span>
      )}
      {trigger === 'button' && (
        <Button variant="ghost" size="sm">
          <span className="mr-1">ℹ️</span>
          Learn more
        </Button>
      )}
    </>
  );

  if (!showDialog) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{triggerContent}</TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-medium">{info.icon} {info.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {info.shortDescription}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerContent}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{info.icon}</span>
            {info.name}
          </DialogTitle>
          <DialogDescription>{info.shortDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div>
            <h4 className="font-medium mb-2">What is it?</h4>
            <p className="text-sm text-muted-foreground">{info.fullDescription}</p>
          </div>

          <div>
            <h4 className="font-medium mb-2">What data is stored?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {info.whatIsStored.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">How to access</h4>
            <p className="text-sm text-muted-foreground">{info.howToAccess}</p>
          </div>

          <div>
            <h4 className="font-medium mb-2">FAQ</h4>
            <div className="space-y-3">
              {info.faq.map((item, i) => (
                <div key={i} className="bg-muted/50 rounded-lg p-3">
                  <p className="font-medium text-sm">{item.q}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function HowDoIKnowThisIsRight() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span>🤔</span>
          How do I know this is right?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Understanding Your Data</DialogTitle>
          <DialogDescription>
            Here's how to verify and trust the information in this app
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h4 className="font-medium flex items-center gap-2 text-green-800 dark:text-green-300">
              <span>✅</span> Source Citations
            </h4>
            <p className="text-sm text-green-700 dark:text-green-400 mt-1">
              Every AI response includes clickable citations. Click them to see the original source—document, meeting, or record.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium flex items-center gap-2 text-blue-800 dark:text-blue-300">
              <span>📊</span> Freshness Indicators
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              Look for 🟢 Fresh, 🟡 Stale, or 🔴 Outdated badges. Fresh data was synced in the last 24 hours.
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <h4 className="font-medium flex items-center gap-2 text-purple-800 dark:text-purple-300">
              <span>🔗</span> View Original
            </h4>
            <p className="text-sm text-purple-700 dark:text-purple-400 mt-1">
              Most sources have a "View in [Source]" link that takes you directly to the original in Airtable, Fireflies, etc.
            </p>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h4 className="font-medium flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
              <span>🔄</span> Sync Anytime
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              If something seems off, hit "Sync Now" on the Data Sources page to pull the latest data from all connected sources.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
