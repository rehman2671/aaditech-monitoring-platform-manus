import type { EndpointStatus } from '../types';

export const endpointLifecyclePresentation = (status: EndpointStatus) => {
  if (status === 'online') return { label: 'ONLINE', tone: 'online' as const };
  if (status === 'pending') return { label: 'PENDING EVIDENCE', tone: 'pending' as const };
  if (status === 'enrollment_failed') return { label: 'ENROLLMENT FAILED', tone: 'error' as const };
  if (status === 'auth_error') return { label: 'AUTH ERROR', tone: 'error' as const };
  if (status === 'disabled') return { label: 'DISABLED', tone: 'disabled' as const };
  if (status === 'warning') return { label: 'WARNING', tone: 'warning' as const };
  if (status === 'critical') return { label: 'CRITICAL', tone: 'error' as const };
  return { label: 'OFFLINE', tone: 'offline' as const };
};
