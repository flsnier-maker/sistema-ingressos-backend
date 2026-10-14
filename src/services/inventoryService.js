const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

/**
 * Inicializa o estoque do lote no Redis.
 * Chave no Redis: `inventory:batch:{batchId}`
 */
async function initBatchInventory(batchId, totalQuantity) {
  const key = `inventory:batch:${batchId}`;
  await redis.set(key, totalQuantity);
  console.log(`[Redis] Estoque do lote ${batchId} configurado para ${totalQuantity} unidades.`);
}

module.exports = { initBatchInventory, redis };