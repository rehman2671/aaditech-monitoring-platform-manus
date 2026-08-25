# SentinelPulse endpoint normalization contract

The dashboard treats backend endpoint records as evidence, not as a source for inferred telemetry. Normalization is limited to adapting lifecycle vocabulary and protecting the UI from malformed nullable fields.

| Field family | Rule | Allowed fallback |
|---|---|---|
| Status | `pending` is displayed as `warning`; `disabled` is displayed as `offline`; `online`, `warning`, and `offline` are preserved. Unknown values fail closed to `offline` and must not be presented as healthy. | `offline` for an unknown lifecycle value |
| Timestamps | Valid backend timestamps are converted to ISO strings. Missing or invalid timestamps remain unavailable. The client must never use the current time as a substitute. | `Unavailable` |
| Identity strings | Backend values are preserved after trimming. Missing or blank serial, IP, MAC, OS, build, domain, and agent-version fields are explicit unavailable values. | `Unavailable` |
| Hardware | Hardware model strings may be unavailable. CPU core/thread counts and RAM capacity are optional and are rendered as unavailable when absent; zero is not used as a missing-data sentinel. | `Unavailable` text; optional numeric fields remain absent |
| OS health | DISM, SFC, driver-count, and reliability evidence is rendered only when supplied. Missing driver counts do not mean zero issues. | `Unavailable` text; optional numeric fields remain absent |
| Collections | Missing disks, software, processes, events, and telemetry history are empty collections and render a no-evidence/empty state, not fabricated rows. | Empty collection |

The backend remains authoritative for tenant scope and endpoint lifecycle. Frontend normalization must not create telemetry samples, freshness timestamps, health scores, disk-critical counts, or diagnostic success claims.
