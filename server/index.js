import './load-env.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToModelMessages, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import * as db from './db.js';
import { createTelegramBot } from './telegram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GEMENI_API_KEY || // tolerate the original misspelled key
  process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
  console.error('Missing GEMINI_API_KEY in environment (.env)');
  process.exit(1);
}

const google = createGoogleGenerativeAI({ apiKey });
const MODEL = 'gemini-2.5-flash';
const SYSTEM =
  'You are a helpful assistant. When the user asks for arithmetic, ' +
  'use the calculator tool instead of computing it yourself.';

// ---- Calculator tool (test tool for the agent) ----
function safeEval(expression) {
  if (!/^[\d\s+\-*/().%]+$/.test(expression)) {
    throw new Error('Expression contains invalid characters');
  }
  // eslint-disable-next-line no-new-func
  const value = Function(`"use strict"; return (${expression});`)();
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Expression did not evaluate to a finite number');
  }
  return value;
}

const calculator = tool({
  description:
    'Evaluate a basic arithmetic expression. Supports + - * / % and parentheses. ' +
    'Use this whenever the user asks for a calculation.',
  inputSchema: z.object({
    expression: z
      .string()
      .describe('The arithmetic expression to evaluate, e.g. "(2 + 3) * 4"'),
  }),
  execute: async ({ expression }) => {
    try {
      return { expression, result: safeEval(expression) };
    } catch (err) {
      return { expression, error: err.message };
    }
  },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

// List chats for the sidebar
app.get('/api/chats', async (_req, res) => {
  res.json(await db.listChats());
});

// Load a chat's message history
app.get('/api/chats/:id/messages', async (req, res) => {
  res.json(await db.getMessages(req.params.id));
});

// Clear all messages in a chat (the "Clear chat" button)
app.delete('/api/chats/:id/messages', async (req, res) => {
  await db.clearMessages(req.params.id);
  res.json({ ok: true });
});

// Delete a chat entirely
app.delete('/api/chats/:id', async (req, res) => {
  await db.deleteChat(req.params.id);
  res.json({ ok: true });
});

// Chat completion (streaming) + persistence
app.post('/api/chat', async (req, res) => {
  const { id, messages } = req.body;
  if (!id || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Expected { id, messages }' });
  }

  // Title the chat from the first user message
  const firstUserText =
    messages.find((m) => m.role === 'user')?.parts?.find((p) => p.type === 'text')?.text || '';
  await db.ensureChat(id, firstUserText.slice(0, 60) || 'New chat');

  // Persist the latest user message
  const last = messages[messages.length - 1];
  if (last?.role === 'user') {
    await db.saveMessage(id, last);
  }

  const result = streamText({
    model: google(MODEL),
    system: SYSTEM,
    messages: convertToModelMessages(messages),
    tools: { calculator },
    stopWhen: stepCountIs(5),
  });

  result.pipeUIMessageStreamToResponse(res, {
    originalMessages: messages,
    onFinish: async ({ responseMessage }) => {
      if (responseMessage) await db.saveMessage(id, responseMessage);
    },
    onError: (err) => {
      console.error('[chat] stream error:', err);
      return 'An error occurred while generating the response.';
    },
  });
});

// ---- Telegram bot ----
// Local dev: poll with the test bot. Production: webhook with the prod bot.
const isProd = process.env.NODE_ENV === 'production';
const tgToken = isProd ? process.env.TG_PROD : process.env.TG_TEST;

if (tgToken) {
  const bot = createTelegramBot({
    token: tgToken,
    model: google(MODEL),
    tools: { calculator },
    system: SYSTEM,
  });

  if (isProd) {
    // Telegram POSTs updates here; verify the secret token and ack fast.
    app.post('/api/telegram/webhook', (req, res) => {
      if (req.get('x-telegram-bot-api-secret-token') !== bot.webhookSecret) {
        return res.sendStatus(401);
      }
      res.sendStatus(200); // ack immediately, then process
      bot.handleUpdate(req.body).catch((err) => console.error('[tg] handle error:', err));
    });

    const publicUrl =
      process.env.PUBLIC_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      'https://ai-chat-app-07rg.onrender.com';
    bot.registerWebhook(publicUrl).catch((err) => console.error('[tg] setWebhook error:', err));
  } else {
    bot.startPolling().catch((err) => console.error('[tg] polling error:', err));
  }
} else {
  console.log(`[tg] no ${isProd ? 'TG_PROD' : 'TG_TEST'} token set — Telegram bot disabled`);
}

// Serve the built client in production (single Render web service)
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
