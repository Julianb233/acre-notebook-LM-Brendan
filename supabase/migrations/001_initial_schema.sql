-- ACRE Partner Client Notebook LM - Initial Schema
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- PARTNERS (Clients)
-- ============================================
CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  company TEXT NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{
    "default_ai_provider": "openai",
    "branding": {
      "primary_color": "#3B82F6",
      "secondary_color": "#1E40AF"
    },
    "notifications": {
      "email": true,
      "webhook": false
    }
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DOCUMENTS
-- ============================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'docx', 'txt', 'md')),
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'error')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_partner_id ON documents(partner_id);
CREATE INDEX idx_documents_status ON documents(status);

-- ============================================
-- DOCUMENT CHUNKS (for RAG)
-- ============================================
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- CONVERSATIONS
-- ============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_partner_id ON conversations(partner_id);

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]'::jsonb,
  confidence JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- ============================================
-- GENERATED CONTENT
-- ============================================
CREATE TABLE generated_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('infographic', 'presentation', 'report')),
  title TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_url TEXT,
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_generated_content_partner_id ON generated_content(partner_id);
CREATE INDEX idx_generated_content_type ON generated_content(type);

-- ============================================
-- MEETINGS (Fireflies.ai)
-- ============================================
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  fireflies_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  participants TEXT[] DEFAULT '{}',
  transcript TEXT,
  summary TEXT,
  action_items TEXT[] DEFAULT '{}',
  date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meetings_partner_id ON meetings(partner_id);
CREATE INDEX idx_meetings_fireflies_id ON meetings(fireflies_id);
CREATE INDEX idx_meetings_date ON meetings(date);

-- ============================================
-- MEETING CHUNKS (for RAG)
-- ============================================
CREATE TABLE meeting_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meeting_chunks_meeting_id ON meeting_chunks(meeting_id);
CREATE INDEX idx_meeting_chunks_embedding ON meeting_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- AIRTABLE RECORDS
-- ============================================
CREATE TABLE airtable_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  base_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partner_id, base_id, table_name, record_id)
);

CREATE INDEX idx_airtable_records_partner_id ON airtable_records(partner_id);
CREATE INDEX idx_airtable_records_lookup ON airtable_records(base_id, table_name);

-- ============================================
-- AIRTABLE CONFIGS
-- ============================================
CREATE TABLE airtable_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  base_id TEXT NOT NULL,
  tables JSONB NOT NULL DEFAULT '[]'::jsonb,
  api_key_encrypted TEXT,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partner_id, base_id)
);

-- ============================================
-- WEBHOOK LOGS (n8n integration)
-- ============================================
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  endpoint TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_partner_id ON webhook_logs(partner_id);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at);
CREATE INDEX idx_webhook_logs_status ON webhook_logs(status);

-- ============================================
-- DATA SOURCES (for transparency dashboard)
-- ============================================
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('documents', 'fireflies', 'airtable')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'syncing', 'error', 'disconnected')),
  last_sync TIMESTAMPTZ,
  record_count INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_data_sources_partner_id ON data_sources(partner_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE airtable_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE airtable_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;

-- Partners can only see their own data
CREATE POLICY "Partners can view own data" ON partners
  FOR SELECT USING (auth.uid()::text = id::text OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Partners can update own data" ON partners
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Documents policies
CREATE POLICY "Partners can view own documents" ON documents
  FOR SELECT USING (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text) OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Partners can insert own documents" ON documents
  FOR INSERT WITH CHECK (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text) OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Partners can update own documents" ON documents
  FOR UPDATE USING (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text));

CREATE POLICY "Partners can delete own documents" ON documents
  FOR DELETE USING (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text));

-- Document chunks inherit from documents
CREATE POLICY "Partners can view own document chunks" ON document_chunks
  FOR SELECT USING (document_id IN (SELECT id FROM documents WHERE partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text)) OR auth.jwt() ->> 'role' = 'service_role');

-- Conversations policies
CREATE POLICY "Partners can view own conversations" ON conversations
  FOR ALL USING (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text) OR auth.jwt() ->> 'role' = 'service_role');

