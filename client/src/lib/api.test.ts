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
