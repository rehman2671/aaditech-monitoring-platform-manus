import { describe, expect, it } from 'vitest';
import { summarizeDashboardEvidence } from './dashboardEvidence';

describe('summarizeDashboardEvidence', () => {
  it('does not claim evidence when the backend provides none', () => {
    expect(summarizeDashboardEvidence([{ collectorEvidence: undefined }])).toEqual({
      records: [],
      hasExplicitEvidence: false,
      limitationCount: 0,
      latestCapturedAt: undefined,
    });
  });

  it('counts non-success evidence and selects the newest capture timestamp', () => {
    const result = summarizeDashboardEvidence([
      {
        collectorEvidence: [
          { collector: 'performance', status: 'success', capturedAt: '2026-08-25T08:00:00.000Z' },
          { collector: 'drivers', status: 'partial', capturedAt: '2026-08-25T08:05:00.000Z' },
        ],
      },
      {
        collectorEvidence: [
          { collector: 'battery', status: 'unavailable', capturedAt: '2026-08-25T08:03:00.000Z' },
        ],
      },
    ]);

    expect(result.hasExplicitEvidence).toBe(true);
    expect(result.limitationCount).toBe(2);
    expect(result.latestCapturedAt).toBe('2026-08-25T08:05:00.000Z');
    expect(result.records).toHaveLength(3);
  });
});
