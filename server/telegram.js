// Telegram bot integration.
// - Reuses the same Gemini agent (model + tools + system prompt) as the web chat.
// - Persists history with the shared db layer, under separate chat ids: `tg:<chatId>`.
// - Local: long polling. Production: webhook.
import { randomUUID, createHash } from 'node:crypto';
import { generateText, convertToModelMessages, stepCountIs } from 'ai';
import * as db from './db.js';

const TG_LIMIT = 4096; // Telegram max message length

export function createTelegramBot({ token, model, tools, system }) {
  const base = `https://api.telegram.org/bot${token}`;

  async function api(method, body) {
    const res = await fetch(`${base}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json();
    if (!data.ok) console.error(`[tg] ${method} failed:`, data.description);
    return data;
  }

  async function sendMessage(chatId, text) {
    // split long replies to respect Telegram's per-message limit
    for (let i = 0; i < text.length; i += TG_LIMIT) {
      await api('sendMessage', { chat_id: chatId, text: text.slice(i, i + TG_LIMIT) });
    }
  }

  // A unique, stable secret derived from the bot token, used to verify webhook calls.
  const webhookSecret = createHash('sha256').update(token).digest('hex').slice(0, 40);

  async function handleUpdate(update) {
    const msg = update.message ?? update.edited_message;
    const text = msg?.text;
    if (!msg || !text) return;

    const tgChatId = msg.chat.id;
    const chatId = `tg:${tgChatId}`; // separate namespace from web chats

    // Commands
    if (text === '/start') {
      await sendMessage(
        tgChatId,
        'Hi! I am your AI assistant. Ask me anything — I can also do math via a calculator tool. Use /clear to reset this conversation.'
      );
      return;
    }
    if (text === '/clear') {
      await db.clearMessages(chatId);
      await sendMessage(tgChatId, 'Conversation history cleared.');
      return;
    }

    const title =
      msg.chat.title ||
      [msg.chat.first_name, msg.chat.last_name].filter(Boolean).join(' ') ||
      msg.chat.username ||
      String(tgChatId);
    await db.ensureChat(chatId, `TG: ${title}`.slice(0, 60));

    // Build conversation: stored history + new user message
    const history = await db.getMessages(chatId);
    const userMessage = { id: randomUUID(), role: 'user', parts: [{ type: 'text', text }] };
    await db.saveMessage(chatId, userMessage);

    await api('sendChatAction', { chat_id: tgChatId, action: 'typing' });

    let replyText;
    try {
      const result = await generateText({
        model,
        system,
        tools,
        stopWhen: stepCountIs(5),
        messages: convertToModelMessages([...history, userMessage]),
      });
      replyText = result.text?.trim() || '(no response)';
    } catch (err) {
      console.error('[tg] generation error:', err);
      replyText = 'Sorry, something went wrong generating a response.';
    }

    const assistantMessage = {
      id: randomUUID(),
      role: 'assistant',
      parts: [{ type: 'text', text: replyText }],
    };
    await db.saveMessage(chatId, assistantMessage);
    await sendMessage(tgChatId, replyText);
  }

  // ---- Local: long polling ----
  async function startPolling() {
    await api('deleteWebhook', { drop_pending_updates: true });
    const me = await api('getMe');
    console.log(`[tg] polling as @${me.result?.username}`);
    let offset = 0;
    const loop = async () => {
      let delay = 0;
      try {
        const res = await api('getUpdates', { offset, timeout: 30 });
        if (res.ok) {
          for (const update of res.result) {
            offset = update.update_id + 1;
            await handleUpdate(update);
          }
        }
      } catch (err) {
        console.error('[tg] polling error:', err.message);
        delay = 3000; // back off before retrying
      }
      setTimeout(loop, delay);
    };
    loop();
  }

  // ---- Production: webhook ----
  async function registerWebhook(publicUrl) {
    const url = `${publicUrl.replace(/\/$/, '')}/api/telegram/webhook`;
    const res = await api('setWebhook', {
      url,
      secret_token: webhookSecret,
      drop_pending_updates: true,
      allowed_updates: ['message', 'edited_message'],
    });
    if (res.ok) console.log(`[tg] webhook set to ${url}`);
    return res;
  }

  return { handleUpdate, startPolling, registerWebhook, webhookSecret };
}
