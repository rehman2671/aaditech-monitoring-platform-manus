import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLatestEndpointAnalyst } from './sentinelApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('local analyst authentication', () => {
  it('refreshes once and retries a cached assessment request after a 401', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'renewed-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response('No cached analyst assessment is available', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchLatestEndpointAnalyst('endpoint-7', 'expired-token'))
      .rejects.toThrow('No cached analyst assessment is available');

    const firstRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const retryRequest = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/endpoints/endpoint-7/analyst/latest');
    expect(firstRequest.credentials).toBe('include');
    expect(new Headers(firstRequest.headers).get('Authorization')).toBe('Bearer expired-token');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/auth/refresh');
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).credentials).toBe('include');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/v1/endpoints/endpoint-7/analyst/latest');
    expect(retryRequest.credentials).toBe('include');
    expect(new Headers(retryRequest.headers).get('Authorization')).toBe('Bearer renewed-token');
  });
});
