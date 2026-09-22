#!/bin/bash

echo "Starting Databases..."
docker-compose up -d postgres redis

echo "Starting Backend API (Port 8000)..."
cd backend
source venv/Scripts/activate 2>/dev/null || source venv/bin/activate 2>/dev/null
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
cd ..

echo "Starting Frontend (Port 3002)..."
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:8000 \
NEXT_PUBLIC_WS_URL=ws://localhost:8000 \
npm run dev -- -p 3002 &
cd ..

echo "Everything is starting in the background!"
echo "Your frontend will be available at: http://localhost:3002"
echo "Frontend data API: http://localhost:8000/api/v1"
