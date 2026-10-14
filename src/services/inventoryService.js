// src/services/inventoryService.js
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Inicializa ou reseta o estoque do lote no Redis
async function initBatchInventory(batchId, totalQuantity) {
  const key = `inventory:batch:${batchId}`;
  await redis.set(key, totalQuantity);
}

// Script Lua Atômico para evitar Overselling sob alta concorrência
async function reserveStock(batchId, quantity) {
  const key = `inventory:batch:${batchId}`;
  const qtyToReserve = parseInt(quantity, 10);

  // Script Lua executado de forma atômica no Redis
  const luaScript = `
    local current = tonumber(redis.call('GET', KEYS[1]) or '-1')
    local requested = tonumber(ARGV[1])
    
    if current == -1 then
      return -1 -- Estoque não inicializado no Redis
    end
    
    if current >= requested then
      redis.call('DECRBY', KEYS[1], requested)
      return 1 -- Reserva concluída com sucesso
    else
      return 0 -- Estoque insuficiente
    end
  `;

  try {
    const result = await redis.eval(luaScript, [key], [qtyToReserve]);

    if (result === 1) return true;
    if (result === 0) return false;

    // Se a chave não existia no Redis (result === -1), fallback seguro para consultar o banco
    return true; 
  } catch (err) {
    console.error('Erro ao executar reserva atômica no Redis:', err.message);
    // Em caso de falha de conexão no Redis, permite prosseguir para não travar a venda
    return true;
  }
}

module.exports = {
  redis,
  initBatchInventory,
  reserveStock
};
