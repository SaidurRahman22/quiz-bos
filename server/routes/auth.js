import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { signToken, requireAuth, computeIsAdmin } from '../middleware/auth.js';
import { sendMail } from '../email.js';
import { APP_URL } from '../config.js';

const router = Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;

// Avatar may be an uploaded image/GIF (data URL) or an https image URL. Capped so a
// giant data URL can't bloat the row / body. ~1.4M chars ≈ a ~1 MB image.
const AVATAR_MAX_LEN = 1_400_000;
const AVATAR_RE = /^(data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+|https:\/\/[^\s]+)$/i;
const RESET_TTL_MIN = 60; // password-reset link lifetime

// Precomputed hash compared against when a user isn't found, so login timing
// doesn't reveal whether an account exists (mitigates user enumeration).
const DUMMY_HASH = bcrypt.hashSync('a-non-matching-dummy-password', BCRYPT_ROUNDS);

// Escape user text interpolated into the reset email's HTML body.
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// Shape the public user object returned to the client (never includes the hash).
function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatar: row.avatar ?? null,
    isAdmin: computeIsAdmin(row),
    ...(row.created_at ? { created_at: row.created_at } : {}),
  };
}

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

    const user = { id: result.insertId, username, email, avatar: null, is_admin: 0, token_version: 0 };
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
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
      'SELECT id, username, email, password_hash, token_version, avatar, is_admin FROM users WHERE username = ? OR email = ? LIMIT 1',
      [identifier, identifier.toLowerCase()]
    );
    const user = rows[0];
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !ok) return res.status(401).json({ error: 'Invalid credentials.' });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me  (validate token, return current user)
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, email, avatar, is_admin, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/me  — update editable profile fields (username, avatar). Email is
// intentionally NOT editable here. Only the fields present in the body are touched.
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const fields = [];
    const values = [];

    if (req.body?.username !== undefined) {
      const username = String(req.body.username).trim();
      if (!USERNAME_RE.test(username))
        return res.status(400).json({ error: 'Username must be 3–30 letters, numbers, or underscores.' });
      fields.push('username = ?');
      values.push(username);
    }

    if (req.body?.avatar !== undefined) {
      const raw = req.body.avatar;
      if (raw === null || raw === '') {
        fields.push('avatar = ?');
        values.push(null);
      } else {
        const avatar = String(raw);
        if (avatar.length > AVATAR_MAX_LEN)
          return res.status(400).json({ error: 'Image is too large (max ~1 MB).' });
        if (!AVATAR_RE.test(avatar))
          return res.status(400).json({ error: 'Unsupported image. Upload an image/GIF or use an https URL.' });
        fields.push('avatar = ?');
        values.push(avatar);
      }
    }

    if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });

    values.push(req.user.id);
    try {
      // Column names are fixed literals above (never user input) — safe.
      await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(409).json({ error: 'That username is already taken.' });
      throw err;
    }

    const [rows] = await pool.execute(
      'SELECT id, username, email, avatar, is_admin, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/change-password — requires the CURRENT password (no email needed).
// Revokes other sessions by bumping token_version, and returns a fresh token so the
// caller's own session keeps working.
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');
    if (newPassword.length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    if (newPassword.length > 200)
      return res.status(400).json({ error: 'New password is too long.' });

    const [rows] = await pool.execute(
      'SELECT username, password_hash, token_version FROM users WHERE id = ?',
      [req.user.id]
    );
    const u = rows[0];
    if (!u) return res.status(404).json({ error: 'User not found.' });

    const ok = await bcrypt.compare(currentPassword, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'Your current password is incorrect.' });

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.execute(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
      [hash, req.user.id]
    );

    const token = signToken({
      id: req.user.id,
      username: u.username,
      token_version: (u.token_version ?? 0) + 1,
    });
    res.json({ ok: true, token });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password — email a reset link. Always responds the same way
// (no user enumeration). Only the SHA-256 hash of the token is stored.
router.post('/forgot-password', async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const generic = { ok: true, message: 'If an account exists for that email, a reset link is on its way.' };
    if (!EMAIL_RE.test(email) || email.length > 255) return res.json(generic);

    const [rows] = await pool.execute('SELECT id, username FROM users WHERE email = ? LIMIT 1', [email]);
    const u = rows[0];
    if (u) {
      const raw = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      const expires = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000);

      await pool.execute('DELETE FROM password_resets WHERE user_id = ?', [u.id]); // one active token
      await pool.execute(
        'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [u.id, hash, expires]
      );

      const link = `${APP_URL}/reset-password?token=${raw}`;
      await sendMail({
        to: email,
        subject: 'Reset your Quiz Boss password',
        text: `Hi ${u.username},\n\nReset your password with this link (valid ${RESET_TTL_MIN} minutes):\n${link}\n\nIf you didn't request this, you can safely ignore this email.`,
        html: `<p>Hi ${escapeHtml(u.username)},</p>
<p>Reset your password with this link (valid ${RESET_TTL_MIN} minutes):</p>
<p><a href="${link}">Reset my password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>`,
      });
    }
    res.json(generic);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password — consume a reset token and set a new password.
router.post('/reset-password', async (req, res, next) => {
  try {
    const token = String(req.body?.token ?? '');
    const password = String(req.body?.password ?? '');
    if (!/^[a-f0-9]{64}$/i.test(token))
      return res.status(400).json({ error: 'Invalid or expired reset link.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (password.length > 200)
      return res.status(400).json({ error: 'Password is too long.' });

    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.execute(
      'SELECT id, user_id, expires_at FROM password_resets WHERE token_hash = ? LIMIT 1',
      [hash]
    );
    const row = rows[0];
    if (!row || new Date(row.expires_at).getTime() < Date.now())
      return res.status(400).json({ error: 'Invalid or expired reset link.' });

    const pwHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    // New password + revoke every existing session, then invalidate all reset tokens.
    await pool.execute(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
      [pwHash, row.user_id]
    );
    await pool.execute('DELETE FROM password_resets WHERE user_id = ?', [row.user_id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout-all — revoke every outstanding token for this user by
// bumping token_version, so a leaked/stolen token can be invalidated (SEC-03).
router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    await pool.execute('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
