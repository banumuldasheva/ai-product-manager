# AI Chat App

Simple streaming chat app built with the **Vercel AI SDK** and **Gemini**.

- **Backend:** Node.js + Express, Vercel AI SDK (`ai`, `@ai-sdk/google`)
- **Frontend:** React + Vite (`@ai-sdk/react` `useChat`)
- **Persistence:** SQLite locally, Postgres in production (auto-detected via `DATABASE_URL`)
- **Agent tool:** a `calculator` tool the model calls for arithmetic
- **Telegram:** same agent over a Telegram bot — polling locally, webhook in prod
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

## Telegram bot

The same Gemini agent (with the calculator tool) is reachable over Telegram.
Conversations are stored with the shared db layer under separate chat ids
(`tg:<telegramChatId>`), so they never mix with web chats. They appear in the
web sidebar titled `TG: <name>`.

Two bots are used:

- **Local** → polls with `TG_TEST` (long polling, no public URL needed)
- **Production** → webhook with `TG_PROD`, registered to
  `${RENDER_EXTERNAL_URL}/api/telegram/webhook` on startup

Env vars (in `.env` locally, in the Render dashboard for prod):

```
TG_TEST=...   # test bot token (local polling)
TG_PROD=...   # prod bot token (webhook)
```

Bot commands: `/start` (intro), `/clear` (reset that chat's history).

The webhook endpoint verifies Telegram's `X-Telegram-Bot-Api-Secret-Token`
header (a value derived from the bot token), so only Telegram can post updates.

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
