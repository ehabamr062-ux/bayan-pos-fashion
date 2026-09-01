@echo off
:: Automatic self-elevation to Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrative privileges...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c netsh advfirewall firewall add rule name=\"Bayan POS Local Server\" dir=in action=allow protocol=TCP localport=4545 profile=any & echo [SUCCESS] Port 4545 is now OPEN! & echo [SUCCESS] Tam fath el-monfaz benagah! & pause' -Verb RunAs"
    exit /b
)

netsh advfirewall firewall add rule name="Bayan POS Local Server" dir=in action=allow protocol=TCP localport=4545 profile=any
echo ================================================================
echo   [SUCCESS] Port 4545 is now OPEN in Windows Firewall!
echo   [SUCCESS] Tam fath el-monfaz benagah!
echo ================================================================
pause
