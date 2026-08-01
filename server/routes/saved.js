import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const DIFFICULTIES = ['easy', 'medium', 'hard'];

// POST /api/saved — save (or re-save) a question for the current user.
// Stores a denormalized snapshot so the saved deck survives content reseeds.
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const questionId = Number(req.body?.questionId);
    const topicSlug = String(req.body?.topicSlug ?? '').trim();
    const question = String(req.body?.question ?? '').trim();
    const options = req.body?.options;
    const correctIndex = Number(req.body?.correctIndex);
    const rawExplanation = String(req.body?.explanation ?? '').trim();
    const rawDifficulty = String(req.body?.difficulty ?? '');

    if (!Number.isInteger(questionId) || questionId <= 0)
      return res.status(400).json({ error: 'Invalid question.' });
    if (!topicSlug || topicSlug.length > 64)
      return res.status(400).json({ error: 'Invalid question.' });
    if (!question)
      return res.status(400).json({ error: 'Invalid question.' });
    if (
      !Array.isArray(options) ||
      options.length < 2 ||
      options.length > 6 ||
      !options.every((o) => typeof o === 'string')
    )
      return res.status(400).json({ error: 'Invalid question.' });
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > options.length - 1)
      return res.status(400).json({ error: 'Invalid question.' });

    const questionText = question.slice(0, 4000);
    const explanation = rawExplanation ? rawExplanation.slice(0, 4000) : null;
    const difficulty = DIFFICULTIES.includes(rawDifficulty) ? rawDifficulty : 'medium';

    await pool.execute(
      `INSERT INTO saved_questions
         (user_id, question_id, topic_slug, question, options, correct_index, explanation, difficulty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         topic_slug = VALUES(topic_slug),
         question = VALUES(question),
         options = VALUES(options),
         correct_index = VALUES(correct_index),
         explanation = VALUES(explanation),
         difficulty = VALUES(difficulty)`,
      [
        req.user.id,
        questionId,
        topicSlug,
        questionText,
        JSON.stringify(options),
        correctIndex,
        explanation,
        difficulty,
      ]
    );
    res.status(201).json({ ok: true, saved: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/saved/:questionId — unsave a question for the current user.
router.delete('/:questionId', requireAuth, async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);
    if (!Number.isInteger(questionId) || questionId <= 0)
      return res.status(400).json({ error: 'Invalid question.' });

    await pool.execute('DELETE FROM saved_questions WHERE user_id = ? AND question_id = ?', [
      req.user.id,
      questionId,
    ]);
    res.json({ ok: true, saved: false });
  } catch (err) {
    next(err);
  }
});

// GET /api/saved — the current user's saved deck, newest first.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT question_id AS questionId, topic_slug AS topicSlug, question,
              options, correct_index AS correctIndex, explanation, difficulty, created_at
       FROM saved_questions WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );

    // mysql2 returns JSON columns already parsed; normalize just in case.
    const saved = rows.map((r) => ({
      ...r,
      options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options,
    }));

    res.json({ saved });
  } catch (err) {
    next(err);
  }
});

export default router;
