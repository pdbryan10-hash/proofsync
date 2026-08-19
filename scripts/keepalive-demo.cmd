@echo off
REM Wrapper so the scheduled task's action needs no nested quoting.
REM See keepalive-demo.ps1 for what this does and why every 10 days.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0keepalive-demo.ps1"
