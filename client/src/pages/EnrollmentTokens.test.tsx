import { describe, expect, it } from 'vitest';
import { getMSIBuildStatusLabel } from './EnrollmentTokens';
import type { MSIBuildJob } from '../types';

const job = (overrides: Partial<MSIBuildJob>): MSIBuildJob => ({
  id: 'job-1',
  organizationId: 'org-1',
  agentVersion: '2.4.36',
  signMode: 'self_signed_test',
  automaticEnrollment: true,
  status: 'pending',
  isSigned: false,
  certificateTrusted: false,
  sizeBytes: 0,
  createdAt: '2026-08-28T00:00:00.000Z',
  ...overrides,
});

describe('MSI release status labels', () => {
  it.each([
    ['pending', false, false, 'queued'],
    ['running', false, false, 'building'],
    ['succeeded', false, false, 'unsigned-test'],
    ['succeeded', true, false, 'unsigned-test'],
    ['succeeded', true, true, 'trusted-signed'],
    ['failed', false, false, 'failed'],
  ] as const)('maps %s/%s/%s to %s', (status, isSigned, certificateTrusted, expected) => {
    expect(getMSIBuildStatusLabel(job({ status, isSigned, certificateTrusted }))).toBe(expected);
  });
});
