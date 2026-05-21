export async function seedHabits(Habit) {
  const count = await Habit.count();
  if (count > 0) return;
  await Habit.bulkCreate([
    { name: "Медитация",           category: "good", emoji: "🧘" },
    { name: "Пранаяма",            category: "good", emoji: "🌬️" },
    { name: "Йога",                category: "good", emoji: "🤸" },
    { name: "Терапия",             category: "good", emoji: "💬" },
    { name: "Курение",             category: "bad",  emoji: "🚬" },
    { name: "Алкоголь",            category: "bad",  emoji: "🍷" },
    { name: "Скроллинг >2ч",       category: "bad",  emoji: "📱" },
  ]);
}
