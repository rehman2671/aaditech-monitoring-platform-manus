/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('endpoint API payload validation', () => {
  it('accepts an endpoint array response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ id: 'endpoint-1' }]), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    await expect(api.endpoints('token')).resolves.toEqual([{ id: 'endpoint-1' }]);
  });

  it.each([null, { data: [] }])('rejects a malformed endpoint payload: %s', async payload => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    await expect(api.endpoints('token')).rejects.toMatchObject<ApiError>({
      status: 502,
      code: 'INVALID_API_PAYLOAD',
      message: expect.stringMatching(/^Expected an array response from \/endpoints; received (null|object)\.$/),
    });
  });
});


describe('MSI artifact downloads', () => {
  it('downloads a checksum manifest from the authenticated job route', async () => {
    const fetchMock = vi.fn(async () => new Response('abc123  SentinelPulseAgent.msi', {
      status: 200,
      headers: { 'Content-Disposition': 'attachment; filename="SentinelPulseAgent.sha256"' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    const click = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);

    await api.downloadMSIManifest('token', 'job-7');

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/admin/msi-builds/job-7/manifest', expect.objectContaining({
      headers: { Authorization: 'Bearer token' },
      credentials: 'include',
    }));
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a')).toBeNull();
  });
});
