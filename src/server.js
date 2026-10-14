require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { initSocket } = require('./services/socketService');
const { handleCheckout } = require('./controllers/checkoutController');
const { handlePaymentWebhook } = require('./controllers/webhookController');
const { createEvent, createBatch, updateBatch, deleteBatch, deleteEvent, getAdminMetrics } = require('./controllers/adminController');

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
initSocket(server);

// Rotas da API
app.post('/api/checkout', handleCheckout);
app.post('/api/webhooks/payment', handlePaymentWebhook);

// Rotas Admin
app.get('/api/admin/metrics', getAdminMetrics);
app.post('/api/admin/events', createEvent);
app.delete('/api/admin/events/:id', deleteEvent);
app.post('/api/admin/batches', createBatch);
app.put('/api/admin/batches/:id', updateBatch);
app.delete('/api/admin/batches/:id', deleteBatch);

// Adicionar em src/server.js junto com as outras rotas:
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
