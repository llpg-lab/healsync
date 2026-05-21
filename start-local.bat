@echo off
cd /d "%~dp0backend"
if exist "venv\Scripts\python.exe" start "HealSync Backend" /min "venv\Scripts\python.exe" run_server.py
cd /d "%~dp0frontend-new"
if exist ".next" rmdir /s /q ".next"
set NEXT_TELEMETRY_DISABLED=1
npm.cmd run build
npm.cmd run start
