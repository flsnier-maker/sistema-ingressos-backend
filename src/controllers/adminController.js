// src/controllers/adminController.js
const pool = require('../config/database');
const { initBatchInventory, redis } = require('../services/inventoryService');

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

// 2. Criar Lote de Ingressos (grava em batches e ticket_batches para compatibilidade total)
async function createBatch(req, res) {
  const { eventId, name, price, totalQuantity } = req.body;
  try {
    let batch;
    try {
      const result = await pool.query(
        `INSERT INTO batches (event_id, name, price, total_quantity, status) VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
        [eventId, name, price, totalQuantity]
      );
      batch = result.rows[0];
    } catch (e) {
      const result = await pool.query(
        `INSERT INTO ticket_batches (event_id, name, price, total_quantity, status) VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
        [eventId, name, price, totalQuantity]
      );
      batch = result.rows[0];
    }
    
    await initBatchInventory(batch.id, totalQuantity);
    res.status(201).json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 3. Editar Lote
async function updateBatch(req, res) {
  const { id } = req.params;
  const { name, price, totalQuantity } = req.body;
  try {
    try {
      await pool.query(
        `UPDATE batches SET name = $1, price = $2, total_quantity = $3 WHERE id = $4`,
        [name, price, totalQuantity, id]
      );
    } catch (e) {}

    try {
      await pool.query(
        `UPDATE ticket_batches SET name = $1, price = $2, total_quantity = $3 WHERE id = $4`,
        [name, price, totalQuantity, id]
      );
    } catch (e) {}

    await initBatchInventory(id, totalQuantity);
    res.json({ message: 'Lote atualizado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 4. Apagar Lote
async function deleteBatch(req, res) {
  const { id } = req.params;
  try {
    try { await pool.query(`DELETE FROM batches WHERE id = $1`, [id]); } catch (e) {}
    try { await pool.query(`DELETE FROM ticket_batches WHERE id = $1`, [id]); } catch (e) {}

    await redis.del(`inventory:batch:${id}`);
    res.json({ message: 'Lote removido com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 5. Apagar Evento
async function deleteEvent(req, res) {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM events WHERE id = $1`, [id]);
    res.json({ message: 'Evento apagado!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 6. Listar Métricas + Todos os Lotes
async function getAdminMetrics(req, res) {
  try {
    const events = await pool.query('SELECT * FROM events ORDER BY created_at DESC');
    
    let batches = [];
    try {
      const b1 = await pool.query(`SELECT b.*, e.title as event_title FROM batches b LEFT JOIN events e ON b.event_id = e.id ORDER BY b.created_at DESC`);
      batches = b1.rows;
    } catch (e) {}

    if (batches.length === 0) {
      try {
        const b2 = await pool.query(`SELECT b.*, e.title as event_title FROM ticket_batches b LEFT JOIN events e ON b.event_id = e.id ORDER BY b.created_at DESC`);
        batches = b2.rows;
      } catch (e) {}
    }

    const orders = await pool.query("SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_revenue FROM orders WHERE status = 'paid'");
    const tickets = await pool.query("SELECT COUNT(*) as valid_tickets FROM tickets WHERE status = 'valid'");

    res.json({
      events: events.rows,
      batches: batches,
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

module.exports = { createEvent, createBatch, updateBatch, deleteBatch, deleteEvent, getAdminMetrics };
