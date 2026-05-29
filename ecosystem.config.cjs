module.exports = {
  apps: [
    {
      name: "weblangrensha",
      cwd: "./server",
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      // 日志配置
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      merge_logs: true,
      max_memory_restart: "500M",
    },
  ],
};
