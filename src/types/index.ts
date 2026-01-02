// Partner/Client types
export interface Partner {
  id: string;
  name: string;
  email: string;
  company: string;
  logo_url: string | null;
  settings: PartnerSettings;
  created_at: string;
}

export interface PartnerSettings {
  default_ai_provider: 'openai' | 'anthropic' | 'google';
  branding: {
    primary_color: string;
    secondary_color: string;
  };
  notifications: {
    email: boolean;
    webhook: boolean;
  };
}

// Document types
export interface Document {
  id: string;
  partner_id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'md';
  storage_path: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  metadata: DocumentMetadata;
  created_at: string;
  updated_at: string;
}

export interface DocumentMetadata {
  size: number;
  pages?: number;
  word_count?: number;
  last_processed?: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  embedding: number[];
  chunk_index: number;
  metadata: {
    page?: number;
    section?: string;
  };
}

// Chat types
export interface Conversation {
  id: string;
  partner_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources: SourceCitation[];
  confidence?: ConfidenceScore;
  created_at: string;
}

// Source Citation types (KEY for transparency)
export interface SourceCitation {
  id: string;
  type: 'document' | 'meeting' | 'airtable';
  source_name: string;
  source_id: string;
  location: {
    page?: number;
    timestamp?: string;
    field?: string;
    chunk_index?: number;
  };
  excerpt: string;
  relevance_score: number;
  last_updated: string;
  edit_url?: string;
}

export interface ConfidenceScore {
  level: 'high' | 'medium' | 'low';
  score: number; // 0-1
  supporting_sources: number;
  explanation: string;
}

// Generated content types
export interface GeneratedContent {
  id: string;
  partner_id: string;
  type: 'infographic' | 'presentation' | 'report';
  title: string;
  data: Record<string, unknown>;
  preview_url: string | null;
  status: 'generating' | 'ready' | 'error';
  created_at: string;
}

// Meeting types (Fireflies)
export interface Meeting {
  id: string;
  partner_id: string;
  fireflies_id: string;
  title: string;
  participants: string[];
  transcript: string;
  summary: string | null;
  action_items: string[];
  date: string;
  duration_minutes: number;
  created_at: string;
  synced_at: string;
}

export interface MeetingChunk {
  id: string;
  meeting_id: string;
  content: string;
  embedding: number[];
  chunk_index: number;
  metadata: {
    timestamp?: string;
    speaker?: string;
  };
}

// Airtable types
export interface AirtableRecord {
  id: string;
  partner_id: string;
  base_id: string;
  table_name: string;
  record_id: string;
  data: Record<string, unknown>;
  synced_at: string;
}

export interface AirtableConfig {
  base_id: string;
  tables: {
    name: string;
    fields_to_sync: string[];
    sync_frequency: 'realtime' | 'hourly' | 'daily';
  }[];
}

// n8n Webhook types
export interface WebhookLog {
  id: string;
  direction: 'inbound' | 'outbound';
  endpoint: string;
  event_type: string;
  payload: Record<string, unknown>;
  response: Record<string, unknown> | null;
  status: 'pending' | 'success' | 'error';
  created_at: string;
}

export interface N8nEvent {
  type: 'new_document' | 'chat_query' | 'content_generated' | 'meeting_synced' | 'airtable_updated';
  partner_id: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// Data Source Dashboard types
export interface DataSource {
  id: string;
  type: 'documents' | 'fireflies' | 'airtable';
  name: string;
  status: 'connected' | 'syncing' | 'error' | 'disconnected';
  last_sync: string | null;
  record_count: number;
  freshness: 'fresh' | 'stale' | 'outdated';
  config: Record<string, unknown>;
}

export interface DataSourceStats {
  total_documents: number;
  total_meetings: number;
  total_airtable_records: number;
  last_activity: string;
  storage_used_mb: number;
}

// RAG types
export interface RAGContext {
  chunks: {
    content: string;
    source: SourceCitation;
    similarity: number;
  }[];
  total_tokens: number;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Content Generation types

// Infographic Types
export interface InfographicDataPoint {
  label: string;
  value: number;
  suffix?: string;
  color?: string;
}

export interface InfographicSection {
  id: string;
  title: string;
  type: 'bar' | 'pie' | 'line' | 'stat';
  data: InfographicDataPoint[];
}

export interface InfographicColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface InfographicBranding {
  logo?: string;
  companyName?: string;
}

export interface InfographicConfig {
  title: string;
  subtitle?: string;
  sections: InfographicSection[];
  colors: InfographicColors;
  branding?: InfographicBranding;
  footer?: string;
}

// Presentation Types
export interface Slide {
  id: string;
  layout: 'title' | 'content' | 'two-column' | 'image';
  title: string;
  subtitle?: string;
  bullets?: string[];
  leftContent?: string[];
  rightContent?: string[];
  imageUrl?: string;
  notes?: string;
}

export interface PresentationTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

export interface PresentationBranding {
  logo?: string;
  companyName?: string;
}

export interface PresentationConfig {
  title: string;
  subtitle?: string;
  author?: string;
  slides: Slide[];
  theme: PresentationTheme;
  branding?: PresentationBranding;
}

// Report Types
export interface ReportSubsection {
  id: string;
  title: string;
  content: string;
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  subsections?: ReportSubsection[];
}

export interface ReportAppendix {
  id: string;
  title: string;
  content: string;
}

export interface ReportStyling {
  fontFamily: string;
  primaryColor: string;
  headerStyle: 'modern' | 'classic' | 'minimal';
}

export interface ReportBranding {
  logo?: string;
  companyName?: string;
}

export interface ReportConfig {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string;
  executiveSummary?: string;
  sections: ReportSection[];
  appendices?: ReportAppendix[];
  references?: string[];
  styling?: ReportStyling;
  branding?: ReportBranding;
}

export interface TableOfContentsItem {
  id: string;
  title: string;
  level: number;
  page?: number;
}
