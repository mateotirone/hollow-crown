@echo off
rem Double-click to open the live asset viewer (Windows). Leave the window open while you look.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org, then double-click this again.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)
rem keep the viewer itself up to date (only when nothing in the checkout is edited)
for /f %%i in ('git status --porcelain --untracked-files=no 2^>nul') do goto :run
git pull --ff-only --quiet 2>nul
:run
node serve.mjs %*
pause
