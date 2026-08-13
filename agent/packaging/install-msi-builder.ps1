<#
.SYNOPSIS
    Installs the SentinelPulse Windows MSI build runner for the local deployment.
.DESCRIPTION
    Generates a random private runner-to-backend key if one does not exist,
    writes it only to the ignored deployment .env file, configures the backend
    container to read the shared artifacts directory, and registers a scheduled
    task that runs the host-side builder at logon/startup.

    This script does not create a trusted code-signing certificate. For trusted
    production MSI builds, install the organization's real Code Signing
    certificate and set SENTINELPULSE_SIGNING_CERT_THUMBPRINT. For internal
    testing, use -SigningMode self_signed_test.
#>
[CmdletBinding()]
param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) "..\..")),
    [ValidateSet("trusted", "self_signed_test", "unsigned_test")]
    [string]$SigningMode = "trusted",
    [string]$CertificateThumbprint = $env:SENTINELPULSE_SIGNING_CERT_THUMBPRINT,
    [string]$ApiBaseUrl = "http://127.0.0.1:8080/api/v1",
    [switch]$SkipDockerRestart
)

$ErrorActionPreference = "Stop"
$packagingDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$runner = Join-Path $packagingDir "run-msi-builder.ps1"
$deploymentDir = Join-Path $ProjectRoot "deployment"
$envFile = Join-Path $deploymentDir ".env"
$configDir = Join-Path $ProjectRoot "agent\config"
$keyFile = Join-Path $configDir "msi-builder.key"
$taskName = "SentinelPulse MSI Builder"
if (-not (Test-Path $runner)) { throw "Runner not found: $runner" }
if (-not (Test-Path $deploymentDir)) { throw "Deployment directory not found: $deploymentDir" }
if ($SigningMode -eq "trusted" -and [string]::IsNullOrWhiteSpace($CertificateThumbprint)) {
    throw "Trusted mode requires -CertificateThumbprint or SENTINELPULSE_SIGNING_CERT_THUMBPRINT. Use -SigningMode self_signed_test for internal testing."
}

function New-BuilderKey {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return ([Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', '')
}

$key = $null
if (Test-Path $envFile) {
    $existing = Get-Content $envFile | Where-Object { $_ -match '^MSI_BUILDER_KEY=' } | Select-Object -First 1
    if ($existing) { $key = $existing.Substring('MSI_BUILDER_KEY='.Length).Trim() }
}
if ([string]::IsNullOrWhiteSpace($key)) { $key = New-BuilderKey }

New-Item -ItemType Directory -Force $configDir | Out-Null
$key | Set-Content -Path $keyFile -Encoding ascii -NoNewline
& icacls.exe $keyFile /inheritance:r /grant:r 'SYSTEM:(F)' 'Administrators:(F)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not protect $keyFile with Windows ACLs." }

$lines = @()
if (Test-Path $envFile) { $lines = @(Get-Content $envFile | Where-Object { $_ -notmatch '^MSI_BUILDER_KEY=' -and $_ -notmatch '^MSI_ARTIFACT_DIR=' }) }
$lines += "MSI_BUILDER_KEY=$key"
$lines += "MSI_ARTIFACT_DIR=/var/lib/sentinelpulse/artifacts"
$lines | Set-Content -Path $envFile -Encoding ascii

$runnerArgs = @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runner,
    '-ApiBaseUrl', $ApiBaseUrl,
    '-SigningMode', $SigningMode
)
if ($CertificateThumbprint) { $runnerArgs += @('-CertificateThumbprint', $CertificateThumbprint) }
$argumentString = ($runnerArgs | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }) -join ' '
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argumentString -WorkingDirectory $packagingDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

if (-not $SkipDockerRestart) {
    Push-Location $deploymentDir
    try {
        $compose = Get-Command docker-compose.exe -ErrorAction SilentlyContinue
        if ($compose) {
            & $compose.Source --env-file $envFile -f (Join-Path $deploymentDir 'docker-compose.yml') up -d --build backend
        } else {
            & docker compose --env-file $envFile -f (Join-Path $deploymentDir 'docker-compose.yml') up -d --build backend
        }
        if ($LASTEXITCODE -ne 0) { throw "Docker backend restart failed with exit code $LASTEXITCODE" }
    } finally { Pop-Location }
}

Write-Output "MSI builder task: $taskName"
Write-Output "Signing mode: $SigningMode"
Write-Output "Builder key: stored in agent\config\msi-builder.key with SYSTEM/Administrators ACLs and mirrored only to ignored deployment\.env for the backend"
Write-Output "Certificate private key: never copied, uploaded, or placed in the scheduled-task command line by this script"
Write-Output "Use the dashboard Enrollment & Installers page to queue a versioned MSI build."
