Set-Location $PSScriptRoot
$env:NEXT_TELEMETRY_DISABLED = '1'
npm.cmd run local
