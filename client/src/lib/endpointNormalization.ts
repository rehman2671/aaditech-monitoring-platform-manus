import type { EndpointStatus } from '@/types';

export type BackendEndpointStatus = EndpointStatus | 'pending' | 'disabled';

/**
 * Backend lifecycle states are normalized only where the dashboard contract
 * intentionally uses a smaller display vocabulary. Unknown values fail closed.
 */
export function normalizeEndpointStatus(status: BackendEndpointStatus | string | null | undefined): EndpointStatus {
  if (status === 'pending') return 'warning';
  if (status === 'disabled') return 'offline';
  if (status === 'online' || status === 'warning' || status === 'offline') return status;
  return 'offline';
}

export function normalizeEndpointTimestamp(value: string | Date | null | undefined, fallback = 'Unavailable'): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function evidenceFallback(value: string | null | undefined, fallback = 'Unavailable'): string {
  return value?.trim() ? value : fallback;
}
