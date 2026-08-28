[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$MsiPath,

    [string]$ExePath = "$(if ($env:ProgramW6432) { $env:ProgramW6432 } elseif ($env:ProgramFiles) { $env:ProgramFiles } else { 'C:\Program Files' })\SentinelPulse\Agent\SentinelPulse.Agent.exe"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $MsiPath -PathType Leaf)) {
    throw "MSI not found: $MsiPath"
}
if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) {
    throw "Agent executable not found: $ExePath"
}

$msiName = [IO.Path]::GetFileName($MsiPath)
if ($msiName -notmatch '^SentinelPulseAgent-(?<version>[^-]+)-x64\.msi$') {
    throw "MSI filename does not contain a canonical release version: $msiName"
}
$expectedVersion = $Matches.version
$info = [Diagnostics.FileVersionInfo]::GetVersionInfo((Resolve-Path -LiteralPath $ExePath).Path)
$fileVersion = $info.FileVersion
$productVersion = $info.ProductVersion

if ([string]::IsNullOrWhiteSpace($fileVersion) -or [string]::IsNullOrWhiteSpace($productVersion)) {
    throw "Installed executable is missing FileVersion/ProductVersion metadata"
}
if ($fileVersion -match '^1\.0\.0' -or $productVersion -match '^1\.0\.0') {
    throw "Placeholder 1.0.0 agent metadata detected: FileVersion=$fileVersion ProductVersion=$productVersion"
}
if ($fileVersion -notmatch "^$([regex]::Escape($expectedVersion))(?:\.0)?$") {
    throw "FileVersion $fileVersion does not match MSI release $expectedVersion"
}
if ($productVersion -notmatch "^$([regex]::Escape($expectedVersion))(?:\.0)?$") {
    throw "ProductVersion $productVersion does not match MSI release $expectedVersion"
}

[pscustomobject]@{
    MSI = $msiName
    ExpectedVersion = $expectedVersion
    FileVersion = $fileVersion
    ProductVersion = $productVersion
    Result = 'PASS'
} | Format-List
