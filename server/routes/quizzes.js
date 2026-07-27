import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET /api/quizzes/:slug -> topic + its questions
router.get('/:slug', async (req, res, next) => {
  try {
    const [topics] = await pool.query('SELECT * FROM topics WHERE slug = ?', [req.params.slug]);
    if (!topics.length) return res.status(404).json({ error: 'Topic not found' });

    const [rows] = await pool.query(
      `SELECT id, question, options, correct_index AS correctIndex, explanation, difficulty
       FROM quiz_questions WHERE topic_id = ? ORDER BY id`,
      [topics[0].id]
    );

    // mysql2 returns JSON columns already parsed; normalize just in case.
    const questions = rows.map((r) => ({
      ...r,
      options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options,
    }));

    res.json({ topic: topics[0], questions });
  } catch (err) {
    next(err);
  }
});

export default router;
