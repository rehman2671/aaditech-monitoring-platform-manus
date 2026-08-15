import type {
  ApiRequestEnvelope,
  AuthSession,
  DashboardSummary,
  Endpoint,
  StandardErrorEnvelope,
  MSIBuilderStatus,
  MSIBuildJob,
  MSISignMode,
} from '../types';

/** Precision Enterprise Glass: API boundaries remain crisp, typed, and operational. */
export const API_BASE_URL = import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '/api/v1';

type BackendMSIBuilderStatus = {
  available: boolean;
  builder_id?: string;
  last_seen_at?: string;
  signing_mode: MSIBuilderStatus['signingMode'];
  certificate_subject?: string;
  certificate_thumbprint?: string;
  certificate_expires_at?: string;
  certificate_trusted: boolean;
  message: string;
};

type BackendMSIBuildJob = {
  id: string;
  organization_id: string;
	agent_version: string;
	sign_mode: MSISignMode;
	automatic_enrollment: boolean;
  status: MSIBuildJob['status'];
  error_message?: string;
  artifact_filename?: string;
  checksum_filename?: string;
  sha256?: string;
  is_signed: boolean;
  certificate_subject?: string;
  certificate_thumbprint?: string;
  certificate_expires_at?: string;
  certificate_trusted: boolean;
  size_bytes: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
};

function mapMSIBuilderStatus(value: BackendMSIBuilderStatus): MSIBuilderStatus {
  return {
    available: value.available,
    builderId: value.builder_id,
    lastSeenAt: value.last_seen_at,
    signingMode: value.signing_mode,
    certificateSubject: value.certificate_subject,
    certificateThumbprint: value.certificate_thumbprint,
    certificateExpiresAt: value.certificate_expires_at,
    certificateTrusted: value.certificate_trusted,
    message: value.message,
  };
}

function mapMSIBuildJob(value: BackendMSIBuildJob): MSIBuildJob {
  return {
    id: value.id,
    organizationId: value.organization_id,
		agentVersion: value.agent_version,
		signMode: value.sign_mode,
		automaticEnrollment: value.automatic_enrollment,
    status: value.status,
    errorMessage: value.error_message,
    artifactFilename: value.artifact_filename,
    checksumFilename: value.checksum_filename,
    sha256: value.sha256,
    isSigned: value.is_signed,
    certificateSubject: value.certificate_subject,
    certificateThumbprint: value.certificate_thumbprint,
    certificateExpiresAt: value.certificate_expires_at,
    certificateTrusted: value.certificate_trusted,
    sizeBytes: value.size_bytes,
    createdAt: value.created_at,
    startedAt: value.started_at,
    completedAt: value.completed_at,
  };
}

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
    const rawBody = await response.text();
    let payload: StandardErrorEnvelope;
    try {
      payload = rawBody ? JSON.parse(rawBody) as StandardErrorEnvelope : {
        error: { code: 'UNKNOWN_ERROR', message: response.statusText || 'Request failed' },
      };
    } catch {
      payload = {
        error: {
          code: `HTTP_${response.status}`,
          message: rawBody.trim() || response.statusText || 'Request failed',
        },
      };
    }
    throw new ApiError(response.status, payload);
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
  msiBuilderStatus: async (token: string) => mapMSIBuilderStatus(await request<BackendMSIBuilderStatus>('/admin/msi-builder/status', {}, token)),
  listMSIBuilds: async (token: string) => (await request<BackendMSIBuildJob[]>('/admin/msi-builds', {}, token)).map(mapMSIBuildJob),
  createMSIBuild: (
    token: string,
    agentVersion: string,
    signMode: MSISignMode,
    bootstrap?: { apiBaseUrl: string; endpointId: string; automaticEnrollment: boolean },
  ) => request<{ job_id: string; status: string; message: string; automatic_enrollment?: boolean }>('/admin/msi-builds', {
    method: 'POST',
    body: JSON.stringify({
      agent_version: agentVersion,
      sign_mode: signMode,
      api_base_url: bootstrap?.apiBaseUrl ?? '',
      endpoint_id: bootstrap?.endpointId ?? '',
      automatic_enrollment: bootstrap?.automaticEnrollment ?? false,
    }),
  }, token),
  downloadMSI: async (token: string, jobId: string) => {
    const response = await fetch(`${API_BASE_URL}/admin/msi-builds/${encodeURIComponent(jobId)}/download`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!response.ok) {
      const message = await response.text();
      throw new ApiError(response.status, { error: { code: 'MSI_DOWNLOAD_FAILED', message: message || response.statusText } });
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'SentinelPulseAgent.msi';
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
  downloadLatestMSI: async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/admin/msi-latest/download`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!response.ok) {
      const message = await response.text();
      throw new ApiError(response.status, { error: { code: 'MSI_LATEST_DOWNLOAD_FAILED', message: message || response.statusText } });
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'SentinelPulseAgent-latest-x64.msi';
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
};
