# SentinelPulse Signed MSI Build Workflow

## Purpose

The dashboard now queues versioned SentinelPulse Agent MSI builds from the existing **Enrollment & Installers** page. The Linux Docker backend owns authorization, tenant isolation, build-job state, and artifact metadata. A Windows host-side runner performs the Windows-only operations: `.NET publish`, WiX v4 packaging, Authenticode signing, SHA-256 generation, and manifest reporting.

The private code-signing key never enters the browser, Docker container, API payload, MSI artifact, or build manifest. The backend receives only certificate metadata such as subject, thumbprint, expiry, and trust status.

## Signing modes

| Mode | Intended use | Windows trust |
|---|---|---|
| `trusted` | Production distribution | Requires an organization’s real Code Signing certificate with private key and a chain trusted by the build host. The dashboard blocks this mode while the runner reports no trusted certificate. |
| `self_signed_test` | Internal development and lab validation | The runner may generate `CN=SentinelPulse Local Test Signing` automatically. The MSI is signed, but Windows still treats the publisher as untrusted unless the certificate is separately installed as trusted on the target machines. |
| `unsigned_test` | Packaging troubleshooting only | No Authenticode signature. The dashboard labels the build as unsigned and it must not be distributed as a production installer. |

The platform cannot automatically mint a trusted public certificate. Trust must come from a certificate issued for the organization or an organization-controlled internal PKI.

## One-time local runner setup

Run an elevated PowerShell window from the repository root. For internal testing, the following command provisions the random runner key, registers the scheduled task, and restarts the existing backend with the shared artifact mount:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File `
  .\agent\packaging\install-msi-builder.ps1 `
  -SigningMode self_signed_test
```

For production signing, first install the organization’s Code Signing certificate in `Cert:\LocalMachine\My` or `Cert:\CurrentUser\My`, then use its thumbprint:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File `
  .\agent\packaging\install-msi-builder.ps1 `
  -SigningMode trusted `
  -CertificateThumbprint 'CERTIFICATE_THUMBPRINT'
```

The script stores `MSI_BUILDER_KEY` in the ignored `deployment\.env` file and registers **SentinelPulse MSI Builder** as a high-privilege startup task. The random builder key authenticates the host runner to the backend; it is not an enrollment token and is not a signing certificate.

## Dashboard flow

After the first-run setup and administrator login:

1. Open **Enrollment & Installers**.
2. Confirm that **Windows runner online** and the certificate status are visible.
3. Enter a semantic agent version such as `2.4.2`.
4. Select **Trusted certificate (production)**, **Self-signed test certificate (untrusted)**, or **Unsigned test MSI**.
5. Click **Build & Sign MSI**.
6. Wait for the job to become `succeeded`.
7. Click **Download MSI**. The artifact filename, signing mode, checksum, and certificate metadata are retained in build history.

The backend serves downloads only after verifying the authenticated admin belongs to the same tenant that created the build job. Viewer users cannot configure signing, queue builds, or download artifacts.

## Required Windows prerequisites

The Windows runner requires .NET 8 SDK/runtime, WiX v4 CLI, and `signtool.exe` from the Windows SDK. The current connected host has WiX v4 and PowerShell Authenticode cmdlets available, but the final local smoke test must confirm that `dotnet.exe` and `signtool.exe` are installed and available. The existing 2.4.2 MSI is currently `NotSigned`; it is not retroactively signed by the new workflow.

## Artifact integrity

For each completed build, `build-msi.ps1` writes:

- `SentinelPulseAgent-<version>-x64.msi`
- `SentinelPulseAgent-<version>-x64.msi.sha256`
- `SentinelPulseAgent-<version>-x64.msi.manifest.json`

The manifest records the semantic version, SHA-256, build time, signing mode, Authenticode status, certificate subject/thumbprint/expiry, trust result, and file size. Validate a downloaded production installer with:

```powershell
Get-AuthenticodeSignature .\SentinelPulseAgent-<version>-x64.msi | Format-List
Get-FileHash .\SentinelPulseAgent-<version>-x64.msi -Algorithm SHA256
```

A self-signed or unsigned build must never be described as a trusted production installer.
