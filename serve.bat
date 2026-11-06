@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Локальный предпросмотр: http://localhost:8080
echo Закрыть — Ctrl+C
start "" "http://localhost:8080"
python -m http.server 8080
