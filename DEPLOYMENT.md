# 🚀 Deploying Quiz Boss to the internet

This guide puts your app online with a public URL like `https://quiz-boss.vercel.app`.

Because Quiz Boss is **full-stack**, it deploys in two halves:

| Half | Goes to | You get |
| --- | --- | --- |
| **Backend API + MySQL database** | **Railway** | `https://<name>.up.railway.app` |
| **React frontend** | **Vercel** | `https://<name>.vercel.app` ← the link you share |

The frontend (Vercel) calls the backend (Railway) over HTTPS. The code is already
prepared for this — you just create the accounts and click through.

> You'll need three free accounts: **GitHub**, **Railway**, **Vercel**.
> Signing into all three "with GitHub" is the easiest path.

---

## Step 0 — Put the code on GitHub

Both Railway and Vercel deploy from a GitHub repository.

```bash
cd "d:/project/Test Agent"
git init
git add .
git commit -m "Quiz Boss app"
```

Then create an empty repo on github.com (e.g. `quiz-boss`) and push:

```bash
git remote add origin https://github.com/<your-username>/quiz-boss.git
git branch -M main
git push -u origin main
```

> `.gitignore` already excludes `node_modules` and `.env` (your DB password), so
> secrets are **not** uploaded. The quiz/flashcard content in
> `server/data/seed-data.json` **is** included — the backend needs it to seed.

---

## Step 1 — Backend + database on Railway

1. Go to **https://railway.app** → sign in with GitHub.
2. **New Project → Deploy from GitHub repo →** pick your `quiz-boss` repo.
3. This repo has two folders, so tell Railway to use the backend one:
   - Open the created service → **Settings → Root Directory →** set it to `server` → save.
4. Add the database: in the project canvas click **New → Database → Add MySQL**.
   Railway provisions a MySQL instance (this is your cloud replacement for the
   local MySQL on port 3306).
5. Give the backend its variables. Open your **backend service → Variables →
   New Variable** and add both:
   - `DATABASE_URL` = `${{MySQL.MYSQL_URL}}`  ← type it exactly; Railway links it to the MySQL service.
     (If your MySQL service has a different name, use that name instead of `MySQL`.)
   - `JWT_SECRET` = a long random string used to sign login tokens. Generate one with:
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - *(Optional)* `CORS_ORIGIN` = your Vercel URL once you have it (Step 2), to lock the API to your site.
6. Railway redeploys automatically. On first boot the app **auto-creates the tables
   and seeds all 900 questions + 250 flashcards** (via `ensure-seed.js`). Watch the
   **Deploy Logs** — you should see `… running one-time setup` then the insert counts.
7. Make the API public: **backend service → Settings → Networking → Generate Domain**.
   Copy the URL, e.g. `https://quiz-boss-production.up.railway.app`.

**Test the backend** — open this in your browser (use your domain):

```
https://<your-backend>.up.railway.app/api/health
```

You should see `{"status":"ok","db":"connected"}`. ✅

---

## Step 2 — Frontend on Vercel

1. Go to **https://vercel.com** → sign in with GitHub.
2. **Add New… → Project →** import your `quiz-boss` repo.
3. Configure the project:
   - **Root Directory:** click *Edit* and choose **`client`**.
   - Framework Preset should auto-detect **Vite** (build `npm run build`, output `dist`).
4. Add an **Environment Variable** (this tells the frontend where your API lives):
   - Name: `VITE_API_URL`
   - Value: `https://<your-backend>.up.railway.app/api`  ← your Railway URL **plus `/api`**
5. Click **Deploy**. After ~1 minute you get your link:

```
https://<name>.vercel.app
```

Open it — the quizzes and flashcards load from your Railway database. 🎉
That `.vercel.app` link is what you share.

---

## Step 3 — (Recommended) lock the API to your site

Right now the API accepts requests from anywhere. To restrict it to your Vercel site,
in **Railway → backend service → Variables** add:

```
CORS_ORIGIN=https://<name>.vercel.app
```

The backend already reads this variable (no code change needed) and will then only
accept requests from your frontend. Optional, but good practice.

---

## Updating content later

- Edit content locally, run `npm run setup:db` to refresh your **local** DB.
- Push to GitHub. Vercel auto-redeploys the frontend.
- The Railway backend **won't** reseed automatically (it only seeds when empty, so it
  never wipes data). To reseed the cloud DB after content changes, run a one-off:
  either use the **Railway CLI** — `railway run npm run setup` — or temporarily change
  the start command to `npm run setup && npm start` for one deploy, then change it back.

---

## Custom domain (optional)

Both platforms let you attach your own domain for free (you buy the domain elsewhere):
- **Vercel → Project → Settings → Domains** for the frontend (e.g. `quizboss.com`).
- Point the frontend there; keep the Railway URL for the API.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Site loads but **no quizzes** | `VITE_API_URL` is wrong/missing on Vercel, or missing the `/api` suffix. Fix it and redeploy. |
| `/api/health` shows `db: disconnected` | `DATABASE_URL` not set correctly on Railway, or MySQL service not linked. |
| Browser console **CORS error** | Backend not reachable, or if you set `CORS_ORIGIN`, it must exactly match your Vercel URL. |
| Railway deploy fails at seeding | Check Deploy Logs; usually the MySQL service isn't linked yet. Re-check `DATABASE_URL=${{MySQL.MYSQL_URL}}`. |
| Railway can't find the app | Root Directory must be `server`; Vercel Root Directory must be `client`. |

---

### Alternative: everything on Railway

You can also skip Vercel and serve the frontend from Railway too (add a second service
with Root Directory `client`, build `npm run build`, and a static host). But the
**Vercel + Railway** split above is the simplest and gives you the `.vercel.app` URL
you asked about.
