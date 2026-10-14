const pool = require('../config/database');
const crypto = require('crypto');
const QRCode = require('qrcode');

async function handlePaymentWebhook(req, res) {
  const { event_type, data } = req.body;

  if (event_type !== 'payment.approved') {
    return res.status(400).json({ error: 'Evento não suportado' });
  }

  const { orderId, customer } = data;

  try {
    // 1. Atualiza o status do pedido para 'paid'
    await pool.query(
      "UPDATE orders SET status = 'paid' WHERE id = $1",
      [orderId]
    );

    // 2. Procura o pedido para obter o batch_id
    const orderQuery = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
    if (orderQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const order = orderQuery.rows[0];
    const ticketId = crypto.randomUUID();

    // 3. Insere o bilhete apenas nas colunas existentes na tabela 'tickets' (id, order_id, batch_id, status)
    await pool.query(
      `INSERT INTO tickets (id, order_id, batch_id, status) 
       VALUES ($1, $2, $3, 'valid')`,
      [ticketId, orderId, order.batch_id]
    );

    // 4. Cria os dados que vão dentro do QR Code
    const payload = JSON.stringify({
      ticketId: ticketId,
      orderId: orderId,
      nome: customer ? customer.name : 'Ingresso Confirmado',
      cpf: customer ? customer.cpf : '',
      timestamp: Date.now()
    });

    // 5. Gera a imagem do QR Code
    const qrCodeImage = await QRCode.toDataURL(payload);

    res.json({
      message: 'Pagamento processado e ingresso gerado com sucesso!',
      tickets: [
        {
          id: ticketId,
          qrCodeImage: qrCodeImage
        }
      ]
    });
  } catch (err) {
    console.error('Erro no webhook:', err);
    res.status(500).json({ error: 'Falha ao processar webhook: ' + err.message });
  }
}

module.exports = { handlePaymentWebhook };