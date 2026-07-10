@echo off
chcp 65001 >nul
echo 启动监管采集控制台...
cd /d "D:\Claude code 项目\监管信息采集监控平台"
start "" http://localhost:3458
node scripts\local_server.cjs
pause
