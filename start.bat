@echo off
echo ================================================
echo    SkillOrbit — Local Demo
echo    AI Learning Platform
echo ================================================
echo.
echo Starting backend (FastAPI) on port 8000...
start "SkillOrbit Backend" cmd /k "cd /d %~dp0backend && python main.py"
echo.
echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak > nul
echo.
echo Starting frontend (Vite) on port 5173...
start "SkillOrbit Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
echo.
echo ================================================
echo    SkillOrbit is starting up!
echo.
echo    Frontend:  http://localhost:5173
echo    Backend:   http://localhost:8000
echo    API Docs:  http://localhost:8000/docs
echo.
echo    This is a LOCAL DEMO with simulated AI.
echo    All data is stored in data/skillorbit.db
echo ================================================
echo.
echo Opening browser in 5 seconds...
timeout /t 5 /nobreak > nul
start http://localhost:5173
