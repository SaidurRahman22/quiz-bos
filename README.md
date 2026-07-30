# 🧠 Quiz Boss

A modern, responsive **quiz & flashcard** web app built with **React + Vite + Bootstrap**, backed by a **MySQL** database (`Quiz_boss`). No login required — just open it and start learning.

- **Accounts** — animated login / registration (no email verification), secure JWT sessions
- **Performance dashboard** — logged-in users get an animated stats dashboard (accuracy trend, per-topic
  accuracy, overall-accuracy donut, recent activity) powered by [Recharts](https://recharts.org)
- **900 quiz questions** across 4 topics (225 each): Nursing, General Knowledge, English, World Geo Politics
- **250 study flashcards** across the same 4 topics (~62 each)
- **Difficulty toggle — Easy / Medium / Hard / Mix** on both quizzes and flashcards (Mix = a random blend of all levels)
- Each quiz play-through serves **15 random questions** drawn from the chosen difficulty pool
- Instant answer feedback with explanations, animated score ring, per-item difficulty tags
- Flip-card study mode with keyboard navigation and "known" tracking
- Light / dark theme toggle, glassmorphism UI, gradient accents, fully responsive

---

## 🗂 Project structure

```
Test Agent/
├── server/                  # Node + Express + mysql2 API
│   ├── index.js             # API server (port 4000)
│   ├── setup.js             # Creates the Quiz_boss DB, tables, and seeds data
│   ├── schema.sql           # Reference SQL schema
│   ├── config.js  db.js     # Config + connection pool
│   ├── routes/              # /api/topics, /api/quizzes/:slug, /api/flashcards/:slug
│   └── data/
│       ├── topics.js        # Topic metadata (name, icon, color)
│       └── seed-data.json   # 100 quiz questions + 50 flashcards
└── client/                  # React + Vite + Bootstrap SPA (port 5173) — the WEB APP
    ├── src/
    │   ├── pages/           # Home, QuizTopics, QuizPlay, FlashcardTopics, FlashcardDeck
    │   ├── components/      # Navbar, TopicCard, Loader
    │   ├── pwa/             # PWA-only React bits (install/update toast) ← mobile layer
    │   ├── api.js           # Axios client (calls /api, proxied to :4000)
    │   └── styles.css       # Design system (themes, cards, animations)
    ├── pwa/                 # 📱 PWA / Android app layer — manifest, master icon, generator
    │   └── README.md        #    explains the web-vs-PWA split in detail
    └── public/pwa/          # generated app icons (192 / 512 / apple-touch)
```

---

## ✅ Prerequisites

- **Node.js 18+** (tested on v24)
- **MySQL server running on `localhost:3306`**

Database credentials are read from `server/.env`. The defaults are:

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=Quiz_boss
PORT=4000
```

> Edit `server/.env` if your MySQL user/password differ.
> Tip: `npm run test:db` probes common credentials and reports what works.

---

## 🚀 Getting started

From the project root (`Test Agent/`):

```bash
# 1. Install dependencies for both server and client
npm run install:all

# 2. Create the "Quiz_boss" database, tables, and seed all content
npm run setup:db

# 3. Start the API server  (terminal 1) -> http://localhost:4000
npm run server

# 4. Start the React app   (terminal 2) -> http://localhost:5173
npm run client
```

Then open **http://localhost:5173** in your browser.

> The Vite dev server proxies `/api/*` to the Express server on port 4000, so
> you only need to visit the client URL.

You can also run each part directly, e.g. `cd server && npm start`, `cd client && npm run dev`.

---

## 🗄 Database

`npm run setup:db` (i.e. `node server/setup.js`) is idempotent — it drops and
recreates the tables each run, then seeds them. Re-run it any time to reset.

Tables in `Quiz_boss`:

| Table            | Purpose                                                              |
| ---------------- | -------------------------------------------------------------------- |
| `topics`         | 4 topics (slug, name, description, icon, color)                      |
| `quiz_questions` | 900 questions (`options` JSON, `correct_index`, `difficulty`)        |
| `flashcards`     | 250 cards (`front`, `back`, `hint`, `difficulty`)                    |
| `users`          | accounts (`username`, `email`, bcrypt `password_hash`)               |
| `quiz_attempts`  | recorded quiz results per user (`topic_slug`, `difficulty`, `score`, `total`) |

> `users` and `quiz_attempts` are **created if missing but never dropped**, so accounts and
> history survive content reseeds (`npm run setup:db` only rebuilds the content tables).

### Security

Passwords are hashed with **bcrypt** (cost 12); sessions use signed **JWTs**. All auth/stats
queries use **prepared statements** (`pool.execute`). Auth endpoints are **rate-limited**,
security headers come from **helmet**, and inputs are validated server-side.
Set a strong **`JWT_SECRET`** in production (see `.env.example`).

Difficulty is one of `easy` / `medium` / `hard`. The original foundational
content is tagged `easy`; the advanced expansion set is `medium` / `hard`.
The **Mix** toggle option randomly blends all three levels.

## 🔌 API endpoints

| Method | Endpoint                   | Description                              |
| ------ | -------------------------- | ---------------------------------------- |
| GET    | `/api/health`              | API + DB health check                    |
| GET    | `/api/topics`              | All topics with quiz & flashcard counts  |
| GET    | `/api/quizzes/:slug`       | A topic's questions                      |
| GET    | `/api/flashcards/:slug`    | A topic's flashcards                     |
| POST   | `/api/auth/register`       | Create an account → `{ token, user }`    |
| POST   | `/api/auth/login`          | Log in (username or email) → `{ token }` |
| GET    | `/api/auth/me`             | Current user (requires token)            |
| POST   | `/api/attempts`            | Record a finished quiz (requires token)  |
| GET    | `/api/stats`               | Aggregated performance metrics (token)   |

Topic slugs: `nursing`, `general-knowledge`, `english`, `world-geo-politics`.

---

## 🛠 Tech stack

- **Frontend:** React 18, React Router 6, Vite 5, Bootstrap 5, Recharts, Axios, custom CSS design system
- **Backend:** Node.js, Express, mysql2, bcryptjs, jsonwebtoken, helmet, express-rate-limit
- **Database:** MySQL 8 (`Quiz_boss`)

## 📱 Install as an Android app (PWA)

Quiz Boss is a **Progressive Web App** — the *same* React site, made installable. On Android, open it in
Chrome and choose **menu ▸ Install app / Add to Home screen**; it launches full-screen (no browser bar)
and works offline for decks you've already opened.

The mobile layer is fully isolated and documented in **[`client/pwa/README.md`](client/pwa/README.md)** —
the manifest, the master `icon.svg`, the icon generator (`npm run icons`), and the service-worker wiring
in `vite.config.js`. Everything else is the untouched web app.

```bash
cd client && npm run build && npm run preview   # the service worker is active in the preview build
```

## 🏗 Production build

```bash
cd client && npm run build   # outputs to client/dist
```

Serve `client/dist` with any static host and point it at the running API
(configure a proxy/rewrite for `/api`, or set the API base URL in `client/src/api.js`).
