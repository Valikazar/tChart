module.exports = {
  apps: [
    {
      name: 'telegram-bot',
      script: 'tg_chart_bot.py',
      cwd: '/root/tchart_service/bot',
      interpreter: 'python3',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        MARIA_PASSWORD: ''
      }
    },
    {
      name: 'discord-bot',
      script: 'dc_chart_bot.py',
      cwd: '/root/tchart_service/bot',
      interpreter: 'python3',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        MARIA_PASSWORD: ''
      }
    },
    {
      name: 'tchart-server',
      script: 'server.js',
      cwd: '/root/tchart_service',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        MARIA_PASSWORD: ''
      }
    },
    {
      name: 'tchart-api',
      script: 'jsbot/tChartServerAPI.js',
      cwd: '/root/tchart_service',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
