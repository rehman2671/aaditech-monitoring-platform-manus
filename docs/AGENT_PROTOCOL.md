# SentinelPulse Agent-Server Protocol Specification

## 1. Enrollment Protocol

```text
Agent                     Go API Server                 PostgreSQL
  │                             │                           │
  │── POST /api/v1/enroll ─────►│                           │
  │   (Token + Hardware ID)     │── Verify & Hash Token ───►│
  │                             │── Create Endpoint Record ─►│
  │◄─ 200 OK + Device Cred ─────│                           │
  │   (Encrypted via DPAPI)     │                           │
```

1. **Request**: The agent sends an enrollment request containing the raw one-time enrollment token and local hardware identifiers.
2. **Verification**: The server hashes the incoming token, checks expiration and usage status, and marks the token consumed in a database transaction.
3. **Issuance**: The server registers the endpoint in `pending` or `online` status and returns an endpoint credential token.
4. **Local Protection**: The agent encrypts and stores the credential locally using Windows DPAPI.

---

## 2. Telemetry Envelope and Transport

Every telemetry payload transmitted over HTTPS to `/api/v1/telemetry` must conform to the following JSON structure:

```json
{
  "schema_version": "1.0",
  "event_id": "uuid-v4-string",
  "endpoint_id": "endpoint-uuid-string",
  "capture_time": "2026-08-12T18:30:00Z",
  "sequence_number": 10482,
  "module": "performance",
  "payload": {
    "cpu_percent": 24.5,
    "ram_percent": 68.2,
    "disk_io_mbps": 3.1
  },
  "capabilities": {
    "wmi_version": "2.0",
    "collectors": ["cpu", "ram", "disk", "battery", "network"]
  }
}
```

### 2.1 Transport Rules
- **Idempotency**: The `event_id` and `sequence_number` ensure deduplication at the ingestion boundary.
- **Acknowledgements**: The server responds with `202 Accepted` and `{"success": true, "queued": true}` upon successful stream enqueue.
- **Retries & Backoff**: If network transmission fails or the server returns a 5xx error, the agent writes the payload to its local DPAPI-encrypted SQLite offline buffer and retries with exponential backoff.
- **Unsupported Collectors**: If a Windows WMI query or performance counter is unavailable on a specific OS edition, the module reports `supported: false` with an explicit reason string rather than crashing or fabricating values.

---

## 3. Heartbeat and Command Models

### 3.1 Heartbeat
- Agents transmit a lightweight heartbeat every 60 seconds to update `last_seen_at`.
- If an endpoint misses 15 minutes of heartbeats, background worker routines transition its state from `online` to `offline` and trigger stale-check alerting rules.

### 3.2 Command Model
- The server dispatches administrative commands (such as on-demand refresh or diagnostic log collection) via authenticated polling or persistent streaming channels.
- Each command includes a unique `command_id`, expiration time, target endpoint ID, and action payload.
- The agent executes the command, records the result, and returns an authenticated acknowledgement with execution output or error details.
