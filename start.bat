@echo off
echo 🌱 Starting Modern DruvyaGuna Plant Scanner...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Please run this script from the modern-plant-scanner directory
    pause
    exit /b 1
)

echo.
echo 📦 Installing dependencies...
if not exist "node_modules" (
    npm install
    if errorlevel 1 (
        echo ❌ npm install failed
        pause
        exit /b 1
    )
)

echo.
echo 🔑 Checking API key...
if not exist ".env" (
    echo ❌ .env file not found
    echo Please create .env file with your REACT_APP_GEMINI_API_KEY
    echo Get your key from: https://makersuite.google.com/app/apikey
    pause
    exit /b 1
)

findstr /C:"your_gemini_api_key_here" .env >nul
if not errorlevel 1 (
    echo ❌ Please set your REACT_APP_GEMINI_API_KEY in .env file
    echo Get your key from: https://makersuite.google.com/app/apikey
    echo.
    echo Example .env file:
    echo REACT_APP_GEMINI_API_KEY=your_actual_api_key_here
    pause
    exit /b 1
)

echo ✅ API key configured

echo.
echo 🚀 Starting the app...
echo 📱 Opening http://localhost:3000
echo.
echo Features:
echo • Frontend-only - no backend required!
echo • Advanced AI plant identification
echo • Modern UI with smooth animations  
echo • Detailed Ayurvedic information
echo • Mobile camera support
echo.

npm start
