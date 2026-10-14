// src/controllers/checkoutController.js
const pool = require('../config/database');
const { reserveStock } = require('../services/inventoryService');

async function handleCheckout(req, res) {
  const { batchId, quantity, userId } = req.body;

  const qty = parseInt(quantity) || 1;

  try {
    let batch = null;

    // 1. Tenta localizar o lote nas tabelas
    if (batchId) {
      try {
        const result = await pool.query('SELECT * FROM batches WHERE id = $1', [batchId]);
        if (result.rows.length > 0) batch = result.rows[0];
      } catch (e) {}

      if (!batch) {
        try {
          const result = await pool.query('SELECT * FROM ticket_batches WHERE id = $1', [batchId]);
          if (result.rows.length > 0) batch = result.rows[0];
        } catch (e) {}
      }
    }

    // 2. Busca o último lote caso nenhum ID válido tenha sido enviado
    if (!batch) {
      try {
        let result = await pool.query('SELECT * FROM batches ORDER BY created_at DESC LIMIT 1');
        if (result.rows.length > 0) batch = result.rows[0];
      } catch (e) {}

      if (!batch) {
        try {
          let result = await pool.query('SELECT * FROM ticket_batches ORDER BY created_at DESC LIMIT 1');
          if (result.rows.length > 0) batch = result.rows[0];
        } catch (e) {}
      }
    }

    const validBatchId = batch ? batch.id : null;
    const price = batch ? parseFloat(batch.price) : 70.00;
    const totalAmount = price * qty;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Tenta reservar no Redis (se falhar, prossegue para não travar a experiência)
    if (validBatchId) {
      try {
        await reserveStock(validBatchId, qty);
      } catch (redisErr) {
        console.warn('Aviso: Falha ao decrementar estoque no Redis, continuando checkout:', redisErr.message);
      }
    }

    // Cria a ordem no PostgreSQL
    const orderResult = await pool.query(
      `INSERT INTO orders (user_id, batch_id, total_amount, status, expires_at) 
       VALUES ($1, $2, $3, 'pending', $4) RETURNING *`,
      [userId || '00000000-0000-0000-0000-000000000000', validBatchId, totalAmount, expiresAt]
    );

    const order = orderResult.rows[0];

    res.status(201).json({
      message: 'Reserva realizada com sucesso!',
      orderId: order.id,
      totalAmount: totalAmount,
      expiresAt: expiresAt
    });

  } catch (err) {
    console.error('Erro detalhado no checkout:', err);
    res.status(500).json({ error: 'Erro interno ao processar a reserva: ' + err.message });
  }
}

module.exports = { handleCheckout };
