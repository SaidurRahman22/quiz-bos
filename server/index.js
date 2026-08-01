import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PORT } from './config.js';
import {
  pool,
  ensureAuthSchema,
  ensureReportsSchema,
  ensureSavedSchema,
  ensureProfileSchema,
  ensurePasswordResetSchema,
} from './db.js';
import topicsRouter from './routes/topics.js';
import quizzesRouter from './routes/quizzes.js';
import flashcardsRouter from './routes/flashcards.js';
import authRouter from './routes/auth.js';
import statsRouter from './routes/stats.js';
import reportsRouter from './routes/reports.js';
import savedRouter from './routes/saved.js';
import adminRouter from './routes/admin.js';

const app = express();

// Trust the first proxy hop (Railway/Vercel) so rate-limiting sees real client IPs.
app.set('trust proxy', 1);

// Security headers. Allow cross-origin use so the Vercel frontend can call this API.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS: deny cross-origin by default; allow only the origins listed in CORS_ORIGIN
// (comma-separated, e.g. "https://quiz-bos.vercel.app"). Unset -> no cross-origin (SEC-04).
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })
);
// Rate limiters are defined BEFORE the body parsers so the avatar route can throttle
// large uploads before they are ever buffered / decompressed / parsed.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});
const reportsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reports. Please try again later.' },
});
// Guards the larger avatar-upload body so an unauthenticated flood can't force repeated
// big-body buffering before auth runs.
const avatarUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many profile updates. Please try again later.' },
});

// Profile updates can carry an avatar (image/GIF data URL) so this one path gets a larger
// body limit — throttled FIRST, and with inflate:false so a tiny gzip body can't be
// decompression-amplified (~1000x) into a huge payload before auth/rate-limiting run.
// Everything else stays tight at 64kb. This parser runs first, so the global one below
// sees the body already parsed and skips it. inflate:false also rejects compressed bodies
// globally (our client only sends plain JSON).
app.use('/api/auth/me', avatarUploadLimiter, express.json({ limit: '1.5mb', inflate: false }));
app.use(express.json({ limit: '64kb', inflate: false }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    // Don't leak internal DB error details to unauthenticated clients.
    console.error('Health check failed:', err.message);
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Content (public)
app.use('/api/topics', topicsRouter);
app.use('/api/quizzes', quizzesRouter);
app.use('/api/flashcards', flashcardsRouter);
app.use('/api/reports', reportsLimiter, reportsRouter);

// Auth (rate-limited) + user stats (auth-protected inside the router)
app.use('/api/auth', authLimiter, authRouter);
app.use('/api', statsRouter);
app.use('/api/saved', savedRouter);
app.use('/api/admin', adminRouter);

// 404 + error handlers
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Run idempotent boot migrations (token_version column + question_reports table),
// then start listening regardless of migration outcome.
Promise.all([
  ensureAuthSchema(),
  ensureReportsSchema(),
  ensureSavedSchema(),
  ensureProfileSchema(),
  ensurePasswordResetSchema(),
])
  .catch((err) => console.error('Schema migration failed:', err))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Quiz Boss API listening on http://localhost:${PORT}`);
    });
  });
