import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PORT } from './config.js';
import { pool } from './db.js';
import topicsRouter from './routes/topics.js';
import quizzesRouter from './routes/quizzes.js';
import flashcardsRouter from './routes/flashcards.js';
import authRouter from './routes/auth.js';
import statsRouter from './routes/stats.js';

const app = express();

// Trust the first proxy hop (Railway/Vercel) so rate-limiting sees real client IPs.
app.set('trust proxy', 1);

// Security headers. Allow cross-origin use so the Vercel frontend can call this API.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Allow all origins by default; set CORS_ORIGIN (e.g. your Vercel URL) to restrict.
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

// Throttle auth endpoints to blunt brute-force / credential-stuffing attacks.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

// Content (public)
app.use('/api/topics', topicsRouter);
app.use('/api/quizzes', quizzesRouter);
app.use('/api/flashcards', flashcardsRouter);

// Auth (rate-limited) + user stats (auth-protected inside the router)
app.use('/api/auth', authLimiter, authRouter);
app.use('/api', statsRouter);

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
