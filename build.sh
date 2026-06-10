#!/bin/bash
set -e

echo "=========================================="
echo "      Tradeflow Full Build Script"
echo "=========================================="
echo ""
echo "[1/3] Building React Frontend..."
cd frontend
npm run build
cd ..

echo ""
echo "[2/3] Compiling Python Backend (PyInstaller)..."
cd backend
source ../.venv/bin/activate
pyinstaller --clean -y tradeflow-backend.spec
cd ..

echo ""
echo "[3/3] Packaging Electron App..."
cd desktop
npm run build
cd ..

echo ""
echo "=========================================="
echo "SUCCESS! Your executable is ready at:"
echo "desktop/dist/"
echo "=========================================="
