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

// Add the profile columns (avatar data-URL/URL + admin flag). Idempotent — one ALTER
// per column so an already-migrated DB just skips the duplicates.
export async function ensureProfileSchema() {
  const alters = [
    'ALTER TABLE users ADD COLUMN avatar LONGTEXT NULL',
    'ALTER TABLE users ADD COLUMN is_admin TINYINT NOT NULL DEFAULT 0',
  ];
  for (const sql of alters) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_NO_SUCH_TABLE') throw err;
    }
  }
}

// Password-reset tokens. Only the SHA-256 hash of the token is stored, never the raw
// token, so a DB leak can't be used to reset passwords.
export async function ensurePasswordResetSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_token (token_hash),
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB
  `);
}

// Idempotent migration: guarantee the question_reports table exists so user-submitted
// reports survive content reseeds (which drop/recreate the content tables). Safe to run
// on every boot — CREATE TABLE IF NOT EXISTS is a no-op when the table is already there.
export async function ensureReportsSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_reports (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      question_id INT NOT NULL,
      topic_slug  VARCHAR(64) NOT NULL,
      reason      VARCHAR(280),
      user_id     INT NULL,
      created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_question (question_id)
    ) ENGINE=InnoDB;
  `);
}

// Idempotent migration: guarantee the saved_questions table exists so a user's saved
// deck survives content reseeds. Rows store a denormalized snapshot of the question
// (not a FK to quiz_questions) so the deck stays renderable after the content tables
// are dropped/recreated. Safe to run on every boot — CREATE TABLE IF NOT EXISTS is a
// no-op when the table is already there.
export async function ensureSavedSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS saved_questions (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      user_id       INT NOT NULL,
      question_id   INT NOT NULL,
      topic_slug    VARCHAR(64) NOT NULL,
      question      TEXT NOT NULL,
      options       JSON NOT NULL,
      correct_index TINYINT NOT NULL,
      explanation   TEXT,
      difficulty    VARCHAR(16) NOT NULL DEFAULT 'medium',
      created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_q (user_id, question_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB;
  `);
}
