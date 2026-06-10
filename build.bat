@echo off
echo ==========================================
echo       Tradeflow Full Build Script
echo ==========================================

echo.
echo [1/3] Building React Frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%
cd ..

echo.
echo [2/3] Compiling Python Backend (PyInstaller)...
cd backend
call ..\.venv\Scripts\pyinstaller.exe --clean -y tradeflow-backend.spec
if %errorlevel% neq 0 exit /b %errorlevel%
cd ..

echo.
echo [3/3] Packaging Electron Windows App...
cd desktop
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%
cd ..

echo.
echo ==========================================
echo SUCCESS! Your executable is ready at:
echo desktop\dist\Tradeflow Setup.exe
echo ==========================================
pause
