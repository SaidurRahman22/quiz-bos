import 'dotenv/config';

// Supports three ways to configure the DB, in priority order:
//   1. A single connection URL:  DATABASE_URL / MYSQL_URL   (Railway, most hosts)
//   2. Railway-style discrete vars: MYSQLHOST / MYSQLPORT / MYSQLUSER / ...
//   3. Local .env vars: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
function fromUrl(u) {
  const url = new URL(u);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || undefined,
  };
}

const connUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
const parsed = connUrl ? fromUrl(connUrl) : null;

export const dbConfig = {
  host: parsed?.host || process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
  port: Number(parsed?.port || process.env.DB_PORT || process.env.MYSQLPORT || 3306),
  user: parsed?.user || process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: parsed?.password ?? process.env.DB_PASSWORD ?? process.env.MYSQLPASSWORD ?? '',
  // Some managed hosts require TLS. Set DB_SSL=true to enable.
  ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
};

export const DB_NAME =
  parsed?.database || process.env.DB_NAME || process.env.MYSQLDATABASE || 'Quiz_boss';

export const PORT = Number(process.env.PORT || 4000);
