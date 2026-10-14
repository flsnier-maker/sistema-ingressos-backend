const { Pool } = require('pg');

// Detecta se está rodando na nuvem com DATABASE_URL
const isProduction = process.env.DATABASE_URL ? true : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || '1234'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'sistema_ingressos'}`,
  ssl: isProduction ? { rejectUnauthorized: false } : false, // Requerido para o Neon na nuvem
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  console.log('[PostgreSQL] Conectado ao banco de dados com sucesso.');
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Error] Erro inesperado no pool de conexões:', err);
});

module.exports = pool;