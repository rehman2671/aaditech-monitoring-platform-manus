@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "API_BASE_URL=%~1"
if "%API_BASE_URL%"=="" set "API_BASE_URL=http://127.0.0.1:8080"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','%SCRIPT_DIR%configure-agent-enrollment.ps1','-ApiBaseUrl','%API_BASE_URL%')"

if errorlevel 1 (
  echo Enrollment configuration failed. Open an elevated PowerShell window and review the error.
  exit /b 1
)
echo Enrollment configuration finished. The token was not displayed.
exit /b 0
