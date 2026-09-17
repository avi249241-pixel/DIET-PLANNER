@echo off
title Diet Planner - Vercel Deployer
echo ===================================================
echo   Diet Planner - Automated Vercel Deployer
echo ===================================================
echo.
echo Select deployment target:
echo [1] Preview Deployment (get an isolated staging URL)
echo [2] Production Deployment (go live immediately)
echo.
set /p choice="Enter choice [1 or 2]: "

if "%choice%"=="1" (
    echo.
    echo Running: bun run deploy:preview ...
    call bun run deploy:preview
) else if "%choice%"=="2" (
    echo.
    echo Running: bun run deploy:prod ...
    call bun run deploy:prod
) else (
    echo Invalid choice. Please run again and select 1 or 2.
)
echo.
pause
