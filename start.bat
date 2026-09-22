@echo off
echo Starting Databases...
docker-compose up -d postgres redis

echo Starting Backend API (Port 8000)...
start "DevOps Dashboard - Backend" cmd /k "cd backend && .\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000"

echo Starting Frontend (Port 3002)...
start "DevOps Dashboard - Frontend" cmd /k "cd frontend && set NEXT_PUBLIC_API_URL=http://localhost:8000&& set NEXT_PUBLIC_WS_URL=ws://localhost:8000&& npm run dev -- -p 3002"

echo Everything is starting! Your browser should open shortly.
timeout /t 5 >nul
start http://localhost:3002
