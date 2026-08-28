export interface EndpointItem {
  id: string;
  hostname: string;
  ip_address: string;
  os_version: string;
  status: string;
  status_reason?: string;
  status_changed_at?: string;
  last_seen?: string;
  created_at: string;
}

export async function fetchEndpoints(token?: string): Promise<EndpointItem[]> {
  try {
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch("/api/v1/endpoints", { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch endpoints: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error("[SentinelAPI] Error fetching endpoints:", err);
    return [];
  }
}

export async function generateEnrollmentToken(token: string): Promise<{ enrollment_token: string; expires_at: string } | null> {
  try {
    const res = await fetch("/api/v1/enrollment-tokens", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to generate token: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error("[SentinelAPI] Error generating enrollment token:", err);
    return null;
  }
}

export interface AlertRuleItem {
  id: string;
  tenant_id: string;
  metric: string;
  operator: string;
  threshold: number;
  severity: string;
  enabled: boolean;
}

export async function fetchAlertRules(token?: string): Promise<AlertRuleItem[]> {
  try {
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch("/api/v1/alert-rules", { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch alert rules: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error("[SentinelAPI] Error fetching alert rules:", err);
    return [];
  }
}

export async function testWebhook(url: string, provider: string, token?: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch("/api/v1/alert-rules/test", {
      method: "POST",
      headers,
      body: JSON.stringify({ url, provider }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error testing webhook" };
  }
}

export interface AnalystFindingItem {
  finding_id: string;
  category: string;
  severity: string;
  confidence: number;
  title: string;
  description: string;
  evidence_ids: string[];
  recommended_action: string;
  remediation_available: boolean;
}

export interface AnalystAssessmentItem {
  overall_risk: string;
  confidence: number;
  summary: string;
  findings: AnalystFindingItem[];
  positive_findings: string[];
  data_quality_issues: string[];
  recommended_steps: string[];
}

export interface AnalystResponse {
  available: boolean;
  reason: string;
  evidence_hash: string;
  evidence_count: number;
  persisted: boolean;
  assessment: AnalystAssessmentItem;
}

export async function runEndpointAnalyst(endpointId: string, token?: string): Promise<AnalystResponse> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api/v1/endpoints/${encodeURIComponent(endpointId)}/analyst`, { method: 'POST', headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || data?.reason || `Analyst request failed: ${res.statusText}`);
  return data as AnalystResponse;
}

export async function fetchLatestEndpointAnalyst(endpointId: string, token?: string): Promise<AnalystResponse> {
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api/v1/endpoints/${encodeURIComponent(endpointId)}/analyst/latest`, { headers });
  if (res.status === 404) throw new Error('No cached analyst assessment is available');
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Cached analyst request failed: ${res.statusText}`);
  return { ...data, evidence_count: 0, persisted: true } as AnalystResponse;
}

export interface ProcessHistoryBucketItem {
  bucketStart: string;
  processCount: number;
  averageCPUPercent?: number | null;
  maxWorkingSet?: number | null;
}

export async function fetchProcessHistory(endpointId: string, bucket = '5m', token?: string): Promise<ProcessHistoryBucketItem[]> {
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api/v1/endpoints/${encodeURIComponent(endpointId)}/process-history?bucket=${encodeURIComponent(bucket)}`, { headers });
  if (!res.ok) throw new Error(`Process history request failed: ${res.statusText}`);
  const data = await res.json();
  return Array.isArray(data?.buckets) ? data.buckets : [];
}

export async function sendEndpointCommand(endpointId: string, commandType: 'QUARANTINE' | 'ISOLATE' | 'REBOOT', payload: string = '', token?: string): Promise<any> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`/api/v1/endpoints/${endpointId}/command`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ command_type: commandType, payload })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send command: ${text}`);
  }
  return res.json();
}
