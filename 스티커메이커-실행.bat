@echo off
chcp 65001 >nul
cd /d "%~dp0"
title OGQ 스티커 메이커 (이 창을 닫으면 서버가 꺼집니다)

echo ============================================
echo   OGQ AI 스티커 메이커 시작 중...
echo.
echo   주소:   http://localhost:3000
echo   로그인: admin / 251108
echo.
echo   * 다 쓰면 이 검은 창을 닫으면 됩니다.
echo   * 처음 켤 때 화면 뜨는 데 10~20초 걸릴 수 있어요.
echo ============================================
echo.

REM 서버가 뜰 시간을 잠깐 준 뒤 브라우저 자동 열기
start "" /b cmd /c "timeout /t 6 >nul & start http://localhost:3000"

call npm run dev
pause
