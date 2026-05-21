import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

const Habit = sequelize.define("Habit", {
  name:     { type: DataTypes.STRING,                         allowNull: false },
  category: { type: DataTypes.ENUM("good", "bad"),           allowNull: false },
  emoji:    { type: DataTypes.STRING },
}, { timestamps: false });

const HabitLog = sequelize.define("HabitLog", {
  habitId: { type: DataTypes.INTEGER, allowNull: false },
  date:    { type: DataTypes.DATEONLY, allowNull: false },
  done:    { type: DataTypes.BOOLEAN, defaultValue: true },
}, { timestamps: false });

Habit.hasMany(HabitLog, { foreignKey: "habitId" });
HabitLog.belongsTo(Habit, { foreignKey: "habitId" });

export { Habit, HabitLog };
