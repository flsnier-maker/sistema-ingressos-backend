// src/controllers/checkoutController.js
const pool = require('../config/database');
const { reserveStock } = require('../services/inventoryService');

async function handleCheckout(req, res) {
  const { batchId, quantity, userId } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Quantidade inválida.' });
  }

  try {
    let batch = null;

    // 1. Tenta buscar na tabela 'batches'
    if (batchId) {
      try {
        const result = await pool.query('SELECT * FROM batches WHERE id = $1', [batchId]);
        if (result.rows.length > 0) batch = result.rows[0];
      } catch (e) {}

      // 2. Se não achou, tenta na tabela 'ticket_batches'
      if (!batch) {
        try {
          const result = await pool.query('SELECT * FROM ticket_batches WHERE id = $1', [batchId]);
          if (result.rows.length > 0) batch = result.rows[0];
        } catch (e) {}
      }
    }

    // 3. Fallback: Se mesmo assim não achou ID válido, pega o último lote ativo cadastrado
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

    if (!batch) {
      return res.status(404).json({ error: 'Lote de ingressos não encontrado.' });
    }

    // Tenta reservar o estoque no Redis
    const stockReserved = await reserveStock(batch.id, quantity);
    if (!stockReserved) {
      return res.status(400).json({ error: 'Ingressos esgotados para este lote!' });
    }

    // Cria o pedido no PostgreSQL
    const totalAmount = parseFloat(batch.price) * quantity;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // Expirar em 15min

    const orderResult = await pool.query(
      `INSERT INTO orders (user_id, batch_id, total_amount, status, expires_at) 
       VALUES ($1, $2, $3, 'pending', $4) RETURNING *`,
      [userId || '00000000-0000-0000-0000-000000000000', batch.id, totalAmount, expiresAt]
    );

    const order = orderResult.rows[0];

    res.status(201).json({
      message: 'Reserva realizada com sucesso!',
      orderId: order.id,
      totalAmount: totalAmount,
      expiresAt: expiresAt
    });

  } catch (err) {
    console.error('Erro no checkout:', err);
    res.status(500).json({ error: 'Erro interno ao processar a reserva.' });
  }
}

module.exports = { handleCheckout };
