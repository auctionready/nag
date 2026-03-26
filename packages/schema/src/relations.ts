import { relations } from "drizzle-orm";
import { habit } from "./habit";
import { checkIn } from "./checkIn";
import { goal } from "./goal";

export const habitRelations = relations(habit, ({ many }) => ({
  checkIns: many(checkIn),
  goals: many(goal),
}));

export const checkInRelations = relations(checkIn, ({ one }) => ({
  habit: one(habit, {
    fields: [checkIn.habitId],
    references: [habit.id],
  }),
}));

export const goalRelations = relations(goal, ({ one }) => ({
  habit: one(habit, {
    fields: [goal.habitId],
    references: [habit.id],
  }),
}));
