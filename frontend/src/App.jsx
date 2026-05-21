import { useEffect, useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

function daysInMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export default function App() {
  const [tab, setTab] = useState("today");
  const [habits, setHabits] = useState([]);
  const [logs, setLogs] = useState([]);
  const month = currentMonth();

  useEffect(() => {
    fetch("/api/habits").then(r => r.json()).then(setHabits);
    fetchLogs();
  }, []);

  function fetchLogs() {
    fetch(`/api/logs?month=${month}`).then(r => r.json()).then(setLogs);
  }

  function isDone(habitId, date) {
    return logs.some(l => l.habitId === habitId && l.date === date && l.done);
  }

  async function toggle(habitId, date) {
    const current = isDone(habitId, date);
    // optimistic update
    setLogs(prev => {
      const exists = prev.find(l => l.habitId === habitId && l.date === date);
      if (exists) return prev.map(l => l.habitId === habitId && l.date === date ? { ...l, done: !l.done } : l);
      return [...prev, { habitId, date, done: true }];
    });
    await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId, date, done: !current }),
    });
  }

  const good = habits.filter(h => h.category === "good");
  const bad  = habits.filter(h => h.category === "bad");
  const days = daysInMonth(month);
  const dayNums = Array.from({ length: days }, (_, i) => i + 1);

  return (
    <div className="app">
      <header>
        <h1>Трекер привычек</h1>
        <div className="tabs">
          <button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}>Сегодня</button>
          <button className={tab === "month" ? "active" : ""} onClick={() => setTab("month")}>Месяц</button>
        </div>
      </header>

      {tab === "today" && (
        <div className="today">
          <Section title="✅ Полезные" habits={good} cls="good" date={today()} isDone={isDone} toggle={toggle} />
          <Section title="❌ Вредные"  habits={bad}  cls="bad"  date={today()} isDone={isDone} toggle={toggle} />
        </div>
      )}

      {tab === "month" && (
        <div className="month">
          <h2 className="month-title">{month}</h2>
          <MonthSummary good={good} bad={bad} dayNums={dayNums} month={month} isDone={isDone} />
          <CalendarBlock title="✅ Полезные" habits={good} cls="good" dayNums={dayNums} month={month} isDone={isDone} toggle={toggle} />
          <CalendarBlock title="❌ Вредные"  habits={bad}  cls="bad"  dayNums={dayNums} month={month} isDone={isDone} toggle={toggle} />
        </div>
      )}
    </div>
  );
}

function pct(done, total) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function MonthSummary({ good, bad, dayNums, month, isDone }) {
  const total = dayNums.length;

  function groupPct(habits) {
    if (!habits.length) return 0;
    const done = habits.reduce((sum, h) =>
      sum + dayNums.filter(d => isDone(h.id, `${month}-${String(d).padStart(2, "0")}`)).length, 0);
    return pct(done, total * habits.length);
  }

  const goodPct = groupPct(good);
  const badPct  = groupPct(bad);

  return (
    <div className="summary">
      <div className="summary-card summary-good">
        <div className="summary-label">✅ Полезные</div>
        <div className="summary-pct">{goodPct}%</div>
        <div className="summary-bar"><div className="summary-fill fill-good" style={{ width: `${goodPct}%` }} /></div>
      </div>
      <div className="summary-card summary-bad">
        <div className="summary-label">❌ Вредные</div>
        <div className="summary-pct">{badPct}%</div>
        <div className="summary-bar"><div className="summary-fill fill-bad" style={{ width: `${badPct}%` }} /></div>
      </div>
    </div>
  );
}

function Section({ title, habits, cls, date, isDone, toggle }) {
  return (
    <div className={`section section-${cls}`}>
      <h2>{title}</h2>
      {habits.map(h => (
        <div key={h.id} className="habit-row">
          <span className="emoji">{h.emoji}</span>
          <span className="name">{h.name}</span>
          <input
            type="checkbox"
            checked={isDone(h.id, date)}
            onChange={() => toggle(h.id, date)}
          />
        </div>
      ))}
    </div>
  );
}

function CalendarBlock({ title, habits, cls, dayNums, month, isDone, toggle }) {
  return (
    <div className={`section section-${cls}`}>
      <h2>{title}</h2>
      {habits.map(h => {
        const done = dayNums.filter(d => isDone(h.id, `${month}-${String(d).padStart(2, "0")}`)).length;
        const p = pct(done, dayNums.length);
        return (
          <div key={h.id} className="cal-habit">
            <div className="cal-label">
              <span className="emoji">{h.emoji}</span>
              <span className="name">{h.name}</span>
              <span className="count">{done} / {dayNums.length}</span>
              <span className={`habit-pct pct-${cls}`}>{p}%</span>
            </div>
            <div className="habit-bar">
              <div className={`habit-fill fill-${cls}`} style={{ width: `${p}%` }} />
            </div>
            <div className="cal-row">
              {dayNums.map(d => {
                const date = `${month}-${String(d).padStart(2, "0")}`;
                const active = isDone(h.id, date);
                return (
                  <button
                    key={d}
                    className={`day ${active ? `day-done day-done-${cls}` : "day-miss"}`}
                    onClick={() => toggle(h.id, date)}
                    title={date}
                  >
                    {active ? h.emoji : <span className="day-num">{d}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
