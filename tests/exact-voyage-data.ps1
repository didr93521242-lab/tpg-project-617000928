$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$data = Get-Content -Raw (Join-Path $root 'docs\data\project-data.json') | ConvertFrom-Json
foreach ($voyage in @($data.voyages)) {
    $entries = @($voyage.dateHourMap.psobject.Properties)
    if ($entries.Count -eq 0) { throw "Voyage $($voyage.index) has no exact date-hour aggregation." }
    $weight = ($entries | ForEach-Object { [double]$_.Value.weight } | Measure-Object -Sum).Sum
    $trips = ($entries | ForEach-Object { [double]$_.Value.trips } | Measure-Object -Sum).Sum
    if ([math]::Abs($weight - [double]$voyage.totalWeightTons) -gt 1) { throw "Voyage $($voyage.index) date-hour weight does not reconcile." }
    if ([math]::Abs($trips - [double]$voyage.totalTrips) -gt 1) { throw "Voyage $($voyage.index) date-hour trips do not reconcile." }
}

$app = Get-Content -Raw (Join-Path $root 'docs\app.js')
if ($app -match 'dailyWeightShare|dailyTripsShare') { throw 'Online UI must not proportionally estimate date-hour data.' }
Write-Output 'Exact voyage data checks passed.'
