/**
 * GENERATED — do not edit by hand.
 *
 * Regenerate with:
 *   pnpm --filter @nag/api-client generate
 *
 * (requires the backend running in Debug so /swagger/v1/swagger.json is exposed,
 * or pass --file path/to/openapi.json for an offline regen)
 *
 * This initial version was authored from the backend contracts in
 * backend/Nag.Core/Contracts and backend/Nag.Core/Commands so the client
 * has usable typings before the generator is first run. Subsequent
 * regenerations will overwrite this file.
 */
import { z } from "zod";

const isoDate = z.iso.datetime({ offset: true }).transform((s) => new Date(s));

export const Regularity = z.enum(["day", "week", "month"]);
export type Regularity = z.infer<typeof Regularity>;

export const ScheduleEntry = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  days: z.number().int().min(1).max(127).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  reminder: z.boolean().optional(),
});
export type ScheduleEntry = z.infer<typeof ScheduleEntry>;

export const GoalPayload = z.object({
  regularity: Regularity,
  frequency: z.number().int().min(1).optional(),
  schedules: z.array(ScheduleEntry).optional(),
});
export type GoalPayload = z.infer<typeof GoalPayload>;

export const CreateHabitPayload = z.object({
  habitId: z.uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  goal: GoalPayload.optional(),
});
export type CreateHabitPayload = z.infer<typeof CreateHabitPayload>;

export const UpdateHabitPayload = z.object({
  habitId: z.uuid(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  goal: GoalPayload.nullable().optional(),
  clearDescription: z.boolean().optional(),
  clearIcon: z.boolean().optional(),
  clearGoal: z.boolean().optional(),
});
export type UpdateHabitPayload = z.infer<typeof UpdateHabitPayload>;

export const DeleteHabitPayload = z.object({
  habitId: z.uuid(),
});
export type DeleteHabitPayload = z.infer<typeof DeleteHabitPayload>;

export const CreateCheckInPayload = z.object({
  checkInId: z.uuid(),
  habitId: z.uuid(),
  timestamp: isoDate,
  skipped: z.boolean().optional(),
});
export type CreateCheckInPayload = z.infer<typeof CreateCheckInPayload>;

export const UpdateCheckInPayload = z.object({
  checkInId: z.uuid(),
  timestamp: isoDate,
  skipped: z.boolean().optional(),
});
export type UpdateCheckInPayload = z.infer<typeof UpdateCheckInPayload>;

export const DeleteCheckInPayload = z.object({
  checkInId: z.uuid(),
});
export type DeleteCheckInPayload = z.infer<typeof DeleteCheckInPayload>;

const envelope = <T extends string, P extends z.ZodType>(type: T, payload: P) =>
  z.object({
    id: z.uuid(),
    type: z.literal(type),
    timestamp: isoDate,
    payload,
  });

export const CommandEnvelope = z.discriminatedUnion("type", [
  envelope("CreateHabit", CreateHabitPayload),
  envelope("UpdateHabit", UpdateHabitPayload),
  envelope("DeleteHabit", DeleteHabitPayload),
  envelope("CreateCheckIn", CreateCheckInPayload),
  envelope("UpdateCheckIn", UpdateCheckInPayload),
  envelope("DeleteCheckIn", DeleteCheckInPayload),
]);
export type CommandEnvelope = z.infer<typeof CommandEnvelope>;

export const CommandAccepted = z.object({
  accepted: z.boolean(),
  sequence: z.number().int(),
});
export type CommandAccepted = z.infer<typeof CommandAccepted>;

export const CommandEnvelopeOut = z.object({
  sequence: z.number().int(),
  id: z.uuid(),
  type: z.string(),
  timestamp: isoDate,
  payload: z.unknown(),
});
export type CommandEnvelopeOut = z.infer<typeof CommandEnvelopeOut>;

export const CommandsPage = z.object({
  commands: z.array(CommandEnvelopeOut),
  nextSince: z.number().int().nullable(),
});
export type CommandsPage = z.infer<typeof CommandsPage>;

export const HomeGoal = z.object({
  regularity: Regularity,
  frequency: z.number().int().nullable(),
});
export type HomeGoal = z.infer<typeof HomeGoal>;

export const HomeSchedule = z.object({
  hour: z.number().int(),
  minute: z.number().int(),
  days: z.number().int().nullable(),
  dayOfMonth: z.number().int().nullable(),
  reminder: z.boolean(),
});
export type HomeSchedule = z.infer<typeof HomeSchedule>;

export const HomeCheckIn = z.object({
  id: z.uuid(),
  timestamp: isoDate,
  skipped: z.boolean(),
});
export type HomeCheckIn = z.infer<typeof HomeCheckIn>;

export const HomeHabit = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  goal: HomeGoal.nullable().optional(),
  schedules: z.array(HomeSchedule),
  periodCheckIns: z.array(HomeCheckIn),
});
export type HomeHabit = z.infer<typeof HomeHabit>;

export const HomeBoard = z.object({
  id: z.uuid(),
  lastSequence: z.number().int(),
  habits: z.array(HomeHabit),
});
export type HomeBoard = z.infer<typeof HomeBoard>;

export const HealthResponse = z.object({
  status: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const ValidationErrorBody = z.object({
  errors: z.array(z.string()),
});
export type ValidationErrorBody = z.infer<typeof ValidationErrorBody>;

export const endpoints = [
  {
    method: "get",
    path: "/health",
    alias: "getHealth",
    parameters: [],
    response: HealthResponse,
    errors: [],
  },
  {
    method: "post",
    path: "/commands",
    alias: "postCommands",
    parameters: [{ name: "body", type: "Body", schema: CommandEnvelope }],
    response: CommandAccepted,
    errors: [{ status: 400, schema: ValidationErrorBody }],
  },
  {
    method: "get",
    path: "/commands",
    alias: "getCommands",
    parameters: [
      { name: "since", type: "Query", schema: z.number().int() },
      { name: "limit", type: "Query", schema: z.number().int().optional() },
    ],
    response: CommandsPage,
    errors: [],
  },
  {
    method: "get",
    path: "/home-board",
    alias: "getHomeBoard",
    parameters: [],
    response: HomeBoard,
    errors: [],
  },
] as const;

export type Endpoints = typeof endpoints;
