'use client';

import { cn } from '@/lib/utils';

export type SyncStatus = 'connected' | 'syncing' | 'error' | 'disconnected' | 'pending';

interface SyncStatusBadgeProps {
  status: SyncStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<SyncStatus, {
  color: string;
  bgColor: string;
  label: string;
  icon: string;
  pulse?: boolean;
}> = {
  connected: {
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'Connected',
    icon: '🟢',
  },
  syncing: {
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    label: 'Syncing...',
    icon: '🟡',
    pulse: true,
  },
  error: {
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Error',
    icon: '🔴',
  },
  disconnected: {
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    label: 'Disconnected',
    icon: '⚫',
  },
  pending: {
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Pending Setup',
    icon: '🔵',
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function SyncStatusBadge({
  status,
  showLabel = true,
  size = 'md'
}: SyncStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.bgColor,
        config.color,
        sizeClasses[size],
        config.pulse && 'animate-pulse'
      )}
    >
      <span className="text-xs">{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export function SyncStatusDot({ status }: { status: SyncStatus }) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full',
        status === 'connected' && 'bg-green-500',
        status === 'syncing' && 'bg-yellow-500 animate-pulse',
        status === 'error' && 'bg-red-500',
        status === 'disconnected' && 'bg-gray-400',
        status === 'pending' && 'bg-blue-500'
      )}
      title={config.label}
    />
  );
}
