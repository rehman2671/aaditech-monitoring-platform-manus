import fs from 'fs';
import path from 'path';

export function generateCsvReport(endpoints: any[], alerts: any[]): string {
  const headers = ['Endpoint ID', 'Hostname', 'Status', 'OS Version', 'IP Address', 'Last Seen'];
  const rows = endpoints.map(e => [
    e.id,
    e.hostname,
    e.status,
    `"${e.osVersion || ''}"`,
    e.ipAddress,
    e.lastSeenAt
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const exportDir = path.join(process.cwd(), 'public', 'exports');
  fs.mkdirSync(exportDir, { recursive: true });
  
  const filePath = path.join(exportDir, `fleet-report-${Date.now()}.csv`);
  fs.writeFileSync(filePath, csvContent);
  return filePath;
}

export function generatePdfReportHtml(endpoints: any[], alerts: any[]): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>SentinelPulse Fleet Diagnostic Report</title>
      <style>
        body { font-family: Arial, sans-serif; color: #1e293b; padding: 40px; }
        h1 { color: #0f172a; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 12px; }
        th { background: #f1f5f9; }
      </style>
    </head>
    <body>
      <h1>SentinelPulse Fleet Diagnostic Report</h1>
      <p>Generated at: ${new Date().toISOString()}</p>
      <h2>Endpoints Overview</h2>
      <table>
        <tr><th>Hostname</th><th>Status</th><th>IP Address</th><th>OS</th></tr>
        ${endpoints.map(e => `<tr><td>${e.hostname}</td><td>${e.status}</td><td>${e.ipAddress}</td><td>${e.osVersion}</td></tr>`).join('')}
      </table>
    </body>
    </html>
  `;
}
