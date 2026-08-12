# SentinelPulse Threat Model (STRIDE Framework)

## 1. Threat Analysis Table

| Asset / Boundary | STRIDE Threat | Attack Path | Impact | Mitigation | Validation / Test |
|---|---|---|---|---|---|
| **Dashboard UI** | Elevation of Privilege | Bypassing session checks to gain admin actions | Unauthorized tenant management or token generation | Strict RBAC middleware, server-side session validation, and admin-only procedure wrappers. | Automated role-based authorization test suite. |
| **Go API Ingestion** | Spoofing | Submitting telemetry payloads with forged endpoint IDs | Corrupted fleet metrics or false alerts | Authenticated endpoint credentials, monotonic sequence numbers, and strict schema validation. | Ingestion integration test with invalid or mismatched credentials. |
| **PostgreSQL / TimescaleDB** | Information Disclosure | Direct database query bypassing tenant scope | Cross-organization telemetry and credential leakage | Mandatory `organization_id` predicates in every database query and repository helper. | Tenant isolation unit tests executing queries across simulated tenants. |
| **Redis Streams** | Denial of Service | Flooding the ingestion stream with invalid messages | Consumer group lag and worker starvation | Rate limiting, strict body-size limits, and payload schema validation at the API boundary. | Load test and malformed payload injection test. |
| **Windows Agent** | Tampering | Modifying local agent configuration or payload queue | Tampered telemetry or suppressed alerts | Windows DPAPI encryption on local SQLite buffer and configuration files, restricted LocalSystem ACLs. | Local permission audit and DPAPI decryption tests. |
| **Enrollment Token** | Information Disclosure / Spoofing | Intercepting or reusing plaintext enrollment tokens | Unauthorized agent registration and rogue endpoint takeover | Storing only SHA-256 hashes (`token_hash`), one-time atomic consumption, and short token expiration times. | Token reuse rejection test. |
| **Command Dispatch** | Tampering / Elevation | Injecting unauthorized remote commands to endpoints | Endpoint compromise or operational disruption | Authenticated admin session requirement, command signing, explicit target validation, and audit logging. | Command authorization and audit-trail test. |
