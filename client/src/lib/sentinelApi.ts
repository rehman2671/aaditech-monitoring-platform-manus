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
