import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import {
  validateReportConfig,
  generateReportPrompt,
  generateTableOfContents,
  REPORT_TEMPLATES
} from '@/lib/generate/report';
import type { ReportConfig, ReportSection } from '@/types';

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
      partnerId,
      action = 'generate' // 'generate' | 'export'
    } = body;

    // Handle export action - return PDF data
    if (action === 'export') {
      const { config } = body;
      if (!config) {
        return NextResponse.json({ error: 'Config required for export' }, { status: 400 });
      }

      // For PDF generation, we return the config for client-side rendering
      // The actual PDF is generated client-side using @react-pdf/renderer
      return NextResponse.json({
        success: true,
        config,
        exportReady: true
      });
    }

    // Generate report
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Retrieve relevant document context
    let documentContext = '';
    let sourceDocuments: { id: string; name: string }[] = [];

    if (documentIds.length > 0) {
      const { data: chunks } = await supabase
        .from('document_chunks')
        .select('content, documents!inner(id, name)')
        .in('document_id', documentIds)
        .limit(40);

      if (chunks && chunks.length > 0) {
        documentContext = chunks
          .map(c => `[${(c.documents as { name: string }).name}]: ${c.content}`)
          .join('\n\n');

        // Get unique source documents
        const uniqueDocs = new Map();
        chunks.forEach(c => {
          const doc = c.documents as { id: string; name: string };
          if (!uniqueDocs.has(doc.id)) {
            uniqueDocs.set(doc.id, doc);
          }
        });
        sourceDocuments = Array.from(uniqueDocs.values());
      }
    }

    // Get template configuration
    const templateConfig = template ? REPORT_TEMPLATES[template] : null;

    // Generate report content with AI
    const systemPrompt = `You are an expert report writer. Create a comprehensive, professional report based on the user's request.

${templateConfig ? `Use this template style: ${templateConfig.name} - ${templateConfig.description}` : ''}

Return your response as a valid JSON object with this exact structure:
{
  "title": "Report Title",
  "subtitle": "Optional subtitle",
  "author": "Author name or organization",
  "date": "${new Date().toISOString().split('T')[0]}",
  "executiveSummary": "2-3 paragraph executive summary of the entire report",
  "sections": [
    {
      "id": "section-1",
      "title": "Section Title",
      "content": "Detailed section content with multiple paragraphs...",
      "subsections": [
        {
          "id": "subsection-1-1",
          "title": "Subsection Title",
          "content": "Subsection content..."
        }
      ]
    }
  ],
  "appendices": [
    {
      "id": "appendix-a",
      "title": "Appendix A: Data Tables",
      "content": "Supporting data and tables..."
    }
  ],
  "references": ["Reference 1", "Reference 2"]
}

Create a well-structured report with:
- Clear executive summary
- 4-6 main sections with subsections where appropriate
- Professional, formal tone
- Data-driven insights when context is provided
- Appendices for supporting material`;

    const userPrompt = generateReportPrompt(
      prompt,
      documentContext || undefined
    );

    const { text } = await generateText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      maxTokens: 4000, // Reports need more tokens
    });

    // Parse AI response
    let reportData;
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
      const jsonStr = jsonMatch[1]?.trim() || text.trim();
      reportData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', text);
      return NextResponse.json(
        { error: 'Failed to generate valid report structure' },
        { status: 500 }
      );
    }

    // Build config
    const config: ReportConfig = {
      title: reportData.title || 'Untitled Report',
      subtitle: reportData.subtitle,
      author: reportData.author || 'ACRE Partners',
      date: reportData.date || new Date().toISOString().split('T')[0],
      executiveSummary: reportData.executiveSummary,
      sections: reportData.sections || [],
      appendices: reportData.appendices || [],
      references: reportData.references || [],
      styling: templateConfig?.styling || {
        fontFamily: 'Inter',
        primaryColor: '#1E40AF',
        headerStyle: 'modern'
      },
      branding: {
        logo: '/acre-logo.svg',
        companyName: 'ACRE Partners'
      }
    };

    // Generate table of contents
    const tableOfContents = generateTableOfContents(config.sections, config.appendices);

    // Validate config
    const validation = validateReportConfig(config);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid report configuration', details: validation.errors },
        { status: 400 }
      );
    }

    // Save to database
    const { data: savedContent, error: saveError } = await supabase
      .from('generated_content')
      .insert({
        partner_id: partnerId || user.id,
        type: 'report',
        title: config.title,
        data: { ...config, tableOfContents },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save report:', saveError);
    }

    return NextResponse.json({
      success: true,
      config: { ...config, tableOfContents },
      id: savedContent?.id,
      sources: sourceDocuments.length > 0 ? sourceDocuments : undefined
    });

  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

// GET - Retrieve saved reports
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
        .eq('type', 'report')
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }

      return NextResponse.json(data);
    }

    const { data, error } = await supabase
      .from('generated_content')
      .select('id, title, created_at, preview_url')
      .eq('type', 'report')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }

    return NextResponse.json({ reports: data });

  } catch (error) {
    console.error('Fetch reports error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
