# 🧠 Quiz Boss

A modern, responsive **quiz & flashcard** web app built with **React + Vite + Bootstrap**, backed by a **MySQL** database (`Quiz_boss`). No login required — just open it and start learning.

- **900 quiz questions** across 4 topics (225 each): Nursing, General Knowledge, English, World Geo Politics
- **250 study flashcards** across the same 4 topics (~62 each)
- **Difficulty toggle — Easy / Medium / Hard / Mix** on both quizzes and flashcards (Mix = a random blend of all levels)
- Each quiz play-through serves **15 random questions** drawn from the chosen difficulty pool
- Instant answer feedback with explanations, animated score ring, per-item difficulty tags
- Flip-card study mode with keyboard navigation and "known" tracking
- Light / dark theme toggle, glassmorphism UI, gradient accents

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
└── client/                  # React + Vite + Bootstrap SPA (port 5173)
    └── src/
        ├── pages/           # Home, QuizTopics, QuizPlay, FlashcardTopics, FlashcardDeck
        ├── components/      # Navbar, TopicCard, Loader
        ├── api.js           # Axios client (calls /api, proxied to :4000)
        └── styles.css       # Design system (themes, cards, animations)
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

Difficulty is one of `easy` / `medium` / `hard`. The original foundational
content is tagged `easy`; the advanced expansion set is `medium` / `hard`.
The **Mix** toggle option randomly blends all three levels.

## 🔌 API endpoints

| Method | Endpoint                   | Description                            |
| ------ | -------------------------- | -------------------------------------- |
| GET    | `/api/health`              | API + DB health check                  |
| GET    | `/api/topics`              | All topics with quiz & flashcard counts |
| GET    | `/api/quizzes/:slug`       | A topic's questions                    |
| GET    | `/api/flashcards/:slug`    | A topic's flashcards                   |

Topic slugs: `nursing`, `general-knowledge`, `english`, `world-geo-politics`.

---

## 🛠 Tech stack

- **Frontend:** React 18, React Router 6, Vite 5, Bootstrap 5, Axios, custom CSS design system
- **Backend:** Node.js, Express, mysql2
- **Database:** MySQL 8 (`Quiz_boss`)

## 🏗 Production build

```bash
cd client && npm run build   # outputs to client/dist
```

Serve `client/dist` with any static host and point it at the running API
(configure a proxy/rewrite for `/api`, or set the API base URL in `client/src/api.js`).
