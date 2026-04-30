@echo off
REM Admin Dashboard Setup Script for Windows
REM This script helps set up the admin account for WebGiaiDau

setlocal enabledelayedexpansion
color 0A

echo.
echo ==========================================
echo   WebGiaiDau Admin Dashboard Setup
echo ==========================================
echo.

REM Check if server is running
echo [*] Checking if server is running...
timeout /t 1 /nobreak > nul

for /f %%i in ('powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5000/api/db-test' -UseBasicParsing; if ($response.StatusCode -eq 200) { Write-Output 'true' } else { Write-Output 'false' } } catch { Write-Output 'false' }"') do set SERVER_CHECK=%%i

if "%SERVER_CHECK%"=="false" (
    echo [WARNING] Server is not running!
    echo.
    echo Please start the server first:
    echo   cd server ^&^& npm run dev
    echo.
    pause
    exit /b 1
)

echo [OK] Server is running
echo.

REM Create admin account
echo ==========================================
echo   Creating Admin Account
echo ==========================================
echo.

set /p ADMIN_EMAIL="Enter admin email: "
set /p ADMIN_PASSWORD="Enter admin password: "
set /p ADMIN_NAME="Enter admin full name: "

echo.
echo [*] Creating account...
echo.

for /f %%i in ('powershell -Command "try { $body = @{ email = '%ADMIN_EMAIL%'; password = '%ADMIN_PASSWORD%'; full_name = '%ADMIN_NAME%' } | ConvertTo-Json; $response = Invoke-WebRequest -Uri 'http://localhost:5000/api/auth/register' -Method POST -ContentType 'application/json' -Body $body -UseBasicParsing; Write-Output $response.Content } catch { Write-Output 'error' }"') do set RESPONSE=%%i

if not "%RESPONSE%"=="error" (
    if "%RESPONSE:success=x%"=="error" if not "%RESPONSE%"=="%RESPONSE:success=%" (
        echo [OK] Admin account created successfully!
        echo.
        echo Login credentials:
        echo   Email: %ADMIN_EMAIL%
        echo   Password: (the password you entered)
        echo.
        echo [SUCCESS] You can now login to the admin dashboard!
    ) else (
        echo [ERROR] Error creating admin account
        echo Response: %RESPONSE%
    )
) else (
    echo [ERROR] Failed to connect to server
)

echo.
echo For more information, see ADMIN_SETUP.md
echo.
pause
