# Windows MSI Packaging and CI/CD Release Architecture

## Overview
SentinelPulse packages the native .NET 8 Windows Service Agent into a production-grade MSI installer using WiX Toolset v4 [1]. Because WiX v4 relies on Windows Installer XML technologies and Windows APIs, MSI compilation must execute on a Windows runner (`windows-latest`).

---

## GitHub Actions Release Workflow (`.github/workflows/release-msi.yml`)

The production release workflow supports both automated tag pushes (`v*`) and manual operator triggers (`workflow_dispatch`) [2]:

```yaml
name: Windows Agent Release & MSI Packaging

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      agent_version:
        description: 'Agent version tag (e.g. v2.4.1)'
        required: true
        default: 'v2.4.1'

jobs:
  build-msi:
    name: Build WiX v4 MSI on Windows Runner
    runs-on: windows-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup .NET 8 SDK
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'

      - name: Install WiX v4 Global Tool
        run: dotnet tool install --global wix --version 4.0.4

      - name: Build C# Windows Agent
        run: |
          cd agent/src/SentinelPulse.Agent
          dotnet publish -c Release -r win-x64 --self-contained true -o ../../publish/agent

      - name: Compile WiX v4 MSI Installer
        run: |
          cd agent/packaging
          wix extension add WixToolset.NetFx.wixext
          $versionTag = "${{ github.event.inputs.agent_version }}"
          if (-not $versionTag) { $versionTag = "${{ github.ref_name }}" }
          if (-not $versionTag) { $versionTag = "v2.4.1" }
          wix build sentinelpulse-agent.wxs -ext WixToolset.NetFx.wixext -out ../../publish/SentinelPulse-Agent-$versionTag.msi

      - name: Generate SHA-256 Checksum
        run: |
          cd publish
          $versionTag = "${{ github.event.inputs.agent_version }}"
          if (-not $versionTag) { $versionTag = "${{ github.ref_name }}" }
          if (-not $versionTag) { $versionTag = "v2.4.1" }
          Get-FileHash SentinelPulse-Agent-$versionTag.msi -Algorithm SHA256 | Select-Object -ExpandProperty Hash | Out-File -Encoding ascii SentinelPulse-Agent-$versionTag.msi.sha256

      - name: Upload Release Artifacts
        uses: softprops/action-gh-release@v2
        if: startsWith(github.ref, 'refs/tags/v')
        with:
          files: |
            publish/SentinelPulse-Agent-*.msi
            publish/SentinelPulse-Agent-*.msi.sha256
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## References

[1] WiX Toolset v4 Documentation: https://wixtoolset.org/docs/wix4/
[2] GitHub Actions Workflow Syntax for `workflow_dispatch`: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#workflow_dispatch
