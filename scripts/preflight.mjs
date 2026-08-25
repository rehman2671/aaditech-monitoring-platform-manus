#!/usr/bin/env node

import net from 'node:net';
import process from 'node:process';

function usage() {
  console.log('Usage: node scripts/preflight.mjs [--api-base-url URL] [--runner-status-url URL] [--database-url URL] [--timeout-ms N]');
}

function parseArgs(argv) {
  const options = {
    apiBaseUrl: process.env.SENTINELPULSE_API_BASE_URL ?? 'http://127.0.0.1:8080',
    runnerStatusUrl: process.env.SENTINELPULSE_MSI_BUILDER_STATUS_URL ?? '',
    databaseUrl: process.env.DATABASE_URL ?? '',
    timeoutMs: 5000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') return { ...options, help: true };
    if (arg === '--api-base-url') options.apiBaseUrl = argv[++index] ?? '';
    else if (arg === '--runner-status-url') options.runnerStatusUrl = argv[++index] ?? '';
    else if (arg === '--database-url') options.databaseUrl = argv[++index] ?? '';
    else if (arg === '--timeout-ms') options.timeoutMs = Number(argv[++index] ?? 0);
  }
  return options;
}

async function checkHttp(url, timeoutMs, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json', ...headers } });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body: body.slice(0, 240) };
  } catch (error) {
    return { ok: false, status: 0, body: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function checkTcpDatabase(databaseUrl, timeoutMs) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return { ok: false, detail: 'DATABASE_URL is invalid' };
  }
  const port = Number(parsed.port || (parsed.protocol === 'postgres:' ? 5432 : 3306));
  return await new Promise(resolve => {
    const socket = net.createConnection({ host: parsed.hostname, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, detail: `database TCP probe timed out at ${parsed.hostname}:${port}` });
    }, timeoutMs);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve({ ok: true, detail: `database TCP endpoint reachable at ${parsed.hostname}:${port}` });
    });
    socket.once('error', error => {
      clearTimeout(timer);
      resolve({ ok: false, detail: error instanceof Error ? error.message : String(error) });
    });
  });
}

export async function runPreflight(options, dependencies = {}) {
  const checkHttpFn = dependencies.checkHttp ?? checkHttp;
  const checkDatabaseFn = dependencies.checkDatabase ?? checkTcpDatabase;
  const apiBaseUrl = options.apiBaseUrl.replace(/\/$/, '');
  let parsedUrl;
  try {
    parsedUrl = new URL(apiBaseUrl);
  } catch {
    return { ok: false, checks: [{ name: 'api_base_url', ok: false, detail: 'Invalid URL' }] };
  }

  const checks = [];
  const health = await checkHttpFn(`${apiBaseUrl}/health/live`, options.timeoutMs);
  checks.push({ name: 'backend_health_live', ok: health.ok, detail: `${health.status || 'unreachable'} ${health.body}` });
  const readiness = await checkHttpFn(`${apiBaseUrl}/health/ready`, options.timeoutMs);
  checks.push({ name: 'backend_health_ready', ok: readiness.ok, detail: `${readiness.status || 'unreachable'} ${readiness.body}` });

  const isLoopback = parsedUrl.hostname === '127.0.0.1' || parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '::1';
  checks.push({ name: 'api_binding', ok: Boolean(parsedUrl.port), detail: `${parsedUrl.protocol}//${parsedUrl.hostname}:${parsedUrl.port || '(default)'}` });

  if (options.databaseUrl) {
    const database = await checkDatabaseFn(options.databaseUrl, options.timeoutMs);
    checks.push({ name: 'database_connectivity', ok: database.ok, detail: database.detail });
  } else {
    checks.push({ name: 'database_connectivity', ok: false, detail: 'DATABASE_URL is not configured' });
  }

  if (options.runnerStatusUrl) {
    const runner = await checkHttpFn(options.runnerStatusUrl, options.timeoutMs);
    checks.push({ name: 'msi_runner_health', ok: runner.ok, detail: `${runner.status || 'unreachable'} ${runner.body}` });
  } else {
    checks.push({ name: 'msi_runner_health', ok: false, detail: 'SENTINELPULSE_MSI_BUILDER_STATUS_URL is not configured' });
  }

  checks.push({ name: 'loopback_warning', ok: !isLoopback || process.env.ALLOW_LOOPBACK_API === 'true', detail: isLoopback ? 'loopback URL is suitable only when agent and backend share a host' : 'non-loopback API URL configured' });
  return { ok: checks.every(check => check.ok), checks };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    process.exit(0);
  }
  const result = await runPreflight(options);
  for (const check of result.checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
  process.exit(result.ok ? 0 : 1);
}
