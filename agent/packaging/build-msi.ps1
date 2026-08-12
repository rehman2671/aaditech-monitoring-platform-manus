<#
.SYNOPSIS
    Builds the SentinelPulse Agent .msi installer using WiX Toolset.
.DESCRIPTION
    Requires WiX Toolset installed on a Windows build runner.
#>

param(
    [string]$Configuration = "Release"
)

Write-Host "Starting SentinelPulse Agent .msi build pipeline..."
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Compile WiX source
& "candle.exe" "$projectDir\sentinelpulse-agent.wxs" -out "$projectDir\sentinelpulse-agent.wixobj"
if ($LASTEXITCODE -ne 0) {
    Write-Error "WiX candle compilation failed."
    exit $LASTEXITCODE
}

# Link WiX object to MSI
& "light.exe" "$projectDir\sentinelpulse-agent.wixobj" -out "$projectDir\SentinelPulseAgent-Setup.msi"
if ($LASTEXITCODE -ne 0) {
    Write-Error "WiX light linking failed."
    exit $LASTEXITCODE
}

Write-Host "Successfully generated: $projectDir\SentinelPulseAgent-Setup.msi"
