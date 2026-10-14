require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path'); // Módulo nativo para manipular caminhos de pastas
const { initSocket } = require('./services/socketService');
const { handleCheckout } = require('./controllers/checkoutController');
const { handlePaymentWebhook } = require('./controllers/webhookController');
const { createEvent, createBatch, getAdminMetrics } = require('./controllers/adminController');

const app = express();
app.use(express.json());

// Servir os arquivos estáticos do site (HTML/CSS/JS) da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

// Cria o servidor HTTP combinando Express e Socket.io
const server = http.createServer(app);
initSocket(server);

// Rotas da API de Checkout e Pagamentos
app.post('/api/checkout', handleCheckout);
app.post('/api/webhooks/payment', handlePaymentWebhook);

// Rotas da API do Administrador
app.get('/api/admin/metrics', getAdminMetrics);
app.post('/api/admin/events', createEvent);
app.post('/api/admin/batches', createBatch);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT} com suporte a WebSockets`);
  console.log(`🌐 Acesse o site em: http://localhost:${PORT}`);
  console.log(`🛡️ Acesse o painel admin em: http://localhost:${PORT}/admin.html`);
});