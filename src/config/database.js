const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'sistema_ingressos',
  max: 20, // Máximo de conexões simultâneas no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('[PostgreSQL] Conectado ao banco de dados com sucesso.');
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Error] Erro inesperado no pool de conexões:', err);
});

module.exports = pool;