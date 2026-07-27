import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET /api/topics -> all topics with quiz & flashcard counts
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        t.id, t.slug, t.name, t.description, t.icon, t.color,
        (SELECT COUNT(*) FROM quiz_questions q WHERE q.topic_id = t.id) AS quizCount,
        (SELECT COUNT(*) FROM flashcards f WHERE f.topic_id = t.id)      AS flashcardCount
      FROM topics t
      ORDER BY t.id
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
