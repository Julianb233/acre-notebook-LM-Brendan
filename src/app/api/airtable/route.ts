import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAirtableClient, isAirtableConfigured } from '@/lib/airtable';

/**
 * GET /api/airtable
 * Fetch Airtable records with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'airtable';
    const tableName = searchParams.get('table');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search');

    // Fetch from local (synced) records
    if (source === 'local') {
      let query = supabase
        .from('airtable_records')
        .select('*', { count: 'exact' })
        .eq('source', 'airtable')
        .order('synced_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (tableName) {
        query = query.eq('table_name', tableName);
      }

      if (search) {
        query = query.textSearch('fields', search);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return NextResponse.json({
        records: data || [],
        total: count || 0,
        offset,
        limit,
      });
    }

    // Fetch directly from Airtable API
    if (!isAirtableConfigured()) {
      return NextResponse.json(
        { error: 'Airtable not configured' },
        { status: 500 }
      );
    }

    const client = getAirtableClient();

    // Get schema if no table specified
    if (!tableName) {
      const tables = await client.getBaseSchema();
      return NextResponse.json({
        tables: tables.map(t => ({
          id: t.id,
          name: t.name,
          fields: t.fields.map(f => ({ id: f.id, name: f.name, type: f.type })),
        })),
      });
    }

    // Fetch records from specific table
    const result = await client.listRecords(tableName, {
      pageSize: Math.min(limit, 100),
      offset: searchParams.get('airtable_offset') || undefined,
    });

    return NextResponse.json({
      records: result.records,
      offset: result.offset,
      hasMore: !!result.offset,
    });

  } catch (error) {
    console.error('Airtable API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Airtable data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/airtable
 * Create a record in Airtable
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAirtableConfigured()) {
      return NextResponse.json(
        { error: 'Airtable not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { table, fields } = body;

    if (!table || !fields) {
      return NextResponse.json(
        { error: 'Missing required fields: table, fields' },
        { status: 400 }
      );
    }

    const client = getAirtableClient();
    const record = await client.createRecord(table, fields, { typecast: true });

    return NextResponse.json({
      success: true,
      record,
    });

  } catch (error) {
    console.error('Airtable create error:', error);
    return NextResponse.json(
      { error: 'Failed to create Airtable record' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/airtable
 * Update a record in Airtable
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAirtableConfigured()) {
      return NextResponse.json(
        { error: 'Airtable not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { table, recordId, fields } = body;

    if (!table || !recordId || !fields) {
      return NextResponse.json(
        { error: 'Missing required fields: table, recordId, fields' },
        { status: 400 }
      );
    }

    const client = getAirtableClient();
    const record = await client.updateRecord(table, recordId, fields, { typecast: true });

    // Update local synced record too
    const baseId = process.env.AIRTABLE_BASE_ID!;
    await supabase
      .from('airtable_records')
      .update({
        fields: record.fields,
        synced_at: new Date().toISOString(),
      })
      .eq('external_id', recordId)
      .eq('base_id', baseId);

    return NextResponse.json({
      success: true,
      record,
    });

  } catch (error) {
    console.error('Airtable update error:', error);
    return NextResponse.json(
      { error: 'Failed to update Airtable record' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/airtable
 * Delete a record from Airtable
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAirtableConfigured()) {
      return NextResponse.json(
        { error: 'Airtable not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const recordId = searchParams.get('recordId');

    if (!table || !recordId) {
      return NextResponse.json(
        { error: 'Missing required params: table, recordId' },
        { status: 400 }
      );
    }

    const client = getAirtableClient();
    const result = await client.deleteRecord(table, recordId);

    // Delete from local synced records too
    const baseId = process.env.AIRTABLE_BASE_ID!;
    await supabase
      .from('airtable_records')
      .delete()
      .eq('external_id', recordId)
      .eq('base_id', baseId);

    return NextResponse.json({
      success: true,
      deleted: result.deleted,
    });

  } catch (error) {
    console.error('Airtable delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete Airtable record' },
      { status: 500 }
    );
  }
}
