import type { EndpointStatus } from '@/types';

export type BackendEndpointStatus = EndpointStatus | 'pending' | 'disabled' | 'enrollment_failed' | 'auth_error';

/**
 * Backend lifecycle states are normalized only where the dashboard contract
 * intentionally uses a smaller display vocabulary. Unknown values fail closed.
 */
export function normalizeEndpointStatus(status: BackendEndpointStatus | string | null | undefined): EndpointStatus {
  if (status === 'pending') return 'pending';
  if (status === 'disabled') return 'disabled';
  if (status === 'enrollment_failed') return 'enrollment_failed';
  if (status === 'auth_error') return 'auth_error';
  if (status === 'online' || status === 'warning' || status === 'offline' || status === 'critical') return status;
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
