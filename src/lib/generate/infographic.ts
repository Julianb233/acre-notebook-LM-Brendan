import type { InfographicConfig } from '@/types';

// Color utilities
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

export function generateGradientColors(
  primary: string,
  secondary: string,
  steps: number
): string[] {
  const p = hexToRgb(primary);
  const s = hexToRgb(secondary);
  const colors: string[] = [];

  for (let i = 0; i < steps; i++) {
    const ratio = i / (steps - 1);
    const r = Math.round(p.r + (s.r - p.r) * ratio);
    const g = Math.round(p.g + (s.g - p.g) * ratio);
    const b = Math.round(p.b + (s.b - p.b) * ratio);
    colors.push(`rgb(${r}, ${g}, ${b})`);
  }

  return colors;
}

// Default templates for infographics
export const INFOGRAPHIC_TEMPLATES = {
  business_metrics: {
    name: 'Business Metrics',
    description: 'Key performance indicators and metrics',
    sections: [
      { heading: 'Revenue', chart_type: 'stat' as const },
      { heading: 'Growth', chart_type: 'line' as const },
      { heading: 'Distribution', chart_type: 'pie' as const },
    ],
  },
  comparison: {
    name: 'Comparison',
    description: 'Side-by-side comparison of data',
    sections: [
      { heading: 'Overview', chart_type: 'bar' as const },
      { heading: 'Details', chart_type: 'bar' as const },
    ],
  },
  timeline: {
    name: 'Timeline',
    description: 'Progress over time',
    sections: [
      { heading: 'Progress', chart_type: 'line' as const },
      { heading: 'Milestones', chart_type: 'stat' as const },
    ],
  },
  summary: {
    name: 'Summary',
    description: 'High-level overview with key stats',
    sections: [
      { heading: 'Key Stats', chart_type: 'stat' as const },
      { heading: 'Breakdown', chart_type: 'pie' as const },
    ],
  },
};

// Validate infographic configuration
export function validateInfographicConfig(config: Partial<InfographicConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.title || config.title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (!config.sections || config.sections.length === 0) {
    errors.push('At least one section is required');
  }

  config.sections?.forEach((section, index) => {
    if (!section.heading) {
      errors.push(`Section ${index + 1} is missing a heading`);
    }
    if (!section.data || section.data.length === 0) {
      errors.push(`Section ${index + 1} has no data`);
    }
  });

  if (!config.branding?.primary_color) {
    errors.push('Primary color is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Generate default branding
export function getDefaultBranding(partnerBranding?: {
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string;
}): InfographicConfig['branding'] {
  return {
    primary_color: partnerBranding?.primary_color || '#2563eb',
    secondary_color: partnerBranding?.secondary_color || '#1e40af',
    logo_url: partnerBranding?.logo_url,
  };
}

// Format data for charts
export function formatChartData(
  data: { label: string; value: number | string }[],
  chartType: 'bar' | 'pie' | 'line' | 'stat'
): Record<string, unknown>[] {
  switch (chartType) {
    case 'pie':
      return data.map((item) => ({
        name: item.label,
        value: typeof item.value === 'number' ? item.value : parseFloat(String(item.value)) || 0,
      }));

    case 'bar':
    case 'line':
      return data.map((item) => ({
        name: item.label,
        value: typeof item.value === 'number' ? item.value : parseFloat(String(item.value)) || 0,
      }));

    case 'stat':
    default:
      return data.map((item) => ({
        label: item.label,
        value: item.value,
      }));
  }
}

// Calculate summary statistics
export function calculateStats(data: { value: number | string }[]): {
  total: number;
  average: number;
  min: number;
  max: number;
} {
  const numbers = data
    .map((d) => (typeof d.value === 'number' ? d.value : parseFloat(String(d.value))))
    .filter((n) => !isNaN(n));

  if (numbers.length === 0) {
    return { total: 0, average: 0, min: 0, max: 0 };
  }

  return {
    total: numbers.reduce((a, b) => a + b, 0),
    average: numbers.reduce((a, b) => a + b, 0) / numbers.length,
    min: Math.min(...numbers),
    max: Math.max(...numbers),
  };
}

// AI prompt to generate infographic content from documents
export function generateInfographicPrompt(
  topic: string,
  context: string,
  template?: keyof typeof INFOGRAPHIC_TEMPLATES
): string {
  const templateInfo = template ? INFOGRAPHIC_TEMPLATES[template] : null;

  return `You are creating an infographic about "${topic}".

Based on the following context from documents:
${context}

${
  templateInfo
    ? `Use the "${templateInfo.name}" template with sections: ${templateInfo.sections.map((s) => s.heading).join(', ')}`
    : 'Create appropriate sections with relevant data.'
}

Generate a JSON response with this structure:
{
  "title": "Main title for the infographic",
  "subtitle": "Optional subtitle",
  "sections": [
    {
      "heading": "Section heading",
      "data": [
        { "label": "Label 1", "value": 100 },
        { "label": "Label 2", "value": 200 }
      ],
      "chart_type": "bar" | "pie" | "line" | "stat"
    }
  ]
}

Requirements:
- Use real numbers from the context when available
- Create 2-4 sections
- Each section should have 3-6 data points
- Choose appropriate chart types for the data
- Keep labels concise (max 20 characters)`;
}
