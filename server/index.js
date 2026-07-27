import express from 'express';
import cors from 'cors';
import { PORT } from './config.js';
import { pool } from './db.js';
import topicsRouter from './routes/topics.js';
import quizzesRouter from './routes/quizzes.js';
import flashcardsRouter from './routes/flashcards.js';

const app = express();
// Allow all origins by default; set CORS_ORIGIN (e.g. your Vercel URL) to restrict.
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

app.use('/api/topics', topicsRouter);
app.use('/api/quizzes', quizzesRouter);
app.use('/api/flashcards', flashcardsRouter);

// 404 + error handlers
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Quiz Boss API listening on http://localhost:${PORT}`);
});
