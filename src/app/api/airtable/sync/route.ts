import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Airtable API configuration
const AIRTABLE_API_URL = 'https://api.airtable.com/v0';

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

interface AirtableTable {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: {
    id: string;
    name: string;
    type: string;
  }[];
}

interface SyncResult {
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

// Fetch base schema to get all tables
async function fetchBaseSchema(apiKey: string, baseId: string): Promise<AirtableTable[]> {
  const response = await fetch(`${AIRTABLE_API_URL}/meta/bases/${baseId}/tables`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.tables || [];
}

// Fetch all records from a table with pagination
async function fetchTableRecords(
  apiKey: string,
  baseId: string,
  tableId: string,
  offset?: string
): Promise<{ records: AirtableRecord[]; offset?: string }> {
  const url = new URL(`${AIRTABLE_API_URL}/${baseId}/${tableId}`);
  if (offset) {
    url.searchParams.set('offset', offset);
  }
  url.searchParams.set('pageSize', '100');

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    records: data.records || [],
    offset: data.offset,
  };
}

// Fetch all records from a table (handles pagination)
async function fetchAllTableRecords(
  apiKey: string,
  baseId: string,
  tableId: string
): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const result = await fetchTableRecords(apiKey, baseId, tableId, offset);
    allRecords.push(...result.records);
    offset = result.offset;
  } while (offset);

  return allRecords;
}

async function syncTableToSupabase(
  supabase: ReturnType<typeof createClient>,
  table: AirtableTable,
  records: AirtableRecord[],
  baseId: string
): Promise<{ synced: number; errors: string[] }> {
  const result = { synced: 0, errors: [] as string[] };

  for (const record of records) {
    try {
      const recordData = {
        external_id: record.id,
        source: 'airtable',
        base_id: baseId,
        table_id: table.id,
        table_name: table.name,
        fields: record.fields,
        created_at_source: record.createdTime,
        synced_at: new Date().toISOString(),
      };

      // Upsert record
      const { error } = await supabase
        .from('airtable_records')
        .upsert(recordData, {
          onConflict: 'external_id,base_id,table_id'
        });

      if (error) throw error;
      result.synced++;
    } catch (error) {
      result.errors.push(`Failed to sync record ${record.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return result;
}

// POST - Trigger sync
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!apiKey || !baseId) {
      return NextResponse.json(
        { error: 'Airtable API key or Base ID not configured' },
        { status: 500 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for optional table filter
    const body = await request.json().catch(() => ({}));
    const tableFilter = body.tables as string[] | undefined;

    // Fetch base schema
    const tables = await fetchBaseSchema(apiKey, baseId);

    // Filter tables if specified
    const tablesToSync = tableFilter
      ? tables.filter(t => tableFilter.includes(t.name) || tableFilter.includes(t.id))
      : tables;

    const result: SyncResult = {
      success: true,
      tables: [],
      totalRecords: 0,
      errors: [],
    };

    // Sync each table
    for (const table of tablesToSync) {
      try {
        const records = await fetchAllTableRecords(apiKey, baseId, table.id);
        const syncResult = await syncTableToSupabase(supabase, table, records, baseId);

        result.tables.push({
          name: table.name,
          synced: syncResult.synced,
          status: syncResult.errors.length === 0 ? 'success' : 'error',
          error: syncResult.errors.length > 0 ? syncResult.errors[0] : undefined,
        });

        result.totalRecords += syncResult.synced;
        result.errors.push(...syncResult.errors);
      } catch (error) {
        result.tables.push({
          name: table.name,
          synced: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.errors.push(`Failed to sync table ${table.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Check overall success
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

    return NextResponse.json({
      success: result.success,
      message: `Synced ${result.totalRecords} records from ${result.tables.length} Airtable tables`,
      details: result,
    });
  } catch (error) {
    console.error('Airtable sync error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync Airtable data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET - Get sync status
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get sync status
    const { data: status } = await supabase
      .from('data_source_status')
      .select('*')
      .eq('source', 'airtable')
      .single();

    // Get table statistics
    const { data: tableStats } = await supabase
      .from('airtable_records')
      .select('table_name')
      .eq('source', 'airtable');

    // Count records per table
    const tableCounts: Record<string, number> = {};
    tableStats?.forEach(record => {
      const tableName = record.table_name as string;
      tableCounts[tableName] = (tableCounts[tableName] || 0) + 1;
    });

    const totalRecords = Object.values(tableCounts).reduce((sum, count) => sum + count, 0);

    return NextResponse.json({
      configured: !!(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID),
      status: status || { source: 'airtable', status: 'not_synced' },
      totalRecords,
      tableBreakdown: tableCounts,
    });
  } catch (error) {
    console.error('Airtable status error:', error);
    return NextResponse.json(
      { error: 'Failed to get Airtable status' },
      { status: 500 }
    );
  }
}
