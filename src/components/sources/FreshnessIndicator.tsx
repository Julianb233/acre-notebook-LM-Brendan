'use client';

import { cn } from '@/lib/utils';
import { formatDistanceToNow, differenceInHours, differenceInDays } from 'date-fns';

export type FreshnessLevel = 'fresh' | 'stale' | 'outdated' | 'unknown';

interface FreshnessIndicatorProps {
  lastUpdated: string | Date | null;
  showLabel?: boolean;
  showTime?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function getFreshnessLevel(lastUpdated: Date | null): FreshnessLevel {
  if (!lastUpdated) return 'unknown';

  const now = new Date();
  const hoursDiff = differenceInHours(now, lastUpdated);
  const daysDiff = differenceInDays(now, lastUpdated);

  if (hoursDiff < 24) return 'fresh';
  if (daysDiff < 7) return 'stale';
  return 'outdated';
}

const freshnessConfig: Record<FreshnessLevel, {
  color: string;
  bgColor: string;
  label: string;
  icon: string;
  description: string;
}> = {
  fresh: {
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'Fresh',
    icon: '🟢',
    description: 'Updated within the last 24 hours',
  },
  stale: {
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    label: 'Stale',
    icon: '🟡',
    description: 'Updated 1-7 days ago',
  },
  outdated: {
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Outdated',
    icon: '🔴',
    description: 'Not updated in over 7 days',
  },
  unknown: {
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    label: 'Unknown',
    icon: '⚪',
    description: 'Last update time unknown',
  },
};

const sizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export function FreshnessIndicator({
  lastUpdated,
  showLabel = true,
  showTime = true,
  size = 'md',
}: FreshnessIndicatorProps) {
  const date = lastUpdated ? new Date(lastUpdated) : null;
  const level = getFreshnessLevel(date);
  const config = freshnessConfig[level];

  const timeAgo = date
    ? formatDistanceToNow(date, { addSuffix: true })
    : 'Never';

  return (
    <div className={cn('flex items-center gap-2', sizeClasses[size])}>
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
          config.bgColor,
          config.color
        )}
        title={config.description}
      >
        <span className="text-xs">{config.icon}</span>
        {showLabel && <span className="font-medium">{config.label}</span>}
      </span>
      {showTime && (
        <span className="text-muted-foreground">
          {timeAgo}
        </span>
      )}
    </div>
  );
}

export function FreshnessDot({ lastUpdated }: { lastUpdated: string | Date | null }) {
  const date = lastUpdated ? new Date(lastUpdated) : null;
  const level = getFreshnessLevel(date);
  const config = freshnessConfig[level];

  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full',
        level === 'fresh' && 'bg-green-500',
        level === 'stale' && 'bg-yellow-500',
        level === 'outdated' && 'bg-red-500',
        level === 'unknown' && 'bg-gray-400'
      )}
      title={`${config.label}: ${config.description}`}
    />
  );
}

export { getFreshnessLevel };
