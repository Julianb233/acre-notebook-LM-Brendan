'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Presentation,
  FileText,
  Sparkles,
  ArrowRight,
  Clock,
  Star,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ContentType {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  features: string[];
  estimatedTime: string;
  popular?: boolean;
}

const contentTypes: ContentType[] = [
  {
    id: 'infographic',
    title: 'Infographic',
    description: 'Create visual data stories with charts, statistics, and key insights from your documents.',
    icon: <BarChart3 className="h-8 w-8" />,
    href: '/generate/infographic',
    features: [
      'Bar, pie, and line charts',
      'Key statistics display',
      'Custom color schemes',
      'PNG/SVG export'
    ],
    estimatedTime: '2-5 min',
    popular: true
  },
  {
    id: 'presentation',
    title: 'Presentation',
    description: 'Generate professional slide decks with AI-powered content from your knowledge base.',
    icon: <Presentation className="h-8 w-8" />,
    href: '/generate/presentation',
    features: [
      'Multiple slide layouts',
      'Auto-generated content',
      'Custom branding',
      'PowerPoint export'
    ],
    estimatedTime: '3-7 min',
    popular: true
  },
  {
    id: 'report',
    title: 'Report',
    description: 'Build comprehensive reports with sections, appendices, and table of contents.',
    icon: <FileText className="h-8 w-8" />,
    href: '/generate/report',
    features: [
      'Structured sections',
      'Table of contents',
      'Appendices support',
      'PDF export'
    ],
    estimatedTime: '5-10 min'
  }
];

interface RecentGeneration {
  id: string;
  type: 'infographic' | 'presentation' | 'report';
  title: string;
  createdAt: string;
}

// Mock recent generations - would come from API
const recentGenerations: RecentGeneration[] = [
  { id: '1', type: 'presentation', title: 'Q4 Partner Overview', createdAt: '2 hours ago' },
  { id: '2', type: 'infographic', title: 'Market Analysis 2024', createdAt: '1 day ago' },
  { id: '3', type: 'report', title: 'Annual Performance Report', createdAt: '3 days ago' },
];

const typeIcons = {
  infographic: <BarChart3 className="h-4 w-4" />,
  presentation: <Presentation className="h-4 w-4" />,
  report: <FileText className="h-4 w-4" />
};

export default function GeneratePage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Generate Content</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Transform your documents into professional infographics, presentations, and reports using AI.
        </p>
      </div>

      {/* Content Type Cards */}
      <div className="grid gap-6 md:grid-cols-3 mb-12">
        {contentTypes.map((type) => (
          <Card
            key={type.id}
            className="relative hover:shadow-lg transition-shadow group"
          >
            {type.popular && (
              <Badge className="absolute -top-2 -right-2 bg-orange-500">
                <Star className="h-3 w-3 mr-1" />
                Popular
              </Badge>
            )}
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-3 bg-primary/10 rounded-lg text-primary">
                  {type.icon}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-1" />
                  {type.estimatedTime}
                </div>
              </div>
              <CardTitle className="mt-4">{type.title}</CardTitle>
              <CardDescription>{type.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-6">
                {type.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center text-sm text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mr-2" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href={type.href}>
                <Button className="w-full group-hover:bg-primary/90">
                  Create {type.title}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Generations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Generations
          </h2>
          <Button variant="ghost" size="sm">
            View All
          </Button>
        </div>

        {recentGenerations.length > 0 ? (
          <div className="grid gap-3">
            {recentGenerations.map((gen) => (
              <Card key={gen.id} className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      {typeIcons[gen.type]}
                    </div>
                    <div>
                      <p className="font-medium">{gen.title}</p>
                      <p className="text-sm text-muted-foreground capitalize">{gen.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{gen.createdAt}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No content generated yet</h3>
              <p className="text-muted-foreground mb-4">
                Start by creating your first infographic, presentation, or report.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tips Section */}
      <Card className="mt-8 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Pro Tips for Better Results
          </h3>
          <ul className="grid gap-2 md:grid-cols-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Upload relevant documents first to give AI more context
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Be specific in your prompts for more accurate content
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Use templates as a starting point, then customize
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Review and edit AI-generated content before exporting
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
