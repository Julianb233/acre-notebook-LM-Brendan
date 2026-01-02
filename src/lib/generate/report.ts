import type { ReportConfig } from '@/types';

// Report templates
export const REPORT_TEMPLATES = {
  executive_summary: {
    name: 'Executive Summary',
    description: 'High-level overview for leadership',
    sections: [
      { title: 'Overview' },
      { title: 'Key Findings' },
      { title: 'Recommendations' },
    ],
  },
  progress_report: {
    name: 'Progress Report',
    description: 'Status update on ongoing work',
    sections: [
      { title: 'Summary' },
      { title: 'Completed Work' },
      { title: 'In Progress' },
      { title: 'Blockers & Risks' },
      { title: 'Next Steps' },
    ],
  },
  analysis_report: {
    name: 'Analysis Report',
    description: 'Detailed analysis with supporting data',
    sections: [
      { title: 'Introduction' },
      { title: 'Methodology' },
      { title: 'Findings' },
      { title: 'Analysis' },
      { title: 'Conclusions' },
    ],
  },
  client_deliverable: {
    name: 'Client Deliverable',
    description: 'Formal report for client delivery',
    sections: [
      { title: 'Executive Summary' },
      { title: 'Scope of Work' },
      { title: 'Deliverables' },
      { title: 'Results' },
      { title: 'Appendices' },
    ],
  },
};

