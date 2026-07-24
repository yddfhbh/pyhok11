module.exports = {
  apps: [
    {
      name: 'pyhok-numeric-chat',
      script: './server.mjs',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3230,
        CHAT_HISTORY_LIMIT: 200,
        MAX_CONNECTIONS: 300,
        DATA_DIR: './data',
      },
    },
  ],
};
