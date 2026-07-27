// Probes common local MySQL credentials so setup can find a working login.
import mysql from 'mysql2/promise';
import 'dotenv/config';

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 3306);

const candidates = [
  { user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD ?? '' },
  { user: 'root', password: '' },
  { user: 'root', password: 'root' },
  { user: 'root', password: 'password' },
  { user: 'root', password: 'admin' },
  { user: 'root', password: 'mysql' },
  { user: 'root', password: '1234' },
  { user: 'root', password: 'toor' },
];

const tried = new Set();
for (const c of candidates) {
  const key = `${c.user}:${c.password}`;
  if (tried.has(key)) continue;
  tried.add(key);
  try {
    const conn = await mysql.createConnection({ host, port, user: c.user, password: c.password, connectTimeout: 4000 });
    await conn.query('SELECT 1');
    await conn.end();
    console.log(`SUCCESS user="${c.user}" password="${c.password}"`);
    process.exit(0);
  } catch (e) {
    console.log(`FAIL   user="${c.user}" password="${c.password}" -> ${e.code || e.message}`);
  }
}
console.error('No candidate credentials worked. Edit server/.env with valid DB_USER / DB_PASSWORD.');
process.exit(1);
