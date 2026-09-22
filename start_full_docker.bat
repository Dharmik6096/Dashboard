@echo off
echo Stopping any running containers...
docker-compose down

echo Building and starting the entire website in Docker...
docker-compose up --build -d

echo.
echo ========================================================
echo The databases, backend API, and frontend are all starting!
echo Please wait about 30-60 seconds for the frontend to finish booting up.
echo.
echo Your dashboard will be available at: http://localhost:3002
echo ========================================================
pause
