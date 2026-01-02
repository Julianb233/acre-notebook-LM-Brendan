-- Data Sources Schema for Acre NotebookLM
-- This migration creates tables for Fireflies.ai and Airtable integrations

-- Data Source Status Table
-- Tracks the status and last sync time of each data source
CREATE TABLE IF NOT EXISTS data_source_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT UNIQUE NOT NULL, -- 'documents', 'fireflies', 'airtable'
  status TEXT NOT NULL DEFAULT 'disconnected', -- 'connected', 'disconnected', 'syncing', 'error'
  last_sync TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  item_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meeting Transcripts Table (Fireflies.ai)
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'fireflies',
  title TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- in seconds
  transcript_url TEXT,
  participants TEXT[],
  summary TEXT,
  action_items TEXT[],
  keywords TEXT[],
  full_transcript TEXT,
  raw_data JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(external_id, source)
);

-- Airtable Records Table
CREATE TABLE IF NOT EXISTS airtable_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'airtable',
  base_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '{}',
  created_at_source TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(external_id, base_id, table_id)
);

-- Sync Audit Log Table
-- Tracks all sync operations for transparency
CREATE TABLE IF NOT EXISTS sync_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  action TEXT NOT NULL, -- 'sync_started', 'sync_completed', 'sync_failed', 'items_added', 'items_updated', 'items_deleted'
  details TEXT,
  items_affected INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_source ON meeting_transcripts(source);
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_date ON meeting_transcripts(date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_synced_at ON meeting_transcripts(synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_airtable_records_source ON airtable_records(source);
CREATE INDEX IF NOT EXISTS idx_airtable_records_base_table ON airtable_records(base_id, table_id);
CREATE INDEX IF NOT EXISTS idx_airtable_records_synced_at ON airtable_records(synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_audit_log_source ON sync_audit_log(source);
CREATE INDEX IF NOT EXISTS idx_sync_audit_log_created_at ON sync_audit_log(created_at DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_data_source_status_updated_at ON data_source_status;
CREATE TRIGGER update_data_source_status_updated_at
  BEFORE UPDATE ON data_source_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_transcripts_updated_at ON meeting_transcripts;
CREATE TRIGGER update_meeting_transcripts_updated_at
  BEFORE UPDATE ON meeting_transcripts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_airtable_records_updated_at ON airtable_records;
CREATE TRIGGER update_airtable_records_updated_at
  BEFORE UPDATE ON airtable_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE data_source_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE airtable_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for now, can be restricted per user later)
CREATE POLICY "Allow all for data_source_status" ON data_source_status FOR ALL USING (true);
CREATE POLICY "Allow all for meeting_transcripts" ON meeting_transcripts FOR ALL USING (true);
CREATE POLICY "Allow all for airtable_records" ON airtable_records FOR ALL USING (true);
CREATE POLICY "Allow all for sync_audit_log" ON sync_audit_log FOR ALL USING (true);

-- Comments
COMMENT ON TABLE data_source_status IS 'Tracks connection status and sync state of data sources';
COMMENT ON TABLE meeting_transcripts IS 'Stores meeting transcripts from Fireflies.ai';
COMMENT ON TABLE airtable_records IS 'Stores records synced from Airtable bases';
COMMENT ON TABLE sync_audit_log IS 'Audit trail of all sync operations for transparency';
