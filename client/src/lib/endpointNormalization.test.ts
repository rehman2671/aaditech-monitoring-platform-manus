import { describe, expect, it } from 'vitest';
import { evidenceFallback, normalizeEndpointStatus, normalizeEndpointTimestamp } from './endpointNormalization';

describe('endpoint normalization', () => {
  it('maps known backend lifecycle states and fails closed for unknown values', () => {
    expect(normalizeEndpointStatus('online')).toBe('online');
    expect(normalizeEndpointStatus('warning')).toBe('warning');
    expect(normalizeEndpointStatus('offline')).toBe('offline');
    expect(normalizeEndpointStatus('pending')).toBe('pending');
    expect(normalizeEndpointStatus('disabled')).toBe('disabled');
    expect(normalizeEndpointStatus('enrollment_failed')).toBe('enrollment_failed');
    expect(normalizeEndpointStatus('auth_error')).toBe('auth_error');
    expect(normalizeEndpointStatus('unrecognized')).toBe('offline');
  });

  it('does not invent timestamps when the backend value is missing or invalid', () => {
    expect(normalizeEndpointTimestamp(undefined)).toBe('Unavailable');
    expect(normalizeEndpointTimestamp('not-a-date', 'Missing timestamp')).toBe('Missing timestamp');
    expect(normalizeEndpointTimestamp('2026-08-25T08:00:00.000Z')).toBe('2026-08-25T08:00:00.000Z');
  });

  it('uses explicit unavailable labels for missing identity strings', () => {
    expect(evidenceFallback(undefined)).toBe('Unavailable');
    expect(evidenceFallback('')).toBe('Unavailable');
    expect(evidenceFallback('  ')).toBe('Unavailable');
    expect(evidenceFallback('DESKTOP-1')).toBe('DESKTOP-1');
  });
});
