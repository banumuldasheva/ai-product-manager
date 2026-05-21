import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Op } from "sequelize";
import { sequelize, dbKind } from "./db.js";
import { Habit, HabitLog } from "./models.js";
import { seedHabits } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: "ok", db: dbKind });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/api/habits", async (req, res) => {
  const habits = await Habit.findAll({ order: [["category", "ASC"]] });
  res.json(habits);
});

app.get("/api/logs", async (req, res) => {
  const { month } = req.query; // YYYY-MM
  const logs = await HabitLog.findAll({
    where: { date: { [Op.like]: `${month}-%` } },
    include: Habit,
  });
  res.json(logs);
});

app.post("/api/logs", async (req, res) => {
  const { habitId, date, done } = req.body;
  const existing = await HabitLog.findOne({ where: { habitId, date } });
  if (existing) {
    await existing.update({ done });
    res.json(existing);
  } else {
    const log = await HabitLog.create({ habitId, date, done });
    res.json(log);
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "public")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });
}

sequelize.sync().then(() => seedHabits(Habit)).then(() => {
  app.listen(PORT, () => {
    console.log(`db: ${dbKind}`);
    console.log(`server running on port ${PORT}`);
  });
});
