export interface EndpointItem {
  id: string;
  hostname: string;
  ip_address: string;
  os_version: string;
  status: string;
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
