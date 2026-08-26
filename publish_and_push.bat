@echo off
cd /d "%~dp0"
chcp 65001 >nul

echo ======================================================================
echo   Taipei Port Project - Auto Publish and Push
echo ======================================================================
echo.

set "GIT_EXE=C:\Users\slliau\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"
set "PYTHON_EXE=C:\Users\slliau\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if not exist "%PYTHON_EXE%" (
    set "PYTHON_EXE=python"
)
if not exist "%GIT_EXE%" (
    set "GIT_EXE=git"
)

echo [1/3] 正在自 API 擷取最新作業資料（失敗時自動退回本機 Excel 模式）...
"%PYTHON_EXE%" sync_api.py
if %ERRORLEVEL% neq 0 (
    echo.
    echo [警告] API 連線失敗，嘗試使用本機 Excel 檔案備援...
    "%PYTHON_EXE%" publish.py
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [ERROR] 資料同步失敗，請檢查 API 伺服器或本機檔案。
        pause
        exit /b 1
    )
)

echo.
echo [2/3] Adding files to Git staging...
"%GIT_EXE%" add docs/data/project-data.json docs/

echo.
echo [3/3] Committing and pushing to GitHub...
"%GIT_EXE%" commit -m "Update: Sync latest Taipei Port weighing data"
"%GIT_EXE%" push -u origin main

echo.
echo ======================================================================
echo   Done! Your data has been published.
echo   URL: https://didr93521242-lab.github.io/tpg-project-617000928/
echo ======================================================================
echo.
pause
