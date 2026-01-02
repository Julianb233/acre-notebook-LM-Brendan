'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
} from 'recharts';
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
import { Loader2, Download, Sparkles, Plus, Trash2 } from 'lucide-react';
import type { InfographicConfig } from '@/types';
import {
  INFOGRAPHIC_TEMPLATES,
  validateInfographicConfig,
  generateGradientColors,
} from '@/lib/generate/infographic';

interface InfographicBuilderProps {
  partnerId: string;
  onGenerate?: (config: InfographicConfig) => void;
}

export function InfographicBuilder({ partnerId, onGenerate }: InfographicBuilderProps) {
  const [config, setConfig] = useState<Partial<InfographicConfig>>({
    title: '',
    subtitle: '',
    sections: [],
    branding: {
      primary_color: '#2563eb',
      secondary_color: '#1e40af',
    },
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleTemplateSelect = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    const template = INFOGRAPHIC_TEMPLATES[templateKey as keyof typeof INFOGRAPHIC_TEMPLATES];
    if (template) {
      setConfig((prev) => ({
        ...prev,
        sections: template.sections.map((s) => ({
          heading: s.heading,
          data: [],
          chart_type: s.chart_type,
        })),
      }));
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    setErrors([]);

    try {
      const response = await fetch('/api/generate/infographic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          template: selectedTemplate || undefined,
          partnerId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate infographic');
      }

      const data = await response.json();
      setConfig(data.config);
    } catch (error) {
      setErrors(['Failed to generate infographic. Please try again.']);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    const validation = validateInfographicConfig(config);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setIsExporting(true);

    try {
      const response = await fetch('/api/generate/infographic/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, partnerId }),
      });

      if (!response.ok) {
        throw new Error('Failed to export infographic');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.title || 'infographic'}.png`;
      a.click();
      URL.revokeObjectURL(url);

      onGenerate?.(config as InfographicConfig);
    } catch (error) {
      setErrors(['Failed to export infographic. Please try again.']);
    } finally {
      setIsExporting(false);
    }
  };

  const addSection = () => {
    setConfig((prev) => ({
      ...prev,
      sections: [
        ...(prev.sections || []),
        { heading: '', data: [], chart_type: 'bar' as const },
      ],
    }));
  };

  const removeSection = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections?.filter((_, i) => i !== index) || [],
    }));
  };

  const updateSection = (
    index: number,
    field: string,
    value: string | { label: string; value: number | string }[]
  ) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections?.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }));
  };

  const addDataPoint = (sectionIndex: number) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections?.map((s, i) =>
        i === sectionIndex
          ? { ...s, data: [...s.data, { label: '', value: 0 }] }
          : s
      ),
    }));
  };

  const updateDataPoint = (
    sectionIndex: number,
    dataIndex: number,
    field: 'label' | 'value',
    value: string | number
  ) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections?.map((s, i) =>
        i === sectionIndex
          ? {
              ...s,
              data: s.data.map((d, di) =>
                di === dataIndex ? { ...d, [field]: value } : d
              ),
            }
          : s
      ),
    }));
  };

  const removeDataPoint = (sectionIndex: number, dataIndex: number) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections?.map((s, i) =>
        i === sectionIndex
          ? { ...s, data: s.data.filter((_, di) => di !== dataIndex) }
          : s
      ),
    }));
  };

  const renderChart = (
    section: InfographicConfig['sections'][0],
    colors: string[]
  ) => {
    const data = section.data.map((d) => ({
      name: d.label,
      value: typeof d.value === 'number' ? d.value : parseFloat(String(d.value)) || 0,
    }));

    switch (section.chart_type) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.branding?.primary_color}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'stat':
        return (
          <div className="grid grid-cols-2 gap-4">
            {section.data.map((d, i) => (
              <div
                key={i}
                className="text-center p-4 rounded-lg"
                style={{ backgroundColor: `${config.branding?.primary_color}10` }}
              >
                <div
                  className="text-3xl font-bold"
                  style={{ color: config.branding?.primary_color }}
                >
                  {d.value}
                </div>
                <div className="text-sm text-muted-foreground">{d.label}</div>
              </div>
            ))}
          </div>
        );

      case 'bar':
      default:
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill={config.branding?.primary_color} />
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  const gradientColors = generateGradientColors(
    config.branding?.primary_color || '#2563eb',
    config.branding?.secondary_color || '#1e40af',
    6
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Configuration Panel */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Generation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="template">Template (Optional)</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INFOGRAPHIC_TEMPLATES).map(([key, template]) => (
                    <SelectItem key={key} value={key}>
                      {template.name} - {template.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="aiPrompt">Describe your infographic</Label>
              <Textarea
                id="aiPrompt"
                placeholder="E.g., Create an infographic showing Q3 revenue growth with comparisons to Q2..."
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
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={config.title || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Infographic Title"
              />
            </div>

            <div>
              <Label htmlFor="subtitle">Subtitle (Optional)</Label>
              <Input
                id="subtitle"
                value={config.subtitle || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
                placeholder="Optional subtitle"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="primaryColor"
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
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="secondaryColor"
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
            <CardTitle>Sections</CardTitle>
            <Button onClick={addSection} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Section
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.sections?.map((section, sectionIndex) => (
              <div key={sectionIndex} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Section {sectionIndex + 1}</Badge>
                  <Button
                    onClick={() => removeSection(sectionIndex)}
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <Input
                  placeholder="Section heading"
                  value={section.heading}
                  onChange={(e) =>
                    updateSection(sectionIndex, 'heading', e.target.value)
                  }
                />

                <Select
                  value={section.chart_type || 'bar'}
                  onValueChange={(value) =>
                    updateSection(sectionIndex, 'chart_type', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chart type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar Chart</SelectItem>
                    <SelectItem value="pie">Pie Chart</SelectItem>
                    <SelectItem value="line">Line Chart</SelectItem>
                    <SelectItem value="stat">Statistics</SelectItem>
                  </SelectContent>
                </Select>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Data Points</Label>
                    <Button
                      onClick={() => addDataPoint(sectionIndex)}
                      size="sm"
                      variant="ghost"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>

                  {section.data.map((dataPoint, dataIndex) => (
                    <div key={dataIndex} className="flex gap-2 items-center">
                      <Input
                        placeholder="Label"
                        value={dataPoint.label}
                        onChange={(e) =>
                          updateDataPoint(sectionIndex, dataIndex, 'label', e.target.value)
                        }
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Value"
                        value={dataPoint.value}
                        onChange={(e) =>
                          updateDataPoint(
                            sectionIndex,
                            dataIndex,
                            'value',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-24"
                      />
                      <Button
                        onClick={() => removeDataPoint(sectionIndex, dataIndex)}
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {(!config.sections || config.sections.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sections yet. Add a section or use AI to generate content.
              </p>
            )}
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
          disabled={isExporting || !config.title}
          className="w-full"
          size="lg"
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export Infographic
            </>
          )}
        </Button>
      </div>

      {/* Preview Panel */}
      <div className="sticky top-4">
        <Card className="overflow-hidden">
          <CardHeader
            style={{ backgroundColor: config.branding?.primary_color }}
            className="text-white"
          >
            <CardTitle className="text-2xl">{config.title || 'Infographic Preview'}</CardTitle>
            {config.subtitle && (
              <p className="text-white/80">{config.subtitle}</p>
            )}
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {config.sections?.map((section, index) => (
              <div key={index}>
                <h3
                  className="text-lg font-semibold mb-4"
                  style={{ color: config.branding?.primary_color }}
                >
                  {section.heading || `Section ${index + 1}`}
                </h3>
                {section.data.length > 0 ? (
                  renderChart(section, gradientColors)
                ) : (
                  <div className="h-32 bg-muted rounded flex items-center justify-center text-muted-foreground">
                    Add data points to see chart
                  </div>
                )}
              </div>
            ))}

            {(!config.sections || config.sections.length === 0) && (
              <div className="h-64 bg-muted rounded flex items-center justify-center text-muted-foreground">
                Configure sections to see preview
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
