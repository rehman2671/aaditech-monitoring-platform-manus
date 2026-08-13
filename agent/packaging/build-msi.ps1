<#
.SYNOPSIS
    Builds the versioned SentinelPulse Agent MSI with WiX Toolset v4.
.DESCRIPTION
    Publishes the .NET 8 agent for win-x64 and generates a WiX v4 component
    fragment for the complete flat publish directory before linking the MSI.
#>
[CmdletBinding()]
param(
    [string]$Configuration = "Release",
    [string]$AgentVersion = "2.4.1",
    [string]$AgentSemVer = $AgentVersion
)

$ErrorActionPreference = "Stop"
$packagingDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$agentDir = Resolve-Path (Join-Path $packagingDir "..")
$projectFile = Join-Path $agentDir "src\SentinelPulse.Agent\SentinelPulse.Agent.csproj"
$publishDir = Join-Path $agentDir "publish"
$artifactsDir = Join-Path $agentDir "artifacts"
$wxsFile = Join-Path $packagingDir "sentinelpulse-agent.wxs"
$payloadWxsFile = Join-Path $artifactsDir "agent-payload.generated.wxs"
$msiFile = Join-Path $artifactsDir ("SentinelPulseAgent-{0}-x64.msi" -f $AgentSemVer)
$wixExe = Join-Path $env:USERPROFILE ".dotnet\tools\wix.exe"

if (-not (Test-Path $projectFile)) { throw "Agent project not found: $projectFile" }
if (-not (Test-Path $wxsFile)) { throw "WiX source not found: $wxsFile" }
if (-not (Test-Path $wixExe)) { throw "WiX v4 CLI not found at $wixExe. Install with: dotnet tool install --global wix --version 4.0.4" }

New-Item -ItemType Directory -Force $publishDir, $artifactsDir | Out-Null
Remove-Item (Join-Path $publishDir "*") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $payloadWxsFile -Force -ErrorAction SilentlyContinue

Write-Host "Publishing SentinelPulse Agent $AgentSemVer for win-x64..."
dotnet publish $projectFile `
    --configuration $Configuration `
    --runtime win-x64 `
    --self-contained true `
    --output $publishDir `
    --nologo
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed with exit code $LASTEXITCODE" }

$publishedFiles = @(Get-ChildItem $publishDir -File | Where-Object { $_.Name -ne "SentinelPulse.Agent.exe" } | Sort-Object FullName)
if ($publishedFiles.Count -eq 0) { throw "No published payload files were found in $publishDir" }

# WiX v4 core does not accept the WiX v5/HeatWave Files element here. Generate
# an explicit component for each flat self-contained publish file instead.
$xml = [System.Text.StringBuilder]::new()
[void]$xml.AppendLine('<?xml version="1.0" encoding="UTF-8"?>')
[void]$xml.AppendLine('<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">')
[void]$xml.AppendLine('  <Fragment>')
[void]$xml.AppendLine('    <ComponentGroup Id="AgentPayloadGroup" Directory="AGENTFOLDER">')
$index = 0
foreach ($file in $publishedFiles) {
    $index++
    $componentId = "PayloadComponent{0:D4}" -f $index
    $fileId = "PayloadFile{0:D4}" -f $index
    $source = [System.Security.SecurityElement]::Escape($file.FullName)
    [void]$xml.AppendLine(('      <Component Id="{0}" Guid="*">' -f $componentId))
    [void]$xml.AppendLine(('        <File Id="{0}" Source="{1}" KeyPath="yes" />' -f $fileId, $source))
    [void]$xml.AppendLine('      </Component>')
}
[void]$xml.AppendLine('    </ComponentGroup>')
[void]$xml.AppendLine('  </Fragment>')
[void]$xml.AppendLine('</Wix>')
$xml.ToString() | Set-Content -Path $payloadWxsFile -Encoding utf8

Write-Host "Building WiX v4 MSI with $($publishedFiles.Count) payload files..."
& $wixExe build `
    -arch x64 `
    -ext WixToolset.Util.wixext `
    -d "AgentVersion=$AgentVersion.0" `
    -d "AgentSemVer=$AgentSemVer" `
    -d "PublishDir=$publishDir" `
    $wxsFile `
    $payloadWxsFile `
    -o $msiFile
if ($LASTEXITCODE -ne 0) { throw "WiX v4 build failed with exit code $LASTEXITCODE" }

$hash = (Get-FileHash -Algorithm SHA256 -Path $msiFile).Hash
$checksumFile = "$msiFile.sha256"
"$hash  $(Split-Path -Leaf $msiFile)" | Set-Content -Encoding ascii $checksumFile

Write-Host "MSI: $msiFile"
Write-Host "SHA256: $hash"
