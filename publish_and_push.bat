@echo off
chcp 65001 >nul
echo ======================================================================
echo   台北港專案 · 一鍵更新與同步至外部網站 (GitHub Pages)
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

echo [1/3] 正在讀取本機 Excel 並產生匿名彙總數據...
"%PYTHON_EXE%" "publish.py"
if %ERRORLEVEL% neq 0 (
    echo.
    echo ❌ 數據處理失敗，請檢查資料夾或檔案格式！
    pause
    exit /b 1
)

echo.
echo [2/3] 正在加入最新數據至 Git 暫存區...
"%GIT_EXE%" add docs/data/project-data.json docs/

echo.
echo [3/3] 正在提交並推送更新至 GitHub Pages...
set "NOW=%date% %time%"
"%GIT_EXE%" commit -m "Update: %NOW% 同步最新台北港過磅統計數據"
"%GIT_EXE%" push origin main

echo.
echo ======================================================================
echo   🎉 同步完成！外部訪客將在 1 分鐘內看到最新作業情形。
echo   🌐 外部查詢網址: https://didr93521242-lab.github.io/tpg-project-617000928/
echo ======================================================================
echo.
pause
