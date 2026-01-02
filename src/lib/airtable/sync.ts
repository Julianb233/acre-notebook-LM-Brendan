/**
 * Airtable Sync Module
 * Handles bidirectional sync between Airtable and Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { getAirtableClient, type AirtableRecord, type AirtableTable } from './client';
import { generateEmbedding } from '@/lib/ai/embeddings';

// Types
export interface SyncResult {
  success: boolean;
  tables: {
    name: string;
    synced: number;
    status: 'success' | 'error';
    error?: string;
  }[];
  totalRecords: number;
  errors: string[];
}

export interface SyncedRecord {
  id: string;
  external_id: string;
  source: 'airtable';
  base_id: string;
  table_id: string;
  table_name: string;
  fields: Record<string, unknown>;
  created_at_source: string;
  synced_at: string;
  embedding?: number[];
}

/**
 * Get Supabase admin client for sync operations
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase not configured');
  }

  return createClient(url, key);
}

/**
 * Convert Airtable record to text for embedding
 */
function recordToText(record: AirtableRecord, tableName: string): string {
  const parts = [`Table: ${tableName}`];

  for (const [key, value] of Object.entries(record.fields)) {
    if (value !== null && value !== undefined) {
      if (typeof value === 'string') {
        parts.push(`${key}: ${value}`);
      } else if (Array.isArray(value)) {
        parts.push(`${key}: ${value.join(', ')}`);
      } else if (typeof value === 'object') {
        parts.push(`${key}: ${JSON.stringify(value)}`);
      } else {
        parts.push(`${key}: ${String(value)}`);
      }
    }
  }

  return parts.join('\n');
}

/**
 * Sync a single table from Airtable to Supabase
 */
