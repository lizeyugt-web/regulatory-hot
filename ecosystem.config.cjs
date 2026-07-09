/**
 * PM2 配置 — 微信公众号轮询守护进程
 *
 * 部署到阿里云 ECS 后：
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'mp-watcher',
      script: 'scripts/watcher.cjs',
      cwd: '/root/regulatory-hot',
      interpreter: 'node',
      // 环境变量（部署时替换实际值）
      env: {
        NODE_ENV: 'production',
        WX_EXPORTER_URL: 'https://127.0.0.1:3443',
        WX_AUTH_KEY: 'def858160e3441dd88a377cba24ce0be',
        GITHUB_TOKEN: 'YOUR_GITHUB_TOKEN',   // ← 替换
        WATCHER_INTERVAL: '30',
        WATCHER_ARTICLE_LIMIT: '5',
        CONTENT_CONCURRENCY: '3',
        CONTENT_MAX_CHARS: '30000',
        WX_TLS_REJECT_UNAUTHORIZED: '0',
      },
      // 日志
      error_file: '/root/regulatory-hot/logs/watcher-err.log',
      out_file: '/root/regulatory-hot/logs/watcher-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // 重启策略
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      max_memory_restart: '200M',
      // 优雅退出
      kill_timeout: 30000,
      wait_ready: false,
    },
  ],
};
