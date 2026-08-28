# SentinelPulse Endpoint Intelligence / AI Analyst Architecture

**Status:** Design baseline after repository inspection on 2026-08-28  
**Author:** Manus AI  
**Scope:** Additive integration only; existing telemetry, enrollment, tenant isolation, endpoint pages, alerts, exports, and MSI flow remain the compatibility boundary.

## 1. Inspected architecture

The active repository contains a React 19 + TypeScript portal under `client/`, a Go backend under `backend/go/`, auxiliary TypeScript backend services under `backend/services/`, and a .NET 8 Windows agent under `agent/src/SentinelPulse.Agent/`. The Go service owns the device enrollment, bearer authentication, Redis-ingress, tenant-scoped endpoint reads, telemetry worker, lifecycle state, MSI builder API, and PostgreSQL/TimescaleDB migrations. The portal consumes REST-style SentinelPulse endpoints through `client/src/lib/api.ts`, `client/src/lib/sentinelApi.ts`, and the endpoint normalization modules; endpoint detail is implemented in `client/src/pages/EndpointDetail.tsx`.

The agent already has a Worker polling loop, WMI-backed CPU/RAM/disk collection, diagnostic collectors, Windows event/process/software boundaries, durable SQLite buffering, sequence numbers, exponential backoff, DPAPI device credentials, and the canonical `config.json` contract in the current remediation branch. The existing collector deliberately returns unavailable values as null rather than substituting synthetic values. This remains mandatory for the Analyst layer.

The database already contains tenant-scoped endpoints, endpoint metric history, diagnostic events, optional battery/network/application evidence, metadata/audit tables, and MSI job tables. Existing Go migrations are additive and run during backend startup. No new table or column is introduced by this design document alone.

## 2. Source-of-truth boundary

The agent and deterministic backend remain authoritative for measurements, timestamps, thresholds, historical aggregation, endpoint score inputs, and evidence availability. The LLM receives a bounded, tenant-scoped summary of already-collected evidence and may explain or contextualize it only. It cannot collect, calculate, overwrite, elevate, or silently dismiss measurements.

Every derived claim must carry source evidence, capture time, and a data-quality state. Missing evidence is represented as `UNKNOWN`, `UNAVAILABLE`, or `INSUFFICIENT_EVIDENCE`; it is never converted into a failure or zero. High CPU alone is a resource observation, not a malware verdict. SMART unavailable is not disk failure. SFC timeout is an incomplete scan, not proof of corruption. Installed remote-access software is policy context, not automatic malware.

## 3. Additive contract vocabulary

The implementation will use the following bounded domain objects:

| Object | Purpose | Tenant boundary |
|---|---|---|
| `ProcessSample` | One process observation with supported identity, resource, and provenance fields | `(tenant_id, endpoint_id)` |
| `ApplicationAggregate` | Confidence-aware grouping of process samples into a logical application | `(tenant_id, endpoint_id, sample_window)` |
| `Finding` | Deterministic or correlated observation with severity, confidence, evidence, lifecycle, and action safety | `(tenant_id, endpoint_id)` |
| `EvidenceRef` | Stable reference to a source row/payload field and capture timestamp | Same tenant as parent object |
| `AnalystAssessment` | Optional Ollama explanation over a deterministic evidence snapshot | `(tenant_id, endpoint_id, evidence_hash)` |
| `EndpointHealthScore` | Transparent deterministic dimension scores and calculation explanation | `(tenant_id, endpoint_id, captured_at)` |
| `EndpointReport` | Snapshot export combining endpoint identity, evidence, findings, score, and optional AI narrative | Authenticated tenant only |

Recommended finding statuses are `OPEN`, `ACKNOWLEDGED`, `DISMISSED`, `RESOLVED`, and `UNKNOWN`. Recommended severities are `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFORMATIONAL`, and `UNKNOWN`. Any remediation action defaults to `requires_confirmation=true` and is only a recommendation until existing policy, permission, and administrator confirmation gates approve execution.

## 4. Processing pipeline

1. **Collection:** The Windows agent collects only supported evidence and records collector success, limitation, capture time, and agent version.
2. **Ingestion:** The authenticated Go telemetry path validates device bearer, endpoint identity, tenant identity, sequence, and payload shape before persistence.
3. **Normalization:** Backend workers normalize process, event, driver, OS-health, software, storage, battery, and hardware records. Raw endpoint strings remain untrusted data.
4. **History:** Process and endpoint samples are retained with bounded raw retention and downsampled time buckets for 5-minute, 15-minute, 1-hour, 24-hour, and 7-day views; retention is configurable and documented.
5. **Deterministic analysis:** CPU/RAM/storage/battery thresholds, event classification, driver impact, SFC/DISM state, software categories, data-quality limitations, and health-score dimensions are computed without an LLM.
6. **Correlation:** Related evidence is combined into a finding only when contextual evidence supports it. A single spike remains a spike; sustained usage plus unsigned/unexpected execution and network evidence may become a stronger investigation candidate.
7. **Optional Ollama:** An asynchronous worker sends a compact, delimited evidence summary to configurable local Ollama. Invalid, unavailable, timed-out, or missing-model responses fall back to deterministic findings and show `AI analysis unavailable`.
8. **Presentation/export:** Portal views show the evidence chain, confidence, limitations, safe recommendations, and explicit no-action states. JSON/CSV/PDF exports use the same tenant-scoped report snapshot.

## 5. Local Ollama boundary

Configuration is provider-neutral and must not hard-code a model in application logic:

```text
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:1.7b
```

The default model is `qwen3:1.7b`, but `qwen2.5:3b` and `llama3.2:3b` must be selectable without code changes. The Ollama client is server-side only, local-network scoped by configuration, timeout-bounded, rate-limited, and cacheable by evidence hash. Endpoint strings are placed inside explicit `TELEMETRY_DATA` delimiters and the system prompt states that these strings are data, not instructions. No OpenAI, Anthropic, Gemini, or other external AI API is introduced.

The structured response is validated before persistence. At minimum it contains overall risk, confidence, summary, findings, positive findings, data-quality issues, and next steps. Findings must reference only supplied evidence IDs. Any invalid response is discarded or retried safely; deterministic output remains available.

## 6. Compatibility and rollout

The first implementation slice should add read-only contracts, deterministic analyzers, and tests before changing the Windows collection cadence. Existing endpoint APIs remain backward-compatible; new fields are additive and nullable. Existing UI pages remain intact, with Analyst views added to endpoint detail and existing process/event/diagnostic panels reused rather than replaced.

No destructive migration, automatic remediation, certificate/private-key change, or global Windows security-policy change is part of this architecture. Production signing remains a separate environment gate. Windows-specific collection and MSI behavior must be verified on the connected endpoint, not inferred from Linux preview tests.

## 7. Implementation order

The safe order is: contract and migration design; deterministic process/history and application aggregation; CPU/RAM/storage/battery/hardware analyzers; event/driver/OS-health/software normalization; centralized findings and correlation; bounded Ollama client and schema validation; report snapshot/export; Analyst UI; tenant/privacy/retention safeguards; then full regression and Windows/Docker/Ollama acceptance.

## 8. Explicit non-goals

The Analyst layer will not execute process termination, file deletion, uninstall, service or registry changes, firewall changes, isolation, quarantine, restart, or destructive commands. It will not call missing fields zero, classify normal events as incidents, treat unsigned software alone as malware, or claim a leak/corruption/failure without sufficient evidence.
