import { processCommand } from "@nag/core";
import { db } from "../db";
import { cancelNotifications } from "../notifications";

export const deleteHabit = async (habitId: number) => {
  await cancelNotifications(habitId);
  await processCommand(db, { type: "DeleteHabit", habitId });
};
