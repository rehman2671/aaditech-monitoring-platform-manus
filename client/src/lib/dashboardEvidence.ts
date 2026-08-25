import type { CollectorEvidence, Endpoint } from '@/types';

export interface DashboardEvidenceSummary {
  records: CollectorEvidence[];
  hasExplicitEvidence: boolean;
  limitationCount: number;
  latestCapturedAt?: string;
  latestSuccessfulCapturedAt?: string;
  latestByCollector: Record<string, string | undefined>;
}

export function summarizeDashboardEvidence(endpoints: Pick<Endpoint, 'collectorEvidence'>[]): DashboardEvidenceSummary {
  const records = endpoints.flatMap(endpoint => endpoint.collectorEvidence ?? []);
  const timestamps = records
    .map(record => record.capturedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const successfulTimestamps = records
    .filter(record => record.status === 'success')
    .map(record => record.capturedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const latestByCollector: Record<string, string | undefined> = {};
  const diagnosticCollectors = new Set(['diagnostics', 'drivers', 'dism', 'sfc', 'reliability', 'software', 'processes', 'event_logs', 'network']);
  for (const record of records) {
    if (!record.capturedAt || !latestByCollector[record.collector] || record.capturedAt > latestByCollector[record.collector]!) {
      latestByCollector[record.collector] = record.capturedAt;
    }
    if (record.capturedAt && record.status === 'success' && diagnosticCollectors.has(record.collector) && (!latestByCollector.diagnostics || record.capturedAt > latestByCollector.diagnostics)) {
      latestByCollector.diagnostics = record.capturedAt;
    }
  }

  return {
    records,
    hasExplicitEvidence: records.length > 0,
    limitationCount: records.filter(record => record.status !== 'success').length,
    latestCapturedAt: timestamps.at(-1),
    latestSuccessfulCapturedAt: successfulTimestamps.at(-1),
    latestByCollector,
  };
}
