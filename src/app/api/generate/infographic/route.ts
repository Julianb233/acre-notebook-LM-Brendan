import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import {
  validateInfographicConfig,
  generateInfographicPrompt,
  INFOGRAPHIC_TEMPLATES
} from '@/lib/generate/infographic';
import type { InfographicConfig, InfographicSection } from '@/types';

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
      documentIds = [],
      partnerId
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Retrieve relevant document context if documentIds provided
    let documentContext = '';
    if (documentIds.length > 0) {
      const { data: chunks } = await supabase
        .from('document_chunks')
        .select('content, documents!inner(name)')
        .in('document_id', documentIds)
        .limit(20);

      if (chunks && chunks.length > 0) {
        documentContext = chunks
          .map(c => `[${(c.documents as { name: string }).name}]: ${c.content}`)
          .join('\n\n');
      }
    }

    // Get template configuration
    const templateConfig = template ? INFOGRAPHIC_TEMPLATES[template] : null;

    // Generate infographic content with AI
    const systemPrompt = `You are an expert data visualization designer. Create infographic content based on the user's request and any provided document context.

${templateConfig ? `Use this template style: ${templateConfig.name} - ${templateConfig.description}` : ''}

Return your response as a valid JSON object with this exact structure:
{
  "title": "Main title for the infographic",
  "subtitle": "Optional subtitle",
  "sections": [
    {
      "id": "unique-id",
      "title": "Section title",
      "type": "bar" | "pie" | "line" | "stat",
      "data": [
        { "label": "Item 1", "value": 100 },
        { "label": "Item 2", "value": 200 }
      ]
    }
  ],
  "footer": "Optional footer text with source attribution"
}

For "stat" type sections, use this data format:
{ "label": "Metric name", "value": 95, "suffix": "%" }

Ensure all numerical values are realistic and based on the provided context when available.`;

    const userPrompt = generateInfographicPrompt(
      prompt,
      documentContext || undefined
    );

    const { text } = await generateText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
    });

    // Parse AI response
    let infographicData;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
      const jsonStr = jsonMatch[1]?.trim() || text.trim();
      infographicData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', text);
      return NextResponse.json(
        { error: 'Failed to generate valid infographic structure' },
        { status: 500 }
      );
    }

    // Build config
    const config: InfographicConfig = {
      title: infographicData.title || 'Untitled Infographic',
      subtitle: infographicData.subtitle,
      sections: infographicData.sections || [],
      colors: templateConfig?.colors || {
        primary: '#3B82F6',
        secondary: '#10B981',
        accent: '#F59E0B',
        background: '#FFFFFF',
        text: '#1F2937'
      },
      branding: {
        logo: '/acre-logo.svg',
        companyName: 'ACRE Partners'
      },
      footer: infographicData.footer
    };

    // Validate config
    const validation = validateInfographicConfig(config);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid infographic configuration', details: validation.errors },
        { status: 400 }
      );
    }

    // Save to database
    const { data: savedContent, error: saveError } = await supabase
      .from('generated_content')
      .insert({
        partner_id: partnerId || user.id,
        type: 'infographic',
        title: config.title,
        data: config,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save infographic:', saveError);
      // Continue anyway - generation succeeded
    }

    return NextResponse.json({
      success: true,
      config,
      id: savedContent?.id,
      sources: documentIds.length > 0 ? documentIds : undefined
    });

  } catch (error) {
    console.error('Infographic generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate infographic' },
      { status: 500 }
    );
  }
}

// GET - Retrieve saved infographics
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
      // Get specific infographic
      const { data, error } = await supabase
        .from('generated_content')
        .select('*')
        .eq('id', id)
        .eq('type', 'infographic')
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Infographic not found' }, { status: 404 });
      }

      return NextResponse.json(data);
    }

    // List infographics
    const { data, error } = await supabase
      .from('generated_content')
      .select('id, title, created_at, preview_url')
      .eq('type', 'infographic')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch infographics' }, { status: 500 });
    }

    return NextResponse.json({ infographics: data });

  } catch (error) {
    console.error('Fetch infographics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch infographics' },
      { status: 500 }
    );
  }
}
