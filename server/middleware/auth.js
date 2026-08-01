import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN, ADMIN_EMAILS } from '../config.js';
import { pool } from '../db.js';

// True if the account should have admin rights (is_admin column OR allow-listed email).
export function computeIsAdmin(user) {
  if (!user) return false;
  return user.is_admin === 1 || ADMIN_EMAILS.has(String(user.email || '').toLowerCase());
}

// `tv` (token version) makes tokens revocable: bump users.token_version
// (logout-all / password change) and every previously-issued token stops verifying.
export function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, tv: user.token_version ?? 0 },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Rejects the request unless a valid `Authorization: Bearer <jwt>` is present AND the
// token's version still matches the user's current token_version (SEC-03 revocation).
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Your session is invalid or has expired.' });
  }

  try {
    const [rows] = await pool.execute('SELECT token_version FROM users WHERE id = ?', [payload.id]);
    const u = rows[0];
    if (!u || u.token_version !== (payload.tv ?? 0)) {
      return res.status(401).json({ error: 'Your session has been revoked. Please log in again.' });
    }
  } catch (err) {
    return next(err);
  }

  req.user = payload;
  next();
}

// Gate admin-only routes. Chain AFTER requireAuth: `router.use(requireAuth, requireAdmin)`.
// Looks up the live account each time (admin status is never trusted from the token).
export async function requireAdmin(req, res, next) {
  try {
    const [rows] = await pool.execute('SELECT email, is_admin FROM users WHERE id = ?', [req.user.id]);
    if (!computeIsAdmin(rows[0])) return res.status(403).json({ error: 'Admin access required.' });
    req.user.isAdmin = true;
    next();
  } catch (err) {
    next(err);
  }
}
