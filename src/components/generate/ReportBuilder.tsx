'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Download,
  Sparkles,
  Plus,
  Trash2,
  FileText,
  BookOpen,
  Clock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { ReportConfig } from '@/types';
import {
  REPORT_TEMPLATES,
  validateReportConfig,
  formatReportDate,
  calculateReadingTime,
  generateTableOfContents,
} from '@/lib/generate/report';

interface ReportBuilderProps {
  partnerId: string;
  onGenerate?: (config: ReportConfig) => void;
}

export function ReportBuilder({ partnerId, onGenerate }: ReportBuilderProps) {
  const [config, setConfig] = useState<Partial<ReportConfig>>({
    title: '',
    subtitle: '',
    author: '',
    date: new Date().toISOString().split('T')[0],
    sections: [],
    appendices: [],
    branding: {
      primary_color: '#2563eb',
      secondary_color: '#1e40af',
    },
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [errors, setErrors] = useState<string[]>([]);

  const handleTemplateSelect = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    const template = REPORT_TEMPLATES[templateKey as keyof typeof REPORT_TEMPLATES];
    if (template) {
      setConfig((prev) => ({
        ...prev,
        sections: template.sections.map((s) => ({
          title: s.title,
          content: '',
          subsections: [],
        })),
      }));
      setExpandedSections(new Set([0]));
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    setErrors([]);

    try {
      const response = await fetch('/api/generate/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          template: selectedTemplate || undefined,
          partnerId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const data = await response.json();
      setConfig(data.config);
      setExpandedSections(new Set([0]));
    } catch (error) {
      setErrors(['Failed to generate report. Please try again.']);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    const validation = validateReportConfig(config);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setIsExporting(true);

    try {
      const response = await fetch('/api/generate/report/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, partnerId }),
      });

      if (!response.ok) {
        throw new Error('Failed to export report');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.title || 'report'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      onGenerate?.(config as ReportConfig);
    } catch (error) {
      setErrors(['Failed to export report. Please try again.']);
    } finally {
      setIsExporting(false);
    }
  };

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const addSection = () => {
    setConfig((prev) => ({
      ...prev,
      sections: [
        ...(prev.sections || []),
        { title: '', content: '', subsections: [] },
      ],
    }));
    setExpandedSections((prev) => new Set([...prev, config.sections?.length || 0]));
  };

  const removeSection = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections?.filter((_, i) => i !== index) || [],
    }));
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  const updateSection = (index: number, field: string, value: string) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections?.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }));
  };

  const addSubsection = (sectionIndex: number) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections?.map((s, i) =>
        i === sectionIndex
          ? {
              ...s,
              subsections: [...(s.subsections || []), { title: '', content: '' }],
            }
          : s
      ),
    }));
  };

  const updateSubsection = (
    sectionIndex: number,
    subIndex: number,
    field: string,
    value: string
  ) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections?.map((s, i) =>
        i === sectionIndex
          ? {
              ...s,
              subsections: s.subsections?.map((sub, si) =>
                si === subIndex ? { ...sub, [field]: value } : sub
              ),
            }
          : s
      ),
    }));
  };

  const removeSubsection = (sectionIndex: number, subIndex: number) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections?.map((s, i) =>
        i === sectionIndex
          ? {
              ...s,
              subsections: s.subsections?.filter((_, si) => si !== subIndex),
            }
          : s
      ),
    }));
  };

  const addAppendix = () => {
    setConfig((prev) => ({
      ...prev,
      appendices: [...(prev.appendices || []), { title: '', content: '' }],
    }));
  };

  const updateAppendix = (index: number, field: string, value: string) => {
    setConfig((prev) => ({
      ...prev,
      appendices: prev.appendices?.map((a, i) =>
        i === index ? { ...a, [field]: value } : a
      ),
    }));
  };

  const removeAppendix = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      appendices: prev.appendices?.filter((_, i) => i !== index),
    }));
  };

  // Calculate stats for preview
  const readingTime = config.sections?.length
    ? calculateReadingTime(config as ReportConfig)
    : 0;
  const toc = config.sections?.length
    ? generateTableOfContents(config as ReportConfig)
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Configuration */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Generation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="template">Template</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REPORT_TEMPLATES).map(([key, template]) => (
                      <SelectItem key={key} value={key}>
                        {template.name} - {template.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="title">Report Title</Label>
                <Input
                  id="title"
                  value={config.title || ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter report title..."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="aiPrompt">Describe your report</Label>
              <Textarea
                id="aiPrompt"
                placeholder="E.g., Create a comprehensive analysis report on Q3 performance including revenue trends, market positioning, and strategic recommendations..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              onClick={handleAIGenerate}
              disabled={isGenerating || !aiPrompt.trim()}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate with AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Subtitle</Label>
                <Input
                  value={config.subtitle || ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Optional subtitle"
                />
              </div>
              <div>
                <Label>Author</Label>
                <Input
                  value={config.author || ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, author: e.target.value }))}
                  placeholder="Author name"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={config.date || ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={config.branding?.primary_color || '#2563eb'}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        branding: { ...prev.branding!, primary_color: e.target.value },
                      }))
                    }
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={config.branding?.primary_color || '#2563eb'}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        branding: { ...prev.branding!, primary_color: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={config.branding?.secondary_color || '#1e40af'}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        branding: { ...prev.branding!, secondary_color: e.target.value },
                      }))
                    }
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={config.branding?.secondary_color || '#1e40af'}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        branding: { ...prev.branding!, secondary_color: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">
              Sections ({config.sections?.length || 0})
            </CardTitle>
            <Button onClick={addSection} size="sm" variant="outline">
              <Plus className="h-3 w-3 mr-1" />
              Add Section
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.sections?.map((section, sectionIndex) => (
              <div key={sectionIndex} className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer"
                  onClick={() => toggleSection(sectionIndex)}
                >
                  <div className="flex items-center gap-2">
                    {expandedSections.has(sectionIndex) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Badge variant="secondary">{sectionIndex + 1}</Badge>
                    <span className="font-medium text-sm">
                      {section.title || 'Untitled Section'}
                    </span>
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSection(sectionIndex);
                    }}
                    size="sm"
                    variant="ghost"
                    className="text-destructive h-7 w-7 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {expandedSections.has(sectionIndex) && (
                  <div className="p-3 space-y-3">
                    <div>
                      <Label>Section Title</Label>
                      <Input
                        value={section.title}
                        onChange={(e) =>
                          updateSection(sectionIndex, 'title', e.target.value)
                        }
                        placeholder="Section title"
                      />
                    </div>
                    <div>
                      <Label>Content</Label>
                      <Textarea
                        value={section.content}
                        onChange={(e) =>
                          updateSection(sectionIndex, 'content', e.target.value)
                        }
                        placeholder="Section content (supports markdown: - for lists, > for quotes)"
                        rows={4}
                      />
                    </div>

                    <div className="pl-4 border-l-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          Subsections ({section.subsections?.length || 0})
                        </Label>
                        <Button
                          onClick={() => addSubsection(sectionIndex)}
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      {section.subsections?.map((sub, subIndex) => (
                        <div key={subIndex} className="space-y-2 bg-muted/30 p-2 rounded">
                          <div className="flex gap-2">
                            <Input
                              value={sub.title}
                              onChange={(e) =>
                                updateSubsection(
                                  sectionIndex,
                                  subIndex,
                                  'title',
                                  e.target.value
                                )
                              }
                              placeholder="Subsection title"
                              className="text-sm"
                            />
                            <Button
                              onClick={() => removeSubsection(sectionIndex, subIndex)}
                              size="sm"
                              variant="ghost"
                              className="text-destructive h-9 w-9 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <Textarea
                            value={sub.content}
                            onChange={(e) =>
                              updateSubsection(
                                sectionIndex,
                                subIndex,
                                'content',
                                e.target.value
                              )
                            }
                            placeholder="Subsection content"
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {(!config.sections || config.sections.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sections yet. Add a section or use AI to generate content.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">
              Appendices ({config.appendices?.length || 0})
            </CardTitle>
            <Button onClick={addAppendix} size="sm" variant="outline">
              <Plus className="h-3 w-3 mr-1" />
              Add Appendix
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.appendices?.map((appendix, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">
                    Appendix {String.fromCharCode(65 + index)}
                  </Badge>
                  <Button
                    onClick={() => removeAppendix(index)}
                    size="sm"
                    variant="ghost"
                    className="text-destructive h-7 w-7 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <Input
                  value={appendix.title}
                  onChange={(e) => updateAppendix(index, 'title', e.target.value)}
                  placeholder="Appendix title"
                />
                <Textarea
                  value={appendix.content}
                  onChange={(e) => updateAppendix(index, 'content', e.target.value)}
                  placeholder="Appendix content"
                  rows={3}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {errors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <ul className="list-disc list-inside text-sm text-destructive">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <Button
          onClick={handleExport}
          disabled={isExporting || !config.title || !config.sections?.length}
          className="w-full"
          size="lg"
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting PDF...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export PDF Report
            </>
          )}
        </Button>
      </div>

      {/* Right Panel - Preview */}
      <div className="space-y-4">
        <Card className="sticky top-4">
          <CardHeader
            style={{ backgroundColor: config.branding?.primary_color }}
            className="text-white rounded-t-lg"
          >
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Report Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Title Block */}
              <div className="text-center pb-4 border-b">
                <h2 className="text-xl font-bold">
                  {config.title || 'Report Title'}
                </h2>
                {config.subtitle && (
                  <p className="text-muted-foreground">{config.subtitle}</p>
                )}
                <div className="flex items-center justify-center gap-4 mt-2 text-sm text-muted-foreground">
                  {config.author && <span>{config.author}</span>}
                  {config.date && <span>{formatReportDate(config.date)}</span>}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 bg-muted rounded">
                  <div className="flex items-center justify-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    <span className="font-semibold">
                      {config.sections?.length || 0}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Sections</p>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span className="font-semibold">{readingTime}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Min read</p>
                </div>
              </div>

              {/* Table of Contents */}
              {toc.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Table of Contents</h3>
                  <ScrollArea className="h-48">
                    <ul className="space-y-1 text-sm">
                      {toc.map((entry, i) => (
                        <li key={i}>
                          <div className="flex justify-between">
                            <span className="truncate">{entry.title}</span>
                            <span className="text-muted-foreground">
                              p.{entry.page}
                            </span>
                          </div>
                          {entry.subsections && (
                            <ul className="pl-4 space-y-0.5 text-xs text-muted-foreground">
                              {entry.subsections.map((sub, si) => (
                                <li key={si} className="flex justify-between">
                                  <span className="truncate">{sub.title}</span>
                                  <span>p.{sub.page}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}

              {/* Color Preview */}
              <div>
                <h3 className="font-semibold text-sm mb-2">Branding</h3>
                <div className="flex gap-2">
                  <div
                    className="h-8 flex-1 rounded flex items-center justify-center text-white text-xs"
                    style={{ backgroundColor: config.branding?.primary_color }}
                  >
                    Primary
                  </div>
                  <div
                    className="h-8 flex-1 rounded flex items-center justify-center text-white text-xs"
                    style={{ backgroundColor: config.branding?.secondary_color }}
                  >
                    Secondary
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
