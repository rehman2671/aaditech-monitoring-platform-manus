import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { generateCsvReport, generatePdfReport } from './generateReports';
import { calculateHealthScore } from './healthScore';

describe('reports and health score', () => {
  it('generates downloadable CSV and PDF artifacts', () => {
    const endpoints = [{ id: 'ep-1', hostname: 'WS-01', status: 'online', osVersion: 'Windows 11', ipAddress: '10.0.0.1', lastSeenAt: '2026-08-12T00:00:00Z' }];
    const alerts = [{ id: 'alert-1', endpointId: 'ep-1', hostname: 'WS-01', acknowledged: false, severity: 'critical', ruleName: 'CPU high', message: 'CPU exceeded 90%', triggeredAt: '2026-08-12T00:00:00Z' }];
    const telemetry = [{ endpointId: 'ep-1', battery: { chargePercent: 82, healthPercent: 96, chargingStatus: 'charging' }, network: { ssid: 'CorpWiFi', latencyMs: 12, vpnActive: true }, applications: [{ appName: 'Chrome', activeSeconds: 600, launchCount: 3 }] }];
    const csvPath = generateCsvReport(endpoints, alerts, telemetry);
    const pdfPath = generatePdfReport(endpoints, alerts, telemetry);
    const csv = fs.readFileSync(csvPath, 'utf8');
    const pdf = fs.readFileSync(pdfPath).toString('latin1');
    expect(csv).toContain('WS-01');
    expect(csv).toContain('CorpWiFi');
    expect(csv).toContain('CPU exceeded 90%');
    expect(pdf.substring(0, 8)).toBe('%PDF-1.4');
    expect(pdf).toContain('CPU exceeded 90%');
    fs.rmSync(csvPath, { force: true });
    fs.rmSync(pdfPath, { force: true });
  });

  it('returns bounded explainable health components', () => {
    const result = calculateHealthScore({ cpuUtilizationPercent: 95, memoryUtilizationPercent: 90, diskFreePercent: 5, batteryHealthPercent: 60, networkLatencyMs: 200, securityScore: 80 });
    expect(result.formulaVersion).toBe('health-v1');
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    expect(result.components.disk).toBe(10);
  });
});
