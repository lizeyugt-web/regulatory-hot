@echo off
chcp 65001 >nul
title 监管信息采集监控平台 - 本地守护进程

echo ============================================
echo   监管信息采集监控平台 — 全自动本地部署
echo ============================================
echo.

cd /d "%~dp0"

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js 22+
    pause
    exit /b 1
)

:: 检查 .env
if not exist "regulatory-hot\.env" (
    echo [错误] regulatory-hot\.env 不存在
    echo   请复制 regulatory-hot\.env.example 并填入 SILICONFLOW_API_KEY
    pause
    exit /b 1
)

:: 检查 Prisma
if not exist "regulatory-hot\node_modules\@prisma\client" (
    echo [提示] 安装 Prisma 依赖...
    cd regulatory-hot
    call npm install --no-save @prisma/client@7 @prisma/adapter-libsql@7
    cd ..
)

:: 检查 PM2
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 安装 PM2...
    call npm install -g pm2
)

echo.
echo === 启动选项 ===
echo [1] 常驻模式 (PM2 守护，自动采集+分析+同步)
echo [2] 单次手动 (跑一次全流程后退出)
echo [3] FDA 采集 (仅 FDA 采集 + AI 分析)
echo [4] AI 分析 (仅 AI 分析)
echo [5] 退出
echo.

set /p choice="请选择 [1-5]: "

if "%choice%"=="1" goto daemon
if "%choice%"=="2" goto once
if "%choice%"=="3" goto fda_only
if "%choice%"=="4" goto ai_only
if "%choice%"=="5" goto end

echo 无效选择
goto end

:daemon
echo.
echo === 启动 PM2 守护进程 ===
pm2 delete local-daemon 2>nul
pm2 start ecosystem.local.config.cjs
pm2 save
echo.
echo ✅ 守护进程已启动！
echo    查看日志: pm2 logs local-daemon
echo    查看状态: pm2 status
echo    停止进程: pm2 stop local-daemon
echo.
echo === 同时启动 Next.js 前端? ===
set /p startNext="启动前端开发服务器? (y/n): "
if /i "%startNext%"=="y" (
    echo.
    echo 启动前端 (端口 3457)...
    cd regulatory-hot
    start "Regulatory Hot Frontend" cmd /k "npx next dev -p 3457 -H 0.0.0.0"
    cd ..
    echo ✅ 前端已在新窗口启动: http://localhost:3457
)
goto end

:once
echo.
echo === 单次全流程 ===
node scripts/local_daemon.cjs --once
goto end

:fda_only
echo.
echo === FDA 采集 + AI 分析 ===
node scripts/local_daemon.cjs --fda-only
goto end

:ai_only
echo.
echo === AI 分析 ===
node scripts/local_daemon.cjs --ai-only
goto end

:end
echo.
pause
