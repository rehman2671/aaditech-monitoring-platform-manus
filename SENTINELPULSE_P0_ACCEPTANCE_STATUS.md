# SentinelPulse P0 Acceptance Status

**Updated:** 2026-08-28

## Verified in this remediation pass

The Windows agent was rebuilt as **2.4.36** from the current source and installed on the connected endpoint. The installation returned `MSI_EXIT=0`; the `SentinelPulseAgent` service is `Running` with `Automatic` start; the installed executable reports `2.4.36.0`; `config.json` is present under `C:\ProgramData\SentinelPulse\Agent`; and `device-credential.bin` is present for DPAPI-protected device authentication.

`BATTERY_HEALTH` is executed before telemetry serialization. Its command status, exit code, output, and error are attached to the same diagnostics payload through a null-safe `ApplyCommandEvidence` path. The Windows Release build completed with zero warnings and zero errors.

The backend has an additive lifecycle migration for `status_reason` and `status_changed_at`. Successful enrollment marks an endpoint `pending` until telemetry evidence exists. Consumed or expired enrollment tokens now record `ENROLLMENT_FAILED` semantics only when the requested endpoint already belongs to the token's tenant; invalid or unresolvable tokens remain non-mutating. The endpoint API exposes lifecycle reason and transition timestamp, and the frontend preserves and renders explicit `pending`, `disabled`, `enrollment_failed`, and `auth_error` values instead of collapsing them to generic offline.

The MSI release flow now presents **Compile MSI** as the primary action, the generated MSI as the primary download, and a tenant-scoped `.sha256` manifest as a secondary download. Release rows distinguish queued, building, trusted-signed, unsigned-test, and failed states without exposing signing secrets.

Validation is green for the active application code: TypeScript passes; the full frontend/server Vitest suite reports **15 files and 51 tests passed**; dedicated setup-to-login, endpoint lifecycle, MSI manifest, and MSI status-label regressions pass; configuration, password hashing, token hashing, token tampering, lifecycle SQL, and the complete Go backend suite pass.

## Gates that remain unproven

The connected database currently contains the optional `battery_telemetry` and `network_telemetry` tables, but the read-only query for `DESKTOP-1E02MC9` returned no rows. Therefore the portal's battery/network unavailable state remains truthful; a clean live collection cycle still needs to be observed after the rebuilt runtime is active.

The full Windows xUnit run is blocked before test execution because the local Application Control policy rejects the test assembly dependency with `0x800711C7`. This is an environment policy failure, not a failed assertion, and no Windows-suite pass is claimed.

The deployment container rebuild could not be completed in the sandbox. The Docker daemon cannot create bridge endpoints because the kernel lacks the `iptables` `raw` table. The application source was not changed to work around this infrastructure limitation, and no container health result is claimed from that attempt.

Trusted production MSI signing remains open. The generated 2.4.36 artifact is an unsigned test MSI; its status must remain visibly distinct from a trusted Authenticode-signed release.

Complete `AUTH_ERROR` and operator-controlled `DISABLED` transition writers still require an authenticated, tenant-scoped backend action and live verification. The UI and API contract are fail-closed and preserve explicit values, but these transitions are not claimed complete.

## Acceptance decision

The current state is **not yet final P0 acceptance**. Agent packaging, command evidence, authentication/configuration boundaries, MSI artifact delivery, release-status semantics, and local login continuity are verified. Live battery/network persistence, complete explicit failure-state writers, trusted signing, container runtime rebuild, clean-profile MSI proof, and the Windows test execution gate still require observed evidence.
