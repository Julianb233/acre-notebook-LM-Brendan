import pptxgen from 'pptxgenjs';
import type { PresentationConfig } from '@/types';

// Slide layout definitions
export const SLIDE_LAYOUTS = {
  title: {
    name: 'Title Slide',
    description: 'Opening slide with title and subtitle',
  },
  content: {
    name: 'Content Slide',
    description: 'Bullet points with optional header',
  },
  'two-column': {
    name: 'Two Column',
    description: 'Split content in two columns',
  },
  image: {
    name: 'Image Slide',
    description: 'Full or half image with text',
  },
};

// Default presentation templates
export const PRESENTATION_TEMPLATES = {
  business_update: {
    name: 'Business Update',
    description: 'Quarterly or monthly business review',
    slides: [
      { title: 'Executive Summary', layout: 'title' as const },
      { title: 'Key Metrics', layout: 'content' as const },
      { title: 'Highlights & Lowlights', layout: 'two-column' as const },
      { title: 'Next Steps', layout: 'content' as const },
    ],
  },
  project_proposal: {
    name: 'Project Proposal',
    description: 'Propose a new project or initiative',
    slides: [
      { title: 'Project Overview', layout: 'title' as const },
      { title: 'Problem Statement', layout: 'content' as const },
      { title: 'Proposed Solution', layout: 'content' as const },
      { title: 'Timeline & Resources', layout: 'two-column' as const },
      { title: 'Expected Outcomes', layout: 'content' as const },
    ],
  },
  client_report: {
    name: 'Client Report',
    description: 'Progress report for clients',
    slides: [
      { title: 'Report Overview', layout: 'title' as const },
      { title: 'Work Completed', layout: 'content' as const },
      { title: 'Results & Metrics', layout: 'content' as const },
      { title: 'Recommendations', layout: 'content' as const },
    ],
  },
};

