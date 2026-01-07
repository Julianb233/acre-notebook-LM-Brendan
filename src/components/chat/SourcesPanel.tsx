'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    FileText,
    Link as LinkIcon,
    Plus,
    Search,
    Globe,
    Youtube,
    MoreVertical,
    CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface Source {
    id: string;
    title: string;
    type: 'pdf' | 'docx' | 'txt' | 'web' | 'youtube';
    selected: boolean;
    icon?: any;
}

interface SourcesPanelProps {
    className?: string;
    sources?: Source[];
}

export function SourcesPanel({ className, sources: initialSources = [] }: SourcesPanelProps) {
    const [sources, setSources] = useState<Source[]>(
        initialSources.length > 0 ? initialSources : [
            { id: '1', title: 'Q4 Claims Report.pdf', type: 'pdf', selected: true },
            { id: '2', title: 'Policy Guidelines 2026.docx', type: 'docx', selected: true },
            { id: '3', title: 'Competitor Analysis', type: 'web', selected: true },
            { id: '4', title: 'Market Trends Video', type: 'youtube', selected: true },
        ]);

    const toggleSource = (id: string) => {
        setSources(sources.map(s =>
            s.id === id ? { ...s, selected: !s.selected } : s
        ));
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'web': return Globe;
            case 'youtube': return Youtube;
            default: return FileText;
        }
    };

    return (
        <div className={cn("flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/50 border-r", className)}>
            <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg">Sources</h2>
                    <span className="text-xs text-muted-foreground border px-1.5 py-0.5 rounded">
                        {sources.length}
                    </span>
                </div>

                <Button className="w-full gap-2 bg-white text-black hover:bg-zinc-100 border dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 shadow-sm">
                    <Plus className="h-4 w-4" />
                    Add sources
                </Button>

                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search sources..."
                        className="pl-8 h-9 text-xs bg-white dark:bg-zinc-900"
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 px-4">
                <div className="space-y-1 pb-4">
                    <div className="flex items-center justify-between py-2 text-xs font-medium text-muted-foreground">
                        <span>Select all sources</span>
                        <Checkbox
                            checked={sources.every(s => s.selected)}
                            onCheckedChange={(checked) => setSources(sources.map(s => ({ ...s, selected: !!checked })))}
                        />
                    </div>

                    {sources.map((source) => {
                        const Icon = getIcon(source.type);
                        return (
                            <div
                                key={source.id}
                                className={cn(
                                    "group flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm",
                                    source.selected
                                        ? "bg-white border-blue-200 dark:bg-zinc-900 dark:border-blue-900"
                                        : "bg-transparent border-transparent hover:bg-white dark:hover:bg-zinc-900"
                                )}
                                onClick={() => toggleSource(source.id)}
                            >
                                <div className={cn(
                                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                    source.type === 'youtube' ? "bg-red-50 text-red-600" :
                                        source.type === 'web' ? "bg-blue-50 text-blue-600" :
                                            "bg-orange-50 text-orange-600"
                                )}>
                                    <Icon className="h-4 w-4" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{source.title}</div>
                                    <div className="text-[10px] text-muted-foreground truncate">
                                        {source.selected ? "Active" : "Excluded"}
                                    </div>
                                </div>

                                <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    <Checkbox checked={source.selected} onCheckedChange={() => toggleSource(source.id)} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}
