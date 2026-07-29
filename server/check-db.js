// Read-only DB inspector — connects with the SAME config the app uses
// (DATABASE_URL / DB_SSL) and prints WHERE it connected and what's there.
// Changes nothing. Use it to confirm you're pointing at the live database
// BEFORE running a reseed, and to verify counts AFTER.
//
//   $env:DB_SSL="true"; $env:DATABASE_URL="<url>"; node check-db.js
import mysql from 'mysql2/promise';
import { dbConfig, DB_NAME } from './config.js';

const redactedHost = dbConfig.host;
console.log('Connecting to:');
console.log('  host    :', redactedHost);
console.log('  port    :', dbConfig.port);
console.log('  user    :', dbConfig.user);
console.log('  database:', DB_NAME, DB_NAME && /^\d+$/.test(String(DB_NAME)) ? '  <-- ⚠ looks like a PORT, not a DB name!' : '');
console.log('  ssl     :', dbConfig.ssl ? 'on' : 'OFF');

try {
  const db = await mysql.createConnection({ ...dbConfig, database: DB_NAME });
  const [[{ v }]] = await db.query('SELECT DATABASE() AS v');
  console.log('\nServer says current database is:', v);
  const [rows] = await db.query(`
    SELECT t.slug,
      (SELECT COUNT(*) FROM quiz_questions q WHERE q.topic_id=t.id) AS quiz,
      (SELECT COUNT(*) FROM flashcards f WHERE f.topic_id=t.id)     AS cards
    FROM topics t ORDER BY t.slug`);
  let tq = 0, tf = 0;
  for (const r of rows) { tq += Number(r.quiz); tf += Number(r.cards); console.log(`  ${r.slug.padEnd(20)} quiz=${r.quiz}  cards=${r.cards}`); }
  console.log(`\n  TOTAL quiz=${tq}  cards=${tf}`);
  const [[{ users }]] = await db.query('SELECT COUNT(*) AS users FROM users').catch(() => [[{ users: 'n/a' }]]);
  console.log('  users (preserved):', users);
  await db.end();
} catch (e) {
  console.error('\nConnection/query failed:', e.code || e.message);
  process.exit(1);
}