// Validate presentation configuration
export function validatePresentationConfig(config: Partial<PresentationConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.title || config.title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (!config.slides || config.slides.length === 0) {
    errors.push('At least one slide is required');
  }

  config.slides?.forEach((slide, index) => {
    if (!slide.title) {
      errors.push(`Slide ${index + 1} is missing a title`);
    }
    if (!slide.layout) {
      errors.push(`Slide ${index + 1} is missing a layout`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Generate PPTX file
export async function generatePPTX(config: PresentationConfig): Promise<Blob> {
  const pptx = new pptxgen();

  // Set presentation properties
  pptx.author = config.author || 'ACRE Notebook';
  pptx.title = config.title;
  pptx.subject = config.subtitle || '';
  pptx.company = 'ACRE';

  // Define master slide with branding
  pptx.defineSlideMaster({
    title: 'BRANDED_SLIDE',
    background: { color: 'FFFFFF' },
    objects: [
      // Header bar with primary color
      {
        rect: {
          x: 0,
          y: 0,
          w: '100%',
          h: 0.5,
          fill: { color: config.branding.primary_color.replace('#', '') },
        },
      },
      // Footer line
      {
        rect: {
          x: 0,
          y: 5.25,
          w: '100%',
          h: 0.05,
          fill: { color: config.branding.secondary_color.replace('#', '') },
        },
      },
    ],
  });

  // Generate slides
  config.slides.forEach((slideConfig, index) => {
    const slide = pptx.addSlide({ masterName: index === 0 ? undefined : 'BRANDED_SLIDE' });

    switch (slideConfig.layout) {
      case 'title':
        generateTitleSlide(slide, slideConfig, config.branding);
        break;
      case 'content':
        generateContentSlide(slide, slideConfig, config.branding);
        break;
      case 'two-column':
        generateTwoColumnSlide(slide, slideConfig, config.branding);
        break;
      case 'image':
        generateImageSlide(slide, slideConfig, config.branding);
        break;
    }
  });

  // Generate and return blob
  const data = await pptx.write({ outputType: 'blob' });
  return data as Blob;
}

function generateTitleSlide(
  slide: pptxgen.Slide,
  config: PresentationConfig['slides'][0],
  branding: PresentationConfig['branding']
) {
  // Background gradient effect
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: '100%',
    h: '100%',
    fill: { color: branding.primary_color.replace('#', '') },
  });

  // Title
  slide.addText(config.title, {
    x: 0.5,
    y: 2,
    w: '90%',
    h: 1.5,
    fontSize: 44,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
  });

  // Subtitle/content
  if (config.content && config.content.length > 0) {
    slide.addText(config.content.join('\n'), {
      x: 0.5,
      y: 3.5,
      w: '90%',
      h: 1,
      fontSize: 24,
      color: 'FFFFFF',
      align: 'center',
    });
  }

  // Logo if available
  if (branding.logo_url) {
    slide.addImage({
      path: branding.logo_url,
      x: 4.25,
      y: 4.5,
      w: 1.5,
      h: 0.75,
    });
  }
}

function generateContentSlide(
  slide: pptxgen.Slide,
  config: PresentationConfig['slides'][0],
  branding: PresentationConfig['branding']
) {
  // Slide title
  slide.addText(config.title, {
    x: 0.5,
    y: 0.5,
    w: '90%',
    h: 0.75,
    fontSize: 32,
    bold: true,
    color: branding.primary_color.replace('#', ''),
  });

  // Bullet points
  if (config.content && config.content.length > 0) {
    const bullets = config.content.map((text) => ({
      text,
      options: { bullet: { type: 'bullet' as const }, fontSize: 18 },
    }));

    slide.addText(bullets, {
      x: 0.5,
      y: 1.5,
      w: '90%',
      h: 3.5,
      valign: 'top',
    });
  }
}

function generateTwoColumnSlide(
  slide: pptxgen.Slide,
  config: PresentationConfig['slides'][0],
  branding: PresentationConfig['branding']
) {
  // Slide title
  slide.addText(config.title, {
    x: 0.5,
    y: 0.5,
    w: '90%',
    h: 0.75,
    fontSize: 32,
    bold: true,
    color: branding.primary_color.replace('#', ''),
  });

  // Split content into two columns
  const midpoint = Math.ceil((config.content?.length || 0) / 2);
  const leftContent = config.content?.slice(0, midpoint) || [];
  const rightContent = config.content?.slice(midpoint) || [];

  // Left column
  if (leftContent.length > 0) {
    const leftBullets = leftContent.map((text) => ({
      text,
      options: { bullet: { type: 'bullet' as const }, fontSize: 16 },
    }));

    slide.addText(leftBullets, {
      x: 0.5,
      y: 1.5,
      w: 4.25,
      h: 3.5,
      valign: 'top',
    });
  }

  // Right column
  if (rightContent.length > 0) {
    const rightBullets = rightContent.map((text) => ({
      text,
      options: { bullet: { type: 'bullet' as const }, fontSize: 16 },
    }));

    slide.addText(rightBullets, {
      x: 5.25,
      y: 1.5,
      w: 4.25,
      h: 3.5,
      valign: 'top',
    });
  }
}

function generateImageSlide(
  slide: pptxgen.Slide,
  config: PresentationConfig['slides'][0],
  branding: PresentationConfig['branding']
) {
  // Slide title
  slide.addText(config.title, {
    x: 0.5,
    y: 0.5,
    w: '90%',
    h: 0.75,
    fontSize: 32,
    bold: true,
    color: branding.primary_color.replace('#', ''),
  });

  // Image
  if (config.image_url) {
    slide.addImage({
      path: config.image_url,
      x: 0.5,
      y: 1.5,
      w: 5,
      h: 3.5,
    });

    // Content on the right
    if (config.content && config.content.length > 0) {
      const bullets = config.content.map((text) => ({
        text,
        options: { bullet: { type: 'bullet' as const }, fontSize: 14 },
      }));

      slide.addText(bullets, {
        x: 6,
        y: 1.5,
        w: 3.5,
        h: 3.5,
        valign: 'top',
      });
    }
  } else {
    // No image, use full content
    if (config.content && config.content.length > 0) {
      const bullets = config.content.map((text) => ({
        text,
        options: { bullet: { type: 'bullet' as const }, fontSize: 18 },
      }));

      slide.addText(bullets, {
        x: 0.5,
        y: 1.5,
        w: '90%',
        h: 3.5,
        valign: 'top',
      });
    }
  }
}

// AI prompt to generate presentation content
export function generatePresentationPrompt(
  topic: string,
  context: string,
  template?: keyof typeof PRESENTATION_TEMPLATES
): string {
  const templateInfo = template ? PRESENTATION_TEMPLATES[template] : null;

  return `You are creating a professional presentation about "${topic}".

Based on the following context from documents:
${context}

${
  templateInfo
    ? `Use the "${templateInfo.name}" template with slides: ${templateInfo.slides.map((s) => s.title).join(', ')}`
    : 'Create appropriate slides for a professional presentation.'
}

Generate a JSON response with this structure:
{
  "title": "Presentation title",
  "subtitle": "Optional subtitle",
  "slides": [
    {
      "title": "Slide title",
      "content": ["Bullet point 1", "Bullet point 2", "Bullet point 3"],
      "layout": "title" | "content" | "two-column" | "image"
    }
  ]
}

Requirements:
- First slide should use "title" layout
- Each content slide should have 3-5 bullet points
- Keep bullet points concise (max 100 characters each)
- Use facts and figures from the context
- Create 5-8 slides total
- End with a summary or next steps slide`;
}
