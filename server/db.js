// Storage layer with a single async interface.
// - Local dev: SQLite (better-sqlite3), file ./chat.sqlite
// - Production: Postgres, when DATABASE_URL is set (e.g. on Render)
import './load-env.js';
import { randomUUID } from 'node:crypto';

const usePostgres = !!process.env.DATABASE_URL;

let impl;

if (usePostgres) {
  impl = await initPostgres();
  console.log('[db] using Postgres');
} else {
  impl = await initSqlite();
  console.log('[db] using SQLite (chat.sqlite)');
}

// ---------- SQLite ----------
async function initSqlite() {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(new URL('./chat.sqlite', import.meta.url).pathname);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New chat',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      parts TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
  `);

  return {
    async listChats() {
      return db.prepare('SELECT id, title FROM chats ORDER BY created_at DESC').all();
    },
    async ensureChat(id, title) {
      db.prepare(
        'INSERT INTO chats (id, title, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING'
      ).run(id, title || 'New chat', Date.now());
    },
    async getMessages(chatId) {
      const rows = db
        .prepare('SELECT id, role, parts FROM messages WHERE chat_id = ? ORDER BY created_at')
        .all(chatId);
      return rows.map((r) => ({ id: r.id, role: r.role, parts: JSON.parse(r.parts) }));
    },
    async saveMessage(chatId, message) {
      db.prepare(
        `INSERT INTO messages (id, chat_id, role, parts, created_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET parts = excluded.parts`
      ).run(
        message.id || randomUUID(),
        chatId,
        message.role,
        JSON.stringify(message.parts ?? []),
        Date.now()
      );
    },
    async clearMessages(chatId) {
      db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId);
    },
    async deleteChat(chatId) {
      db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId);
      db.prepare('DELETE FROM chats WHERE id = ?').run(chatId);
    },
  };
}

// ---------- Postgres ----------
async function initPostgres() {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New chat',
      created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      parts JSONB NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
  `);

  return {
    async listChats() {
      const { rows } = await pool.query('SELECT id, title FROM chats ORDER BY created_at DESC');
      return rows;
    },
    async ensureChat(id, title) {
      await pool.query(
        'INSERT INTO chats (id, title, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [id, title || 'New chat', Date.now()]
      );
    },
    async getMessages(chatId) {
      const { rows } = await pool.query(
        'SELECT id, role, parts FROM messages WHERE chat_id = $1 ORDER BY created_at',
        [chatId]
      );
      return rows.map((r) => ({ id: r.id, role: r.role, parts: r.parts }));
    },
    async saveMessage(chatId, message) {
      await pool.query(
        `INSERT INTO messages (id, chat_id, role, parts, created_at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET parts = EXCLUDED.parts`,
        [message.id || randomUUID(), chatId, message.role, JSON.stringify(message.parts ?? []), Date.now()]
      );
    },
    async clearMessages(chatId) {
      await pool.query('DELETE FROM messages WHERE chat_id = $1', [chatId]);
    },
    async deleteChat(chatId) {
      await pool.query('DELETE FROM messages WHERE chat_id = $1', [chatId]);
      await pool.query('DELETE FROM chats WHERE id = $1', [chatId]);
    },
  };
}

export const listChats = (...a) => impl.listChats(...a);
export const ensureChat = (...a) => impl.ensureChat(...a);
export const getMessages = (...a) => impl.getMessages(...a);
export const saveMessage = (...a) => impl.saveMessage(...a);
export const clearMessages = (...a) => impl.clearMessages(...a);
export const deleteChat = (...a) => impl.deleteChat(...a);
