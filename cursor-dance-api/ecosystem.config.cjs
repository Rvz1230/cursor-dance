// CursorDance AI API — pm2 守护配置
// 用法：pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: "cursor-dance-api",
      script: "./scripts/prod-server.mjs",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      // 重启策略
      max_memory_restart: "512M",
      restart_delay: 3000,
      max_restarts: 10,
      // 日志
      error_file: "/var/log/cursor-dance-api/err.log",
      out_file: "/var/log/cursor-dance-api/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};
