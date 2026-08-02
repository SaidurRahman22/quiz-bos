# Quiz Boss — Project Overview (for AI agents & new contributors)

> **Purpose of this file:** a single, authoritative brief so a fresh AI session (or a new
> developer) understands the whole project **without reading the entire codebase**. Point a new
> chat at this file first.
>
> **Last updated:** 2026-08-02. If you change architecture, topics, or counts, update this file.
> Note: the repo's root `README.md` is **partially outdated** (it still says "900 questions / 4
> topics / local MySQL"). Trust THIS document for current state.

---

## 1. What Quiz Boss is

A responsive **quiz & flashcard web app** for **Bangladeshi competitive-exam preparation** —
BCS, government & bank jobs, NTRCA teacher registration, BPSC/government nursing jobs, and public
university admission. Users pick a topic and difficulty, answer multiple-choice questions with
instant bilingual explanations, study flashcards, and (when logged in) track performance on an
animated dashboard. It is also an installable **PWA** (works offline for opened content).

Brand/product name in the UI: **Quiz Boss**. Internal package name: `quiz-boss`.

---

## 2. Architecture at a glance

```
   Browser / installed PWA
            │  (HTTPS)
            ▼
   ┌───────────────────┐        VITE_API_URL          ┌────────────────────┐        DATABASE_URL / DB_*        ┌──────────────────┐
   │  FRONTEND (SPA)   │  ─────  ...append "/api" ───▶ │  BACKEND (REST API) │  ─────  mysql2 pool + TLS  ─────▶ │   DATABASE        │
   │  React + Vite     │                              │  Node + Express     │                                  │  TiDB Cloud       │
   │  Hosted: Vercel   │  ◀──── JSON responses ─────  │  Hosted: Render     │  ◀──── rows ──────────────────── │  (MySQL-compatible)│
   └───────────────────┘                              └────────────────────┘                                  └──────────────────┘
```

**How the three tiers connect**

- **Frontend → Backend:** Axios client (`client/src/api.js`). Base URL = `VITE_API_URL` (e.g.
  `https://<render-app>.onrender.com/api`) in production; in local dev it's unset, so requests go
  to `/api` and Vite dev-server **proxies** them to the Express server on `:4000`.
- **Backend → Database:** a `mysql2` connection pool (`server/db.js`) using credentials from
  `server/config.js`. Supports a single `DATABASE_URL`/`MYSQL_URL`, Railway-style discrete vars,
  or local `DB_*` vars. TLS is enabled when `DB_SSL=true` (required for TiDB Cloud), validating the
  server certificate (optionally with a CA bundle via `DB_CA_CERT_PATH`).
- **CORS:** the API only allows origins listed in `CORS_ORIGIN` (comma-separated), e.g. the Vercel
  URL. JWT is sent as a `Bearer` token in the `Authorization` header (not cookies).

**Deployment**: Frontend = **Vercel**, Backend = **Render**, Database = **TiDB Cloud**.
(Historically the DB was Railway/Aiven; code still supports those env shapes.) See `DEPLOYMENT.md`.

---

## 3. Repository structure

```
Test Agent/                     # monorepo root (npm scripts orchestrate both apps)
├── package.json                # root scripts: install:all, setup:db, server, client, build
├── README.md                   # original readme (PARTIALLY OUTDATED — see note above)
├── DEPLOYMENT.md               # hosting/deploy guide
├── server/                     # ── BACKEND ──  Node + Express + mysql2 API
│   ├── index.js                # app entry: middleware, routes, boot migrations, listen(:4000)
│   ├── config.js               # env parsing: DB config, JWT, admin emails, mail, APP_URL
│   ├── db.js                   # mysql2 pool + idempotent ensure*Schema() boot migrations
│   ├── setup.js                # (re)create DB + content tables, seed from data/seed-data.json
│   ├── ensure-seed.js          # boot-time seed guard (runs before index.js via `npm start`)
│   ├── schema.sql              # reference schema (authoritative creation is in setup.js)
│   ├── email.js                # transactional email (Resend or Brevo; console fallback in dev)
│   ├── middleware/auth.js      # signToken, requireAuth, computeIsAdmin
│   ├── routes/                 # topics, quizzes, flashcards, auth, stats, reports, saved, admin
│   └── data/
│       ├── topics.js           # topic metadata (slug, name, description, icon, color)
│       ├── seed-data.json      # ALL quiz questions + flashcards (the content source of truth)
│       ├── seed-data.*.backup.json  # timestamped backups from content edits
│       └── PROJECT_OVERVIEW.md # ← this file
└── client/                     # ── FRONTEND ──  React + Vite SPA + PWA
    ├── vite.config.js          # dev proxy to :4000, PWA/service-worker config
    ├── src/
    │   ├── main.jsx            # React root + Router + context providers
    │   ├── App.jsx             # routes & layout (see routes table below)
    │   ├── api.js              # Axios client (all API calls live here)
    │   ├── pages/              # Home, QuizTopics, QuizPlay, FlashcardTopics, FlashcardDeck,
    │   │                       #   Login, Register, ForgotPassword, ResetPassword, Profile,
    │   │                       #   SavedQuestions, Settings, Admin
    │   ├── components/         # Navbar, TopicCard, Dashboard, Bilingual, DifficultyToggle,
    │   │                       #   AuthLayout, FloatingField, CountUp, Loader
    │   ├── context/            # AuthContext (JWT/user), ThemeContext (light/dark)
    │   ├── pwa/                # install/update prompt, notifications, offline content
    │   ├── streak.js badges.js # client-side streak & badge computation (localStorage-backed)
    │   ├── tokenStore.js       # JWT storage helper
    │   ├── tts.js shareCard.js utils.js
    │   └── styles.css          # design system (themes, cards, animations)
    └── pwa/                    # manifest, master icon.svg, icon generator (npm run icons)
```

