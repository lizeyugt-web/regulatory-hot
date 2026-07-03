# ===========================================================================
# 监管信息采集监控平台 — Windows 定时任务安装脚本
# 
# 用法（以管理员身份运行 PowerShell）:
#   powershell -ExecutionPolicy Bypass -File schedule_task.ps1
#
# 每 3 小时自动: 采集 FDA → AI 一步分析 → 前端刷新即见
# ===========================================================================

$taskName = "RegulatoryHot-Auto-Collect-Analyze"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$batchPath = Join-Path $scriptDir "auto_run.cmd"

# 创建自动执行脚本
@"
@echo off
cd /d "$scriptDir"
echo [%date% %time%] 开始采集...
node scripts/collect_fda.cjs --rss-only --no-ai
echo [%date% %time%] 开始 AI 分析...
node scripts/analyze.cjs
echo [%date% %time%] 完成
"@ | Out-File -FilePath $batchPath -Encoding ASCII

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  安装定时任务: $taskName" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 删除旧任务
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "已删除旧任务" -ForegroundColor Yellow
}

# 创建新任务 — 每 3 小时运行
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batchPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At "00:00" -RepetitionInterval (New-TimeSpan -Hours 3) -RepetitionDuration (New-TimeSpan -Days 365)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "监管信息采集监控 — 每3小时采集FDA + AI分析" | Out-Null

Write-Host "✅ 定时任务已安装!" -ForegroundColor Green
Write-Host "   任务: $taskName" -ForegroundColor White
Write-Host "   频率: 每 3 小时" -ForegroundColor White
Write-Host "   超时: 30 分钟" -ForegroundColor White
Write-Host ""
Write-Host "📋 管理命令:" -ForegroundColor Gray
Write-Host "   查看任务: taskschd.msc" -ForegroundColor Gray
Write-Host "   手动运行: schtasks /run /tn '$taskName'" -ForegroundColor Gray
Write-Host "   删除任务: schtasks /delete /tn '$taskName' /f" -ForegroundColor Gray
Write-Host "   查看状态: schtasks /query /tn '$taskName'" -ForegroundColor Gray
Write-Host ""
Write-Host "📊 查看进度: http://127.0.0.1:3457/all" -ForegroundColor Gray
