#requires -RunAsAdministrator
[CmdletBinding()]
param(
    [string]$AgentVersion = "2.4.3"
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\")).Path
$msi = Join-Path $projectRoot ("agent\artifacts\SentinelPulseAgent-{0}-x64.msi" -f $AgentVersion)
$log = Join-Path $projectRoot ("agent\artifacts\SentinelPulseAgent-{0}-install-elevated.log" -f $AgentVersion)

if (-not (Test-Path $msi)) { throw "MSI not found: $msi" }

$service = Get-Service -Name "SentinelPulseAgent" -ErrorAction SilentlyContinue
if ($service) {
    Stop-Service -Name "SentinelPulseAgent" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    $serviceCim = Get-CimInstance Win32_Service -Filter "Name='SentinelPulseAgent'"
    if ($serviceCim.State -ne "Stopped" -and $serviceCim.ProcessId -gt 0) {
        Stop-Process -Id $serviceCim.ProcessId -Force -ErrorAction Stop
        Start-Sleep -Seconds 2
    }
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

Write-Output "MSI exit code: $($process.ExitCode)"
Write-Output "API base URL: $([Environment]::GetEnvironmentVariable('SENTINELPULSE_API_BASE_URL', 'Machine'))"
Write-Output "Enrollment token configured: $(-not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable('SENTINELPULSE_ENROLLMENT_TOKEN', 'Machine')))"
Get-Service -Name "SentinelPulseAgent" | Select-Object Name, Status, StartType
