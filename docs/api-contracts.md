# SentinelPulse API Contract Reference

All timestamps are UTC ISO 8601. All production requests use TLS. JSON wire fields use `snake_case` in the portable agent/backend contract; the managed tRPC runtime maps them to its typed procedure inputs and outputs.

## Agent and Ingestion Endpoints

| Method | Path | Auth | Response |
|---|---|---|---|
| POST | `/api/v1/agents/enroll` | One-time enrollment token | `201 { endpoint_id, api_key }` |
| POST | `/api/v1/ingest` | Endpoint API key | `202 { received: true }` |
| POST | `/api/v1/agents/{endpoint_id}/heartbeat` | Endpoint API key | `200 { online: true }` |
| WSS | `/ws/agent?endpoint_id=...` | Endpoint API key | `refresh_request` messages |
| POST | `/api/v1/agents/{endpoint_id}/deregister` | Endpoint API key | `200 { deregistered: true }` |

The ingestion envelope contains `endpoint_id`, `module`, `captured_at`, `on_demand`, and `payload`. The accepted module names are `performance`, `disks`, `drivers`, `software`, `hardware`, `os_health`, `event_logs`, and `identity`. The ingestion service validates shape, applies the per-agent rate limit, adds a `request_id`, and pushes the message to Redis Streams before returning `202`.

## Dashboard Endpoints

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Public | Establish access and refresh credentials |
| POST | `/api/v1/auth/refresh` | Refresh token | Rotate refresh session |
| GET | `/api/v1/endpoints` | Admin/viewer | Paginated fleet inventory |
| GET | `/api/v1/endpoints/{id}` | Admin/viewer | Latest complete diagnostic state |
| GET | `/api/v1/endpoints/{id}/performance` | Admin/viewer | Range-based time-series metrics |
| GET | `/api/v1/endpoints/{id}/processes/top` | Admin/viewer | Top CPU/RAM consumers |
| GET | `/api/v1/endpoints/{id}/events` | Admin/viewer | Filtered Event Viewer entries |
| POST | `/api/v1/endpoints/{id}/refresh` | Admin/viewer | Relay on-demand modules over WebSocket |
| POST | `/api/v1/enrollment-tokens` | Admin | Issue single-use 24-hour token |
| GET | `/api/v1/alerts` | Admin/viewer | Firing/resolved lifecycle |
| POST | `/api/v1/alert-rules` | Admin | Create a sustained threshold rule |
| GET | `/api/v1/dashboard/summary` | Admin/viewer | Fleet-wide counts |
| GET | `/api/v1/export/endpoints` | Admin | Full fleet inventory JSON export |

## Standard Error Envelope

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "The viewer role cannot change alert rules.",
    "details": {}
  }
}
```

The UI mirrors this envelope through the typed `ApiError` adapter, while managed server procedures use tRPC's typed error transport and the built-in protected procedure.

## Live Events

Dashboard WebSocket clients receive `endpoint_status_changed`, `new_alert`, `alert_resolved`, and `metrics_updated`. Agent WebSocket clients receive `refresh_request` with a module list and request identifier. Each request identifier is propagated into the ingest payload so the UI can correlate an on-demand refresh with the resulting metrics.
