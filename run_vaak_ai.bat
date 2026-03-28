@echo off
echo 🌐 Starting Vaak AI: Premium Bodhi Studio...
echo 🚀 Launching Backend...
start cmd /k "cd backend && npm install && npm start"
echo 🎨 Launching Frontend (React + Vite)...
start cmd /k "cd frontend && npm install && npm run dev"
echo ✅ Vaak AI is now starting in two separate terminals.
echo 🔗 Frontend: http://localhost:3000
echo 🔗 Backend: http://localhost:5050
pause
