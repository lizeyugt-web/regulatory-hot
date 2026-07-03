@echo off
REM ===========================================================================
REM 全自动采集 + AI 分析
REM 由 Windows 定时任务调用，每 3 小时运行
REM ===========================================================================
cd /d "%~dp0"

REM 从 .env 加载 SILICONFLOW_API_KEY（定时任务环境不继承用户变量）
for /f "usebackq tokens=1,2 delims==" %%a in ("regulatory-hot\.env") do (
    if "%%a"=="SILICONFLOW_API_KEY" set %%a=%%b
    if "%%a"=="SILICONFLOW_BASE_URL" set %%a=%%b
)

echo [%date% %time%] ===== 开始全自动采集+分析 =====

REM Step 1: 采集最新 FDA 信息
echo [%date% %time%] [1/2] 采集 FDA...
node scripts\collect_fda.cjs --rss-only --no-ai
if %ERRORLEVEL% NEQ 0 (
    echo [%date% %time%] [WARN] 采集失败，继续分析已有数据
)

REM Step 2: AI 分析所有未处理条目
echo [%date% %time%] [2/2] AI 分析...
node scripts\analyze.cjs
if %ERRORLEVEL% NEQ 0 (
    echo [%date% %time%] [WARN] AI 分析失败
)

echo [%date% %time%] ===== 完成 =====
