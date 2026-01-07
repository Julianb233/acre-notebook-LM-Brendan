'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Headphones,
    Video,
    Network,
    FileText,
    Copy,
    Layout,
    PieChart,
    Presentation,
    TableProperties,
    MoreVertical,
    Plus,
    Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

interface StudioTool {
    id: string;
    label: string;
    icon: any;
    color: string;
}

const TOOLS: StudioTool[] = [
    { id: 'audio', label: 'Audio Overview', icon: Headphones, color: 'text-blue-500' },
    { id: 'video', label: 'Video Overview', icon: Video, color: 'text-green-500' },
    { id: 'mindmap', label: 'Mind Map', icon: Network, color: 'text-purple-500' },
    { id: 'reports', label: 'Reports', icon: FileText, color: 'text-yellow-500' },
    { id: 'flashcards', label: 'Flashcards', icon: Copy, color: 'text-orange-500' },
    { id: 'quiz', label: 'Quiz', icon: Layout, color: 'text-cyan-500' },
    { id: 'infographic', label: 'Infographic', icon: PieChart, color: 'text-pink-500' },
    { id: 'slides', label: 'Slide Deck', icon: Presentation, color: 'text-indigo-500' },
    { id: 'table', label: 'Data Table', icon: TableProperties, color: 'text-blue-600' },
];

interface StudioPanelProps {
    className?: string;
}

export function StudioPanel({ className }: StudioPanelProps) {
    const { theme } = useTheme();

    return (
        <div className={cn("flex flex-col h-full bg-white dark:bg-zinc-950 border-l", className)}>
            <div className="p-4 border-b flex items-center justify-between shrink-0">
                <h2 className="font-semibold text-lg">Studio</h2>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Layout className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {/* Tools Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {TOOLS.map((tool) => (
                            <Card key={tool.id} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors border-0 shadow-sm bg-zinc-50/50 dark:bg-zinc-900/50">
                                <CardContent className="p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <tool.icon className={cn("h-5 w-5", tool.color)} />
                                        <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 -mt-2 opacity-0 group-hover:opacity-100">
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="text-sm font-medium leading-none">{tool.label}</div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Saved Responses / Notes */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium">Saved notes</h3>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 border rounded-full">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </div>

                        <Card className="shadow-none border cursor-pointer hover:border-blue-500 transition-colors">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                            <Headphones className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm">Deep Dive</div>
                                            <div className="text-xs text-muted-foreground">Generated 2h ago</div>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <Play className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-none border border-dashed flex items-center justify-center p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Plus className="h-4 w-4" />
                                Add note
                            </div>
                        </Card>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
