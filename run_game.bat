@echo off
echo Starting Blackjack Strategy Trainer...

:: Start Backend Server
echo Starting Backend (Socket.IO)...
start "Blackjack Backend" cmd /k "cd server && npm run dev"

:: Start Frontend Server
echo Starting Frontend (Vite)...
start "Blackjack Frontend" cmd /k "npm run dev"

:: Wait a moment for servers to initialize
timeout /t 5 /nobreak > NUL

:: Open the browser (Updated to Match vite.config.ts port: 3000)
start http://localhost:3000

echo Servers started in separate windows! Closing this window now.
exit
