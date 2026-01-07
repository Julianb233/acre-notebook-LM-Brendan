'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Users,
    Search,
    Plus,
    ArrowRight,
    Database,
    Globe,
    MoreHorizontal
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock data for initial implementation
const MOCK_PARTNERS = [
    {
        id: '1',
        name: 'Acme Corp Insurance',
        type: 'Enterprise',
        status: 'Active',
        integrations: ['Airtable', 'Notion'],
        employees: 1250,
        lastActive: '2 hours ago',
        description: 'Premier insurance provider specializing in commercial property coverage.'
    },
    {
        id: '2',
        name: 'Global Shield Ltd',
        type: 'Agency',
        status: 'Active',
        integrations: ['Notion'],
        employees: 45,
        lastActive: '1 day ago',
        description: 'Regional agency focused on personal lines and small business insurance.'
    },
    {
        id: '3',
        name: 'Secure Future Partners',
        type: 'Brokerage',
        status: 'Pending',
        integrations: [],
        employees: 12,
        lastActive: 'Never',
        description: 'Newly onboarded brokerage firm awaiting system configuration.'
    }
];

export default function PartnersPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [partners] = useState(MOCK_PARTNERS);

    const filteredPartners = partners.filter(partner =>
        partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        partner.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Partners</h1>
                    <p className="text-muted-foreground">
                        Manage your client partners and their intelligent agents.
                    </p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Partner
                </Button>
            </div>

            {/* Search and Filter */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search partners..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Partners Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPartners.map((partner) => (
                    <Card key={partner.id} className="group hover:shadow-lg transition-all duration-200 border-zinc-200 dark:border-zinc-800">
                        <CardHeader className="pb-4">
                            <div className="flex items-start justify-between">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Users className="h-6 w-6" />
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem>Edit Details</DropdownMenuItem>
                                        <DropdownMenuItem>Manage Access</DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <div className="mt-4">
                                <CardTitle className="text-xl mb-1">{partner.name}</CardTitle>
                                <CardDescription className="line-clamp-2">
                                    {partner.description}
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="pb-4">
                            <div className="flex flex-wrap gap-2 mb-4">
                                <Badge variant="secondary" className="font-normal">
                                    {partner.type}
                                </Badge>
                                {partner.status === 'Active' ? (
                                    <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-0 font-normal">
                                        Active
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="font-normal">
                                        {partner.status}
                                    </Badge>
                                )}
                            </div>

                            <div className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
                                <div className="flex items-center gap-2">
                                    <Database className="h-4 w-4" />
                                    <span>
                                        {partner.integrations.length > 0
                                            ? `Connected: ${partner.integrations.join(', ')}`
                                            : 'No data sources connected'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    <span>Last active: {partner.lastActive}</span>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                            <Button
                                className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                                variant="outline"
                                onClick={() => router.push(`/partners/${partner.id}`)}
                            >
                                Open Workspace
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {filteredPartners.length === 0 && (
                <div className="text-center py-12">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
                        <Search className="h-6 w-6 text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No partners found</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                        We couldn't find any partners matching your search. Try adjusting your filters or add a new partner.
                    </p>
                </div>
            )}
        </div>
    );
}
