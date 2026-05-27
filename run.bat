@echo off
cd /d "%~dp0"

:: Check for uv, install if missing
where uv >nul 2>&1
if errorlevel 1 (
    echo uv not found. Installing...
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
    set "PATH=%USERPROFILE%\.local\bin;%PATH%"
)

:: Sync deps and run
uv sync
uv run uvicorn server.app:app --port 8765 --reload
pause
