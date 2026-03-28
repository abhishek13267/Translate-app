@echo off
TITLE Vaak AI Bodhi Studio v3.0-Hardened
COLOR 0B
echo.
echo    --- 💠 VAAK AI: HARNESSING THE BODHI INTELLIGENCE ---
echo.
echo    [1/4] Scanning Local Environment...
cd backend
if not exist node_modules (
    echo    [!] Missing Dependencies. Restoring Bodhi Core Engine...
    call npm install
)

echo    [2/4] Initializing Cloud Gateways...
:: We use double quotes for paths with spaces
START /B "Vaak AI API" cmd /c "npm run dev"

echo    [3/4] Tuning Frontend Studio...
cd ..\frontend
if not exist node_modules (
    echo    [!] Restoring Studio UI Assets...
    call npm install
)

echo    [4/4] Launching Bodhi Visualization...
START /B "Vaak AI UI" cmd /c "npm run dev"

echo.
echo    DONE: Studio Live at http://localhost:5173
echo.
pause
