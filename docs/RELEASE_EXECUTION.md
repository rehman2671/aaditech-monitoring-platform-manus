# SentinelPulse Release Execution Guide

This document describes how to execute a versioned release of the SentinelPulse Windows Agent `.msi` package via GitHub Actions and verify the generated artifacts.

## Release Process

1. **Tag the Release**:
   Create and push a semantic version tag starting with `v` (e.g., `v2.4.1`):
   ```bash
   git tag v2.4.1
   git push origin v2.4.1
   ```

2. **Automated GitHub Actions Workflow**:
   The workflow defined in `.github/workflows/release-msi.yml` will automatically trigger on the tag push:
   - Spins up a `windows-latest` runner.
   - Installs .NET 8 SDK and WiX v4 tool (`dotnet tool install --global wix --version 4.0.4`).
   - Publishes the C# agent (`SentinelPulse.Agent`) as a self-contained Windows executable.
   - Compiles the WiX installer (`sentinelpulse-agent.wxs`) into `SentinelPulse-Agent-v2.4.1.msi`.
   - Generates a SHA-256 checksum file (`SentinelPulse-Agent-v2.4.1.msi.sha256`).
   - Publishes both files directly to the GitHub Release corresponding to the tag.

3. **Artifact Verification**:
   Download the `.msi` and `.sha256` files from the GitHub release page and verify the integrity locally on Windows:
   ```powershell
   Get-FileHash SentinelPulse-Agent-v2.4.1.msi -Algorithm SHA256
   Get-Content SentinelPulse-Agent-v2.4.1.msi.sha256
   ```
