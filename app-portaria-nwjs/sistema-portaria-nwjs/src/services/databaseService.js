const Database = require('better-sqlite3');
const path = require('path');

// Inicializa o banco SQLite local no armazenamento do NW.js
const dbPath = path.join(nw.App.dataPath, 'portaria_local.db');
const db = new Database(dbPath);

// Criação das tabelas locais offline
db.exec(`
  CREATE TABLE IF NOT EXISTS local_tickets (
    id TEXT PRIMARY KEY,
    batch_id TEXT,
    holder_name TEXT,
    holder_cpf TEXT,
    status TEXT DEFAULT 'valid',
    used_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT,
    scanned_at TEXT,
    synced INTEGER DEFAULT 0
  );
`);

/**
 * Registra o ingresso como utilizado offline
 */
function markTicketUsed(ticketId) {
  const scannedAt = new Date().toISOString();
  
  const updateStmt = db.prepare(`UPDATE local_tickets SET status = 'used', used_at = ? WHERE id = ?`);
  const logStmt = db.prepare(`INSERT INTO sync_logs (ticket_id, scanned_at) VALUES (?, ?)`);

  const transaction = db.transaction(() => {
    updateStmt.run(scannedAt, ticketId);
    logStmt.run(ticketId, scannedAt);
  });

  transaction();
}

/**
 * Consulta status local do ingresso
 */
function getLocalTicket(ticketId) {
  return db.prepare(`SELECT * FROM local_tickets WHERE id = ?`).get(ticketId);
}

module.exports = { db, markTicketUsed, getLocalTicket };
