import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const DIFFICULTIES = ['easy', 'medium', 'hard', 'mix'];

// POST /api/attempts — record a finished quiz (auth required)
router.post('/attempts', requireAuth, async (req, res, next) => {
  try {
    const topicSlug = String(req.body?.topicSlug ?? '').trim();
    const difficulty = String(req.body?.difficulty ?? '');
    const score = Number(req.body?.score);
    const total = Number(req.body?.total);

    if (
      !topicSlug ||
      topicSlug.length > 64 ||
      !DIFFICULTIES.includes(difficulty) ||
      !Number.isInteger(score) ||
      !Number.isInteger(total) ||
      total <= 0 ||
      score < 0 ||
      score > total
    ) {
      return res.status(400).json({ error: 'Invalid attempt data.' });
    }

    await pool.execute(
      'INSERT INTO quiz_attempts (user_id, topic_slug, difficulty, score, total) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, topicSlug, difficulty, score, total]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/stats — aggregated performance metrics for the current user
router.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const uid = req.user.id;

    const [[summary]] = await pool.execute(
      `SELECT
         COUNT(*)                                   AS attempts,
         COALESCE(SUM(score), 0)                    AS correct,
         COALESCE(SUM(total), 0)                    AS answered,
         COALESCE(MAX(ROUND(score / total * 100)),0) AS bestPct
       FROM quiz_attempts WHERE user_id = ?`,
      [uid]
    );

    const [byTopic] = await pool.execute(
      `SELECT topic_slug AS slug, COUNT(*) AS attempts,
              ROUND(SUM(score) / SUM(total) * 100) AS accuracy
       FROM quiz_attempts WHERE user_id = ?
       GROUP BY topic_slug ORDER BY accuracy DESC`,
      [uid]
    );

    const [byDifficulty] = await pool.execute(
      `SELECT difficulty, COUNT(*) AS attempts,
              ROUND(SUM(score) / SUM(total) * 100) AS accuracy
       FROM quiz_attempts WHERE user_id = ?
       GROUP BY difficulty`,
      [uid]
    );

    // Oldest→newest for the trend chart (last 15 attempts).
    const [recentDesc] = await pool.execute(
      `SELECT id, topic_slug AS slug, difficulty, score, total, created_at,
              ROUND(score / total * 100) AS accuracy
       FROM quiz_attempts WHERE user_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 15`,
      [uid]
    );
    // MySQL returns SUM()/ROUND() as strings — coerce to numbers for the UI.
    const num = (v) => (v === null || v === undefined ? 0 : Number(v));
    const cleanSummary = {
      attempts: num(summary.attempts),
      correct: num(summary.correct),
      answered: num(summary.answered),
      bestPct: num(summary.bestPct),
    };
    const cleanTopic = byTopic.map((r) => ({ ...r, attempts: num(r.attempts), accuracy: num(r.accuracy) }));
    const cleanDiff = byDifficulty.map((r) => ({ ...r, attempts: num(r.attempts), accuracy: num(r.accuracy) }));
    const cleanRecent = recentDesc.map((r) => ({
      ...r,
      score: num(r.score),
      total: num(r.total),
      accuracy: num(r.accuracy),
    }));
    const trend = [...cleanRecent].reverse();

    res.json({ summary: cleanSummary, byTopic: cleanTopic, byDifficulty: cleanDiff, recent: cleanRecent, trend });
  } catch (err) {
    next(err);
  }
});

export default router;
