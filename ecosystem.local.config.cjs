/**
 * PM2 配置 — 本地守护进程 (Windows)
 *
 * 管理 local_daemon.cjs 的启动和保活
 *
 * 用法:
 *   pm2 start ecosystem.local.config.cjs
 *   pm2 save
 *   pm2 logs local-daemon
 */

const path = require('path');

module.exports = {
  apps: [
    {
      name: 'local-daemon',
      script: 'scripts/local_daemon.cjs',
      cwd: __dirname,

      // 常驻模式：每 30 分钟循环（环境变量会传给 daemon）
      env: {
        NODE_ENV: 'production',
        LOCAL_DAEMON_INTERVAL: '30',    // 主循环间隔（分钟）
        LOCAL_FDA_INTERVAL: '4',         // FDA 每 4 轮 = 每 2 小时
        LOCAL_ANALYZE_LIMIT: '100',      // AI 分析上限
      },

      // 日志
      error_file: path.join(__dirname, 'logs', 'pm2-local-err.log'),
      out_file: path.join(__dirname, 'logs', 'pm2-local-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // 重启策略
      autorestart: true,
      max_restarts: 20,
      min_uptime: '30s',
      max_memory_restart: '300M',

      // 优雅退出
      kill_timeout: 30000,
      wait_ready: false,

      // Windows 兼容
      interpreter: 'node',
      exec_mode: 'fork',
    },
  ],
};
