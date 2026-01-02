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
import {
  Loader2,
  Download,
  Sparkles,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Presentation,
  Layout,
  Columns,
  Image,
} from 'lucide-react';
import type { PresentationConfig } from '@/types';
import {
  PRESENTATION_TEMPLATES,
  SLIDE_LAYOUTS,
  validatePresentationConfig,
} from '@/lib/generate/presentation';

interface PresentationBuilderProps {
  partnerId: string;
  onGenerate?: (config: PresentationConfig) => void;
}

const layoutIcons = {
  title: Presentation,
  content: Layout,
  'two-column': Columns,
  image: Image,
};

export function PresentationBuilder({ partnerId, onGenerate }: PresentationBuilderProps) {
  const [config, setConfig] = useState<Partial<PresentationConfig>>({
    title: '',
    subtitle: '',
    author: '',
    slides: [],
    branding: {
      primary_color: '#2563eb',
      secondary_color: '#1e40af',
    },
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const handleTemplateSelect = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    const template = PRESENTATION_TEMPLATES[templateKey as keyof typeof PRESENTATION_TEMPLATES];
    if (template) {
      setConfig((prev) => ({
        ...prev,
        slides: template.slides.map((s) => ({
          title: s.title,
          content: [],
          layout: s.layout,
        })),
      }));
      setCurrentSlide(0);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    setErrors([]);

    try {
      const response = await fetch('/api/generate/presentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          template: selectedTemplate || undefined,
          partnerId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate presentation');
      }

      const data = await response.json();
      setConfig(data.config);
      setCurrentSlide(0);
    } catch (error) {
      setErrors(['Failed to generate presentation. Please try again.']);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    const validation = validatePresentationConfig(config);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setIsExporting(true);

    try {
      const response = await fetch('/api/generate/presentation/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, partnerId }),
      });

      if (!response.ok) {
        throw new Error('Failed to export presentation');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.title || 'presentation'}.pptx`;
      a.click();
      URL.revokeObjectURL(url);

      onGenerate?.(config as PresentationConfig);
    } catch (error) {
      setErrors(['Failed to export presentation. Please try again.']);
    } finally {
      setIsExporting(false);
    }
  };

  const addSlide = () => {
    setConfig((prev) => ({
      ...prev,
      slides: [
        ...(prev.slides || []),
        { title: '', content: [], layout: 'content' as const },
      ],
    }));
    setCurrentSlide((prev.slides?.length || 0));
  };

  const removeSlide = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      slides: prev.slides?.filter((_, i) => i !== index) || [],
    }));
    if (currentSlide >= (config.slides?.length || 1) - 1) {
      setCurrentSlide(Math.max(0, currentSlide - 1));
    }
  };

  const updateSlide = (
    index: number,
    field: string,
    value: string | string[]
  ) => {
    setConfig((prev) => ({
      ...prev,
      slides: prev.slides?.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }));
  };

  const addBulletPoint = (slideIndex: number) => {
    setConfig((prev) => ({
      ...prev,
      slides: prev.slides?.map((s, i) =>
        i === slideIndex
          ? { ...s, content: [...(s.content || []), ''] }
          : s
      ),
    }));
  };

  const updateBulletPoint = (slideIndex: number, bulletIndex: number, value: string) => {
    setConfig((prev) => ({
      ...prev,
      slides: prev.slides?.map((s, i) =>
        i === slideIndex
          ? {
              ...s,
              content: s.content?.map((c, bi) => (bi === bulletIndex ? value : c)),
            }
          : s
      ),
    }));
  };

  const removeBulletPoint = (slideIndex: number, bulletIndex: number) => {
    setConfig((prev) => ({
      ...prev,
      slides: prev.slides?.map((s, i) =>
        i === slideIndex
          ? { ...s, content: s.content?.filter((_, bi) => bi !== bulletIndex) }
          : s
      ),
    }));
  };

  const currentSlideData = config.slides?.[currentSlide];

  const renderSlidePreview = (slide: PresentationConfig['slides'][0], index: number) => {
    const isTitle = slide.layout === 'title';
    const isTwoColumn = slide.layout === 'two-column';

    return (
      <div
        key={index}
        className={`aspect-video rounded-lg border overflow-hidden cursor-pointer transition-all ${
          currentSlide === index ? 'ring-2 ring-primary' : 'hover:border-primary/50'
        }`}
        onClick={() => setCurrentSlide(index)}
      >
        {isTitle ? (
          <div
            className="h-full flex flex-col items-center justify-center p-2 text-white text-center"
            style={{ backgroundColor: config.branding?.primary_color }}
          >
            <div className="text-xs font-bold truncate w-full">
              {slide.title || 'Title Slide'}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col p-2">
            <div
              className="h-1 rounded mb-1"
              style={{ backgroundColor: config.branding?.primary_color }}
            />
            <div className="text-[8px] font-semibold truncate">
              {slide.title || `Slide ${index + 1}`}
            </div>
            <div className={`flex-1 ${isTwoColumn ? 'grid grid-cols-2 gap-1' : ''}`}>
              {slide.content?.slice(0, 3).map((_, i) => (
                <div
                  key={i}
                  className="h-1 bg-muted rounded my-0.5"
                  style={{ width: `${60 + Math.random() * 30}%` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Slide Thumbnails */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              Slides ({config.slides?.length || 0})
              <Button onClick={addSlide} size="sm" variant="outline">
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
            {config.slides?.map((slide, index) => (
              <div key={index} className="relative group">
                {renderSlidePreview(slide, index)}
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSlide(index);
                  }}
                  size="sm"
                  variant="destructive"
                  className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <Badge
                  variant="secondary"
                  className="absolute bottom-1 left-1 text-[10px]"
                >
                  {index + 1}
                </Badge>
              </div>
            ))}

            {(!config.slides || config.slides.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No slides yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Center Panel - Slide Editor */}
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
                    {Object.entries(PRESENTATION_TEMPLATES).map(([key, template]) => (
                      <SelectItem key={key} value={key}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="title">Presentation Title</Label>
                <Input
                  id="title"
                  value={config.title || ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter title..."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="aiPrompt">Describe your presentation</Label>
              <Textarea
                id="aiPrompt"
                placeholder="E.g., Create a presentation about our Q3 results highlighting revenue growth and new initiatives..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={2}
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

        {/* Slide Preview & Editor */}
        {currentSlideData && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Slide {currentSlide + 1} of {config.slides?.length || 0}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
                    disabled={currentSlide === 0}
                    size="sm"
                    variant="outline"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() =>
                      setCurrentSlide((prev) =>
                        Math.min((config.slides?.length || 1) - 1, prev + 1)
                      )
                    }
                    disabled={currentSlide >= (config.slides?.length || 1) - 1}
                    size="sm"
                    variant="outline"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Slide Preview */}
              <div
                className="aspect-video rounded-lg border overflow-hidden"
                style={{
                  backgroundColor:
                    currentSlideData.layout === 'title'
                      ? config.branding?.primary_color
                      : 'white',
                }}
              >
                {currentSlideData.layout === 'title' ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-white text-center">
                    <h2 className="text-2xl font-bold">
                      {currentSlideData.title || 'Title'}
                    </h2>
                    {currentSlideData.content?.[0] && (
                      <p className="mt-2 text-white/80">{currentSlideData.content[0]}</p>
                    )}
                  </div>
                ) : (
                  <div className="h-full p-4">
                    <div
                      className="h-1 rounded mb-2"
                      style={{ backgroundColor: config.branding?.primary_color }}
                    />
                    <h3
                      className="text-lg font-bold mb-4"
                      style={{ color: config.branding?.primary_color }}
                    >
                      {currentSlideData.title || 'Slide Title'}
                    </h3>
                    <ul
                      className={
                        currentSlideData.layout === 'two-column'
                          ? 'grid grid-cols-2 gap-4'
                          : 'space-y-2'
                      }
                    >
                      {currentSlideData.content?.map((bullet, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span
                            className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                            style={{ backgroundColor: config.branding?.primary_color }}
                          />
                          {bullet || 'Bullet point'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Slide Editor */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Slide Title</Label>
                    <Input
                      value={currentSlideData.title}
                      onChange={(e) => updateSlide(currentSlide, 'title', e.target.value)}
                      placeholder="Slide title..."
                    />
                  </div>
                  <div>
                    <Label>Layout</Label>
                    <Select
                      value={currentSlideData.layout}
                      onValueChange={(value) => updateSlide(currentSlide, 'layout', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SLIDE_LAYOUTS).map(([key, layout]) => {
                          const Icon = layoutIcons[key as keyof typeof layoutIcons];
                          return (
                            <SelectItem key={key} value={key}>
                              <span className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {layout.name}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Bullet Points</Label>
                    <Button
                      onClick={() => addBulletPoint(currentSlide)}
                      size="sm"
                      variant="ghost"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {currentSlideData.content?.map((bullet, bulletIndex) => (
                      <div key={bulletIndex} className="flex gap-2">
                        <Input
                          value={bullet}
                          onChange={(e) =>
                            updateBulletPoint(currentSlide, bulletIndex, e.target.value)
                          }
                          placeholder={`Bullet point ${bulletIndex + 1}`}
                        />
                        <Button
                          onClick={() => removeBulletPoint(currentSlide, bulletIndex)}
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Branding & Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Branding & Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Author</Label>
                <Input
                  value={config.author || ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, author: e.target.value }))}
                  placeholder="Your name"
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

            {errors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <ul className="list-disc list-inside text-sm text-destructive">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              onClick={handleExport}
              disabled={isExporting || !config.title || !config.slides?.length}
              className="w-full"
              size="lg"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting PPTX...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export PowerPoint
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
