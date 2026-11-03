#Requires -Version 5.1
<#
.SYNOPSIS
  Install dsh-article-studio into the DSH desktop profile.
#>
[CmdletBinding()]
param(
    [string]$ProfileDir = (Join-Path $env:USERPROFILE '.dsh\profiles\desktop')
)

$ErrorActionPreference = 'Stop'
$source = $PSScriptRoot
$profileJson = Join-Path $ProfileDir 'package.json'

if (-not (Test-Path -LiteralPath $profileJson)) { throw "profile package.json not found: $profileJson" }
if (-not (Test-Path -LiteralPath (Join-Path $source 'lib\client.js'))) { throw "plugin files missing: $source" }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item -LiteralPath $profileJson -Destination "$profileJson.bak-$stamp" -Force
Write-Host "backup: $profileJson.bak-$stamp"

$target = Join-Path $ProfileDir 'node_modules\dsh-article-studio'
if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item -Path (Join-Path $source '*') -Destination $target -Recurse -Force
Write-Host "copied to: $target"

$raw = Get-Content -LiteralPath $profileJson -Raw -Encoding utf8
$pkg = $raw | ConvertFrom-Json
$deps = [ordered]@{}
foreach ($p in $pkg.dependencies.PSObject.Properties) { $deps[$p.Name] = $p.Value }
$deps['dsh-article-studio'] = "file:$($source -replace '\\', '/')"
$pkg.dependencies = [pscustomobject]$deps

$bundles = @()
if ($pkg.dsh -and $pkg.dsh.profile -and $pkg.dsh.profile.bundles) { $bundles = @($pkg.dsh.profile.bundles) }
if ($bundles -notcontains 'dsh-article-studio') { $bundles += 'dsh-article-studio' }
$pkg.dsh.profile.bundles = $bundles

[System.IO.File]::WriteAllText($profileJson, ($pkg | ConvertTo-Json -Depth 30), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "registered in: $profileJson"
Write-Host 'Done. Fully quit and restart DSH.'