---

## 4. Frontend

- **Stack:** React 18, React Router 6, Vite 5, Bootstrap 5, **Recharts 3** (dashboard charts),
  Axios. Custom CSS design system in `styles.css` (glassmorphism, gradients, light/dark themes).
- **PWA:** `vite-plugin-pwa` (Workbox). Installable on Android/desktop; offline access to opened
  decks; update toast via `pwa/PWAUpdatePrompt.jsx`.
- **State/contexts:** `AuthContext` (current user + JWT, hydrated from `getMe()`), `ThemeContext`
  (persisted light/dark). No Redux.
- **Routes** (`App.jsx`):

  | Path | Page | Notes |
  | --- | --- | --- |
  | `/` | Home | landing + topic entry |
  | `/quizzes` | QuizTopics | choose a topic |
  | `/quizzes/:slug` | QuizPlay | difficulty toggle → 15 random Qs, instant feedback |
  | `/flashcards` | FlashcardTopics | choose a deck |
  | `/flashcards/:slug` | FlashcardDeck | flip-card study, keyboard nav, "known" tracking |
  | `/profile` | Profile | account, avatar, change password |
  | `/saved` | SavedQuestions | user's saved question deck |
  | `/settings` | Settings | preferences |
  | `/admin` | Admin | question CRUD (admin accounts only) |
  | `/login` `/register` `/forgot-password` `/reset-password` | Auth | full-screen, no app chrome |

- **Quiz play model:** `GET /api/quizzes/:slug` returns **all** questions for a topic; the client
  filters by the chosen difficulty (`easy`/`medium`/`hard`/`mix`) and serves **15 random** per
  play-through. Answers, scoring, and the score ring are client-side; a finished quiz is POSTed to
  `/api/attempts` (auth only).
- **Bilingual rendering:** `components/Bilingual.jsx` renders the Bangla-medium content (see §8).

---

## 5. Backend

- **Stack:** Node.js (ESM, `"type":"module"`), Express 4, `mysql2/promise`, `bcryptjs`,
  `jsonwebtoken`, `helmet`, `express-rate-limit`, `cors`, `dotenv`.
- **Entry:** `server/index.js` — sets `trust proxy`, helmet, CORS allowlist, tiered JSON body
  limits (64 kb default; a scoped 1.5 mb limit only for the avatar `PATCH /api/auth/me`), route
  mounts, 404/error handlers. On boot it runs idempotent `ensure*Schema()` migrations, then listens
  on `PORT` (default **4000**).
- **Routes / API:**

  | Method | Endpoint | Auth | Description |
  | --- | --- | --- | --- |
  | GET | `/api/health` | – | API + DB health check |
  | GET | `/api/topics` | – | all topics with quiz & flashcard counts |
  | GET | `/api/quizzes/:slug` | – | a topic + its questions |
  | GET | `/api/flashcards/:slug` | – | a topic's flashcards |
  | POST | `/api/reports` | optional | report a bad question (rate-limited) |
  | POST | `/api/auth/register` | – | create account → `{ token, user }` |
  | POST | `/api/auth/login` | – | login (username or email) → `{ token, user }` |
  | GET | `/api/auth/me` | ✔ | current user (runs every page load) |
  | PATCH | `/api/auth/me` | ✔ | update profile/avatar (larger body limit) |
  | POST | `/api/auth/change-password` | ✔ | change password |
  | POST | `/api/auth/forgot-password` | – | email a reset link (hashed token) |
  | POST | `/api/auth/reset-password` | – | consume reset token |
  | POST | `/api/auth/logout-all` | ✔ | bump `token_version` to revoke all JWTs |
  | POST | `/api/attempts` | ✔ | record a finished quiz |
  | GET | `/api/stats` | ✔ | aggregated dashboard metrics |
  | GET/POST/DELETE | `/api/saved` `/api/saved/:id` | ✔ | saved-question deck |
  | GET/POST/PUT/DELETE | `/api/admin/*` | ✔ admin | question CRUD |

