<#
.SYNOPSIS
    Automated SentinelPulse Agent installer and enroller.
.DESCRIPTION
    Installs the MSI, configures machine environment variables for API base URL,
    endpoint ID, and optional enrollment token, then starts the service.
#>
[CmdletBinding()]
param(
    [string]$AgentVersion = "2.4.4",
    [string]$EnrollmentToken,
    [string]$ApiBaseUrl = "http://127.0.0.1:8080",
    [string]$EndpointId = $env:COMPUTERNAME
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\")).Path
$msi = Join-Path $projectRoot ("agent\artifacts\SentinelPulseAgent-{0}-x64.msi" -f $AgentVersion)
$log = Join-Path $projectRoot ("agent\artifacts\SentinelPulseAgent-{0}-install.log" -f $AgentVersion)

if (-not (Test-Path $msi)) {
    # Fallback to any available MSI in artifacts
    $found = Get-ChildItem (Join-Path $projectRoot "agent\artifacts") -Filter "*.msi" | Select-Object -First 1
    if ($found) { $msi = $found.FullName } else { throw "MSI installer not found in artifacts." }
}

[Environment]::SetEnvironmentVariable("SENTINELPULSE_API_BASE_URL", $ApiBaseUrl.TrimEnd('/'), "Machine")
[Environment]::SetEnvironmentVariable("SENTINELPULSE_ENDPOINT_ID", $EndpointId, "Machine")

if (-not [string]::IsNullOrWhiteSpace($EnrollmentToken)) {
    if ($EnrollmentToken -notmatch '^sp-enrol-[0-9a-fA-F-]{36}$') {
        throw "Invalid enrollment token format. Must start with 'sp-enrol-' and contain a UUID."
    }
    [Environment]::SetEnvironmentVariable("SENTINELPULSE_ENROLLMENT_TOKEN", $EnrollmentToken, "Machine")
}

$service = Get-Service -Name "SentinelPulseAgent" -ErrorAction SilentlyContinue
if ($service) {
    Stop-Service -Name "SentinelPulseAgent" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

$process = Start-Process -FilePath "msiexec.exe" -ArgumentList @(
    "/i", $msi, "/qn", "/norestart", "/l*v", $log
) -Wait -PassThru

if ($process.ExitCode -notin @(0, 3010)) {
    throw "MSI installation failed with exit code $($process.ExitCode). See $log"
}

Set-Service -Name "SentinelPulseAgent" -StartupType Automatic
Start-Service -Name "SentinelPulseAgent"
Start-Sleep -Seconds 5

Write-Output "Installation completed successfully."
Write-Output "API base URL: $([Environment]::GetEnvironmentVariable('SENTINELPULSE_API_BASE_URL', 'Machine'))"
Write-Output "Endpoint ID: $([Environment]::GetEnvironmentVariable('SENTINELPULSE_ENDPOINT_ID', 'Machine'))"
Write-Output "Token configured: $(-not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable('SENTINELPULSE_ENROLLMENT_TOKEN', 'Machine')))"
Get-Service -Name "SentinelPulseAgent" | Select-Object Name, Status, StartType
