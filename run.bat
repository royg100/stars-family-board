@echo off
chcp 65001 >nul
title לוח הכוכבים - שרת
cd /d "%~dp0backend"

echo.
echo ====================================
echo     לוח הכוכבים - מפעיל שרת
echo ====================================
echo.

REM בדיקה שפייתון מותקן
python --version >nul 2>&1
if errorlevel 1 (
    echo [שגיאה] פייתון לא מותקן. הורד מ: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM שחרור פורט 8765 משרתים ישנים
echo משחרר את פורט 8765...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765 " ^| findstr "LISTENING"') do (
    echo עוצר תהליך ישן PID=%%a
    taskkill /F /PID %%a >nul 2>&1
)

REM התקנת תלויות אם חסרות
echo בודק תלויות...
python -c "import fastapi, uvicorn, sqlalchemy, bcrypt, itsdangerous, pydantic_settings" 2>nul
if errorlevel 1 (
    echo מתקין תלויות חסרות... זה יקח רגע.
    pip install --user -q -r requirements.txt
    if errorlevel 1 (
        echo [שגיאה] התקנת התלויות נכשלה.
        pause
        exit /b 1
    )
)

echo.
echo ====================================
echo  השרת עולה על:
echo     http://localhost:8765
echo  הדפדפן ייפתח אוטומטית בעוד 2 שניות.
echo  (Ctrl+C כדי לעצור)
echo ====================================
echo.

REM פותח דפדפן אחרי 2 שניות
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8765/"

REM הפעלת השרת
python -m app.main

pause
