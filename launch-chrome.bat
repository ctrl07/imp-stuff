@echo off
REM Launches Chrome without the "Imp Stuff is debugging this browser" banner.
REM The --silent-debugger-extension-api flag suppresses the CDP debug bar
REM that appears during Wayback PDF captures.

set CHROME="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if not exist %CHROME% (
  echo Chrome not found. Edit this file and set the path manually.
  pause
  exit /b 1
)

start "" %CHROME% --silent-debugger-extension-api %*
