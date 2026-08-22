@echo off
rem The Surveyor - starts the local engine and opens it as a window.
cd /d "%~dp0"
start "" /min cmd /c "node surveyorpp.mjs"
timeout /t 2 /nobreak >nul
start "" chrome --app=http://localhost:4321 --window-size=1500,950
