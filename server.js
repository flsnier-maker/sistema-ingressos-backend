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

// Rotas da API de Checkout e Pagamentos
app.post('/api/checkout', handleCheckout);
app.post('/api/webhooks/payment', handlePaymentWebhook);

// Rotas da API do Administrador
app.get('/api/admin/metrics', getAdminMetrics);
app.post('/api/admin/events', createEvent);
app.delete('/api/admin/events/:id', deleteEvent);
app.post('/api/admin/batches', createBatch);
app.put('/api/admin/batches/:id', updateBatch);
app.delete('/api/admin/batches/:id', deleteBatch);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT} com suporte a WebSockets`);
  console.log(`🌐 Acesse o site em: http://localhost:${PORT}`);
  console.log(`🛡️ Acesse o painel admin em: http://localhost:${PORT}/admin.html`);
});