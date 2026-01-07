'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { SourcesPanel } from '@/components/chat/SourcesPanel';
import { StudioPanel } from '@/components/chat/StudioPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Settings, Share, MoreHorizontal } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock data
const MOCK_PARTNER = {
    id: '1',
    name: 'Acme Corp Insurance',
    type: 'Enterprise',
    status: 'Active',
    description: 'Premier insurance provider specializing in commercial property coverage.',
    documents: [
        { id: '1', title: 'Q4 Claims Report.pdf', type: 'pdf' as const, selected: true },
        { id: '2', title: 'Policy Guidelines 2026.docx', type: 'docx' as const, selected: true },
        { id: '3', title: 'Partner Agreement', type: 'txt' as const, selected: true },
        { id: '4', title: 'Risk Assessment Framework', type: 'pdf' as const, selected: true }
    ]
};

export default function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [partner] = useState(MOCK_PARTNER);

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-zinc-50 dark:bg-zinc-950">
            {/* Top Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b bg-white dark:bg-zinc-950 z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                            AC
                        </div>
                        <h1 className="font-semibold text-lg">{partner.name}</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" className="gap-2 hidden md:flex">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Saved
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2">
                        <Share className="h-4 w-4" />
                        Share
                    </Button>
                    <Button variant="ghost" size="icon">
                        <Settings className="h-5 w-5" />
                    </Button>
                    <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                        <span className="text-xs font-medium">JB</span>
                    </div>
                </div>
            </header>

            {/* Main Content Area - 3 Column Layout */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Column: Sources */}
                <div className="w-80 shrink-0 hidden md:block h-full">
                    <SourcesPanel sources={partner.documents} />
                </div>

                {/* Center Column: Chat */}
                <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900 border-x border-zinc-200 dark:border-zinc-800 relative z-0">
                    <ChatInterface
                        partnerId={id}
                        documentIds={partner.documents.map(d => d.id)}
                    />
                </main>

                {/* Right Column: Studio */}
                <div className="w-80 shrink-0 hidden lg:block h-full">
                    <StudioPanel />
                </div>
            </div>
        </div>
    );
}