- **Auth:** `middleware/auth.js`. JWT signed with `JWT_SECRET` (≥32 chars, required — no fallback).
  `token_version` in the token is checked against the DB so `logout-all` / password change revokes
  outstanding tokens. Admins are granted by `ADMIN_EMAILS` (env) **or** the `users.is_admin` column.
- **Security:** bcrypt cost 12; prepared statements everywhere (`pool.execute`); helmet headers;
  rate limits on auth (40/15 min), reports (30/15 min), avatar upload (30/15 min); login uses a
  dummy-hash compare to avoid user-enumeration timing; reset tokens stored only as SHA-256 hashes;
  avatar input strictly validated (safe raster data-URLs or https URLs only — no SVG/`javascript:`).

---

## 6. Database

- **Provider:** **TiDB Cloud** (MySQL-compatible), reached over TLS. Local dev can use any MySQL 8.
  Connection resolved in `config.js` (priority: `DATABASE_URL`/`MYSQL_URL` → discrete `MYSQL*` →
  local `DB_*`). Default DB name: `Quiz_boss`.
- **Tables:**

  | Table | Lifecycle | Purpose |
  | --- | --- | --- |
  | `topics` | content (dropped+reseeded) | slug, name, description, icon, color |
  | `quiz_questions` | content (dropped+reseeded) | `question`, `options` JSON (4), `correct_index` (0–3), `explanation`, `difficulty` |
  | `flashcards` | content (dropped+reseeded) | `front`, `back`, `hint`, `difficulty` |
  | `users` | **preserved** | `username`, `email`, bcrypt `password_hash`, `token_version`, `avatar`, `is_admin` |
  | `quiz_attempts` | **preserved** | per-user results: `topic_slug`, `difficulty`, `score`, `total` |
  | `password_resets` | **preserved** | hashed reset tokens + expiry |
  | `question_reports` | **preserved** | user-submitted bad-question reports |
  | `saved_questions` | **preserved** | denormalized snapshot of a user's saved questions |

- **Seeding model (important):** `node server/setup.js` (`npm run setup:db`) is **idempotent** but
  **drops and recreates the content tables** (`topics`, `quiz_questions`, `flashcards`) from
  `server/data/seed-data.json`, then re-inserts topics from `server/data/topics.js`. User/history
  tables are **created if missing but never dropped**, so accounts, attempts, saved decks, and
  reports survive a content reseed. **To add/edit content you edit `topics.js` + `seed-data.json`,
  then reseed.**
- **`seed-data.json` shape:**
  ```json
  { "quizzes":   [ { "slug": "ict", "questions": [ { "question": "...", "options": ["..","..","..",".."], "correct_index": 0, "explanation": "...", "difficulty": "medium" } ] } ],
    "flashcards":[ { "slug": "ict", "cards":     [ { "front": "...", "back": "...", "hint": "...", "difficulty": "easy" } ] } ] }
  ```

---

## 7. Dependencies

- **Client:** `react`, `react-dom`, `react-router-dom`, `axios`, `bootstrap`, `recharts`;
  dev: `vite`, `@vitejs/plugin-react`, `vite-plugin-pwa`, `@resvg/resvg-js` (icon generation).
- **Server:** `express`, `mysql2`, `bcryptjs`, `jsonwebtoken`, `helmet`, `express-rate-limit`,
  `cors`, `dotenv`.
- **Runtime:** Node.js ≥18 (developed/tested on v24).

---

## 8. Content model & quiz-authoring style ⭐ (follow this exactly)

All new quiz content uses **Bangla-medium stems with English terms/acronyms inline** — the question
and options are written in Bengali prose, but proper nouns, acronyms, numbers, and technical terms
stay in **English** inline. The **explanation is a single flowing text** that mixes Bangla + English
naturally (**NOT** two separate lines, and **no** separate English-translation line).

**Examples (the target style):**
```
Q: NATO এর সদর দপ্তর কোথায়?
Q: ISIS কোন দেশের সন্ত্রাসী সংগঠন?
Q: সৌরজগতের বৃহত্তম planet কোনটি?   options: ["Jupiter","Saturn","Neptune","Earth"]
explanation: "Jupiter হলো সৌরজগতের বৃহত্তম planet, এর diameter পৃথিবীর প্রায় 11 গুণ।"
```

**Per-topic language rules:**
- `general-knowledge`, `world-geo-politics`, `bangla`, `ict` → question + options + explanation all
  Bangla-medium with English inline.
