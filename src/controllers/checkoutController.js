// src/controllers/checkoutController.js
const pool = require('../config/database');
const { reserveStock } = require('../services/inventoryService');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || ''
});
const payment = new Payment(client);

async function handleCheckout(req, res) {
  const { batchId, quantity, userId, email, nome, cpf } = req.body;
  const qty = parseInt(quantity, 10) || 1;

  try {
    let batch = null;

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

    if (!batch) {
      try {
        let result = await pool.query('SELECT * FROM batches ORDER BY created_at DESC LIMIT 1');
        if (result.rows.length > 0) batch = result.rows[0];
      } catch (e) {}
    }

    const validBatchId = batch ? batch.id : null;
    const price = batch ? parseFloat(batch.price) : 70.00;
    const totalAmount = price * qty;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    if (validBatchId) {
      try {
        await reserveStock(validBatchId, qty);
      } catch (redisErr) {
        console.warn('Aviso Redis:', redisErr.message);
      }
    }

    // 1. Regista o pedido no banco
    const orderResult = await pool.query(
      `INSERT INTO orders (user_id, batch_id, total_amount, status, expires_at) 
       VALUES ($1, $2, $3, 'pending', $4) RETURNING *`,
      [userId || '00000000-0000-0000-0000-000000000000', validBatchId, totalAmount, expiresAt]
    );
    const order = orderResult.rows[0];

    // 2. Cria cobrança PIX no Mercado Pago (se o token estiver configurado)
    let qrCodeBase64 = null;
    let qrCodeCopiaECola = null;
    let paymentProviderId = null;

    if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
      try {
        const mpPayment = await payment.create({
          body: {
            transaction_amount: totalAmount,
            description: `Ingresso ${batch ? batch.name : 'Show'} - Order #${order.id.substring(0, 8)}`,
            payment_method_id: 'pix',
            payer: {
              email: email || 'comprador@email.com',
              first_name: nome || 'Cliente',
              identification: {
                type: 'CPF',
                number: (cpf || '00000000000').replace(/\D/g, '')
              }
            },
            external_reference: order.id
          }
        });

        paymentProviderId = mpPayment.id.toString();
        qrCodeBase64 = mpPayment.point_of_interaction?.transaction_data?.qr_code_base64;
        qrCodeCopiaECola = mpPayment.point_of_interaction?.transaction_data?.qr_code;

        await pool.query(
          `UPDATE orders SET payment_provider_id = $1 WHERE id = $2`,
          [paymentProviderId, order.id]
        );
      } catch (mpErr) {
        console.error('Erro na API Mercado Pago:', mpErr);
      }
    }

    res.status(201).json({
      message: 'Reserva realizada com sucesso!',
      orderId: order.id,
      totalAmount: totalAmount,
      expiresAt: expiresAt,
      paymentProviderId: paymentProviderId,
      qrCodeBase64: qrCodeBase64,
      qrCodeCopiaECola: qrCodeCopiaECola
    });

  } catch (err) {
    console.error('Erro no checkout:', err);
    res.status(500).json({ error: 'Erro interno ao processar a reserva: ' + err.message });
  }
}

module.exports = { handleCheckout };
