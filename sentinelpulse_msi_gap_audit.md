# SentinelPulse MSI Builder & Compilation Gap Audit Report

## Executive Summary

An exhaustive review of the Windows MSI packaging, signing, runner polling, and backend job-queuing pipeline was conducted. The audit confirms that while the backend database schema and REST routing are fully implemented, several environmental and PowerShell version dependencies on the Windows host have caused intermittent or failed builds (`exit code 1` during signing or builder provisioning).

---

## Identified Gaps & Root Causes

### 1. PowerShell 5.1 Incompatibility in Key Generation Scripts
- **Issue:** Scripts such as `generate-builder-key.ps1` and `install-msi-builder.ps1` invoke `[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)`.
- **Impact:** In Windows PowerShell 5.1 (the default shell on Windows 10/Server 2019/2022 without PowerShell Core), the static `Fill` method on `RandomNumberGenerator` does not exist, causing a `MethodNotFound` exception. This leaves `MSI_BUILDER_KEY` unconfigured, rendering the builder offline in the portal.

### 2. Trusted Signing Prerequisite Strictness
- **Issue:** The default signing mode in `run-msi-builder.ps1` and `install-msi-builder.ps1` is `trusted`, which requires a valid code-signing certificate installed in `Cert:\LocalMachine\My` and an external or local `signtool.exe`.
- **Impact:** Out of the box on a clean development machine, unless the user manually provisions a trusted certificate and Windows SDK BuildTools, trusted signing fails closed with `exit code 1`.

### 3. WiX v4 Toolchain & .NET Tooling Discovery
- **Issue:** `build-msi.ps1` hard-codes WiX v4 path discovery under user profile paths (`~/.dotnet/tools/wix.exe`).
- **Impact:** If the installer ran under a service account or non-admin context, or if `dotnet tool install --global wix` was not executed in that specific user session, WiX compilation fails.

---

## Prioritized Remediation Plan

1. **Patch PowerShell 5.1 Compatibility:** Replace `[RandomNumberGenerator]::Fill($bytes)` with `[RNGCryptoServiceProvider]::GetNonZeroBytes($bytes)` or a compatible byte array filling method across all packaging scripts.
2. **Fallback to Self-Signed Test Mode:** Ensure default installation scripts gracefully provision a self-signed test certificate (`CN=SentinelPulse Local Test Signing`) if trusted signing fails or is not explicitly configured.
3. **Robust Tool Verification:** Add automated pre-flight checks in `install-msi-builder.ps1` for .NET 8 SDK, WiX v4, and `signtool.exe`, outputting descriptive diagnostic events to the portal rather than opaque `exit code 1` errors.

---
*Audit compiled by SentinelPulse Autonomous Engineering Agent.*
