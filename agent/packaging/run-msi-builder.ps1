<#
.SYNOPSIS
    Runs the SentinelPulse Windows MSI build worker.
.DESCRIPTION
    The Linux Docker backend never compiles or signs Windows binaries. This
    host-side worker authenticates with the backend using a private builder key,
    advertises certificate status, claims queued jobs, runs build-msi.ps1, and
    posts the generated manifest back to the dashboard API.

    The worker does not upload the private key or PFX. Only certificate metadata
    (subject, thumbprint, expiry, and trust result) is reported.
#>
[CmdletBinding()]
param(
    [string]$ApiBaseUrl = "http://127.0.0.1:8080/api/v1",
    [string]$BuilderKey = $env:SENTINELPULSE_MSI_BUILDER_KEY,
    [string]$BuilderId = $env:COMPUTERNAME,
    [ValidateSet("trusted", "self_signed_test", "unsigned_test")]
    [string]$SigningMode = "trusted",
    [string]$CertificateThumbprint = $env:SENTINELPULSE_SIGNING_CERT_THUMBPRINT,
    [string]$PfxPath = $env:SIGNING_CERT_PFX_PATH,
    [string]$PfxPassword = $env:SIGNING_CERT_PASSWORD,
    [string]$SignToolPath = "",
    [int]$PollSeconds = 5,
    [switch]$Once
)

$ErrorActionPreference = "Stop"
$packagingDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$buildScript = Join-Path $packagingDir "build-msi.ps1"
$keyFile = Join-Path $packagingDir "..\config\msi-builder.key"
$deploymentEnvFile = Join-Path $packagingDir "..\..\deployment\.env"
if (-not (Test-Path $buildScript)) { throw "Build script not found: $buildScript" }
if ([string]::IsNullOrWhiteSpace($BuilderKey) -and (Test-Path $keyFile)) { $BuilderKey = (Get-Content -Raw -Path $keyFile).Trim() }
if (Test-Path $deploymentEnvFile) {
    $envLines = Get-Content $deploymentEnvFile
    function Read-DeploymentEnvValue([string]$Name) {
        $line = $envLines | Where-Object { $_ -match ("^" + [regex]::Escape($Name) + "=") } | Select-Object -First 1
        if ($line) { return ($line -replace ("^" + [regex]::Escape($Name) + "="), '').Trim().Trim('"') }
        return $null
    }
    if ([string]::IsNullOrWhiteSpace($BuilderKey)) { $BuilderKey = Read-DeploymentEnvValue 'MSI_BUILDER_KEY' }
    if ([string]::IsNullOrWhiteSpace($CertificateThumbprint)) { $CertificateThumbprint = Read-DeploymentEnvValue 'SENTINELPULSE_SIGNING_CERT_THUMBPRINT' }
    if ([string]::IsNullOrWhiteSpace($PfxPath)) { $PfxPath = Read-DeploymentEnvValue 'SIGNING_CERT_PFX_PATH' }
    if ([string]::IsNullOrWhiteSpace($PfxPassword)) { $PfxPassword = Read-DeploymentEnvValue 'SIGNING_CERT_PASSWORD' }
}
if ([string]::IsNullOrWhiteSpace($BuilderKey)) { throw "MSI builder key is required; set MSI_BUILDER_KEY in deployment/.env or provision agent/config/msi-builder.key." }
if ([string]::IsNullOrWhiteSpace($BuilderId)) { throw "BuilderId is required." }

$base = $ApiBaseUrl.TrimEnd('/')
$headers = @{ "X-SentinelPulse-Builder-Key" = $BuilderKey }
$artifactDir = Join-Path $packagingDir "..\artifacts"
New-Item -ItemType Directory -Force $artifactDir | Out-Null

function Get-TestOrTrustedCertificateMetadata {
    param([string]$Mode, [string]$Thumbprint)
    $certificate = $null
    if ($Mode -eq "trusted") {
        if ([string]::IsNullOrWhiteSpace($Thumbprint)) { throw "SENTINELPULSE_SIGNING_CERT_THUMBPRINT is required for trusted signing." }
        $normalized = ($Thumbprint -replace "\s", "").ToUpperInvariant()
        $certificate = Get-ChildItem Cert:\LocalMachine\My, Cert:\CurrentUser\My -ErrorAction SilentlyContinue |
            Where-Object { $_.Thumbprint -and ($_.Thumbprint -replace "\s", "").ToUpperInvariant() -eq $normalized } |
            Select-Object -First 1
        if (-not $certificate) { throw "Trusted signing certificate $normalized was not found." }
    } elseif ($Mode -eq "self_signed_test") {
        $certificate = Get-ChildItem Cert:\LocalMachine\My, Cert:\CurrentUser\My -ErrorAction SilentlyContinue |
            Where-Object { $_.Subject -eq "CN=SentinelPulse Local Test Signing" -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) } |
            Sort-Object NotAfter -Descending | Select-Object -First 1
    }
    if (-not $certificate) {
        return @{
            certificate_subject = $null
            certificate_thumbprint = $null
            certificate_expires_at = $null
            certificate_trusted = $false
        }
    }

    $trusted = $false
    if ($certificate.Subject -ne $certificate.Issuer) {
        $chain = [System.Security.Cryptography.X509Certificates.X509Chain]::new()
        try {
            $chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::NoCheck
            $trusted = $chain.Build($certificate)
        } finally {
            $chain.Dispose()
        }
    }
    return @{
        certificate_subject = $certificate.Subject
        certificate_thumbprint = $certificate.Thumbprint
        certificate_expires_at = $certificate.NotAfter.ToUniversalTime().ToString("o")
        certificate_trusted = [bool]$trusted
    }
}

