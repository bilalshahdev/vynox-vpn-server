// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "vynox-server", // App name in PM2
      script: "./dist/server.js", // Entry point after build
      instances: "max", // Or set to a number like 2, for clustering
      exec_mode: "cluster", // 'fork' or 'cluster' mode
      env: {
        APP_ENV: "production", // Environment variable
      },
    },
  ],
};
