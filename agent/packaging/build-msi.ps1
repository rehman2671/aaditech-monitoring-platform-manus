<#
.SYNOPSIS
    Builds a versioned SentinelPulse Agent MSI with WiX Toolset v4.
.DESCRIPTION
    Publishes the .NET 8 agent for win-x64, optionally signs the executable and
    MSI with Authenticode, then writes a checksum and machine-readable manifest.

    Production signing requires a certificate with a private key and Code Signing
    EKU already provisioned in the Windows certificate store. The self_signed_test
    mode is explicitly untrusted and exists only for internal testing.
#>
[CmdletBinding()]
param(
    [string]$Configuration = "Release",
    [string]$AgentVersion = "2.4.2",
    [string]$AgentSemVer = $AgentVersion,
    [ValidateSet("trusted", "self_signed_test", "unsigned_test")]
    [string]$SignMode = "unsigned_test",
    [string]$CertificateThumbprint = $env:SENTINELPULSE_SIGNING_CERT_THUMBPRINT,
    [string]$PfxPath = $env:SIGNING_CERT_PFX_PATH,
    [string]$PfxPassword = $env:SIGNING_CERT_PASSWORD,
    [string]$SignToolPath = "",
    [string]$TimestampUrl = "http://timestamp.digicert.com",
    [switch]$NoRestore
)

$ErrorActionPreference = "Stop"
$packagingDir = $PSScriptRoot
if (-not $packagingDir -and $MyInvocation.MyCommand.Path) { $packagingDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $packagingDir) { $packagingDir = (Get-Location).Path }
$packagingDir = (Resolve-Path $packagingDir).Path
$agentDir = (Resolve-Path (Join-Path $packagingDir "..")).Path
$projectFile = Join-Path $agentDir "src\SentinelPulse.Agent\SentinelPulse.Agent.csproj"
$publishDir = Join-Path $agentDir "publish"
$artifactsDir = Join-Path $agentDir "artifacts"
if (-not (Test-Path $artifactsDir)) {
    New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null
}
$wxsFile = Join-Path $packagingDir "sentinelpulse-agent.wxs"
$payloadWxsFile = Join-Path $artifactsDir "agent-payload.generated.wxs"
$msiFile = Join-Path $artifactsDir ("SentinelPulseAgent-{0}-x64.msi" -f $AgentSemVer)
$checksumFile = "$msiFile.sha256"
$manifestFile = "$msiFile.manifest.json"
$wixExe = if ($env:USERPROFILE) { Join-Path $env:USERPROFILE ".dotnet\tools\wix.exe" } else { "C:\Users\Admin\.dotnet\tools\wix.exe" }

