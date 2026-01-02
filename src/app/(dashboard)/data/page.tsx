'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Search,
  Database,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Edit2,
  Trash2,
  Plus,
  Table as TableIcon,
  Clock
} from 'lucide-react';

interface AirtableTable {
  id: string;
  name: string;
  fields: { id: string; name: string; type: string }[];
}

interface AirtableRecord {
  id: string;
  external_id: string;
  table_name: string;
  fields: Record<string, unknown>;
  synced_at: string;
}

interface SyncStatus {
  configured: boolean;
  status: {
    source: string;
    last_sync: string | null;
    status: string;
    item_count: number;
    last_error: string | null;
  } | null;
  tables: { name: string; count: number }[];
}

export default function DataPage() {
  const [tables, setTables] = useState<AirtableTable[]>([]);
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editRecord, setEditRecord] = useState<AirtableRecord | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});

  // Fetch sync status and tables
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [statusRes, tablesRes] = await Promise.all([
          fetch('/api/airtable/sync'),
          fetch('/api/airtable?source=airtable'),
        ]);

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setSyncStatus({
            configured: statusData.configured,
            status: statusData.status,
            tables: Object.entries(statusData.tableBreakdown || {}).map(([name, count]) => ({
              name,
              count: count as number,
            })),
          });
        }

        if (tablesRes.ok) {
          const tablesData = await tablesRes.json();
          setTables(tablesData.tables || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Fetch records when table changes
  useEffect(() => {
    async function fetchRecords() {
      if (!selectedTable) {
        setRecords([]);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(
          `/api/airtable?source=local&table=${encodeURIComponent(selectedTable)}`
        );

        if (!response.ok) throw new Error('Failed to fetch records');

        const data = await response.json();
        setRecords(data.records || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load records');
      } finally {
        setLoading(false);
      }
    }

    fetchRecords();
  }, [selectedTable]);

  // Sync all tables
  async function handleSync() {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch('/api/airtable/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: selectedTable ? [selectedTable] : undefined }),
      });

      if (!response.ok) throw new Error('Sync failed');

      const result = await response.json();

      if (result.success) {
        // Refresh status
        const statusRes = await fetch('/api/airtable/sync');
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setSyncStatus({
            configured: statusData.configured,
            status: statusData.status,
            tables: Object.entries(statusData.tableBreakdown || {}).map(([name, count]) => ({
              name,
              count: count as number,
            })),
          });
        }

        // Refresh records if table selected
        if (selectedTable) {
          const recordsRes = await fetch(
            `/api/airtable?source=local&table=${encodeURIComponent(selectedTable)}`
          );
          if (recordsRes.ok) {
            const data = await recordsRes.json();
            setRecords(data.records || []);
          }
        }
      } else if (result.errors?.length > 0) {
        setError(result.errors.join(', '));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  // Update record
  async function handleUpdateRecord() {
    if (!editRecord) return;

    try {
      const response = await fetch('/api/airtable', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: editRecord.table_name,
          recordId: editRecord.external_id,
          fields: editFields,
        }),
      });

      if (!response.ok) throw new Error('Update failed');

      // Refresh records
      const recordsRes = await fetch(
        `/api/airtable?source=local&table=${encodeURIComponent(selectedTable)}`
      );
      if (recordsRes.ok) {
        const data = await recordsRes.json();
        setRecords(data.records || []);
      }

      setEditRecord(null);
      setEditFields({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  // Delete record
  async function handleDeleteRecord(record: AirtableRecord) {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
      const response = await fetch(
        `/api/airtable?table=${encodeURIComponent(record.table_name)}&recordId=${record.external_id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Delete failed');

      // Remove from local state
      setRecords(records.filter(r => r.id !== record.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  // Format date
  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Get freshness indicator
  function getFreshness(syncedAt: string) {
    const hours = (Date.now() - new Date(syncedAt).getTime()) / (1000 * 60 * 60);
    if (hours < 24) return { label: 'Fresh', color: 'bg-green-500' };
    if (hours < 168) return { label: 'Stale', color: 'bg-yellow-500' };
    return { label: 'Outdated', color: 'bg-red-500' };
  }

  // Filter records by search
  const filteredRecords = records.filter(record => {
    if (!searchQuery) return true;
    const fieldsStr = JSON.stringify(record.fields).toLowerCase();
    return fieldsStr.includes(searchQuery.toLowerCase());
  });

  // Get display columns from first record
  const displayColumns = records.length > 0
    ? Object.keys(records[0].fields).slice(0, 5)
    : [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Airtable Data</h1>
          <p className="text-muted-foreground">
            Browse and manage synced Airtable records
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing || !syncStatus?.configured}>
          {syncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Data
            </>
          )}
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Records</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                syncStatus?.status?.item_count || 0
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tables Synced</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                syncStatus?.tables.length || 0
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Sync</CardDescription>
            <CardTitle className="text-lg">
              {loading ? (
                <Skeleton className="h-6 w-24" />
              ) : syncStatus?.status?.last_sync ? (
                formatDate(syncStatus.status.last_sync)
              ) : (
                'Never'
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Connection</CardDescription>
            <CardTitle className="flex items-center gap-2">
              {loading ? (
                <Skeleton className="h-6 w-24" />
              ) : syncStatus?.configured ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Connected
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  Not Configured
                </>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Table Selector and Search */}
      <div className="flex gap-4">
        <Select value={selectedTable} onValueChange={setSelectedTable}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select a table" />
          </SelectTrigger>
          <SelectContent>
            {tables.map(table => (
              <SelectItem key={table.id} value={table.name}>
                <div className="flex items-center gap-2">
                  <TableIcon className="h-4 w-4" />
                  {table.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {syncStatus?.configured && (
          <Button variant="outline" asChild>
            <a
              href={`https://airtable.com/${process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || ''}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Airtable
            </a>
          </Button>
        )}
      </div>

      {/* Records Table */}
      {!selectedTable ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a Table</h3>
            <p className="text-muted-foreground">
              Choose a table from the dropdown to view and manage records.
            </p>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredRecords.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <TableIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Records Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? 'No records match your search.'
                : 'This table has no synced records yet.'}
            </p>
            {!searchQuery && (
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedTable}</CardTitle>
                <CardDescription>
                  {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {displayColumns.map(col => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                    <TableHead>Synced</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map(record => {
                    const freshness = getFreshness(record.synced_at);
                    return (
                      <TableRow key={record.id}>
                        {displayColumns.map(col => (
                          <TableCell key={col} className="max-w-[200px] truncate">
                            {formatFieldValue(record.fields[col])}
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${freshness.color}`} />
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(record.synced_at)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditRecord(record);
                                setEditFields(
                                  Object.fromEntries(
                                    Object.entries(record.fields).map(([k, v]) => [k, String(v || '')])
                                  )
                                );
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteRecord(record)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table Stats */}
      {syncStatus && syncStatus.tables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tables Overview</CardTitle>
            <CardDescription>Record counts by table</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {syncStatus.tables.map(table => (
                <div
                  key={table.name}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedTable === table.name
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedTable(table.name)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <TableIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{table.name}</span>
                  </div>
                  <p className="text-2xl font-bold">{table.count}</p>
                  <p className="text-sm text-muted-foreground">records</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editRecord} onOpenChange={() => setEditRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Record</DialogTitle>
            <DialogDescription>
              Update fields in this Airtable record. Changes will sync back to Airtable.
            </DialogDescription>
          </DialogHeader>

          {editRecord && (
            <div className="space-y-4 py-4">
              {Object.keys(editRecord.fields).map(field => (
                <div key={field} className="grid grid-cols-4 gap-4 items-center">
                  <label className="text-right font-medium">{field}</label>
                  <Input
                    className="col-span-3"
                    value={editFields[field] || ''}
                    onChange={(e) =>
                      setEditFields({ ...editFields, [field]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRecord}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper function to format field values for display
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