function Send-Json {
    param([string]$Method, [string]$Path, [object]$Body = $null)
    $params = @{ Method = $Method; Uri = "$base$Path"; Headers = $headers; UseBasicParsing = $true }
    if ($null -ne $Body) {
        $params.ContentType = "application/json"
        $params.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
    }
    return Invoke-RestMethod @params
}

function Send-Heartbeat {
    $metadata = Get-TestOrTrustedCertificateMetadata -Mode $SigningMode -Thumbprint $CertificateThumbprint
    Send-Json -Method Post -Path "/internal/msi-builder/heartbeat" -Body (@{
        builder_id = $BuilderId
        signing_mode = $SigningMode
        certificate_subject = $metadata.certificate_subject
        certificate_thumbprint = $metadata.certificate_thumbprint
        certificate_expires_at = $metadata.certificate_expires_at
        certificate_trusted = $metadata.certificate_trusted
    }) | Out-Null
}

function Send-JobStatus {
    param([string]$JobId, [string]$Status, [object]$Manifest = $null, [string]$ErrorMessage = $null)
    $body = @{
        job_id = $JobId
        status = $Status
        error_message = $ErrorMessage
        is_signed = $false
        size_bytes = 0
    }
    if ($Manifest) {
        $body.artifact_filename = $Manifest.artifact_filename
        $body.checksum_filename = $Manifest.checksum_filename
        $body.sha256 = $Manifest.sha256
        $body.is_signed = [bool]$Manifest.is_signed
        $body.certificate_subject = $Manifest.certificate_subject
        $body.certificate_thumbprint = $Manifest.certificate_thumbprint
        $body.certificate_expires_at = $Manifest.certificate_expires_at_utc
        $body.certificate_trusted = [bool]$Manifest.certificate_trusted
        $body.size_bytes = [int64]$Manifest.size_bytes
    }
    Send-Json -Method Post -Path "/internal/msi-builder/status" -Body $body | Out-Null
}

function Process-OneJob {
    $response = Send-Json -Method Get -Path "/internal/msi-builder/next"
    if ($null -eq $response.job) { return $false }
    $job = $response.job
    Send-JobStatus -JobId $job.id -Status "running"

    try {
        $arguments = @{
            Configuration = "Release"
            AgentVersion = $job.agent_version
            AgentSemVer = $job.agent_version
            SignMode = $job.sign_mode
        }
        if ($job.sign_mode -eq "trusted") {
            if ($PfxPath) {
                $arguments.PfxPath = $PfxPath
                $arguments.PfxPassword = $PfxPassword
            } elseif ([string]::IsNullOrWhiteSpace($CertificateThumbprint)) {
                throw "Trusted signing requires SIGNING_CERT_PFX_PATH/SIGNING_CERT_PASSWORD or SENTINELPULSE_SIGNING_CERT_THUMBPRINT."
            } else {
                $arguments.CertificateThumbprint = $CertificateThumbprint
            }
        }
        if ($SignToolPath) { $arguments.SignToolPath = $SignToolPath }
        & $buildScript @arguments
        if ($LASTEXITCODE -ne 0) { throw "build-msi.ps1 exited with code $LASTEXITCODE" }

        $manifestPath = Join-Path $artifactDir ("SentinelPulseAgent-{0}-x64.msi.manifest.json" -f $job.agent_version)
        if (-not (Test-Path $manifestPath)) { throw "Build manifest not found: $manifestPath" }
        $manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
        Send-JobStatus -JobId $job.id -Status "succeeded" -Manifest $manifest
        Write-Host "Completed MSI build $($job.agent_version): $($manifest.artifact_filename)"
    } catch {
        $message = $_.Exception.Message
        try { Send-JobStatus -JobId $job.id -Status "failed" -ErrorMessage $message } catch { Write-Warning "Could not report failed MSI job: $($_.Exception.Message)" }
        Write-Error "MSI build $($job.id) failed: $message"
    }
    return $true
}

try {
    Send-Heartbeat
    do {
        $processed = Process-OneJob
        if ($Once) { break }
        if (-not $processed) { Start-Sleep -Seconds ([Math]::Max(2, $PollSeconds)) }
        Send-Heartbeat
    } while ($true)
} catch {
    Write-Error "MSI builder stopped: $($_.Exception.Message)"
    exit 1
}
