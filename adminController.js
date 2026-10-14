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

// 2. Criar Lote de Ingressos
async function createBatch(req, res) {
  const { eventId, name, price, totalQuantity } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO batches (event_id, name, price, total_quantity, status) VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
      [eventId, name, price, totalQuantity]
    );
    const batch = result.rows[0];
    await initBatchInventory(batch.id, totalQuantity);
    res.status(201).json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 3. Editar Lote (Preço e/ou Estoque)
async function updateBatch(req, res) {
  const { id } = req.params;
  const { name, price, totalQuantity } = req.body;
  try {
    const result = await pool.query(
      `UPDATE batches SET name = $1, price = $2, total_quantity = $3 WHERE id = $4 RETURNING *`,
      [name, price, totalQuantity, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lote não encontrado.' });
    }

    // Atualiza também o estoque no Redis
    await initBatchInventory(id, totalQuantity);

    res.json({ message: 'Lote atualizado com sucesso!', batch: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 4. Apagar Lote (Remoção no PostgreSQL e Redis)
async function deleteBatch(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(`DELETE FROM batches WHERE id = $1 RETURNING *`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lote não encontrado.' });
    }

    // Remove do Redis
    await redis.del(`inventory:batch:${id}`);

    res.json({ message: 'Lote removido com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 5. Apagar Evento (Remoção em cascata)
async function deleteEvent(req, res) {
  const { id } = req.params;
  try {
    // Busca os lotes para remover do Redis também
    const batches = await pool.query(`SELECT id FROM batches WHERE event_id = $1`, [id]);
    for (const b of batches.rows) {
      await redis.del(`inventory:batch:${b.id}`);
    }

    await pool.query(`DELETE FROM events WHERE id = $1`, [id]);
    res.json({ message: 'Evento e seus lotes associados foram apagados!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 6. Listar Métricas Gerais + Todos os Lotes para o Admin
async function getAdminMetrics(req, res) {
  try {
    const events = await pool.query('SELECT * FROM events ORDER BY created_at DESC');
    const batches = await pool.query(`
      SELECT b.*, e.title as event_title 
      FROM batches b 
      LEFT JOIN events e ON b.event_id = e.id 
      ORDER BY b.created_at DESC
    `);
    const orders = await pool.query("SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_revenue FROM orders WHERE status = 'paid'");
    const tickets = await pool.query("SELECT COUNT(*) as valid_tickets FROM tickets WHERE status = 'valid'");

    res.json({
      events: events.rows,
      batches: batches.rows,
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