function Resolve-SignTool {
    param([string]$ExplicitPath)
    if ($ExplicitPath) {
        if (-not (Test-Path $ExplicitPath)) { throw "signtool.exe not found at $ExplicitPath" }
        return (Resolve-Path $ExplicitPath).Path
    }

    $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    $roots = @()
    if (${env:ProgramFiles(x86)}) {
        $roots += (Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin")
        $roots += (Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\App Certification Kit")
    }
    if ($env:ProgramFiles) {
        $roots += (Join-Path $env:ProgramFiles "Windows Kits\10\bin")
        $roots += (Join-Path $env:ProgramFiles "Windows Kits\10\App Certification Kit")
    }
    if ($env:WindowsSdkDir) { $roots += (Join-Path $env:WindowsSdkDir "bin") }
    if ($env:WindowsSdkDir -and $env:WindowsSDKVersion) { $roots += (Join-Path (Join-Path $env:WindowsSdkDir $env:WindowsSDKVersion) "bin") }
    $workspaceTools = Join-Path $packagingDir "..\tools\windows-sdk"
    if (Test-Path $workspaceTools) { $roots += $workspaceTools }
    $roots = $roots | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

    $candidate = Get-ChildItem -Path $roots -Recurse -Filter "signtool.exe" -File -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if (-not $candidate) {
        Write-Warning "signtool.exe was not found in Windows Kits. Continuing without Authenticode signing."
        return $null
    }
    return $candidate.FullName
}

function Has-CodeSigningEku {
    param([System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate)
    return @($Certificate.EnhancedKeyUsageList | Where-Object { $_.ObjectId.Value -eq "1.3.6.1.5.5.7.3.3" }).Count -gt 0
}

function Load-PfxCodeSigningCertificate {
    param([string]$Path, [string]$Password)
    if ([string]::IsNullOrWhiteSpace($Path)) { throw "SIGNING_CERT_PFX_PATH is required for PFX signing." }
    if (-not (Test-Path $Path)) { throw "Signing certificate PFX was not found: $Path" }
    if ([string]::IsNullOrWhiteSpace($Password)) { throw "SIGNING_CERT_PASSWORD is required when SIGNING_CERT_PFX_PATH is configured." }
    $securePassword = ConvertTo-SecureString $Password -AsPlainText -Force
    $pfxData = Get-PfxData -FilePath $Path -Password $securePassword
    $certificate = @($pfxData.EndEntityCertificates | Select-Object -First 1)[0]
    if (-not $certificate) { throw "The PFX does not contain an end-entity certificate." }
    if (-not $certificate.HasPrivateKey) { throw "The PFX certificate has no private key." }
    if (-not (Has-CodeSigningEku $certificate)) { throw "The PFX certificate is not a Code Signing certificate." }
    if ($certificate.NotAfter -le (Get-Date)) { throw "The PFX certificate is expired." }
    return $certificate
}

function Find-CodeSigningCertificate {
    param([string]$Thumbprint)
    $normalized = ($Thumbprint -replace "\s", "").ToUpperInvariant()
    if (-not $normalized) { throw "A certificate thumbprint is required for trusted signing." }

    foreach ($storePath in @("Cert:\LocalMachine\My", "Cert:\CurrentUser\My")) {
        $certificate = Get-ChildItem $storePath -ErrorAction SilentlyContinue |
            Where-Object { $_.Thumbprint -and ($_.Thumbprint -replace "\s", "").ToUpperInvariant() -eq $normalized } |
            Select-Object -First 1
        if ($certificate) {
            if (-not $certificate.HasPrivateKey) { throw "Certificate $normalized has no private key." }
            if (-not (Has-CodeSigningEku $certificate)) { throw "Certificate $normalized is not a Code Signing certificate." }
            if ($certificate.NotAfter -le (Get-Date)) { throw "Certificate $normalized is expired." }
            return $certificate
        }
    }
    throw "Code signing certificate $normalized was not found in LocalMachine or CurrentUser certificate stores."
}

function Ensure-TestSigningCertificate {
    $subject = "CN=SentinelPulse Local Test Signing"
    foreach ($storePath in @("Cert:\LocalMachine\My", "Cert:\CurrentUser\My")) {
        $certificate = Get-ChildItem $storePath -ErrorAction SilentlyContinue |
            Where-Object { $_.Subject -eq $subject -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) } |
            Sort-Object NotAfter -Descending | Select-Object -First 1
        if ($certificate) { return $certificate }
    }

    Write-Warning "Creating an explicitly untrusted self-signed test certificate. This does not establish Windows publisher trust."
    try {
        return New-SelfSignedCertificate `
            -Type CodeSigningCert `
            -Subject $subject `
            -FriendlyName "SentinelPulse Local Test Signing (UNTRUSTED)" `
            -CertStoreLocation "Cert:\LocalMachine\My" `
            -NotAfter (Get-Date).AddYears(3)
    } catch {
        Write-Warning "LocalMachine store access denied; falling back to Cert:\CurrentUser\My."
        return New-SelfSignedCertificate `
            -Type CodeSigningCert `
            -Subject $subject `
            -FriendlyName "SentinelPulse Local Test Signing (UNTRUSTED)" `
            -CertStoreLocation "Cert:\CurrentUser\My" `
            -NotAfter (Get-Date).AddYears(3)
    }
}

function Get-CertificateTrust {
    param([System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate)
    if (-not $Certificate -or $Certificate.Subject -eq $Certificate.Issuer) { return $false }
    $chain = [System.Security.Cryptography.X509Certificates.X509Chain]::new()
    try {
        $chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::NoCheck
        return $chain.Build($Certificate)
    } finally {
        $chain.Dispose()
    }
}

function Sign-Binary {
    param(
        [string]$Path,
        [string]$Tool,
        [System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate,
        [string]$Timestamp,
        [string]$SigningPfxPath,
        [string]$SigningPfxPassword
    )
    $arguments = @("sign", "/fd", "SHA256")
    if ($SigningPfxPath) {
        $arguments += @("/f", $SigningPfxPath, "/p", $SigningPfxPassword)
    } else {
        $arguments += @("/sha1", $Certificate.Thumbprint)
    }
    if ($Timestamp) { $arguments += @("/tr", $Timestamp, "/td", "SHA256") }
    $arguments += $Path
    & $Tool @arguments
    if ($LASTEXITCODE -ne 0) { throw "Authenticode signing failed for $Path with exit code $LASTEXITCODE" }

    $signature = Get-AuthenticodeSignature -FilePath $Path
    if (-not $signature.SignerCertificate) { throw "Signing completed without a signer certificate for $Path" }
    return $signature
}

if (-not (Test-Path $projectFile)) { throw "Agent project not found: $projectFile" }
if (-not (Test-Path $wxsFile)) { throw "WiX source not found: $wxsFile" }
if (-not (Test-Path $wixExe)) { throw "WiX v4 CLI not found at $wixExe. Install with: dotnet tool install --global wix --version 4.0.4" }

$certificate = $null
$signTool = $null
$certificateTrusted = $false
if ($SignMode -eq "trusted") {
    if ($PfxPath) {
        $certificate = Load-PfxCodeSigningCertificate -Path $PfxPath -Password $PfxPassword
    } else {
        $certificate = Find-CodeSigningCertificate -Thumbprint $CertificateThumbprint
    }
    $certificateTrusted = Get-CertificateTrust -Certificate $certificate
    if (-not $certificateTrusted) { throw "The selected certificate is not trusted by this Windows host; production signing is blocked." }
    $signTool = Resolve-SignTool -ExplicitPath $SignToolPath
    if (-not $signTool) { throw "Trusted signing requires signtool.exe. Install the Windows SDK or set SENTINELPULSE_SIGNTOOL_PATH." }
} elseif ($SignMode -eq "self_signed_test") {
    $certificate = Ensure-TestSigningCertificate
    $certificateTrusted = $false
    $signTool = Resolve-SignTool -ExplicitPath $SignToolPath
}

New-Item -ItemType Directory -Force $publishDir, $artifactsDir | Out-Null
Remove-Item (Join-Path $publishDir "*") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $payloadWxsFile -Force -ErrorAction SilentlyContinue
Remove-Item $msiFile, $checksumFile, $manifestFile -Force -ErrorAction SilentlyContinue

Write-Host "Publishing SentinelPulse Agent $AgentSemVer for win-x64..."
$publishArgs = @(
    "--configuration", $Configuration,
    "--runtime", "win-x64",
    "--self-contained", "true",
    "--output", $publishDir,
    "--nologo"
)
$publishArgs += "--no-restore"
$dotnetExe = if (Test-Path 'C:\Program Files\dotnet\dotnet.exe') { 'C:\Program Files\dotnet\dotnet.exe' } else { (Get-Command dotnet -ErrorAction SilentlyContinue).Source }
if (-not $dotnetExe) { $dotnetExe = "dotnet" }
& $dotnetExe publish $projectFile @publishArgs
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed with exit code $LASTEXITCODE" }

$agentExe = Join-Path $publishDir "SentinelPulse.Agent.exe"
if (-not (Test-Path $agentExe)) { throw "Published agent executable was not found at $agentExe" }
$timestampForBuild = if ($SignMode -eq "self_signed_test") { $null } else { $TimestampUrl }
$agentSignature = $null
if ($certificate -and $signTool) {
    Write-Host "Signing agent executable with mode $SignMode..."
    $agentSignature = Sign-Binary -Path $agentExe -Tool $signTool -Certificate $certificate -Timestamp $timestampForBuild -SigningPfxPath $PfxPath -SigningPfxPassword $PfxPassword
} elseif ($certificate) {
    Write-Host "Skipping executable signing because signtool.exe was not found."
}

$publishedFiles = @(Get-ChildItem $publishDir -File | Where-Object { $_.Name -ne "SentinelPulse.Agent.exe" } | Sort-Object FullName)
if ($publishedFiles.Count -eq 0) { throw "No published payload files were found in $publishDir" }

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

$msiSignature = $null
if ($certificate -and $signTool) {
    Write-Host "Signing MSI with mode $SignMode..."
    $msiSignature = Sign-Binary -Path $msiFile -Tool $signTool -Certificate $certificate -Timestamp $timestampForBuild -SigningPfxPath $PfxPath -SigningPfxPassword $PfxPassword
} elseif ($certificate) {
    Write-Host "Skipping MSI signing because signtool.exe was not found."
}

$hash = (Get-FileHash -Algorithm SHA256 -Path $msiFile).Hash.ToLowerInvariant()
"$hash  $(Split-Path -Leaf $msiFile)" | Set-Content -Encoding ascii $checksumFile
$manifest = [ordered]@{
    schema_version = 1
    artifact_filename = (Split-Path -Leaf $msiFile)
    checksum_filename = (Split-Path -Leaf $checksumFile)
    agent_version = $AgentSemVer
    build_timestamp_utc = (Get-Date).ToUniversalTime().ToString("o")
    sha256 = $hash
    sign_mode = $SignMode
    is_signed = [bool]$msiSignature
    certificate_subject = if ($certificate) { $certificate.Subject } else { $null }
    certificate_thumbprint = if ($certificate) { $certificate.Thumbprint } else { $null }
    certificate_expires_at_utc = if ($certificate) { $certificate.NotAfter.ToUniversalTime().ToString("o") } else { $null }
    certificate_trusted = [bool]$certificateTrusted
    agent_signature_status = if ($agentSignature) { $agentSignature.Status.ToString() } else { "NotSigned" }
    msi_signature_status = if ($msiSignature) { $msiSignature.Status.ToString() } else { "NotSigned" }
    size_bytes = (Get-Item $msiFile).Length
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestFile -Encoding utf8

	Write-Host "MSI: $msiFile"
	Write-Host "SHA256: $hash"
	Write-Host "Manifest: $manifestFile"
	Write-Host "Signing mode: $SignMode; trusted: $certificateTrusted"
	if ($msiSignature) {
		Write-Host "Authenticode MSI Signature Status: $($msiSignature.Status) ($($msiSignature.StatusMessage))" -ForegroundColor Green
	} else {
		Write-Host "Authenticode MSI Signature Status: Unsigned (Test mode or no certificate)" -ForegroundColor Yellow
	}
