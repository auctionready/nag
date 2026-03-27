import { z } from "zod";
import { regularityValues } from "@nag/schema";

const GoalPayload = z.object({
  regularity: z.enum(regularityValues),
  frequency: z.int().min(1),
});

export const CreateHabit = z.object({
  type: z.literal("CreateHabit"),
  title: z.string().min(1),
  description: z.string().optional(),
  goal: GoalPayload.optional(),
});

export const UpdateHabit = z.object({
  type: z.literal("UpdateHabit"),
  habitId: z.int().positive(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  goal: GoalPayload.nullable().optional(),
});

export const DeleteHabit = z.object({
  type: z.literal("DeleteHabit"),
  habitId: z.int().positive(),
});

export const CreateCheckIn = z.object({
  type: z.literal("CreateCheckIn"),
  habitId: z.int().positive(),
  skipped: z.boolean().optional(),
});

export const DeleteCheckIn = z.object({
  type: z.literal("DeleteCheckIn"),
  checkInId: z.int().positive(),
});

export const Command = z.discriminatedUnion("type", [
  CreateHabit,
  UpdateHabit,
  DeleteHabit,
  CreateCheckIn,
  DeleteCheckIn,
]);

export type Command = z.infer<typeof Command>;
export type CreateHabit = z.infer<typeof CreateHabit>;
export type UpdateHabit = z.infer<typeof UpdateHabit>;
export type DeleteHabit = z.infer<typeof DeleteHabit>;
export type CreateCheckIn = z.infer<typeof CreateCheckIn>;
export type DeleteCheckIn = z.infer<typeof DeleteCheckIn>;
