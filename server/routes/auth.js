import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;

// Precomputed hash compared against when a user isn't found, so login timing
// doesn't reveal whether an account exists (mitigates user enumeration).
const DUMMY_HASH = bcrypt.hashSync('a-non-matching-dummy-password', BCRYPT_ROUNDS);

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    if (!USERNAME_RE.test(username))
      return res.status(400).json({ error: 'Username must be 3–30 letters, numbers, or underscores.' });
    if (!EMAIL_RE.test(email) || email.length > 255)
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (password.length > 200)
      return res.status(400).json({ error: 'Password is too long.' });

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Prepared statement (parameterized) — no string concatenation.
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hash]
    );

    const user = { id: result.insertId, username };
    res.status(201).json({ token: signToken(user), user: { id: user.id, username, email } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'That username or email is already registered.' });
    next(err);
  }
});

// POST /api/auth/login  (accepts username OR email in `identifier`)
router.post('/login', async (req, res, next) => {
  try {
    const identifier = String(req.body?.identifier ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!identifier || !password)
      return res.status(400).json({ error: 'Enter your username/email and password.' });

    const [rows] = await pool.execute(
      'SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ? LIMIT 1',
      [identifier, identifier.toLowerCase()]
    );
    const user = rows[0];
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !ok) return res.status(401).json({ error: 'Invalid credentials.' });

    res.json({ token: signToken(user), user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me  (validate token, return current user)
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
