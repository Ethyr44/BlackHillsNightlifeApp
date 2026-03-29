@echo off
title BHNL App ^& Ngrok Launcher
:: This forces the command prompt to run inside the exact folder where this file lives
cd /d "%~dp0"

echo ===================================================
echo  Starting Black Hills Nightlife Environment...
echo ===================================================
echo.

:: 1. Start the Vite React Server in a new window
echo Launching Vite Server...
start "BHNL Vite Server" cmd /c "npm run dev"

:: 2. Wait 3 seconds to give Vite a head start
timeout /t 3 /nobreak >nul

:: 3. Start the Ngrok Tunnel in a new window
echo Launching Ngrok Tunnel...
start "BHNL Ngrok Tunnel" cmd /k "ngrok http 5173"

echo.
echo Success! Both windows are now running.
echo You can close this window, but leave the other two open.
echo.
pause