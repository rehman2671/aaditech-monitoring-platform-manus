import { describe, expect, it } from 'vitest';
import { runPreflight } from './preflight.mjs';

describe('runPreflight', () => {
  const healthyDependencies = {
    checkHttp: async () => ({ ok: true, status: 200, body: '{"status":"ok"}' }),
    checkDatabase: async () => ({ ok: true, detail: 'database reachable' }),
  };

  it('passes when backend, database, and runner probes pass on a non-loopback URL', async () => {
    const result = await runPreflight({
      apiBaseUrl: 'http://monitoring-gateway:8080',
      runnerStatusUrl: 'http://builder:9090/healthz',
      databaseUrl: 'postgres://user:pass@postgres:5432/sentinelpulse',
      timeoutMs: 100,
    }, healthyDependencies);

    expect(result.ok).toBe(true);
    expect(result.checks.map(check => check.name)).toEqual([
      'backend_health_live', 'backend_health_ready', 'api_binding', 'database_connectivity', 'msi_runner_health', 'loopback_warning',
    ]);
  });

  it('fails when a backend or database probe fails', async () => {
    const requestedUrls: string[] = [];
    const result = await runPreflight({
      apiBaseUrl: 'http://monitoring-gateway:8080',
      runnerStatusUrl: 'http://builder:9090/healthz',
      databaseUrl: 'postgres://user:pass@postgres:5432/sentinelpulse',
      timeoutMs: 100,
    }, {
      checkHttp: async url => {
        requestedUrls.push(url);
        const isReady = url.endsWith('/health/ready');
        return { ok: !isReady, status: isReady ? 503 : 200, body: 'failure' };
      },
      checkDatabase: async () => ({ ok: false, detail: 'connection refused' }),
    });

    expect(result.ok).toBe(false);
    expect(requestedUrls.slice(0, 2)).toEqual(['http://monitoring-gateway:8080/health/live', 'http://monitoring-gateway:8080/health/ready']);
    expect(result.checks.find(check => check.name === 'backend_health_ready')?.ok).toBe(false);
    expect(result.checks.find(check => check.name === 'database_connectivity')?.ok).toBe(false);
  });

  it('fails misconfigured URL, database, runner, and unsafe loopback operation', async () => {
    const result = await runPreflight({ apiBaseUrl: 'http://127.0.0.1:8080', runnerStatusUrl: '', databaseUrl: '', timeoutMs: 100 }, healthyDependencies);

    expect(result.ok).toBe(false);
    expect(result.checks.find(check => check.name === 'database_connectivity')?.detail).toContain('not configured');
    expect(result.checks.find(check => check.name === 'msi_runner_health')?.detail).toContain('not configured');
    expect(result.checks.find(check => check.name === 'loopback_warning')?.ok).toBe(false);
  });
});
