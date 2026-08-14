# Local MSI Runner Audit — 2026-08-14

## Verified state

The Windows Docker stack is running with `sentinelpulse_frontend`, `sentinelpulse_backend`, `sentinelpulse_db`, and `sentinelpulse_redis`; the existing `sophos_platform` containers remain running. The backend exposes port 8080 and the frontend exposes port 3001.

The PostgreSQL MSI tables exist. The builder heartbeat row is being updated by `WINDOWS-BUILD-HOST` in `self_signed_test` mode, so the runner is able to authenticate and send heartbeats. The connected host did not have an active `run-msi-builder.ps1` process at audit time.

The live database contained three old MSI jobs in `running` state and one newer job in `pending` state. The running jobs had no completion timestamp, artifact filename, or error message. This confirms that the current failure mode is not simply an offline runner: a job can be claimed and then remain running when build/status reporting fails.

The Windows host has `C:\Program Files\dotnet\dotnet.exe` and `C:\Users\Admin\.dotnet\tools\wix.exe`; the previous direct build produced an MSI successfully. `signtool.exe` was not found on PATH or in the searched Windows Kits directories, and `vswhere.exe` reported no installed Visual Studio product instance. The Visual Studio Installer directory exists, but the Windows SDK signing tool is not currently discoverable.

## Repair requirements

The runner must retry heartbeat and status requests without terminating the worker on transient HTTP failures. Failed build reports must include the server response body. The backend must reclaim stale `running` jobs after a bounded timeout so old claims cannot block the queue. Signing-tool discovery must support explicit Windows SDK paths and clearly distinguish a genuinely signed MSI from an unsigned test artifact.

## Official signing-tool verification

Microsoft Learn confirms that `signtool.exe` is installed as part of the Windows Software Development Kit and is normally located under `C:\Program Files (x86)\Windows Kits\10\bin\<sdk-version>\x64\signtool.exe`. Installing Visual Studio alone is not sufficient unless the Windows SDK/signing tools component is present. The official Windows SDK downloads page provides installer and ISO links for supported releases.

## Additional Microsoft source

Microsoft Artifact Signing guidance confirms that Windows SDK `SignTool.exe` is required (minimum version 10.0.2261.755 for that integration) and separately references the `Microsoft.Windows.SDK.BuildTools` package as an alternative distribution. The local host still has no Windows Kits directory after the bootstrap installer attempt, so the signing tool installation did not complete.

Sources:
- https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool
- https://learn.microsoft.com/en-us/windows/apps/windows-sdk/downloads
- https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations
