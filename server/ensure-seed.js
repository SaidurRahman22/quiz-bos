// Seeds the database only if it is empty. Safe to run on every startup:
// the first cloud deploy seeds; later restarts detect existing data and skip
// (so they never drop/overwrite the tables). Waits for the DB to be reachable
// first, which matters on cloud hosts where the DB may start a moment later.
import mysql from 'mysql2/promise';
import { dbConfig, DB_NAME } from './config.js';
import { runSetup } from './setup.js';

async function getConnection(tries = 12, delayMs = 3000) {
  for (let i = 1; i <= tries; i++) {
    try {
      return await mysql.createConnection({ ...dbConfig, database: DB_NAME });
    } catch (e) {
      if (e.code === 'ER_BAD_DB_ERROR') return null; // server up but DB absent -> needs setup
      console.log(`Waiting for database… (${i}/${tries}) ${e.code || e.message}`);
      if (i < tries) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Database not reachable after multiple attempts');
}

try {
  const conn = await getConnection();
  let seeded = false;
  if (conn) {
    try {
      const [rows] = await conn.query('SELECT COUNT(*) AS n FROM topics');
      seeded = rows[0].n > 0;
    } catch {
      seeded = false; // tables not created yet
    }
    await conn.end();
  }

  if (seeded) {
    console.log('✔ Database already seeded — skipping setup.');
  } else {
    console.log('… Database empty — running one-time setup.');
    await runSetup();
  }
  process.exit(0);
} catch (err) {
  console.error('ensure-seed failed:', err.message);
  process.exit(1);
}
