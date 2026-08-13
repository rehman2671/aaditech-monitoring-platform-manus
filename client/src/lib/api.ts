import type {
  ApiRequestEnvelope,
  AuthSession,
  DashboardSummary,
  Endpoint,
  StandardErrorEnvelope,
} from '../types';

/** Precision Enterprise Glass: API boundaries remain crisp, typed, and operational. */
export const API_BASE_URL = import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, payload: StandardErrorEnvelope) {
    super(payload.error.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload.error.code;
    this.details = payload.error.details;
  }
}

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: { code: 'UNKNOWN_ERROR', message: 'Request failed' } }));
    throw new ApiError(response.status, payload as StandardErrorEnvelope);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthSession>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  createEnrollmentToken: (accessToken: string) =>
    request<{ enrollment_token: string; expires_at: string; organization_id: string }>('/enrollment-tokens', { method: 'POST' }, accessToken),
  requestEndpointRefresh: (accessToken: string, endpointId: string, modules: string[]) =>
    request<Record<string, unknown>>(`/endpoints/${encodeURIComponent(endpointId)}/command`, {
      method: 'POST',
      body: JSON.stringify({ command_type: 'REFRESH', payload: JSON.stringify({ modules }) }),
    }, accessToken),
  refresh: () => request<AuthSession>('/auth/refresh', { method: 'POST' }),
  summary: (token: string) => request<DashboardSummary>('/dashboard/summary', {}, token),
  endpoints: (token: string, query = '') => request<Endpoint[]>(`/endpoints${query}`, {}, token),
  endpoint: (token: string, id: string) => request<Endpoint>(`/endpoints/${id}`, {}, token),
  requestRefresh: (token: string, id: string, modules: string[]) =>
    request<{ requestId: string }>(`/endpoints/${id}/refresh`, { method: 'POST', body: JSON.stringify({ modules }) }, token),
  ingest: (token: string, payload: ApiRequestEnvelope) =>
    request<{ received: boolean }>('/ingest', { method: 'POST', body: JSON.stringify(payload) }, token),
  exportEndpoints: (token: string) => request<Endpoint[]>('/export/endpoints', {}, token),
};
