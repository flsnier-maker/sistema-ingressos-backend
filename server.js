require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const pool = require('./config/database');
const { initSocket } = require('./services/socketService');
const { handleCheckout } = require('./controllers/checkoutController');
const { handlePaymentWebhook } = require('./controllers/webhookController');
const { createEvent, createBatch, updateBatch, deleteBatch, deleteEvent, getAdminMetrics } = require('./controllers/adminController');

const app = express();
app.use(express.json());

// Garante que o Render encontra a pasta public, esteja em src/public ou na raiz public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../public')));

const server = http.createServer(app);
initSocket(server);

// Rotas da API Checkout e Webhook
app.post('/api/checkout', handleCheckout);
app.post('/api/webhooks/payment', handlePaymentWebhook);

// Rota para verificar status do pedido na tela de pagamento
app.get('/api/orders/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT status FROM orders WHERE id = $1', [req.params.id]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Pedido não encontrado' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rotas do Painel Admin
app.get('/api/admin/metrics', getAdminMetrics);
app.post('/api/admin/events', createEvent);
app.delete('/api/admin/events/:id', deleteEvent);
app.post('/api/admin/batches', createBatch);
app.put('/api/admin/batches/:id', updateBatch);
app.delete('/api/admin/batches/:id', deleteBatch);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