export async function syncTable(
  table: AirtableTable,
  options: {
    embedRecords?: boolean;
    partnerId?: string;
  } = {}
): Promise<{ synced: number; errors: string[] }> {
  const client = getAirtableClient();
  const supabase = getSupabaseAdmin();
  const baseId = process.env.AIRTABLE_BASE_ID!;

  const result = { synced: 0, errors: [] as string[] };

  try {
    // Fetch all records from Airtable
    const records = await client.getAllRecords(table.id);

    for (const record of records) {
      try {
        // Generate embedding if requested
        let embedding: number[] | undefined;
        if (options.embedRecords) {
          const text = recordToText(record, table.name);
          embedding = await generateEmbedding(text);
        }

        const recordData: SyncedRecord = {
          id: `${baseId}_${table.id}_${record.id}`,
          external_id: record.id,
          source: 'airtable',
          base_id: baseId,
          table_id: table.id,
          table_name: table.name,
          fields: record.fields,
          created_at_source: record.createdTime,
          synced_at: new Date().toISOString(),
          ...(embedding && { embedding }),
        };

        // Upsert to Supabase
        const { error } = await supabase
          .from('airtable_records')
          .upsert(recordData, {
            onConflict: 'external_id,base_id,table_id',
          });

        if (error) throw error;
        result.synced++;
      } catch (error) {
        result.errors.push(
          `Failed to sync record ${record.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  } catch (error) {
    result.errors.push(
      `Failed to fetch table ${table.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return result;
}

/**
 * Sync all tables from Airtable to Supabase
 */
export async function syncAllTables(
  options: {
    tables?: string[];
    embedRecords?: boolean;
    partnerId?: string;
  } = {}
): Promise<SyncResult> {
  const client = getAirtableClient();
  const supabase = getSupabaseAdmin();
  const baseId = process.env.AIRTABLE_BASE_ID!;

  const result: SyncResult = {
    success: true,
    tables: [],
    totalRecords: 0,
    errors: [],
  };

  try {
    // Get base schema
    const allTables = await client.getBaseSchema();

    // Filter tables if specified
    const tablesToSync = options.tables
      ? allTables.filter(t => options.tables!.includes(t.name) || options.tables!.includes(t.id))
      : allTables;

    // Sync each table
    for (const table of tablesToSync) {
      const tableResult = await syncTable(table, {
        embedRecords: options.embedRecords,
        partnerId: options.partnerId,
      });

      result.tables.push({
        name: table.name,
        synced: tableResult.synced,
        status: tableResult.errors.length === 0 ? 'success' : 'error',
        error: tableResult.errors[0],
      });

      result.totalRecords += tableResult.synced;
      result.errors.push(...tableResult.errors);
    }

    result.success = result.tables.some(t => t.status === 'success');

    // Update sync status
    await supabase
      .from('data_source_status')
      .upsert({
        source: 'airtable',
        last_sync: new Date().toISOString(),
        status: result.success ? 'connected' : 'error',
        item_count: result.totalRecords,
        last_error: result.errors.length > 0 ? result.errors[0] : null,
        metadata: {
          base_id: baseId,
          tables_synced: result.tables.length,
        },
      }, { onConflict: 'source' });

  } catch (error) {
    result.success = false;
    result.errors.push(
      `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return result;
}

/**
 * Push a record from local to Airtable (bidirectional sync)
 */
export async function pushToAirtable(
  tableName: string,
  recordId: string | null,
  fields: Record<string, unknown>
): Promise<{ success: boolean; record?: AirtableRecord; error?: string }> {
  try {
    const client = getAirtableClient();

    if (recordId) {
      // Update existing record
      const record = await client.updateRecord(tableName, recordId, fields, { typecast: true });
      return { success: true, record };
    } else {
      // Create new record
      const record = await client.createRecord(tableName, fields, { typecast: true });
      return { success: true, record };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Re-embed all Airtable records for a specific table
 */
export async function reembedTable(tableName: string): Promise<{ updated: number; errors: string[] }> {
  const supabase = getSupabaseAdmin();
  const result = { updated: 0, errors: [] as string[] };

  try {
    // Fetch all records for this table
    const { data: records, error } = await supabase
      .from('airtable_records')
      .select('*')
      .eq('table_name', tableName)
      .eq('source', 'airtable');

    if (error) throw error;

    for (const record of records || []) {
      try {
        const text = recordToText(
          { id: record.external_id, createdTime: record.created_at_source, fields: record.fields },
          record.table_name
        );

        const embedding = await generateEmbedding(text);

        const { error: updateError } = await supabase
          .from('airtable_records')
          .update({ embedding, synced_at: new Date().toISOString() })
          .eq('id', record.id);

        if (updateError) throw updateError;
        result.updated++;
      } catch (error) {
        result.errors.push(
          `Failed to re-embed record ${record.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  } catch (error) {
    result.errors.push(
      `Re-embed failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return result;
}

/**
 * Get sync status for Airtable
 */
export async function getSyncStatus(): Promise<{
  configured: boolean;
  status: {
    source: string;
    last_sync: string | null;
    status: string;
    item_count: number;
    last_error: string | null;
  } | null;
  tables: { name: string; count: number }[];
}> {
  const supabase = getSupabaseAdmin();
  const configured = !!(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);

  // Get sync status
  const { data: status } = await supabase
    .from('data_source_status')
    .select('*')
    .eq('source', 'airtable')
    .single();

  // Get table breakdown
  const { data: records } = await supabase
    .from('airtable_records')
    .select('table_name')
    .eq('source', 'airtable');

  const tableCounts: Record<string, number> = {};
  records?.forEach(record => {
    const tableName = record.table_name;
    tableCounts[tableName] = (tableCounts[tableName] || 0) + 1;
  });

  const tables = Object.entries(tableCounts).map(([name, count]) => ({ name, count }));

  return {
    configured,
    status: status || null,
    tables,
  };
}

/**
 * Delete synced records for a table
 */
export async function deleteSyncedRecords(tableName: string): Promise<{ deleted: number; error?: string }> {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('airtable_records')
      .delete()
      .eq('table_name', tableName)
      .eq('source', 'airtable')
      .select('id');

    if (error) throw error;

    return { deleted: data?.length || 0 };
  } catch (error) {
    return {
      deleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
