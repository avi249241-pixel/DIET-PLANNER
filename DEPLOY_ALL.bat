@echo off
title Diet Planner - One-Click Full Deployment
cd /d "%~dp0"
echo ===================================================
echo   Diet Planner - Automated Full Deployment
echo ===================================================
echo.
echo [1/3] Pushing latest code to GitHub...
git push -u origin main
if errorlevel 1 (
    echo.
    echo Git push failed or was cancelled. Please check your credentials.
    pause
    exit /b 1
)

echo.
echo [2/3] Authenticating with Vercel...
call npx vercel login
if errorlevel 1 (
    echo.
    echo Vercel login failed or was cancelled.
    pause
    exit /b 1
)

echo.
echo [3/3] Deploying production frontend to Vercel...
call bun run deploy:prod

echo.
echo ===================================================
echo Deployment completed!
echo ===================================================
pause
