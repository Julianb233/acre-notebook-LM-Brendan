'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InfographicBuilder } from '@/components/generate';

function InfographicLoading() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="animate-pulse">
        <div className="h-8 w-48 bg-muted rounded mb-4" />
        <div className="h-4 w-96 bg-muted rounded mb-8" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 space-y-4">
            <div className="h-64 bg-muted rounded" />
            <div className="h-48 bg-muted rounded" />
          </div>
          <div className="col-span-2">
            <div className="h-[600px] bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InfographicPage() {
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
              <h1 className="text-xl font-semibold">Create Infographic</h1>
              <p className="text-sm text-muted-foreground">
                Build visual data stories from your documents
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Builder */}
      <Suspense fallback={<InfographicLoading />}>
        <InfographicBuilder />
      </Suspense>
    </div>
  );
}
