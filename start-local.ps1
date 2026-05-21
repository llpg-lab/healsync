$backend = Join-Path $PSScriptRoot 'backend'
$backendPython = Join-Path $backend 'venv\Scripts\python.exe'
if (Test-Path $backendPython) {
  Start-Process -FilePath $backendPython -ArgumentList 'run_server.py' -WorkingDirectory $backend -WindowStyle Hidden
}

Set-Location (Join-Path $PSScriptRoot 'frontend-new')
$nextCache = Join-Path (Get-Location) '.next'
if (Test-Path $nextCache) {
  Remove-Item -LiteralPath $nextCache -Recurse -Force
}
$env:NEXT_TELEMETRY_DISABLED = '1'
npm.cmd run build
npm.cmd run start
