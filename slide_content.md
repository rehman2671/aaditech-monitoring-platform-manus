# SentinelPulse Windows MSI Packaging & Service Deployment Architecture

## Slide 1: Enterprise Windows Fleet Monitoring Demands Native Service Architecture and Unattended MSI Deployment
- Windows endpoints require background telemetry collection operating with LocalSystem privileges without user session dependency.
- Traditional script-based deployments suffer from credential drift, broken paths, and untracked service lifecycles across large fleets.
- SentinelPulse combines a .NET 8 Worker Service collector with WiX v4 MSI packaging to guarantee repeatable, cryptographically secure installations.
- Automated service control manages installation, automatic startup, and clean uninstallation across enterprise Active Directory and Intune environments.

## Slide 2: WMI Collectors and SQLite Offline Buffering Ensure Resilient Telemetry Without Data Loss
- The agent gathers CPU, RAM, GPU, motherboard, disk SMART metrics, and Windows Image health (DISM/SFC) via CIM and WMI queries.
- When network partitions or ingestion outages occur, telemetry is safely queued in a local encrypted SQLite buffer with exponential backoff retries.
- Cryptographic credential protection via Windows DPAPI safeguards enrollment tokens and local API keys against unauthorized access.
- Scheduled telemetry flushes ensure zero data loss and automated recovery once connectivity is restored to the ingestion gateway.

## Slide 3: WiX v4 Declarative Packaging Guarantees Predictable Enterprise Installs and Upgrades
- Declarative `.wxs` definitions establish program files layout, ProgramData configuration directories, and registry diagnostic tracking.
- Major upgrade rules prevent accidental downgrades while supporting seamless minor and patch version transitions.
- The installation workflow automatically registers `SentinelPulseAgent` as an auto-start Windows Service with failure recovery controls.
- Component-based uninstallation cleanly removes binaries and registry markers while preserving operational audit logs.

## Slide 4: GitHub Actions Windows CI/CD Pipeline Automates Versioned Builds and Smoke Testing
- Tagged releases trigger a Windows-native runner workflow that compiles and tests the C# agent codebase in Release configuration.
- The pipeline compiles versioned `.msi` packages using the WiX CLI with preprocessor variables for semantic versioning.
- Automated installation smoke tests verify service registration, status, and clean uninstallation on a clean Windows runner.
- Generated installer binaries are automatically uploaded as signed GitHub release assets ready for enterprise distribution.
