<#
.SYNOPSIS
    Configures a SentinelPulse Windows agent for local enrollment.
.DESCRIPTION
    Run from an elevated PowerShell window on the endpoint. If no token is
    supplied, the script prompts without echoing it. The token is stored only
    in the machine environment and is never printed.
#>
[CmdletBinding()]
param(
    [string]$EnrollmentToken,
    [string]$ApiBaseUrl = "http://127.0.0.1:8080",
    [string]$EndpointId = $env:COMPUTERNAME,
    [string]$ServiceName = "SentinelPulseAgent"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($EnrollmentToken)) {
    $secureToken = Read-Host -Prompt "SentinelPulse enrollment token" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    try {
        $EnrollmentToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

if ([string]::IsNullOrWhiteSpace($EnrollmentToken)) { throw "An enrollment token is required." }
if ([string]::IsNullOrWhiteSpace($EndpointId)) { throw "EndpointId cannot be empty." }

[Environment]::SetEnvironmentVariable("SENTINELPULSE_API_BASE_URL", $ApiBaseUrl.TrimEnd('/'), "Machine")
[Environment]::SetEnvironmentVariable("SENTINELPULSE_ENDPOINT_ID", $EndpointId, "Machine")
[Environment]::SetEnvironmentVariable("SENTINELPULSE_ENROLLMENT_TOKEN", $EnrollmentToken, "Machine")

$EnrollmentToken = $null
if (-not (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) {
    throw "Windows service '$ServiceName' was not found. Install the SentinelPulse MSI first."
}

Set-Service -Name $ServiceName -StartupType Automatic
Restart-Service -Name $ServiceName -Force
Start-Sleep -Seconds 3

Get-Service -Name $ServiceName | Select-Object Name, Status, StartType
Write-Output "Agent enrollment configuration was written for endpoint '$EndpointId'. The token value was not displayed."
