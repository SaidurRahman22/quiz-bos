import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { JWT_SECRET } from '../config.js';

const router = Router();

// POST /api/reports — flag a question as problematic (public; guests may report).
// If a valid Bearer token is present we attribute the report to that user, but a
// missing/invalid token never blocks the request — user_id simply falls back to null.
router.post('/', async (req, res, next) => {
  try {
    const questionId = Number(req.body?.questionId);
    const topicSlug = String(req.body?.topicSlug ?? '').trim();
    const reason = String(req.body?.reason ?? '').trim().slice(0, 280);

    if (!Number.isInteger(questionId) || questionId <= 0)
      return res.status(400).json({ error: 'Invalid report.' });
    if (!topicSlug || topicSlug.length > 64)
      return res.status(400).json({ error: 'Invalid report.' });

    // Optional auth: capture the reporter's id if a valid token was supplied.
    let userId = null;
    const header = String(req.headers.authorization ?? '');
    if (header.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(header.slice(7), JWT_SECRET);
        if (Number.isInteger(payload?.id)) userId = payload.id;
      } catch {
        userId = null;
      }
    }

    await pool.execute(
      'INSERT INTO question_reports (question_id, topic_slug, reason, user_id) VALUES (?, ?, ?, ?)',
      [questionId, topicSlug, reason || null, userId]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
