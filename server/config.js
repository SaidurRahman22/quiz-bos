import 'dotenv/config';
import fs from 'node:fs';

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
  // TLS to a managed DB. Validate the server certificate (SEC-02) — never accept
  // an unverified cert. Supply the provider's CA bundle via DB_CA_CERT_PATH when it
  // isn't in the system trust store (e.g. Aiven publishes a CA .pem to download).
  ...(process.env.DB_SSL === 'true'
    ? {
        ssl: {
          rejectUnauthorized: true,
          ...(process.env.DB_CA_CERT_PATH ? { ca: fs.readFileSync(process.env.DB_CA_CERT_PATH) } : {}),
        },
      }
    : {}),
};

export const DB_NAME =
  parsed?.database || process.env.DB_NAME || process.env.MYSQLDATABASE || 'Quiz_boss';

export const PORT = Number(process.env.PORT || 4000);

// JWT signing secret. REQUIRED in every environment — no committed fallback (SEC-01).
// Fail closed at startup instead of silently signing tokens with a public value.
export const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET must be set to a random string of at least 32 characters. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
  );
}
// Shorter default lifetime limits how long a stolen token stays usable (SEC-03).
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

// Admins are granted by email (comma-separated ADMIN_EMAILS) OR the users.is_admin
// column. The env route lets you bootstrap an admin without touching the DB.
export const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

// Transactional email (password reset). Configure ONE provider via its API key.
// If neither is set the reset link is logged to the server console instead (dev),
// so nothing leaks to the client and the flow is still testable.
export const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
export const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
export const MAIL_FROM = process.env.MAIL_FROM || 'Quiz Boss <onboarding@resend.dev>';

// Public URL of the frontend, used to build password-reset links.
export const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
