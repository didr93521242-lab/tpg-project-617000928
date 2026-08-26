@echo off
cd /d "%~dp0"
chcp 65001 >nul

echo ======================================================================
echo   台北港專案 · API 直連資料發布與 GitHub Pages 同步工具
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

echo [1/3] 正在自台北港 API 擷取最新作業資料並產出彙總 JSON...
"%PYTHON_EXE%" sync_api.py
if %ERRORLEVEL% neq 0 (
    echo.
    echo [警告] API 連線失敗，嘗試使用本機 Excel 檔案備援...
    "%PYTHON_EXE%" publish.py
    if %ERRORLEVEL% neq 0 (
        echo [錯誤] 資料同步失敗，請檢查網路連線或本機檔案。
        pause
        exit /b 1
    )
)

echo.
echo [2/3] 將發布檔案加入 Git 暫存區...
"%GIT_EXE%" add docs/data/project-data.json docs/

echo.
echo [3/3] 提交並推送到 GitHub Pages...
"%GIT_EXE%" commit -m "Update: Sync latest Taipei Port data from API"
"%GIT_EXE%" push -u origin main

echo.
echo ======================================================================
echo   🎉 發布完成！最新數據已推播至線上儀表板。
echo   🌐 查詢網址: https://didr93521242-lab.github.io/tpg-project-617000928/
echo ======================================================================
echo.
pause
