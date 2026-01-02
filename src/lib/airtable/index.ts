/**
 * Airtable Module
 * Exports all Airtable-related functionality
 */

export {
  AirtableClient,
  getAirtableClient,
  isAirtableConfigured,
  type AirtableField,
  type AirtableTable,
  type AirtableRecord,
  type AirtableListResponse,
  type AirtableError,
} from './client';

export {
  syncTable,
  syncAllTables,
  pushToAirtable,
  reembedTable,
  getSyncStatus,
  deleteSyncedRecords,
  type SyncResult,
  type SyncedRecord,
} from './sync';
