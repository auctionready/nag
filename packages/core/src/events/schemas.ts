import { z } from "zod";
import { regularityValues } from "@nag/schema";

/**
 * Past-tense event vocabulary — the immutable facts the server appends
 * to its event store and ships to clients on `/sync`. Keep parallel with
 * the C# event types in `backend/Nag.Core/Events/`.
 *
 * Commands (in `commands/schemas.ts`) stay as the local-intent
 * representation; events are what crosses the wire on the read side
 * (and, in a later stack PR, the write side too).
 *
 * GUIDs on the wire are server-shaped — habit and check-in identifiers
 * are strings here, not the local SQLite integer ids.
 */

const Uuid = z.string().uuid();
const IsoDateTime = z.coerce.date();

const ScheduleEntry = z.object({
  hour: z.int().min(0).max(23),
  minute: z.int().min(0).max(59),
  days: z.int().min(0).max(127).nullable().optional(),
  dayOfMonth: z.int().min(1).max(31).nullable().optional(),
  reminder: z.boolean().nullable().optional(),
});

const GoalPayload = z.object({
  regularity: z.enum(regularityValues),
  frequency: z.int().nullable().optional(),
  schedules: z.array(ScheduleEntry).nullable().optional(),
});

export const HabitCreated = z.object({
  type: z.literal("HabitCreated"),
  habitId: Uuid,
  title: z.string(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  goal: GoalPayload.nullable().optional(),
});

export const HabitDetailsEdited = z.object({
  type: z.literal("HabitDetailsEdited"),
  habitId: Uuid,
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  clearDescription: z.boolean().optional(),
  icon: z.string().nullable().optional(),
  clearIcon: z.boolean().optional(),
});

export const HabitGoalDefined = z.object({
  type: z.literal("HabitGoalDefined"),
  habitId: Uuid,
  regularity: z.enum(regularityValues),
  frequency: z.int().nullable().optional(),
  schedules: z.array(ScheduleEntry).nullable().optional(),
});

export const HabitGoalCleared = z.object({
  type: z.literal("HabitGoalCleared"),
  habitId: Uuid,
});

export const HabitDeleted = z.object({
  type: z.literal("HabitDeleted"),
  habitId: Uuid,
});

export const CheckInRecorded = z.object({
  type: z.literal("CheckInRecorded"),
  checkInId: Uuid,
  habitId: Uuid,
  timestamp: IsoDateTime,
  skipped: z.boolean().optional(),
});

export const CheckInMoved = z.object({
  type: z.literal("CheckInMoved"),
  checkInId: Uuid,
  habitId: Uuid,
  oldTimestamp: IsoDateTime,
  newTimestamp: IsoDateTime,
});

export const CheckInMarkedSkipped = z.object({
  type: z.literal("CheckInMarkedSkipped"),
  checkInId: Uuid,
  habitId: Uuid,
});

export const CheckInMarkedDone = z.object({
  type: z.literal("CheckInMarkedDone"),
  checkInId: Uuid,
  habitId: Uuid,
});

export const CheckInDeleted = z.object({
  type: z.literal("CheckInDeleted"),
  checkInId: Uuid,
  habitId: Uuid,
  timestamp: IsoDateTime,
});

export const Event = z.discriminatedUnion("type", [
  HabitCreated,
  HabitDetailsEdited,
  HabitGoalDefined,
  HabitGoalCleared,
  HabitDeleted,
  CheckInRecorded,
  CheckInMoved,
  CheckInMarkedSkipped,
  CheckInMarkedDone,
  CheckInDeleted,
]);

export type Event = z.infer<typeof Event>;
export type HabitCreated = z.infer<typeof HabitCreated>;
export type HabitDetailsEdited = z.infer<typeof HabitDetailsEdited>;
export type HabitGoalDefined = z.infer<typeof HabitGoalDefined>;
export type HabitGoalCleared = z.infer<typeof HabitGoalCleared>;
export type HabitDeleted = z.infer<typeof HabitDeleted>;
export type CheckInRecorded = z.infer<typeof CheckInRecorded>;
export type CheckInMoved = z.infer<typeof CheckInMoved>;
export type CheckInMarkedSkipped = z.infer<typeof CheckInMarkedSkipped>;
export type CheckInMarkedDone = z.infer<typeof CheckInMarkedDone>;
export type CheckInDeleted = z.infer<typeof CheckInDeleted>;

export const EventTypeNames = [
  "HabitCreated",
  "HabitDetailsEdited",
  "HabitGoalDefined",
  "HabitGoalCleared",
  "HabitDeleted",
  "CheckInRecorded",
  "CheckInMoved",
  "CheckInMarkedSkipped",
  "CheckInMarkedDone",
  "CheckInDeleted",
] as const;
export type EventTypeName = (typeof EventTypeNames)[number];
