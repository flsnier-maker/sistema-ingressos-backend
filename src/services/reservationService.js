const { redis } = require('./inventoryService');
const { v4: uuidv4 } = require('uuid');

const HOLD_TIME_SECONDS = 600; // 10 minutos para pagar

/**
 * Tenta reservar ingressos garantindo que não haverá sobrevenda.
 */
async function reserveTickets(batchId, userId, quantity = 1) {
  const inventoryKey = `inventory:batch:${batchId}`;

  // 1. Decrementa o estoque instantaneamente no Redis (< 1ms)
  const remainingStock = await redis.decrby(inventoryKey, quantity);

  if (remainingStock < 0) {
    // Se o estoque zerou/ficou negativo, reverte o decremento e lança erro
    await redis.incrby(inventoryKey, quantity);
    throw new Error('Ingressos esgotados para este lote!');
  }

  // 2. Gera a reserva com expiração automática de 10 minutos
  const reservationId = uuidv4();
  const reservationKey = `reservation:${reservationId}`;

  const reservationData = {
    reservationId,
    batchId,
    userId,
    quantity,
    status: 'PENDING_PAYMENT',
    createdAt: new Date().toISOString()
  };

  await redis.setex(
    reservationKey,
    HOLD_TIME_SECONDS,
    JSON.stringify(reservationData)
  );

  return {
    success: true,
    reservationId,
    expiresInSeconds: HOLD_TIME_SECONDS,
    reservationData
  };
}

module.exports = { reserveTickets };