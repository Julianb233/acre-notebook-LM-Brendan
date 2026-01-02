import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  });
}

/**
 * Format a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return formatDate(d);
}

/**
 * Get data freshness status based on last sync time
 * - Fresh: synced within 24h
 * - Stale: 1-7 days old
 * - Outdated: 7+ days old
 */
export function getDataFreshness(lastSync: Date | string | null): {
  status: 'fresh' | 'stale' | 'outdated' | 'never';
  label: string;
  color: string;
  emoji: string;
} {
  if (!lastSync) {
    return { status: 'never', label: 'Never synced', color: 'text-gray-400', emoji: '⚪' };
  }

  const d = typeof lastSync === 'string' ? new Date(lastSync) : lastSync;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / 86400000;

  if (diffDays < 1) {
    return { status: 'fresh', label: 'Fresh', color: 'text-green-600', emoji: '🟢' };
  }
  if (diffDays < 7) {
    return { status: 'stale', label: 'Stale', color: 'text-yellow-600', emoji: '🟡' };
  }
  return { status: 'outdated', label: 'Outdated', color: 'text-red-600', emoji: '🔴' };
}

/**
 * Get confidence level styling
 */
export function getConfidenceLevel(score: number): {
  level: 'high' | 'medium' | 'low';
  label: string;
  color: string;
  bgColor: string;
} {
  if (score >= 0.8) {
    return { level: 'high', label: 'High confidence', color: 'text-green-700', bgColor: 'bg-green-50' };
  }
  if (score >= 0.5) {
    return { level: 'medium', label: 'Medium confidence', color: 'text-yellow-700', bgColor: 'bg-yellow-50' };
  }
  return { level: 'low', label: 'Low confidence', color: 'text-red-700', bgColor: 'bg-red-50' };
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Get source type icon name
 */
export function getSourceTypeIcon(type: 'document' | 'meeting' | 'airtable'): string {
  switch (type) {
    case 'document': return 'FileText';
    case 'meeting': return 'Video';
    case 'airtable': return 'Database';
    default: return 'File';
  }
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
