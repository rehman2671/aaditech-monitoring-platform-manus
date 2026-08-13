# SentinelPulse Windows CI/CD & MSI Packaging Pipeline

## Overview
SentinelPulse packages the native .NET 8 Windows Service Agent into a production-grade MSI installer using WiX Toolset v4. Because WiX v4 relies on Windows Installer XML technologies and Windows APIs, MSI compilation must execute on a Windows runner (`windows-latest`).

---

## GitHub Actions Workflow (`.github/workflows/windows-release.yml`)

```yaml
name: Windows Agent Release

on:
  push:
    tags:
    - 'v*'

jobs:
  build-msi:
    runs-on: windows-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup .NET 8
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'

      - name: Install WiX Toolset v4
        run: dotnet tool install --global wix --version 4.0.4

      - name: Publish .NET Agent (win-x64)
        run: |
          cd agent/src/SentinelPulse.Agent
          dotnet publish -c Release -r win-x64 --self-contained true -o ..\..\publish

      - name: Build MSI Installer
        run: |
          cd agent/packaging
          wix build -arch x64 \
            -dAgentVersion=2.4.1.0 \
            -dAgentSemVer=2.4.1 \
            -dPublishDir=..\publish \
            sentinelpulse-agent.wxs \
            -o ..\..\artifacts\SentinelPulseAgent-2.4.1-x64.msi

      - name: Generate SHA-256 Checksum
        run: |
          cd artifacts
          certutil -hashfile SentinelPulseAgent-2.4.1-x64.msi SHA256 > SentinelPulseAgent-2.4.1-x64.msi.sha256

      - name: Upload Release Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: windows-msi-artifact
          path: artifacts/
