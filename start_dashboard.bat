@echo off
chcp 65001 >nul
title AssetVision - Personal Portfolio Dashboard Server

cd /d "%~dp0"

echo ========================================================
echo   AssetVision PRO 핀테크 자산관리 대시보드를 시작합니다...
echo ========================================================
echo.

if not exist "node_modules\" (
    echo [1/2] 최초 실행 감지: 패키지 설치 중...
    call npm install
)

echo [2/2] 로컬 개발 서버 구동 및 브라우저 자동 실행 중...
echo       URL: http://localhost:5173
echo.

start "" "http://localhost:5173"
call npm run dev

pause
