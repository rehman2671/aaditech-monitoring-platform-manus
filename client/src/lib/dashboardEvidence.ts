import type { CollectorEvidence, Endpoint } from '@/types';

export interface DashboardEvidenceSummary {
  records: CollectorEvidence[];
  hasExplicitEvidence: boolean;
  limitationCount: number;
  latestCapturedAt?: string;
}

export function summarizeDashboardEvidence(endpoints: Pick<Endpoint, 'collectorEvidence'>[]): DashboardEvidenceSummary {
  const records = endpoints.flatMap(endpoint => endpoint.collectorEvidence ?? []);
  const timestamps = records
    .map(record => record.capturedAt)
    .filter((value): value is string => Boolean(value))
    .sort();

  return {
    records,
    hasExplicitEvidence: records.length > 0,
    limitationCount: records.filter(record => record.status !== 'success').length,
    latestCapturedAt: timestamps.at(-1),
  };
}
