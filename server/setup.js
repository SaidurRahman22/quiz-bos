// Creates the Quiz_boss database, tables, and seeds them from data/seed-data.json.
// Idempotent: drops and recreates tables on each run. No mysql CLI required.
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbConfig, DB_NAME } from './config.js';
import { TOPICS } from './data/topics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSeed() {
  const p = path.join(__dirname, 'data', 'seed-data.json');
  if (!fs.existsSync(p)) {
    console.error(`\nMissing ${p}\nGenerate content first (it ships with the project).`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export async function runSetup() {
  const seed = loadSeed();

  // 1. Try to create the database. On managed hosts (e.g. Railway) the DB
  //    already exists and the user may lack CREATE privileges — that's fine.
  try {
    const root = await mysql.createConnection({ ...dbConfig, multipleStatements: true });
    await root.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await root.end();
    console.log(`✔ Database "${DB_NAME}" ready`);
  } catch (e) {
    console.log(`ℹ Skipping database creation (${e.code || e.message}); using existing "${DB_NAME}".`);
  }

  // 2. Connect to the database and (re)create the schema.
  const db = await mysql.createConnection({ ...dbConfig, database: DB_NAME, multipleStatements: true });
  await db.query(`
    SET FOREIGN_KEY_CHECKS = 0;
    DROP TABLE IF EXISTS flashcards;
    DROP TABLE IF EXISTS quiz_questions;
    DROP TABLE IF EXISTS topics;
    SET FOREIGN_KEY_CHECKS = 1;

    CREATE TABLE topics (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      slug        VARCHAR(64)  NOT NULL UNIQUE,
      name        VARCHAR(128) NOT NULL,
      description TEXT,
      icon        VARCHAR(16),
      color       VARCHAR(16)
    ) ENGINE=InnoDB;

    CREATE TABLE quiz_questions (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      topic_id      INT NOT NULL,
      question      TEXT NOT NULL,
      options       JSON NOT NULL,
      correct_index TINYINT NOT NULL,
      explanation   TEXT,
      difficulty    ENUM('easy','medium','hard') NOT NULL DEFAULT 'medium',
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE flashcards (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      topic_id   INT NOT NULL,
      front      TEXT NOT NULL,
      back       TEXT NOT NULL,
      hint       TEXT,
      difficulty ENUM('easy','medium','hard') NOT NULL DEFAULT 'easy',
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);
  console.log('✔ Content tables created');

  // 2b. User + attempts tables — created if missing, NEVER dropped, so accounts
  //     and quiz history survive content reseeds. quiz_attempts stores topic_slug
  //     (not a FK) so it is decoupled from the content tables being recreated.
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      username      VARCHAR(30)  NOT NULL UNIQUE,
      email         VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      token_version INT NOT NULL DEFAULT 0,
      created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NOT NULL,
      topic_slug VARCHAR(64) NOT NULL,
      difficulty VARCHAR(16) NOT NULL,
      score      INT NOT NULL,
      total      INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_created (user_id, created_at)
    ) ENGINE=InnoDB;

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
  console.log('✔ User tables ready (preserved across reseeds)');

  // 3. Insert topics.
  const topicId = {};
  for (const t of TOPICS) {
    const [r] = await db.query(
      'INSERT INTO topics (slug, name, description, icon, color) VALUES (?, ?, ?, ?, ?)',
      [t.slug, t.name, t.description, t.icon, t.color]
    );
    topicId[t.slug] = r.insertId;
  }
  console.log(`✔ Inserted ${TOPICS.length} topics`);

  // 4. Insert quiz questions.
  let quizCount = 0;
  for (const group of seed.quizzes) {
    const tid = topicId[group.slug];
    if (!tid) { console.warn(`  ! unknown quiz topic "${group.slug}" — skipped`); continue; }
    if (!group.questions?.length) continue;
    const values = group.questions.map((q) => [
      tid,
      q.question,
      JSON.stringify(q.options),
      q.correct_index,
      q.explanation || null,
      q.difficulty || 'medium',
    ]);
    await db.query(
      'INSERT INTO quiz_questions (topic_id, question, options, correct_index, explanation, difficulty) VALUES ?',
      [values]
    );
    quizCount += values.length;
  }
  console.log(`✔ Inserted ${quizCount} quiz questions`);

  // 5. Insert flashcards.
  let cardCount = 0;
  for (const group of seed.flashcards) {
    const tid = topicId[group.slug];
    if (!tid) { console.warn(`  ! unknown flashcard topic "${group.slug}" — skipped`); continue; }
    if (!group.cards?.length) continue;
    const values = group.cards.map((c) => [tid, c.front, c.back, c.hint || null, c.difficulty || 'easy']);
    await db.query('INSERT INTO flashcards (topic_id, front, back, hint, difficulty) VALUES ?', [values]);
    cardCount += values.length;
  }
  console.log(`✔ Inserted ${cardCount} flashcards`);

  await db.end();
  console.log('\n🎉 Quiz_boss setup complete.');
}

// Run only when invoked directly (node setup.js), not when imported.
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  runSetup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Setup failed:', err.message);
      process.exit(1);
    });
}
