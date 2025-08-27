export default {
  apps: [{
    name: "backend grabador",
    script: "src/server.js",
    watch: false,
    instances: 1,
    autorestart: true,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: 3001
    },
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "logs/error.log",
    out_file: "logs/output.log",
    merge_logs: true
  }]
};