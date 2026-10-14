const Redis = require('ioredis');
const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Habilita as notificações de expiração de chaves no Redis
redis.config('SET', 'notify-keyspace-events', 'Ex');

subscriber.psubscribe('__keyevent@0__:expired');

subscriber.on('pmessage', async (pattern, channel, expiredKey) => {
  if (expiredKey.startsWith('reservation:')) {
    const reservationId = expiredKey.split(':')[1];
    console.log(`[Reserva Expirada] Liberando estoque referente à reserva ${reservationId}`);
    // Em produção: ler metadados do pedido pendente e devolver quantidade com redis.incrby()
  }
});

console.log('[Worker] Escutando reservas expiradas no Redis...');