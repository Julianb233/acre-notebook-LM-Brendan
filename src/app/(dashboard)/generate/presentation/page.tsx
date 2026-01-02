'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PresentationBuilder } from '@/components/generate';

function PresentationLoading() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="animate-pulse">
        <div className="h-8 w-48 bg-muted rounded mb-4" />
        <div className="h-4 w-96 bg-muted rounded mb-8" />
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-1 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded" />
            ))}
          </div>
          <div className="col-span-3">
            <div className="h-[500px] bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PresentationPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto py-4 px-4 max-w-7xl">
          <div className="flex items-center gap-4">
            <Link href="/generate">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Create Presentation</h1>
              <p className="text-sm text-muted-foreground">
                Generate professional slide decks with AI
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Builder */}
      <Suspense fallback={<PresentationLoading />}>
        <PresentationBuilder />
      </Suspense>
    </div>
  );
}
