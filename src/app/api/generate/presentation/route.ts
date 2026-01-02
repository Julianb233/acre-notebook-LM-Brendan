import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import {
  validatePresentationConfig,
  generatePresentationPrompt,
  generatePPTX,
  PRESENTATION_TEMPLATES
} from '@/lib/generate/presentation';
import type { PresentationConfig, Slide } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      prompt,
      template,
      slideCount = 8,
      documentIds = [],
      partnerId,
      action = 'generate' // 'generate' | 'export'
    } = body;

    // Handle export action
    if (action === 'export') {
      const { config } = body;
      if (!config) {
        return NextResponse.json({ error: 'Config required for export' }, { status: 400 });
      }

      try {
        const pptxBuffer = await generatePPTX(config);

        return new NextResponse(pptxBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'Content-Disposition': `attachment; filename="${config.title || 'presentation'}.pptx"`,
          },
        });
      } catch (exportError) {
        console.error('PPTX export error:', exportError);
        return NextResponse.json({ error: 'Failed to export presentation' }, { status: 500 });
      }
    }

    // Generate presentation
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Retrieve relevant document context
    let documentContext = '';
    if (documentIds.length > 0) {
      const { data: chunks } = await supabase
        .from('document_chunks')
        .select('content, documents!inner(name)')
        .in('document_id', documentIds)
        .limit(30);

      if (chunks && chunks.length > 0) {
        documentContext = chunks
          .map(c => `[${(c.documents as { name: string }).name}]: ${c.content}`)
          .join('\n\n');
      }
    }

    // Get template configuration
    const templateConfig = template ? PRESENTATION_TEMPLATES[template] : null;

    // Generate presentation content with AI
    const systemPrompt = `You are an expert presentation designer. Create a professional slide deck based on the user's request.

${templateConfig ? `Use this template style: ${templateConfig.name}` : ''}

Return your response as a valid JSON object with this exact structure:
{
  "title": "Presentation title",
  "slides": [
    {
      "id": "slide-1",
      "layout": "title",
      "title": "Main Title",
      "subtitle": "Subtitle text"
    },
    {
      "id": "slide-2",
      "layout": "content",
      "title": "Slide Title",
      "bullets": ["Point 1", "Point 2", "Point 3"],
      "notes": "Speaker notes for this slide"
    },
    {
      "id": "slide-3",
      "layout": "two-column",
      "title": "Comparison",
      "leftContent": ["Left point 1", "Left point 2"],
      "rightContent": ["Right point 1", "Right point 2"]
    }
  ]
}

Layout types available: "title", "content", "two-column", "image"
Create exactly ${slideCount} slides with logical flow and clear messaging.`;

    const userPrompt = generatePresentationPrompt(
      prompt,
      slideCount,
      documentContext || undefined
    );

    const { text } = await generateText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
    });

    // Parse AI response
    let presentationData;
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
      const jsonStr = jsonMatch[1]?.trim() || text.trim();
      presentationData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', text);
      return NextResponse.json(
        { error: 'Failed to generate valid presentation structure' },
        { status: 500 }
      );
    }

    // Build config
    const config: PresentationConfig = {
      title: presentationData.title || 'Untitled Presentation',
      slides: presentationData.slides || [],
      theme: templateConfig?.theme || {
        primaryColor: '#3B82F6',
        secondaryColor: '#1E40AF',
        backgroundColor: '#FFFFFF',
        textColor: '#1F2937',
        fontFamily: 'Inter'
      },
      branding: {
        logo: '/acre-logo.svg',
        companyName: 'ACRE Partners'
      }
    };

    // Validate config
    const validation = validatePresentationConfig(config);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid presentation configuration', details: validation.errors },
        { status: 400 }
      );
    }

    // Save to database
    const { data: savedContent, error: saveError } = await supabase
      .from('generated_content')
      .insert({
        partner_id: partnerId || user.id,
        type: 'presentation',
        title: config.title,
        data: config,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save presentation:', saveError);
    }

    return NextResponse.json({
      success: true,
      config,
      id: savedContent?.id,
      sources: documentIds.length > 0 ? documentIds : undefined
    });

  } catch (error) {
    console.error('Presentation generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate presentation' },
      { status: 500 }
    );
  }
}

// GET - Retrieve saved presentations
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (id) {
      const { data, error } = await supabase
        .from('generated_content')
        .select('*')
        .eq('id', id)
        .eq('type', 'presentation')
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Presentation not found' }, { status: 404 });
      }

      return NextResponse.json(data);
    }

    const { data, error } = await supabase
      .from('generated_content')
      .select('id, title, created_at, preview_url')
      .eq('type', 'presentation')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch presentations' }, { status: 500 });
    }

    return NextResponse.json({ presentations: data });

  } catch (error) {
    console.error('Fetch presentations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch presentations' },
      { status: 500 }
    );
  }
}
