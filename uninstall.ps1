#Requires -Version 5.1
<#
.SYNOPSIS
  Remove dsh-article-studio from the DSH desktop profile.
#>
[CmdletBinding()]
param(
    [string]$ProfileDir = (Join-Path $env:USERPROFILE '.dsh\profiles\desktop')
)

$ErrorActionPreference = 'Stop'
$profileJson = Join-Path $ProfileDir 'package.json'
if (-not (Test-Path -LiteralPath $profileJson)) { throw "profile package.json not found: $profileJson" }

$pkg = Get-Content -LiteralPath $profileJson -Raw -Encoding utf8 | ConvertFrom-Json
if ($pkg.dependencies) {
    $deps = [ordered]@{}
    foreach ($p in $pkg.dependencies.PSObject.Properties) {
        if ($p.Name -ne 'dsh-article-studio') { $deps[$p.Name] = $p.Value }
    }
    $pkg.dependencies = [pscustomobject]$deps
}
if ($pkg.dsh -and $pkg.dsh.profile -and $pkg.dsh.profile.bundles) {
    $pkg.dsh.profile.bundles = @($pkg.dsh.profile.bundles) | Where-Object { $_ -ne 'dsh-article-studio' }
}
[System.IO.File]::WriteAllText($profileJson, ($pkg | ConvertTo-Json -Depth 30), (New-Object System.Text.UTF8Encoding($false)))

$target = Join-Path $ProfileDir 'node_modules\dsh-article-studio'
if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
Write-Host 'Removed dsh-article-studio. Restart DSH.'
