import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET /api/flashcards/:slug -> topic + its flashcards
router.get('/:slug', async (req, res, next) => {
  try {
    const [topics] = await pool.query('SELECT * FROM topics WHERE slug = ?', [req.params.slug]);
    if (!topics.length) return res.status(404).json({ error: 'Topic not found' });

    const [cards] = await pool.query(
      'SELECT id, front, back, hint, difficulty FROM flashcards WHERE topic_id = ? ORDER BY id',
      [topics[0].id]
    );

    res.json({ topic: topics[0], cards });
  } catch (err) {
    next(err);
  }
});

export default router;