- `english` (tests the English language itself) → **stem + options stay in English**; only the
  **explanation** is Bangla-with-English-terms inline. Never translate the English test material.

**Quality rules for authoring:** exactly 4 options with one correct; vary `correct_index` across a
set (even 0/1/2/3 spread); plausible same-category distractors; explanation says *why* the answer is
right; difficulty mix roughly 20–25% easy / 50% medium / 25–30% hard; Bengali spelling 100% correct
(কার/য-ফলা/রেফ/ণত্ব-ষত্ব বিধান, proper যুক্তবর্ণ); no HTML entities (`&lt;` etc.) — use real `<`/`>`.
When bulk-generating, **verify** every item (spelling + answer correctness) before writing, and
**dedupe** new questions against the existing pool.

**Topics & current content counts (as of 2026-08-02):**

| slug | name | icon | quiz Qs | flashcards |
| --- | --- | --- | --- | --- |
| `nursing` | Nursing | 🩺 | 425 | 63 |
| `general-knowledge` | General Knowledge | 🧠 | 625 | 63 |
| `english` | English | 📖 | 950 | 62 |
| `bangla` | Bangla | ✍️ | 700 | 150 |
| `ict` | ICT | 💻 | 200 | 0 |
| `world-geo-politics` | World Geo Politics | 🗺️ | 625 | 62 |
| **Total** | | | **3,525** | **400** |

Difficulty is one of `easy` / `medium` / `hard`; the UI adds a **Mix** option that blends all three.

---

## 9. Features developed to date

- **Accounts & auth:** register/login (username or email), JWT sessions, `logout-all` revocation
  (token_version), change password, **forgot/reset password via email** (Resend/Brevo; console
  fallback in dev), avatar upload, admin flag.
- **Quizzes:** 6 topics, difficulty toggle (Easy/Medium/Hard/Mix), 15 random questions per play,
  instant feedback with **bilingual explanations**, per-item difficulty tags, animated score ring.
- **Flashcards:** flip-card study mode, keyboard navigation, "known" tracking.
- **Performance dashboard** (`components/Dashboard.jsx`, logged-in): overall-accuracy donut,
  **accuracy-by-topic** horizontal bar chart, accuracy **trend** (last 15 attempts), recent
  activity list, **daily streak**, and **badges** (client-computed).
- **Saved questions:** save/unsave questions to a personal deck (survives content reseeds).
- **Report a question:** users flag bad questions (`question_reports`).
- **Admin panel:** question CRUD for admin accounts.
- **PWA:** installable, offline for opened content, update prompt, generated icons.
- **UX:** light/dark theme, glassmorphism design system, fully responsive, TTS + share-card helpers.

---

## 10. Local development, build & deploy

```bash
# from repo root
npm run install:all     # install server + client deps
npm run setup:db        # create DB + content tables, seed from seed-data.json (DROPS content tables)
npm run server          # start API  -> http://localhost:4000
npm run client          # start SPA  -> http://localhost:5173  (Vite proxies /api -> :4000)
npm run build           # production build of the client -> client/dist
```

**Environment variables**

- **Client (Vercel):** `VITE_API_URL` = deployed backend base incl. `/api`
  (e.g. `https://<render-app>.onrender.com/api`). Unset in local dev (uses the Vite proxy).
- **Server (Render):** `DATABASE_URL` (or discrete `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`),
  `DB_SSL=true` (+ optional `DB_CA_CERT_PATH`) for TiDB Cloud, `JWT_SECRET` (≥32 chars, **required**),
  `JWT_EXPIRES_IN` (default `1d`), `CORS_ORIGIN` (the Vercel URL[s]), `APP_URL` (frontend URL for
  reset links), `ADMIN_EMAILS` (comma-separated), and for email: `RESEND_API_KEY` **or**
  `BREVO_API_KEY` + `MAIL_FROM`. See `server/.env.example`.

---

## 11. Conventions & gotchas

- **Content edits ⇒ reseed:** editing `seed-data.json`/`topics.js` has no effect until
  `node server/setup.js` runs against the target DB. That reseed **drops the content tables** (users
  & history are preserved). Always back up `seed-data.json` before bulk edits (the `*.backup.json`
  files in `server/data/` are such backups).
- **Bengali font bug:** the Blink/Chromium renderer draws some Bengali glyphs (e.g. digit ১) broken
  at `font-weight: 500` with Hind Siliguri. **Use 400 / 600 / 700 for Bengali text**, never 500.
- **`correct_index` is 0-based** and must point at the correct option; `options` is always exactly 4.
- **English topic** stems/options must remain English (they test English); only explanations are
  Bangla-medium.
- **JWT is bearer-token** in `Authorization`, stored client-side (`tokenStore.js`) — not cookies.
- **Root `README.md` is stale** for counts/topics/DB — update it or defer to this file.
