// src/controllers/webhookController.js
const pool = require('../config/database');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || ''
});
const payment = new Payment(client);

async function handlePaymentWebhook(req, res) {
  try {
    const { type, data, action, event_type } = req.body;

    // 1. Suporte a simulação direta (ex: testes de frontend / webhook de simulação)
    if (event_type === 'payment.approved' && req.body.data) {
      const { orderId, customer } = req.body.data;
      return await processApprovedOrder(orderId, customer ? customer.name : null, res);
    }

    // 2. Processamento do Webhook Oficial do Mercado Pago
    let paymentId = null;

    if (type === 'payment' || action === 'payment.created' || action === 'payment.updated') {
      paymentId = data ? data.id : req.query['data.id'];
    }

    if (!paymentId && req.query.id) {
      paymentId = req.query.id;
    }

    if (paymentId && process.env.MERCADOPAGO_ACCESS_TOKEN) {
      const paymentData = await payment.get({ id: paymentId });

      if (paymentData.status === 'approved') {
        const orderId = paymentData.external_reference;
        const customerName = paymentData.payer ? `${paymentData.payer.first_name || ''} ${paymentData.payer.last_name || ''}`.trim() : null;
        return await processApprovedOrder(orderId, customerName, res);
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Erro no webhook:', err);
    res.status(500).json({ error: 'Falha ao processar webhook: ' + err.message });
  }
}

// Função auxiliar para atualizar pedido e emitir ingresso com QR Code
async function processApprovedOrder(orderId, customerName, res) {
  if (!orderId) {
    return res.status(400).json({ error: 'orderId não fornecido' });
  }

  // 1. Atualiza status do pedido
  await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1", [orderId]);

  // 2. Busca dados do pedido
  const orderQuery = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
  if (orderQuery.rows.length === 0) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }

  const order = orderQuery.rows[0];

  // 3. Verifica se o ingresso já foi emitido para evitar duplicatas
  const existingTickets = await pool.query("SELECT * FROM tickets WHERE order_id = $1", [orderId]);
  
  let ticketId;
  if (existingTickets.rows.length > 0) {
    ticketId = existingTickets.rows[0].id;
  } else {
    ticketId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO tickets (id, order_id, batch_id, status) VALUES ($1, $2, $3, 'valid')`,
      [ticketId, orderId, order.batch_id]
    );
  }

  // 4. Cria os dados para o QR Code
  const payload = JSON.stringify({
    ticketId: ticketId,
    orderId: orderId,
    nome: customerName || 'Ingresso Confirmado',
    timestamp: Date.now()
  });

  const qrCodeImage = await QRCode.toDataURL(payload);

  return res.json({
    message: 'Pagamento processado e ingresso gerado com sucesso!',
    tickets: [
      {
        id: ticketId,
        qrCodeImage: qrCodeImage
      }
    ]
  });
}

module.exports = { handlePaymentWebhook };
