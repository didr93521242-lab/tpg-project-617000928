$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

$app = Get-Content -Raw (Join-Path $projectRoot 'docs\app.js')
$indexHtml = Get-Content -Raw (Join-Path $projectRoot 'docs\index.html')
if ($indexHtml -notmatch 'app\.js\?v=') { throw 'The public page must version app.js to avoid stale online logic.' }
if ($app -notmatch 'data\.voyages\s*\|\|\s*\[\]\)\.slice\(\)\.sort') {
    throw 'Online injection must sort voyages chronologically before rendering.'
}
if ($app -notmatch '第 \$\{displayIndex\} 船次') {
    throw 'Online injection must renumber voyages after sorting.'
}
if ($app -notmatch 'const dateHourMap = v\.dateHourMap \|\| \{\}') {
    throw 'Online injection must populate dateHourMap weights.'
}
if ($app -match 'dailyWeightShare|dailyTripsShare') {
    throw 'Online injection must populate dateHourMap trips.'
}

Write-Output 'Online data integrity checks passed.'
