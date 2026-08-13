@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File ".\scripts\bootstrap-demo-data.ps1"
if errorlevel 1 pause & exit /b 1
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File ".\run-dev.ps1"
pause
