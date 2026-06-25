import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function App() {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(() => newId());

  const refreshChats = async () => {
    const res = await fetch('/api/chats');
    setChats(await res.json());
  };

  useEffect(() => {
    refreshChats();
  }, []);

  const startNewChat = () => setActiveId(newId());

  const deleteChat = async (id) => {
    await fetch(`/api/chats/${id}`, { method: 'DELETE' });
    if (id === activeId) startNewChat();
    refreshChats();
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <button className="new-chat" onClick={startNewChat}>
          + New chat
        </button>
        <div className="chat-list">
          {chats.map((c) => (
            <div
              key={c.id}
              className={`chat-item ${c.id === activeId ? 'active' : ''}`}
              onClick={() => setActiveId(c.id)}
            >
              <span className="chat-title">{c.title || 'New chat'}</span>
              <button
                className="delete-chat"
                title="Delete chat"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(c.id);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">Gemini · Vercel AI SDK</div>
      </aside>

      {/* key forces a fresh useChat instance when switching chats */}
      <ChatView key={activeId} chatId={activeId} onActivity={refreshChats} />
    </div>
  );
}

function ChatView({ chatId, onActivity }) {
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  const { messages, sendMessage, setMessages, status, error } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  // Load persisted history for this chat
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      const history = await res.json();
      if (!cancelled && Array.isArray(history)) setMessages(history);
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, setMessages]);

  // Refresh the sidebar once a response settles (new chat appears / title updates)
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== 'ready' && status === 'ready') onActivity();
    prevStatus.current = status;
  }, [status, onActivity]);

  // Autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, status]);

  const busy = status === 'submitted' || status === 'streaming';

  const submit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput('');
  };

  const clearChat = async () => {
    await fetch(`/api/chats/${chatId}/messages`, { method: 'DELETE' });
    setMessages([]);
    onActivity();
  };

  return (
    <main className="chat">
      <header className="chat-header">
        <h1>AI Chat</h1>
        <button className="clear-btn" onClick={clearChat} disabled={messages.length === 0}>
          Clear chat
        </button>
      </header>

      <div className="messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty">
            Ask me anything. Try: <em>“What is (12 + 8) * 5?”</em> to see the calculator tool.
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        {status === 'submitted' && <div className="typing">…</div>}
        {error && <div className="error">Error: {error.message}</div>}
      </div>

      <form className="composer" onSubmit={submit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          autoFocus
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </main>
  );
}

function Message({ message }) {
  return (
    <div className={`msg ${message.role}`}>
      <div className="bubble">
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            return (
              <span key={i} className="text">
                {part.text}
              </span>
            );
          }
          if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
            return <ToolPart key={i} part={part} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

function ToolPart({ part }) {
  const name = part.type === 'dynamic-tool' ? part.toolName : part.type.replace('tool-', '');
  const done = part.state === 'output-available';
  return (
    <div className="tool">
      <div className="tool-head">
        🛠 <strong>{name}</strong>
        {part.input?.expression ? <code>{part.input.expression}</code> : null}
      </div>
      {done && (
        <div className="tool-result">
          {part.output?.error
            ? `error: ${part.output.error}`
            : `= ${part.output?.result ?? JSON.stringify(part.output)}`}
        </div>
      )}
    </div>
  );
}
