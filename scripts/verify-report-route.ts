import fs from 'node:fs';
import { generateCsvReport, generatePdfReport } from '../server/generateReports';

const endpoints = [{ id: 'route-ep', hostname: 'ROUTE-TEST', status: 'online', osVersion: 'Windows 11', ipAddress: '127.0.0.1', lastSeenAt: new Date().toISOString() }];
const alerts = [{ id: 'route-alert', endpointId: 'route-ep', hostname: 'ROUTE-TEST', acknowledged: false, severity: 'warning', ruleName: 'Route test', message: 'Route test alert', triggeredAt: new Date().toISOString() }];
const csvPath = generateCsvReport(endpoints, alerts);
const pdfPath = generatePdfReport(endpoints, alerts);
console.log(JSON.stringify({ csvPath, pdfPath, csvName: csvPath.split('/').pop(), pdfName: pdfPath.split('/').pop() }));
