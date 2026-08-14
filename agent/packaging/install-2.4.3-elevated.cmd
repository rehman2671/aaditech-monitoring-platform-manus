@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','%SCRIPT_DIR%install-2.4.3-elevated.ps1')"
if errorlevel 1 (
  echo Elevated MSI installation failed. Review the installer log in agent\artifacts.
  exit /b 1
)
echo Elevated MSI installation completed.
exit /b 0
