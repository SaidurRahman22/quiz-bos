import mysql from 'mysql2/promise';
import { dbConfig, DB_NAME } from './config.js';

// Pool used by the API. `setup.js` creates the database/tables first.
export const pool = mysql.createPool({
  ...dbConfig,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Idempotent migration: guarantee the token_version revocation column exists (SEC-03).
// Safe to run on every boot — swallows "column already exists" and "table not created
// yet" (a fresh DB gets the column from setup.js instead).
export async function ensureAuthSchema() {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0');
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_NO_SUCH_TABLE') throw err;
  }
}
