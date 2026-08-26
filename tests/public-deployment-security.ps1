$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = 'C:\Users\slliau\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$publicFiles = @(
    (Join-Path $projectRoot 'docs\app.js'),
    (Join-Path $projectRoot 'docs\index.html')
)

$secretPattern = 'ak_[A-Za-z0-9_-]{20,}'
$secretMatches = Select-String -Path $publicFiles -Pattern $secretPattern
if ($secretMatches) {
    throw "Public deployment contains an embedded API key: $($secretMatches.Path -join ', ')"
}

$gitIgnore = Get-Content -Raw (Join-Path $projectRoot '.gitignore')
if ($gitIgnore -notmatch '(?m)^\.cache/$') {
    throw '.cache/ must be excluded from Git before deployment.'
}

$trackedCache = git -C $projectRoot ls-files -- '.cache/**'
if ($trackedCache) {
    throw "Raw cache files are tracked by Git: $trackedCache"
}

$previousApiKey = $env:TPG_API_KEY
try {
    Remove-Item Env:TPG_API_KEY -ErrorAction SilentlyContinue
    & $pythonExe (Join-Path $projectRoot 'sync_api.py') *> $null
    if ($LASTEXITCODE -eq 0) {
        throw 'sync_api.py must exit with a failure code when TPG_API_KEY is missing.'
    }
}
finally {
    if ($null -ne $previousApiKey) {
        $env:TPG_API_KEY = $previousApiKey
    }
}

Write-Output 'Public deployment security checks passed.'
