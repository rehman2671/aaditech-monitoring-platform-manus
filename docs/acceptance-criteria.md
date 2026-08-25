# SentinelPulse acceptance criteria

## Universal MSI and dynamic configuration

A generated MSI must install the same signed agent binary on supported x64 Windows systems without embedding a machine-specific hostname or server address. The installed runtime configuration must be authored at `C:\ProgramData\SentinelPulse\Agent\config.json` and must contain the documented lower-camel-case keys for `serverUrl`, `endpointId`, `enrollmentToken`, and `agentVersion`. Re-pointing the server must be possible by changing runtime configuration without rebuilding the binary. The MSI build record must expose artifact name, SHA-256, signing mode, certificate trust state, and completion status.

## Two-phase enrollment

The installer may carry a short-lived enrollment token only for the first enrollment exchange. The backend must validate the token format, expiry, tenant ownership, and single-use state. On successful enrollment it must issue a device credential, persist only its hash, and the agent must persist the credential using the Windows protected credential store. The enrollment token must then be cleared from runtime configuration. A revoked, unknown, expired, or tenant-mismatched credential must not be accepted for telemetry.

## Evidence-based telemetry

Every accepted telemetry envelope must contain an event ID, endpoint ID, capture timestamp, module, and payload. The endpoint and tenant identity must come from the authenticated device credential, not from a client-supplied tenant field. The worker must persist the payload values at the envelope capture timestamp; unavailable metrics must be stored as NULL. No collector or persistence layer may substitute fixed utilization, temperature, hostname, IP address, operating-system, or tenant values. The endpoint last-seen update must be constrained by both endpoint ID and tenant ID.

## Portal truthfulness

The portal must display explicit unavailable or partial states when evidence is missing. It must not label all collectors nominal or claim universal WMI coverage without corresponding collector evidence and freshness timestamps. RAM modules and GPU adapters must be shown per device when evidence exists; dedicated and shared GPU memory must be labeled distinctly. All fleet and endpoint queries must remain tenant-scoped, and malformed API arrays must produce a diagnosable error rather than a render-time null-map crash.

## Validation gate

A release passes only when frontend tests, Go backend tests, production build, Windows agent compilation, WiX/MSI compilation, Windows installation, DPAPI credential persistence, real WMI capture, PostgreSQL/TimescaleDB persistence, and portal rendering have all been observed. If a platform-specific check cannot run in the current environment, it remains pending and must be reported explicitly.
