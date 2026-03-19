// ─── Configuration PM2 — Cursus Serveur ──────────────────────────────────────
module.exports = {
  apps: [
    {
      name:        'cursus-server',
      script:      'server/index.js',
      instances:   1,           // SQLite ne supporte pas plusieurs instances
      autorestart: true,
      watch:       false,
      max_memory_restart: '300M',
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/err.log',
      out_file:   'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
