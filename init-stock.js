// init-stock.js
require('dotenv').config();
const { initBatchInventory } = require('./src/services/inventoryService');

async function carregarEstoque() {
  const batchId = 'lote-pista-01';
  const quantidadeTotal = 500; // Define 500 ingressos disponíveis para o lote

  await initBatchInventory(batchId, quantidadeTotal);
  console.log(`✅ Sucesso! Estoque do lote "${batchId}" definido para ${quantidadeTotal} unidades no Redis.`);
  process.exit(0);
}

carregarEstoque();