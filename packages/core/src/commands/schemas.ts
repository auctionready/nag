import { z } from "zod";
import { regularityValues } from "@nag/schema";

// A weekly schedule carries a day-of-week mask and a time. `dayOfMonth`
// is forbidden by construction — schedules only attach to weekly goals.
const WeeklyScheduleEntry = z.object({
  hour: z.int().min(0).max(23),
  minute: z.int().min(0).max(59),
  days: z.int().min(1).max(127),
  dayOfMonth: z.undefined().optional(),
  reminder: z.boolean().optional(),
});

// Goal shape A: frequency-only (daily, weekly, monthly counts). No schedules.
const FrequencyGoalPayload = z.object({
  regularity: z.enum(regularityValues),
  frequency: z.int().min(1),
  schedules: z.undefined().optional(),
});

// Goal shape B: scheduled. Always weekly — only weekly goals carry the
// day-of-week mask that schedules need. No top-level frequency (the
// handler derives it from popcount(days) across schedules).
const ScheduledGoalPayload = z.object({
  regularity: z.literal("week"),
  schedules: z.array(WeeklyScheduleEntry).min(1),
  frequency: z.undefined().optional(),
});

// Two structurally-incompatible variants — TypeScript rejects illegal
// combos like `{regularity:"day", schedules:[...]}` at the call site,
// so callers don't need to rely on `superRefine` firing at parse time.
const GoalPayload = z.union([FrequencyGoalPayload, ScheduledGoalPayload]);

export const CreateHabit = z.object({
  type: z.literal("CreateHabit"),
  habitId: z.uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  goal: GoalPayload.optional(),
});

export const UpdateHabit = z.object({
  type: z.literal("UpdateHabit"),
  habitId: z.uuid(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  goal: GoalPayload.nullable().optional(),
});

export const DeleteHabit = z.object({
  type: z.literal("DeleteHabit"),
  habitId: z.uuid(),
});

export const CreateCheckIn = z.object({
  type: z.literal("CreateCheckIn"),
  checkInId: z.uuid(),
  habitId: z.uuid(),
  /**
   * The deemed time-slot time for this check-in. For a regular "check in right
   * now" tap this is `new Date()`; for a long-press back-fill of a missed
   * time-slot it's that time-slot's `Date`. Audit log persists commands as JSON so
   * `z.coerce.date()` lets callers pass either a `Date` or an ISO string.
   */
  timestamp: z.coerce.date(),
  skipped: z.boolean().optional(),
});

export const DeleteCheckIn = z.object({
  type: z.literal("DeleteCheckIn"),
  checkInId: z.uuid(),
});

export const UpdateCheckIn = z.object({
  type: z.literal("UpdateCheckIn"),
  checkInId: z.uuid(),
  timestamp: z.coerce.date(),
  skipped: z.boolean().optional(),
});

export const Command = z.discriminatedUnion("type", [
  CreateHabit,
  UpdateHabit,
  DeleteHabit,
  CreateCheckIn,
  DeleteCheckIn,
  UpdateCheckIn,
]);

export type GoalPayload = z.infer<typeof GoalPayload>;
export type Command = z.infer<typeof Command>;
export type CreateHabit = z.infer<typeof CreateHabit>;
export type UpdateHabit = z.infer<typeof UpdateHabit>;
export type DeleteHabit = z.infer<typeof DeleteHabit>;
export type CreateCheckIn = z.infer<typeof CreateCheckIn>;
export type DeleteCheckIn = z.infer<typeof DeleteCheckIn>;
export type UpdateCheckIn = z.infer<typeof UpdateCheckIn>;
