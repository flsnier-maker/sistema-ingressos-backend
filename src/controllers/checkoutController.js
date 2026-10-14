const { reserveTickets } = require('../services/reservationService');
const pool = require('../config/database');

async function handleCheckout(req, res) {
  const { batchId, quantity, userId } = req.body;

  try {
    // 1. Tenta a reserva rápida no Redis
    const reservation = await reserveTickets(batchId, userId, quantity);

    // 2. Busca o preço do lote no PostgreSQL
    const batchResult = await pool.query('SELECT price FROM ticket_batches WHERE id = $1', [batchId]);
    if (batchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lote de ingressos não encontrado.' });
    }

    const price = batchResult.rows[0].price;
    const totalAmount = price * quantity;
    const expiresAt = new Date(Date.now() + reservation.expiresInSeconds * 1000);

    // 3. Registra o pedido como 'pending'
    const orderResult = await pool.query(
      `INSERT INTO orders (user_id, total_amount, status, expires_at)
       VALUES ($1, $2, 'pending', $3)
       RETURNING id`,
      [userId, totalAmount, expiresAt]
    );

    const orderId = orderResult.rows[0].id;

    return res.status(201).json({
      message: 'Reserva realizada! Aguardando pagamento.',
      orderId,
      reservationId: reservation.reservationId,
      totalAmount,
      expiresAt
    });

  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

module.exports = { handleCheckout };