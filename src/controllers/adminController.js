// src/controllers/adminController.js
const pool = require('../config/database');
const { initBatchInventory } = require('../services/inventoryService');

// 1. Criar Novo Evento
async function createEvent(req, res) {
  const { title, slug, producerId } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO events (title, slug, producer_id, status) VALUES ($1, $2, $3, 'published') RETURNING *`,
      [title, slug, producerId || '00000000-0000-0000-0000-000000000000']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 2. Criar Lote de Ingressos e carregar estoque no Redis automaticamente
async function createBatch(req, res) {
  const { eventId, name, price, totalQuantity } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO ticket_batches (event_id, name, price, total_quantity, status) VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
      [eventId, name, price, totalQuantity]
    );

    const batch = result.rows[0];

    // Carrega o estoque no Redis na hora!
    await initBatchInventory(batch.id, totalQuantity);

    res.status(201).json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 3. Listar Métricas Gerais para o Admin
async function getAdminMetrics(req, res) {
  try {
    const events = await pool.query('SELECT * FROM events ORDER BY created_at DESC');
    const orders = await pool.query("SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_revenue FROM orders WHERE status = 'paid'");
    const tickets = await pool.query("SELECT COUNT(*) as valid_tickets FROM tickets WHERE status = 'valid'");

    res.json({
      events: events.rows,
      metrics: {
        totalOrders: orders.rows[0].total_orders,
        totalRevenue: orders.rows[0].total_revenue,
        validTickets: tickets.rows[0].valid_tickets
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { createEvent, createBatch, getAdminMetrics };