-- Messages inherit from conversations
CREATE POLICY "Partners can view own messages" ON messages
  FOR ALL USING (conversation_id IN (SELECT id FROM conversations WHERE partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text)) OR auth.jwt() ->> 'role' = 'service_role');

-- Generated content policies
CREATE POLICY "Partners can view own generated content" ON generated_content
  FOR ALL USING (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text) OR auth.jwt() ->> 'role' = 'service_role');

-- Meetings policies
CREATE POLICY "Partners can view own meetings" ON meetings
  FOR ALL USING (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text) OR auth.jwt() ->> 'role' = 'service_role');

-- Meeting chunks inherit from meetings
CREATE POLICY "Partners can view own meeting chunks" ON meeting_chunks
  FOR SELECT USING (meeting_id IN (SELECT id FROM meetings WHERE partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text)) OR auth.jwt() ->> 'role' = 'service_role');

-- Airtable policies
CREATE POLICY "Partners can view own airtable records" ON airtable_records
  FOR ALL USING (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text) OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Partners can view own airtable configs" ON airtable_configs
  FOR ALL USING (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text) OR auth.jwt() ->> 'role' = 'service_role');

-- Webhook logs policies
CREATE POLICY "Partners can view own webhook logs" ON webhook_logs
  FOR SELECT USING (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text) OR auth.jwt() ->> 'role' = 'service_role');

-- Data sources policies
CREATE POLICY "Partners can view own data sources" ON data_sources
  FOR ALL USING (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text) OR auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to search documents using vector similarity
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  p_partner_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE
    (p_partner_id IS NULL OR d.partner_id = p_partner_id)
    AND d.status = 'ready'
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to search meetings using vector similarity
CREATE OR REPLACE FUNCTION search_meetings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  p_partner_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  meeting_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.meeting_id,
    mc.content,
    mc.metadata,
    1 - (mc.embedding <=> query_embedding) as similarity
  FROM meeting_chunks mc
  JOIN meetings m ON mc.meeting_id = m.id
  WHERE
    (p_partner_id IS NULL OR m.partner_id = p_partner_id)
    AND 1 - (mc.embedding <=> query_embedding) > match_threshold
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get combined RAG context
CREATE OR REPLACE FUNCTION get_rag_context(
  query_embedding vector(1536),
  p_partner_id uuid,
  match_threshold float DEFAULT 0.7,
  max_results int DEFAULT 20
)
RETURNS TABLE (
  source_type text,
  source_id uuid,
  source_name text,
  content text,
  metadata jsonb,
  similarity float,
  last_updated timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Document chunks
  SELECT
    'document'::text as source_type,
    dc.document_id as source_id,
    d.name as source_name,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity,
    d.updated_at as last_updated
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE
    d.partner_id = p_partner_id
    AND d.status = 'ready'
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold

  UNION ALL

  -- Meeting chunks
  SELECT
    'meeting'::text as source_type,
    mc.meeting_id as source_id,
    m.title as source_name,
    mc.content,
    mc.metadata,
    1 - (mc.embedding <=> query_embedding) as similarity,
    m.synced_at as last_updated
  FROM meeting_chunks mc
  JOIN meetings m ON mc.meeting_id = m.id
  WHERE
    m.partner_id = p_partner_id
    AND 1 - (mc.embedding <=> query_embedding) > match_threshold

  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_generated_content_updated_at
  BEFORE UPDATE ON generated_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_airtable_configs_updated_at
  BEFORE UPDATE ON airtable_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_data_sources_updated_at
  BEFORE UPDATE ON data_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DATA (Optional demo partner)
-- ============================================
-- Uncomment to add a demo partner for testing
-- INSERT INTO partners (name, email, company, settings) VALUES (
--   'Demo User',
--   'demo@acre.example.com',
--   'ACRE Demo',
--   '{
--     "default_ai_provider": "openai",
--     "branding": {
--       "primary_color": "#10B981",
--       "secondary_color": "#059669"
--     },
--     "notifications": {
--       "email": true,
--       "webhook": true
--     }
--   }'::jsonb
-- );