// Validate report configuration
export function validateReportConfig(config: Partial<ReportConfig>): {
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
    if (!section.title) {
      errors.push(`Section ${index + 1} is missing a title`);
    }
    if (!section.content || section.content.trim().length === 0) {
      errors.push(`Section ${index + 1} is missing content`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Format date for report
export function formatReportDate(date?: string): string {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Generate table of contents
export function generateTableOfContents(config: ReportConfig): {
  title: string;
  page: number;
  subsections?: { title: string; page: number }[];
}[] {
  let currentPage = 2; // Start after title page
  const toc: {
    title: string;
    page: number;
    subsections?: { title: string; page: number }[];
  }[] = [];

  config.sections.forEach((section) => {
    const entry: {
      title: string;
      page: number;
      subsections?: { title: string; page: number }[];
    } = {
      title: section.title,
      page: currentPage,
    };

    // Estimate pages based on content length (rough: 3000 chars per page)
    const mainContentPages = Math.ceil(section.content.length / 3000);
    currentPage += mainContentPages;

    if (section.subsections && section.subsections.length > 0) {
      entry.subsections = [];
      section.subsections.forEach((sub) => {
        entry.subsections!.push({
          title: sub.title,
          page: currentPage,
        });
        currentPage += Math.ceil(sub.content.length / 3000);
      });
    }

    toc.push(entry);
  });

  // Add appendices
  if (config.appendices && config.appendices.length > 0) {
    config.appendices.forEach((appendix, index) => {
      toc.push({
        title: `Appendix ${String.fromCharCode(65 + index)}: ${appendix.title}`,
        page: currentPage,
      });
      currentPage += Math.ceil(appendix.content.length / 3000);
    });
  }

  return toc;
}

// Parse markdown-like content to structured format
export function parseReportContent(content: string): {
  paragraphs: string[];
  lists: string[][];
  quotes: string[];
} {
  const lines = content.split('\n');
  const result: {
    paragraphs: string[];
    lists: string[][];
    quotes: string[];
  } = {
    paragraphs: [],
    lists: [],
    quotes: [],
  };

  let currentList: string[] = [];
  let currentParagraph = '';

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      // List item
      if (currentParagraph) {
        result.paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
      currentList.push(trimmed.slice(2));
    } else if (trimmed.startsWith('> ')) {
      // Quote
      if (currentParagraph) {
        result.paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
      if (currentList.length > 0) {
        result.lists.push(currentList);
        currentList = [];
      }
      result.quotes.push(trimmed.slice(2));
    } else if (trimmed === '') {
      // Empty line - end current paragraph/list
      if (currentParagraph) {
        result.paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
      if (currentList.length > 0) {
        result.lists.push(currentList);
        currentList = [];
      }
    } else {
      // Regular text
      if (currentList.length > 0) {
        result.lists.push(currentList);
        currentList = [];
      }
      currentParagraph += (currentParagraph ? ' ' : '') + trimmed;
    }
  });

  // Handle remaining content
  if (currentParagraph) {
    result.paragraphs.push(currentParagraph.trim());
  }
  if (currentList.length > 0) {
    result.lists.push(currentList);
  }

  return result;
}

// Calculate reading time
export function calculateReadingTime(config: ReportConfig): number {
  const wordsPerMinute = 200;

  let totalWords = 0;

  // Title and subtitle
  totalWords += (config.title?.split(' ').length || 0);
  totalWords += (config.subtitle?.split(' ').length || 0);

  // Sections
  config.sections.forEach((section) => {
    totalWords += (section.title?.split(' ').length || 0);
    totalWords += (section.content?.split(' ').length || 0);

    section.subsections?.forEach((sub) => {
      totalWords += (sub.title?.split(' ').length || 0);
      totalWords += (sub.content?.split(' ').length || 0);
    });
  });

  // Appendices
  config.appendices?.forEach((appendix) => {
    totalWords += (appendix.title?.split(' ').length || 0);
    totalWords += (appendix.content?.split(' ').length || 0);
  });

  return Math.ceil(totalWords / wordsPerMinute);
}

// AI prompt to generate report content
export function generateReportPrompt(
  topic: string,
  context: string,
  template?: keyof typeof REPORT_TEMPLATES
): string {
  const templateInfo = template ? REPORT_TEMPLATES[template] : null;

  return `You are creating a professional report about "${topic}".

Based on the following context from documents:
${context}

${
  templateInfo
    ? `Use the "${templateInfo.name}" template with sections: ${templateInfo.sections.map((s) => s.title).join(', ')}`
    : 'Create appropriate sections for a professional report.'
}

Generate a JSON response with this structure:
{
  "title": "Report title",
  "subtitle": "Optional subtitle",
  "sections": [
    {
      "title": "Section title",
      "content": "Full section content as a string. Can include multiple paragraphs separated by newlines. Use markdown-style lists with - or * for bullet points.",
      "subsections": [
        {
          "title": "Subsection title",
          "content": "Subsection content"
        }
      ]
    }
  ],
  "appendices": [
    {
      "title": "Appendix title",
      "content": "Supporting information"
    }
  ]
}

Requirements:
- Write in a professional, formal tone
- Use specific data and facts from the context
- Each section should be 100-300 words
- Include 3-5 main sections
- Add 1-2 appendices if there's supporting data
- Use bullet points for lists of items
- Quote important statistics or findings`;
}

// Export for PDF generation (used by react-pdf)
export interface PDFReportData {
  title: string;
  subtitle?: string;
  author?: string;
  date: string;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
  };
  tableOfContents: {
    title: string;
    page: number;
    subsections?: { title: string; page: number }[];
  }[];
  sections: {
    title: string;
    content: {
      paragraphs: string[];
      lists: string[][];
      quotes: string[];
    };
    subsections?: {
      title: string;
      content: {
        paragraphs: string[];
        lists: string[][];
        quotes: string[];
      };
    }[];
  }[];
  appendices?: {
    title: string;
    content: {
      paragraphs: string[];
      lists: string[][];
      quotes: string[];
    };
  }[];
  readingTime: number;
}

export function prepareReportForPDF(config: ReportConfig): PDFReportData {
  return {
    title: config.title,
    subtitle: config.subtitle,
    author: config.author,
    date: formatReportDate(config.date),
    branding: {
      primaryColor: config.branding.primary_color,
      secondaryColor: config.branding.secondary_color,
      logoUrl: config.branding.logo_url,
    },
    tableOfContents: generateTableOfContents(config),
    sections: config.sections.map((section) => ({
      title: section.title,
      content: parseReportContent(section.content),
      subsections: section.subsections?.map((sub) => ({
        title: sub.title,
        content: parseReportContent(sub.content),
      })),
    })),
    appendices: config.appendices?.map((appendix) => ({
      title: appendix.title,
      content: parseReportContent(appendix.content),
    })),
    readingTime: calculateReadingTime(config),
  };
}
