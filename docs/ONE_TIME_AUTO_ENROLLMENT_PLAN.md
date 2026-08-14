# One-Time Automatic Enrollment Plan

## Success criteria

The administrator enters the local API base URL, endpoint label, agent version, and signing mode once in the dashboard. The platform creates a tenant-scoped enrollment token in the canonical `sp-enrol-<UUID>` format, queues an MSI build, and forwards the bootstrap settings to the connected Windows runner. The generated MSI installs the Windows service without a token prompt. On first service start, the agent enrolls exactly once, stores only the encrypted device credential, removes the bootstrap token from machine configuration, and begins sending real WMI telemetry. A second enrollment attempt with the same token is rejected. Admin history never displays plaintext bootstrap data, and every API query remains tenant-scoped.

## Dependency map

The dashboard build request depends on the protected enrollment-token handler. The Windows runner depends on the backend job response carrying the bootstrap payload. The MSI builder depends on the runner forwarding that payload into WiX. The agent depends on reading the payload and clearing it after successful enrollment. Docker rebuild and local Windows validation depend on all previous layers compiling.

## Pseudocode

1. When the admin submits the automatic build form, validate the semantic version, absolute HTTP(S) API URL, and non-empty endpoint ID in the browser for immediate feedback.
2. Call the protected enrollment-token endpoint. The backend generate function creates a UUID with hyphens, prefixes it with `sp-enrol-`, hashes only the token for persistence, records the tenant and expiry, and returns the raw token exactly once.
3. Immediately call the protected MSI build endpoint with agent version, sign mode, API base URL, endpoint ID, and the raw token. The backend validates all fields and inserts the bootstrap fields into the tenant-scoped pending job. The token is not returned in admin list/detail responses.
4. When the private Windows runner claims the pending job, select the bootstrap fields inside the same transaction, mark the job running, include them only in the internal response, and clear the raw token column before committing. The runner never writes the token to logs.
5. The runner invokes the MSI builder with the API URL, endpoint ID, and token. The WiX package writes machine-level bootstrap registry values under the SentinelPulse agent key. These values are not shown in the dashboard or job history.
6. On service startup, the agent reads the machine bootstrap values. If no encrypted device credential exists and the token matches the `sp-enrol-<UUID>` pattern, call the canonical enrollment endpoint.
7. If enrollment succeeds, save the returned device token using the existing DPAPI local-machine protected buffer, delete the bootstrap token from the machine registry/environment, and continue with telemetry. If enrollment fails, retain the bootstrap token for bounded retries and continue logging a recoverable error without crashing the service.
8. Send telemetry using the existing WMI collectors and offline buffer. Verify that the endpoint is updated only within the tenant assigned by the enrollment token, and that the dashboard can see the endpoint and metrics through the authenticated tenant query.
9. Run static checks, Go tests, frontend type/build checks, an isolated PowerShell syntax validation on Windows, a WiX build, a service install smoke test, and live telemetry checks. If any gate fails, return to the design/implementation step instead of declaring success.

## Security decisions

The token is single-use and tenant-scoped. The database stores the hash for normal enrollment lookup, while the queued build holds the raw token only until the private runner claims it; claiming clears that column in the same transaction. The internal runner endpoint is protected by the existing builder key. The public admin API never returns bootstrap values in build history. The agent removes the bootstrap token after successful enrollment. Trusted Authenticode signing remains separate from enrollment and continues to fail closed when no trusted certificate is available.
