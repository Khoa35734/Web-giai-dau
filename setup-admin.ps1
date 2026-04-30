# WebGiaiDau Admin Dashboard Setup Script
# Run: powershell -ExecutionPolicy Bypass -File setup-admin.ps1

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  WebGiaiDau Admin Dashboard Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if server is running
Write-Host "[*] Checking if server is running..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:5000/api/db-test' -UseBasicParsing -ErrorAction Stop
    Write-Host "[OK] Server is running" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Server is not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start the server first:" -ForegroundColor Yellow
    Write-Host "  cd server" -ForegroundColor White
    Write-Host "  npm run dev" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Creating Admin Account" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$email = Read-Host "Enter admin email"
$password = Read-Host "Enter admin password"
$fullName = Read-Host "Enter admin full name"

Write-Host ""
Write-Host "[*] Creating account..." -ForegroundColor Yellow
Write-Host ""

try {
    $body = @{
        email = $email
        password = $password
        full_name = $fullName
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri 'http://localhost:5000/api/auth/register' `
        -Method POST `
        -ContentType 'application/json' `
        -Body $body `
        -UseBasicParsing

    $responseContent = $response.Content | ConvertFrom-Json

    if ($responseContent.success -eq $true) {
        Write-Host "[SUCCESS] Admin account created!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Login credentials:" -ForegroundColor Cyan
        Write-Host "  Email: $email" -ForegroundColor White
        Write-Host "  Password: $password" -ForegroundColor White
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Start the client: cd client && npm run dev" -ForegroundColor White
        Write-Host "  2. Go to: http://localhost:5173/admin" -ForegroundColor White
        Write-Host "  3. Login with the credentials above" -ForegroundColor White
    } else {
        Write-Host "[ERROR] Failed to create account" -ForegroundColor Red
        Write-Host "Response: $($responseContent.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "[ERROR] Connection failed!" -ForegroundColor Red
    Write-Host "Details: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "  1. Server is running (npm run dev)" -ForegroundColor White
    Write-Host "  2. Server is on port 5000" -ForegroundColor White
    Write-Host "  3. Database is connected" -ForegroundColor White
}

Write-Host ""
Read-Host "Press Enter to exit"
