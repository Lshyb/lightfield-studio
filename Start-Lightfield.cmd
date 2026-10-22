@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0Lightfield.exe" (
    start "" "%~dp0Lightfield.exe" %*
    exit /b 0
)
where node >nul 2>nul
if errorlevel 1 (
    echo Download the Windows portable ZIP from GitHub Releases.
    echo The source ZIP requires Node.js 20 or later.
    pause
    exit /b 1
)
node "%~dp0launch.mjs" %*
if errorlevel 1 pause
