$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$css = Get-Content -Raw (Join-Path $projectRoot 'styles.css')
$indexHtml = Get-Content -Raw (Join-Path $projectRoot 'index.html')
if ($indexHtml -notmatch 'styles\.css\?v=') { throw 'The main page must version its stylesheet URL to avoid stale mobile CSS.' }
$mobileBlock = $css
if ($css -notmatch '@media\s*\(max-width:\s*600px\)') {
    throw 'A dedicated 600px mobile layout block is required.'
}
foreach ($requiredRule in @('grid-template-columns: 1fr', 'overflow-x: auto', 'font-size: 0.82rem')) {
    if ($mobileBlock -notmatch [regex]::Escape($requiredRule)) {
        throw "Mobile layout is missing required rule: $requiredRule"
    }
}

if ($mobileBlock -notmatch 'grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)') {
    throw 'Mobile KPI cards should use a compact two-column layout.'
}
foreach ($requiredRule in @('padding: 0.75rem', 'gap: 0.6rem', 'min-height: 210px')) {
    if ($mobileBlock -notmatch [regex]::Escape($requiredRule)) {
        throw "Mobile visual tuning is missing required rule: $requiredRule"
    }
}

foreach ($mirror in @('docs\styles.css')) {
    $mirrorCss = Get-Content -Raw (Join-Path $projectRoot $mirror)
    $mirrorMobileBlock = $mirrorCss
    if ($mirrorCss -notmatch '@media\s*\(max-width:\s*600px\)') { throw "$mirror is missing the mobile layout block." }
    foreach ($requiredRule in @('grid-template-columns: 1fr', 'overflow-x: auto', 'font-size: 0.82rem', 'repeat(2, minmax(0, 1fr))', 'min-height: 210px')) {
        if ($mirrorMobileBlock -notmatch [regex]::Escape($requiredRule)) {
            throw "$mirror is missing required mobile rule: $requiredRule"
        }
    }
}

Write-Output 'Responsive layout checks passed.'
