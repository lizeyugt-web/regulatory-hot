/**
 * PM2 配置 — ECS 阿里云全量部署
 *
 * 管理 ecs_daemon.cjs 和 Next.js 前端
 *
 * 用法:
 *   pm2 start ecosystem.ecs.config.cjs
 *   pm2 save
 *   pm2 logs
 *
 * 稳定性配置:
 * - restart_delay: 防止快速重启循环
 * - WAL 模式: prisma.ts 中已配置
 * - max_memory_restart: 合理的内存上限
 */

module.exports = {
  apps: [
    {
      name: 'reg-daemon',
      script: 'scripts/ecs_daemon.cjs',
      cwd: '/root/regulatory-hot',

      env: {
        NODE_ENV: 'production',
        ECS_DAEMON_INTERVAL: '30',
        ECS_FDA_INTERVAL: '4',
        ECS_ANALYZE_LIMIT: '100',
        ECS_MEMORY_FLOOR: '200',
      },

      error_file: '/root/regulatory-hot/logs/ecs-daemon-err.log',
      out_file: '/root/regulatory-hot/logs/ecs-daemon-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      autorestart: true,
      max_restarts: 20,
      restart_delay: 10000,
      min_uptime: '30s',
      max_memory_restart: '400M',
      kill_timeout: 45000,
      wait_ready: false,
      exec_mode: 'fork',
    },
    {
      name: 'reg-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3457 -H 0.0.0.0',
      cwd: '/root/regulatory-hot/regulatory-hot',

      env: {
        NODE_ENV: 'production',
        PORT: '3457',
      },

      error_file: '/root/regulatory-hot/logs/reg-web-err.log',
      out_file: '/root/regulatory-hot/logs/reg-web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      autorestart: true,
      max_restarts: 10,
      restart_delay: 15000,
      min_uptime: '30s',
      max_memory_restart: '500M',
      kill_timeout: 15000,
      exec_mode: 'fork',
    },
  ],
};
