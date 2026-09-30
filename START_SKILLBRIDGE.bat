@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js is not installed or not available in PATH.
  echo Install Node.js 18+ and run this file again.
  pause
  exit /b 1
)
if not exist data.json echo {"users":[]} > data.json
start "SkillBridge Backend" cmd /k "cd /d "%~dp0" && node server.js"
set /a tries=0
:wait
set /a tries+=1
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 1; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto open
if %tries% GEQ 15 goto fail
timeout /t 1 /nobreak >nul
goto wait
:open
start "" "http://127.0.0.1:3000/"
exit /b 0
:fail
echo.
echo [ERROR] SkillBridge backend did not start on port 3000.
echo Check the black server window for the error message.
pause
exit /b 1
