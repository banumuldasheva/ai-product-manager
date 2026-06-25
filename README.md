# AI Chat App

Simple streaming chat app built with the **Vercel AI SDK** and **Gemini**.

- **Backend:** Node.js + Express, Vercel AI SDK (`ai`, `@ai-sdk/google`)
- **Frontend:** React + Vite (`@ai-sdk/react` `useChat`)
- **Persistence:** SQLite locally, Postgres in production (auto-detected via `DATABASE_URL`)
- **Agent tool:** a `calculator` tool the model calls for arithmetic
- **Features:** multiple chats (sidebar), streaming responses, **Clear chat** button

## Project structure

```
.
├── server/        Express API + AI SDK + DB layer
│   ├── index.js   routes + streamText + calculator tool
│   ├── db.js      SQLite / Postgres storage
│   └── load-env.js
├── client/        React + Vite UI
│   └── src/App.jsx
├── render.yaml    Render deploy (web service + Postgres)
└── .env           GEMINI_API_KEY, PORT, optional DATABASE_URL
```

## Run locally

1. Set your key in `.env`:
   ```
   GEMINI_API_KEY=your_key_here
   ```
2. Install everything:
   ```
   npm install && npm run install:all
   ```
3. Start both server (`:3001`) and client (`:5173`):
   ```
   npm run dev
   ```
4. Open http://localhost:5173

Locally, chats are stored in `server/chat.sqlite`. The Vite dev server proxies
`/api/*` to the Express server.

## Deploy to Render

`render.yaml` is a blueprint that provisions:
- a **web service** — builds the client and runs the Express server (which also
  serves the built client in production)
- a free **Postgres** database — wired in as `DATABASE_URL`, so storage switches
  from SQLite to Postgres automatically

Set `GEMINI_API_KEY` in the Render dashboard (it is marked `sync: false`).

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/chat` | Streamed chat completion (`{ id, messages }`) |
| `GET` | `/api/chats` | List chats |
| `GET` | `/api/chats/:id/messages` | Load chat history |
| `DELETE` | `/api/chats/:id/messages` | Clear chat (used by the Clear button) |
| `DELETE` | `/api/chats/:id` | Delete a chat |
