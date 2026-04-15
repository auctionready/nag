import { z } from "zod";
import { regularityValues } from "@nag/schema";

const ScheduleEntry = z.object({
  hour: z.int().min(0).max(23),
  minute: z.int().min(0).max(59),
  days: z.int().min(1).max(127).optional(),
  dayOfMonth: z.int().min(1).max(31).optional(),
  reminder: z.boolean().optional(),
});

const GoalPayload = z
  .object({
    regularity: z.enum(regularityValues),
    frequency: z.int().min(1).optional(),
    schedules: z.array(ScheduleEntry).min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.frequency && !data.schedules) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either frequency or schedules must be provided",
      });
    }
    if (data.frequency && data.schedules) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cannot provide both frequency and schedules",
      });
    }
    if (data.schedules) {
      for (const [i, entry] of data.schedules.entries()) {
        if (data.regularity === "day") {
          if (entry.days !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `schedules[${i}]: daily schedules must not have days`,
              path: ["schedules", i, "days"],
            });
          }
          if (entry.dayOfMonth !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `schedules[${i}]: daily schedules must not have dayOfMonth`,
              path: ["schedules", i, "dayOfMonth"],
            });
          }
        }
        if (data.regularity === "week") {
          if (entry.days === undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `schedules[${i}]: days is required for weekly schedules`,
              path: ["schedules", i, "days"],
            });
          }
          if (entry.dayOfMonth !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `schedules[${i}]: weekly schedules must not have dayOfMonth`,
              path: ["schedules", i, "dayOfMonth"],
            });
          }
        }
        if (data.regularity === "month") {
          if (entry.dayOfMonth === undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `schedules[${i}]: dayOfMonth is required for monthly schedules`,
              path: ["schedules", i, "dayOfMonth"],
            });
          }
          if (entry.days !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `schedules[${i}]: monthly schedules must not have days`,
              path: ["schedules", i, "days"],
            });
          }
        }
      }
    }
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
  /**
   * The deemed slot time for this check-in. For a regular "check in right
   * now" tap this is `new Date()`; for a long-press back-fill of a missed
   * slot it's that slot's `Date`. Audit log persists commands as JSON so
   * `z.coerce.date()` lets callers pass either a `Date` or an ISO string.
   */
  timestamp: z.coerce.date(),
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

export type GoalPayload = z.infer<typeof GoalPayload>;
export type Command = z.infer<typeof Command>;
export type CreateHabit = z.infer<typeof CreateHabit>;
export type UpdateHabit = z.infer<typeof UpdateHabit>;
export type DeleteHabit = z.infer<typeof DeleteHabit>;
export type CreateCheckIn = z.infer<typeof CreateCheckIn>;
export type DeleteCheckIn = z.infer<typeof DeleteCheckIn>;
