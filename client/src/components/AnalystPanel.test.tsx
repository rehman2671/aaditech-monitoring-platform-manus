/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AnalystPanel from './AnalystPanel';
import { fetchLatestEndpointAnalyst, fetchProcessHistory, runEndpointAnalyst } from '@/lib/sentinelApi';

vi.mock('@/lib/sentinelApi', () => ({
  fetchLatestEndpointAnalyst: vi.fn(),
  fetchProcessHistory: vi.fn(),
  runEndpointAnalyst: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => cleanup());

const available = {
  available: true,
  reason: '',
  evidence_hash: 'hash-1',
  evidence_count: 4,
  persisted: true,
  assessment: {
    overall_risk: 'LOW', confidence: 0.8,
    summary: 'No actionable issue is established from the supplied evidence.',
    findings: [{ finding_id: 'f-1', category: 'data_quality', severity: 'INFORMATIONAL', confidence: 0.8, title: 'Limited evidence', description: 'Only the supplied snapshot was reviewed.', evidence_ids: ['metrics.latest'], recommended_action: 'Wait for the next sample.', remediation_available: false }],
    positive_findings: [], data_quality_issues: ['Battery evidence is unavailable.'], recommended_steps: ['Review the next scheduled sample.'],
  },
};

describe('AnalystPanel', () => {
  it('renders validated findings, evidence references, and data-quality limitations', async () => {
    vi.mocked(runEndpointAnalyst).mockResolvedValueOnce(available);
    render(<AnalystPanel endpointId="endpoint-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Analyze evidence' }));
    await waitFor(() => expect(screen.getByText('Limited evidence')).toBeTruthy());
    expect(screen.getByText('Evidence: metrics.latest')).toBeTruthy();
    expect(screen.getByText('Battery evidence is unavailable.')).toBeTruthy();
    expect(screen.getByText('Evidence hash: hash-1')).toBeTruthy();
  });

  it('shows an explicit unavailable state when local Ollama is disabled or unavailable', async () => {
    vi.mocked(fetchLatestEndpointAnalyst).mockRejectedValueOnce(new Error('No cached analyst assessment is available'));
    render(<AnalystPanel endpointId="endpoint-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Load cached' }));
    await waitFor(() => expect(screen.getByText(/No analyst result loaded\./)).toBeTruthy());
  });

  it('renders tenant-scoped process trend buckets without inventing missing metrics', async () => {
    vi.mocked(fetchProcessHistory).mockResolvedValueOnce([{ bucketStart: '2026-08-28T09:00:00Z', processCount: 3, averageCPUPercent: 12.5, maxWorkingSet: null }]);
    render(<AnalystPanel endpointId="endpoint-1" />);
    await waitFor(() => expect(screen.getByText('Process performance trend')).toBeTruthy());
    expect(screen.getByText('12.5%')).toBeTruthy();
    expect(screen.getByText('Unavailable')).toBeTruthy();
  });
});
