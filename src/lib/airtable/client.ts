/**
 * Airtable API Client
 * Handles all interactions with the Airtable REST API
 */

const AIRTABLE_API_URL = 'https://api.airtable.com/v0';

// Types
export interface AirtableField {
  id: string;
  name: string;
  type: string;
  options?: Record<string, unknown>;
}

export interface AirtableTable {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: AirtableField[];
}

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

export interface AirtableError {
  error: {
    type: string;
    message: string;
  };
}

export class AirtableClient {
  private apiKey: string;
  private baseId: string;

  constructor(apiKey: string, baseId: string) {
    this.apiKey = apiKey;
    this.baseId = baseId;
  }

  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Fetch base schema to get all tables and their fields
   */
  async getBaseSchema(): Promise<AirtableTable[]> {
    const response = await fetch(
      `${AIRTABLE_API_URL}/meta/bases/${this.baseId}/tables`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      const error = await response.json() as AirtableError;
      throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.tables || [];
  }

  /**
   * Fetch records from a table with pagination
   */
  async listRecords(
    tableIdOrName: string,
    options: {
      pageSize?: number;
      offset?: string;
      fields?: string[];
      filterByFormula?: string;
      sort?: { field: string; direction: 'asc' | 'desc' }[];
      view?: string;
    } = {}
  ): Promise<AirtableListResponse> {
    const url = new URL(`${AIRTABLE_API_URL}/${this.baseId}/${encodeURIComponent(tableIdOrName)}`);

    if (options.pageSize) url.searchParams.set('pageSize', String(options.pageSize));
    if (options.offset) url.searchParams.set('offset', options.offset);
    if (options.filterByFormula) url.searchParams.set('filterByFormula', options.filterByFormula);
    if (options.view) url.searchParams.set('view', options.view);

    if (options.fields) {
      options.fields.forEach(field => url.searchParams.append('fields[]', field));
    }

    if (options.sort) {
      options.sort.forEach((s, i) => {
        url.searchParams.set(`sort[${i}][field]`, s.field);
        url.searchParams.set(`sort[${i}][direction]`, s.direction);
      });
    }

    const response = await fetch(url.toString(), { headers: this.getHeaders() });

    if (!response.ok) {
      const error = await response.json() as AirtableError;
      throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch all records from a table (handles pagination automatically)
   */
  async getAllRecords(
    tableIdOrName: string,
    options: {
      fields?: string[];
      filterByFormula?: string;
      sort?: { field: string; direction: 'asc' | 'desc' }[];
      view?: string;
    } = {}
  ): Promise<AirtableRecord[]> {
    const allRecords: AirtableRecord[] = [];
    let offset: string | undefined;

    do {
      const result = await this.listRecords(tableIdOrName, {
        ...options,
        pageSize: 100,
        offset,
      });
      allRecords.push(...result.records);
      offset = result.offset;
    } while (offset);

    return allRecords;
  }

  /**
   * Get a single record by ID
   */
  async getRecord(tableIdOrName: string, recordId: string): Promise<AirtableRecord> {
    const response = await fetch(
      `${AIRTABLE_API_URL}/${this.baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      const error = await response.json() as AirtableError;
      throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new record
   */
  async createRecord(
    tableIdOrName: string,
    fields: Record<string, unknown>,
    options: { typecast?: boolean } = {}
  ): Promise<AirtableRecord> {
    const response = await fetch(
      `${AIRTABLE_API_URL}/${this.baseId}/${encodeURIComponent(tableIdOrName)}`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          fields,
          typecast: options.typecast,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json() as AirtableError;
      throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create multiple records (max 10 per request)
   */
  async createRecords(
    tableIdOrName: string,
    records: { fields: Record<string, unknown> }[],
    options: { typecast?: boolean } = {}
  ): Promise<AirtableRecord[]> {
    if (records.length > 10) {
      throw new Error('Cannot create more than 10 records at once');
    }

    const response = await fetch(
      `${AIRTABLE_API_URL}/${this.baseId}/${encodeURIComponent(tableIdOrName)}`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          records,
          typecast: options.typecast,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json() as AirtableError;
      throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.records;
  }

  /**
   * Update a record (PATCH - partial update)
   */
  async updateRecord(
    tableIdOrName: string,
    recordId: string,
    fields: Record<string, unknown>,
    options: { typecast?: boolean } = {}
  ): Promise<AirtableRecord> {
    const response = await fetch(
      `${AIRTABLE_API_URL}/${this.baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
      {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({
          fields,
          typecast: options.typecast,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json() as AirtableError;
      throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update multiple records (max 10 per request)
   */
  async updateRecords(
    tableIdOrName: string,
    records: { id: string; fields: Record<string, unknown> }[],
    options: { typecast?: boolean } = {}
  ): Promise<AirtableRecord[]> {
    if (records.length > 10) {
      throw new Error('Cannot update more than 10 records at once');
    }

    const response = await fetch(
      `${AIRTABLE_API_URL}/${this.baseId}/${encodeURIComponent(tableIdOrName)}`,
      {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({
          records,
          typecast: options.typecast,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json() as AirtableError;
      throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.records;
  }

  /**
   * Replace a record (PUT - full update)
   */
  async replaceRecord(
    tableIdOrName: string,
    recordId: string,
    fields: Record<string, unknown>,
    options: { typecast?: boolean } = {}
  ): Promise<AirtableRecord> {
    const response = await fetch(
      `${AIRTABLE_API_URL}/${this.baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
      {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({
          fields,
          typecast: options.typecast,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json() as AirtableError;
      throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete a record
   */
  async deleteRecord(tableIdOrName: string, recordId: string): Promise<{ id: string; deleted: boolean }> {
    const response = await fetch(
      `${AIRTABLE_API_URL}/${this.baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json() as AirtableError;
      throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete multiple records (max 10 per request)
   */
  async deleteRecords(tableIdOrName: string, recordIds: string[]): Promise<{ id: string; deleted: boolean }[]> {
    if (recordIds.length > 10) {
      throw new Error('Cannot delete more than 10 records at once');
    }

    const url = new URL(`${AIRTABLE_API_URL}/${this.baseId}/${encodeURIComponent(tableIdOrName)}`);
    recordIds.forEach(id => url.searchParams.append('records[]', id));

    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json() as AirtableError;
      throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.records;
  }
}

// Singleton instance
let airtableClient: AirtableClient | null = null;

/**
 * Get or create an Airtable client instance
 */
export function getAirtableClient(): AirtableClient {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error('AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set');
  }

  if (!airtableClient) {
    airtableClient = new AirtableClient(apiKey, baseId);
  }

  return airtableClient;
}

/**
 * Check if Airtable is configured
 */
export function isAirtableConfigured(): boolean {
  return !!(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);
}
