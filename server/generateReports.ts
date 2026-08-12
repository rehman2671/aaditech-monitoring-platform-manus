import fs from 'node:fs';
import path from 'node:path';

export type ReportTelemetry = {
  endpointId: string;
  battery?: { chargePercent?: number | null; healthPercent?: number | null; chargingStatus?: string | null };
  network?: { ipAddress?: string | null; ssid?: string | null; latencyMs?: number | string | null; vpnActive?: boolean | null };
  applications?: { appName: string; activeSeconds: number; launchCount: number }[];
};

function reportDirectory() {
  const exportDir = process.env.REPORT_EXPORT_DIR ?? path.join(process.cwd(), process.env.NODE_ENV === 'production' ? 'dist/public' : 'public', 'exports');
  fs.mkdirSync(exportDir, { recursive: true });
  return exportDir;
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

export function generateCsvReport(endpoints: any[], alerts: any[], telemetry: ReportTelemetry[] = []): string {
  const headers = ['Endpoint ID', 'Hostname', 'Status', 'OS Version', 'IP Address', 'Last Seen', 'Battery %', 'Battery Health %', 'Charging', 'Wi-Fi SSID', 'Latency ms', 'VPN Active', 'Top Applications'];
  const telemetryByEndpoint = new Map(telemetry.map(value => [value.endpointId, value]));
  const rows = endpoints.map(endpoint => {
    const item = telemetryByEndpoint.get(endpoint.id);
    return [
      endpoint.id,
      endpoint.hostname,
      endpoint.status,
      endpoint.osVersion,
      endpoint.ipAddress,
      endpoint.lastSeenAt,
      item?.battery?.chargePercent,
      item?.battery?.healthPercent,
      item?.battery?.chargingStatus,
      item?.network?.ssid,
      item?.network?.latencyMs,
      item?.network?.vpnActive,
      item?.applications?.slice(0, 3).map(app => `${app.appName} (${Math.round(app.activeSeconds / 60)}m/${app.launchCount} launches)`).join('; '),
    ];
  });
  const alertRows = alerts.map(alert => [alert.id, alert.endpointId, alert.hostname, alert.severity, alert.ruleName, alert.message, alert.triggeredAt, alert.acknowledged]);
  const csvContent = [
    ['FLEET TELEMETRY'],
    headers,
    ...rows,
    [],
    ['ALERT RECORDS'],
    ['Alert ID', 'Endpoint ID', 'Hostname', 'Severity', 'Rule', 'Message', 'Triggered At', 'Acknowledged'],
    ...alertRows,
  ].map(row => row.map(csvEscape).join(',')).join('\n') + '\n';
  const filePath = path.join(reportDirectory(), `fleet-report-${Date.now()}.csv`);
  fs.writeFileSync(filePath, csvContent, { encoding: 'utf8', mode: 0o640 });
  return filePath;
}

function pdfEscape(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function buildPdf(lines: string[]) {
  const contentLines = ['BT', '/F1 12 Tf', '50 760 Td', ...lines.map((line, index) => `${index ? '0 -18 Td ' : ''}(${pdfEscape(line)}) Tj`), 'ET'];
  const content = contentLines.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'utf8')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

export function generatePdfReport(endpoints: any[], alerts: any[], telemetry: ReportTelemetry[] = []): string {
  const telemetryByEndpoint = new Map(telemetry.map(value => [value.endpointId, value]));
  const lines = [
    'SentinelPulse Fleet Diagnostic Report',
    `Generated UTC: ${new Date().toISOString()}`,
    `Endpoints: ${endpoints.length} | Alert records: ${alerts.length} | Unacknowledged: ${alerts.filter(alert => !alert.acknowledged).length}`,
    '',
    'FLEET TELEMETRY',
    ...endpoints.slice(0, 40).map(endpoint => {
      const item = telemetryByEndpoint.get(endpoint.id);
      return `${endpoint.hostname} | ${endpoint.status} | ${endpoint.osVersion ?? 'Unknown'} | ${endpoint.ipAddress ?? 'Unknown'} | battery ${item?.battery?.chargePercent ?? 'n/a'}% | latency ${item?.network?.latencyMs ?? 'n/a'}ms`;
    }),
    '',
    'ALERT RECORDS',
    ...alerts.slice(0, 60).map(alert => `${alert.hostname ?? alert.endpointId} | ${alert.severity} | ${alert.ruleName} | ${alert.message}`),
  ];
  const filePath = path.join(reportDirectory(), `fleet-report-${Date.now()}.pdf`);
  fs.writeFileSync(filePath, buildPdf(lines), { mode: 0o640 });
  return filePath;
}
