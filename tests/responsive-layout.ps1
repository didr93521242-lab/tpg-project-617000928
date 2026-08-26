$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$css = Get-Content -Raw (Join-Path $projectRoot 'styles.css')
$indexHtml = Get-Content -Raw (Join-Path $projectRoot 'index.html')
if ($indexHtml -notmatch 'styles\.css\?v=') { throw 'The main page must version its stylesheet URL to avoid stale mobile CSS.' }
$mobileBlock = [regex]::Match($css, '(?s)@media\s*\(max-width:\s*600px\)\s*\{.*?\n\}')
if (-not $mobileBlock.Success) {
    throw 'A dedicated 600px mobile layout block is required.'
}
foreach ($requiredRule in @('grid-template-columns: 1fr', 'overflow-x: auto', 'font-size: 0.82rem')) {
    if ($mobileBlock.Value -notmatch [regex]::Escape($requiredRule)) {
        throw "Mobile layout is missing required rule: $requiredRule"
    }
}

foreach ($mirror in @('docs\styles.css')) {
    $mirrorCss = Get-Content -Raw (Join-Path $projectRoot $mirror)
    $mirrorMobileBlock = [regex]::Match($mirrorCss, '(?s)@media\s*\(max-width:\s*600px\)\s*\{.*?\n\}')
    if (-not $mirrorMobileBlock.Success) { throw "$mirror is missing the mobile layout block." }
    foreach ($requiredRule in @('grid-template-columns: 1fr', 'overflow-x: auto', 'font-size: 0.82rem')) {
        if ($mirrorMobileBlock.Value -notmatch [regex]::Escape($requiredRule)) {
            throw "$mirror is missing required mobile rule: $requiredRule"
        }
    }
}

Write-Output 'Responsive layout checks passed.'
