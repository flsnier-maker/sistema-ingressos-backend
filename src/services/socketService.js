const { Server } = require('socket.io');

let io;

/**
 * Inicializa o servidor WebSockets ligado ao servidor HTTP
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*', // Em produção, limite para a URL do seu Painel Web
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Cliente conectado: ${socket.id}`);

    // Permite que o produtor entre na "sala" exclusiva do seu evento
    socket.on('join_event_room', (eventId) => {
      socket.join(`event:${eventId}`);
      console.log(`[WebSocket] Socket ${socket.id} entrou na sala do evento: ${eventId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Notifica o painel do produtor em tempo real sobre uma nova venda
 */
function notifyNewSale(eventId, saleData) {
  if (io) {
    io.to(`event:${eventId}`).emit('new_sale', saleData);
    console.log(`[WebSocket] Notificação de venda enviada para o evento ${eventId}`);
  }
}

module.exports = { initSocket, notifyNewSale };