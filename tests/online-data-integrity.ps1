$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

$app = Get-Content -Raw (Join-Path $projectRoot 'docs\app.js')
if ($app -notmatch 'data\.voyages\s*\|\|\s*\[\]\)\.slice\(\)\.sort') {
    throw 'Online injection must sort voyages chronologically before rendering.'
}
if ($app -notmatch '第 \$\{displayIndex\} 船次') {
    throw 'Online injection must renumber voyages after sorting.'
}
if ($app -notmatch 'weight:\s*w\s*\*\s*dailyWeightShare') {
    throw 'Online injection must populate dateHourMap weights.'
}
if ($app -notmatch 'trips:\s*t\s*\*\s*dailyTripsShare') {
    throw 'Online injection must populate dateHourMap trips.'
}

Write-Output 'Online data integrity checks passed.'
