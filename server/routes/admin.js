import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Every admin route requires a logged-in admin. Admin status is verified against the
// live DB row (never trusted from the token) inside requireAdmin.
router.use(requireAuth, requireAdmin);

const DIFFICULTIES = ['easy', 'medium', 'hard'];

// Validate + normalize a question payload. Returns { value } or { error }.
function parseQuestion(body) {
  const question = String(body?.question ?? '').trim();
  const options = body?.options;
  const correctIndex = Number(body?.correctIndex);
  const explanation = String(body?.explanation ?? '').trim();
  const rawDifficulty = String(body?.difficulty ?? '');

  if (!question || question.length > 2000) return { error: 'Question text is required (max 2000 chars).' };
  if (!Array.isArray(options) || options.length < 2 || options.length > 6)
    return { error: 'Provide between 2 and 6 options.' };
  const opts = options.map((o) => String(o ?? '').trim());
  if (opts.some((o) => !o || o.length > 500))
    return { error: 'Each option must be non-empty (max 500 chars).' };
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > opts.length - 1)
    return { error: 'correctIndex must point at one of the options.' };
  const difficulty = DIFFICULTIES.includes(rawDifficulty) ? rawDifficulty : 'medium';

  return {
    value: {
      question,
      options: opts,
      correctIndex,
      explanation: explanation ? explanation.slice(0, 4000) : null,
      difficulty,
    },
  };
}

function rowToQuestion(r) {
  return { ...r, options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options };
}

// GET /api/admin/topics — topics with their question counts (for the picker).
router.get('/topics', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.slug, t.name, t.icon, t.color,
              COUNT(q.id) AS questionCount
         FROM topics t
         LEFT JOIN quiz_questions q ON q.topic_id = t.id
         GROUP BY t.id
         ORDER BY t.name`
    );
    res.json({ topics: rows.map((r) => ({ ...r, questionCount: Number(r.questionCount) })) });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/questions?topic=slug — all questions for a topic (full detail).
router.get('/questions', async (req, res, next) => {
  try {
    const slug = String(req.query?.topic ?? '').trim();
    if (!slug) return res.status(400).json({ error: 'A topic is required.' });

    const [topics] = await pool.execute('SELECT id FROM topics WHERE slug = ? LIMIT 1', [slug]);
    if (!topics.length) return res.status(404).json({ error: 'Topic not found.' });

    const [rows] = await pool.execute(
      `SELECT id, question, options, correct_index AS correctIndex, explanation, difficulty
         FROM quiz_questions WHERE topic_id = ? ORDER BY id DESC`,
      [topics[0].id]
    );
    res.json({ questions: rows.map(rowToQuestion) });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/questions — create a question under a topic (by slug).
router.post('/questions', async (req, res, next) => {
  try {
    const slug = String(req.body?.topicSlug ?? '').trim();
    if (!slug) return res.status(400).json({ error: 'A topic is required.' });

    const parsed = parseQuestion(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const [topics] = await pool.execute('SELECT id FROM topics WHERE slug = ? LIMIT 1', [slug]);
    if (!topics.length) return res.status(404).json({ error: 'Topic not found.' });

    const { question, options, correctIndex, explanation, difficulty } = parsed.value;
    const [result] = await pool.execute(
      `INSERT INTO quiz_questions (topic_id, question, options, correct_index, explanation, difficulty)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [topics[0].id, question, JSON.stringify(options), correctIndex, explanation, difficulty]
    );
    res.status(201).json({
      question: { id: result.insertId, question, options, correctIndex, explanation, difficulty },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/questions/:id — update an existing question.
router.put('/questions/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid question id.' });

    const parsed = parseQuestion(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const { question, options, correctIndex, explanation, difficulty } = parsed.value;
    const [result] = await pool.execute(
      `UPDATE quiz_questions
          SET question = ?, options = ?, correct_index = ?, explanation = ?, difficulty = ?
        WHERE id = ?`,
      [question, JSON.stringify(options), correctIndex, explanation, difficulty, id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Question not found.' });
    res.json({ question: { id, question, options, correctIndex, explanation, difficulty } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/questions/:id
router.delete('/questions/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid question id.' });

    const [result] = await pool.execute('DELETE FROM quiz_questions WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Question not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
