<#
.SYNOPSIS
    Generates or rotates the SentinelPulse MSI builder-to-backend key.
.DESCRIPTION
    The generated key authenticates the Windows MSI runner to the local Go
    backend. It is not a code-signing certificate, enrollment token, or device
    credential. The key is written only to deployment/.env, which is ignored by
    source control, and the backend must be restarted after rotation.
#>
[CmdletBinding()]
param(
    [string]$ProjectRoot = "",
    [switch]$Rotate
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $base = $PSScriptRoot
    if (-not $base -and $MyInvocation.MyCommand.Path) { $base = Split-Path -Parent $MyInvocation.MyCommand.Path }
    if (-not $base) { $base = (Get-Location).Path }
    $ProjectRoot = (Resolve-Path (Join-Path $base "..\..")).Path
}
$deploymentDir = Join-Path $ProjectRoot "deployment"
$envFile = Join-Path $deploymentDir ".env"
if (-not (Test-Path $deploymentDir)) { throw "Deployment directory not found: $deploymentDir" }

$existing = $null
if (Test-Path $envFile) {
    $existingLine = Get-Content $envFile | Where-Object { $_ -match '^MSI_BUILDER_KEY=' } | Select-Object -First 1
    if ($existingLine) { $existing = ($existingLine -replace '^MSI_BUILDER_KEY=', '').Trim().Trim('"') }
}
if ($existing -and -not $Rotate) {
    Write-Output "MSI_BUILDER_KEY already exists in deployment\.env. Use -Rotate to replace it."
    Write-Output $existing
    exit 0
}

$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$key = [Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', ''
$lines = @()
if (Test-Path $envFile) { $lines = @(Get-Content $envFile | Where-Object { $_ -notmatch '^MSI_BUILDER_KEY=' }) }
$lines += "MSI_BUILDER_KEY=$key"
$lines | Set-Content -Path $envFile -Encoding ascii

Write-Output "Generated MSI_BUILDER_KEY and stored it in deployment\.env."
Write-Output "Restart the backend and restart the SentinelPulse MSI Builder scheduled task before queueing a build."
Write-Output "This key authenticates only the builder runner; it does not sign MSI files or enroll agents."
Write-Output $key
