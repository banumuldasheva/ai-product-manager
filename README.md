# Full-Stack Template

A minimal full-stack starter using React (Vite) on the frontend and Node.js + Express on the backend, with Sequelize ORM for database access. It runs on SQLite locally — no database to install — and deploys for free on Render, where it automatically switches to Postgres.

## Stack

- **Frontend:** React 18 + Vite 5 (JavaScript)
- **Backend:** Node.js + Express, ES modules
- **Database:** Sequelize ORM — SQLite locally, PostgreSQL on Render (same `DATABASE_URL` env var drives both)
- **Deploy:** Render free tier (free web service + free Postgres), provisioned via `render.yaml`

## Project structure

```
.
├── backend/
│   ├── package.json
│   ├── server.js
│   └── db.js
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── styles.css
├── Dockerfile
├── render.yaml
├── .env.example
└── .gitignore
```

## Local development

No database to install — SQLite is built in and created automatically on first run.

**Terminal 1 — backend:**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The frontend proxies `/api` requests to the backend on port 3001.

## Deploy to Render

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New → Blueprint** → connect your repo.
3. Render reads `render.yaml` and provisions a free Postgres database and a free web service. `DATABASE_URL` is wired automatically — no copy-pasting connection strings.

**Note:** Free web services sleep after inactivity (~30s cold start on first request). Free Postgres databases expire after 30 days and must be recreated.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/hello` | Returns `{ message: "Hello from the backend 👋" }` |
| GET | `/api/health` | Returns `{ status: "ok", db: "sqlite" \| "postgres" }` |
| GET | `*` | Serves the built frontend (production only) |
