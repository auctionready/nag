/**
 * GENERATED — do not edit by hand.
 *
 * Regenerate with:
 *   pnpm --filter @nag/api-client generate
 */
import { z } from "zod";

export const Regularity = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type Regularity = z.infer<typeof Regularity>;

export const ScheduleEntry = z
  .object({
    hour: z.int(),
    minute: z.int(),
    days: z.int().nullable(),
    dayOfMonth: z.int().nullable(),
    reminder: z.boolean().nullable(),
  })
  .partial();
export type ScheduleEntry = z.infer<typeof ScheduleEntry>;

export const GoalPayload = z
  .object({
    regularity: Regularity,
    frequency: z.int().nullable(),
    schedules: z.array(ScheduleEntry).nullable(),
  })
  .partial();
export type GoalPayload = z.infer<typeof GoalPayload>;

export const CreateHabit = z
  .object({
    habitId: z.uuid(),
    title: z.string().nullable(),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    goal: GoalPayload,
  })
  .partial();
export type CreateHabit = z.infer<typeof CreateHabit>;

export const CommandEnvelope_CreateHabit = z
  .object({
    id: z.uuid().optional(),
    timestamp: z.iso
      .datetime({ offset: true })
      .transform((s) => new Date(s))
      .optional(),
    type: z.literal("CreateHabit"),
    payload: CreateHabit,
  })
  .passthrough();
export type CommandEnvelope_CreateHabit = z.infer<
  typeof CommandEnvelope_CreateHabit
>;

export const UpdateHabit = z
  .object({
    habitId: z.uuid(),
    title: z.string().nullable(),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    goal: GoalPayload,
    clearDescription: z.boolean(),
    clearIcon: z.boolean(),
    clearGoal: z.boolean(),
  })
  .partial();
export type UpdateHabit = z.infer<typeof UpdateHabit>;

export const CommandEnvelope_UpdateHabit = z
  .object({
    id: z.uuid().optional(),
    timestamp: z.iso
      .datetime({ offset: true })
      .transform((s) => new Date(s))
      .optional(),
    type: z.literal("UpdateHabit"),
    payload: UpdateHabit,
  })
  .passthrough();
export type CommandEnvelope_UpdateHabit = z.infer<
  typeof CommandEnvelope_UpdateHabit
>;

export const DeleteHabit = z.object({ habitId: z.uuid() }).partial();
export type DeleteHabit = z.infer<typeof DeleteHabit>;

export const CommandEnvelope_DeleteHabit = z
  .object({
    id: z.uuid().optional(),
    timestamp: z.iso
      .datetime({ offset: true })
      .transform((s) => new Date(s))
      .optional(),
    type: z.literal("DeleteHabit"),
    payload: DeleteHabit,
  })
  .passthrough();
export type CommandEnvelope_DeleteHabit = z.infer<
  typeof CommandEnvelope_DeleteHabit
>;

export const CreateCheckIn = z
  .object({
    checkInId: z.uuid(),
    habitId: z.uuid(),
    timestamp: z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
    skipped: z.boolean().nullable(),
  })
  .partial();
export type CreateCheckIn = z.infer<typeof CreateCheckIn>;

export const CommandEnvelope_CreateCheckIn = z
  .object({
    id: z.uuid().optional(),
    timestamp: z.iso
      .datetime({ offset: true })
      .transform((s) => new Date(s))
      .optional(),
    type: z.literal("CreateCheckIn"),
    payload: CreateCheckIn,
  })
  .passthrough();
export type CommandEnvelope_CreateCheckIn = z.infer<
  typeof CommandEnvelope_CreateCheckIn
>;

export const UpdateCheckIn = z
  .object({
    checkInId: z.uuid(),
    timestamp: z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
    skipped: z.boolean().nullable(),
  })
  .partial();
export type UpdateCheckIn = z.infer<typeof UpdateCheckIn>;

export const CommandEnvelope_UpdateCheckIn = z
  .object({
    id: z.uuid().optional(),
    timestamp: z.iso
      .datetime({ offset: true })
      .transform((s) => new Date(s))
      .optional(),
    type: z.literal("UpdateCheckIn"),
    payload: UpdateCheckIn,
  })
  .passthrough();
export type CommandEnvelope_UpdateCheckIn = z.infer<
  typeof CommandEnvelope_UpdateCheckIn
>;

export const DeleteCheckIn = z.object({ checkInId: z.uuid() }).partial();
export type DeleteCheckIn = z.infer<typeof DeleteCheckIn>;

export const CommandEnvelope_DeleteCheckIn = z
  .object({
    id: z.uuid().optional(),
    timestamp: z.iso
      .datetime({ offset: true })
      .transform((s) => new Date(s))
      .optional(),
    type: z.literal("DeleteCheckIn"),
    payload: DeleteCheckIn,
  })
  .passthrough();
export type CommandEnvelope_DeleteCheckIn = z.infer<
  typeof CommandEnvelope_DeleteCheckIn
>;

export const CommandEnvelope = z.discriminatedUnion("type", [
  CommandEnvelope_CreateHabit,
  CommandEnvelope_UpdateHabit,
  CommandEnvelope_DeleteHabit,
  CommandEnvelope_CreateCheckIn,
  CommandEnvelope_UpdateCheckIn,
  CommandEnvelope_DeleteCheckIn,
]);
export type CommandEnvelope = z.infer<typeof CommandEnvelope>;

export const CommandAccepted = z
  .object({ accepted: z.boolean(), sequence: z.int() })
  .partial();
export type CommandAccepted = z.infer<typeof CommandAccepted>;

export const CommandEnvelopeOut_CreateHabit = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: z.iso
      .datetime({ offset: true })
      .transform((s) => new Date(s))
      .optional(),
    type: z.literal("CreateHabit"),
    payload: CreateHabit,
  })
  .passthrough();
export type CommandEnvelopeOut_CreateHabit = z.infer<
  typeof CommandEnvelopeOut_CreateHabit
>;

export const CommandEnvelopeOut_UpdateHabit = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: z.iso
      .datetime({ offset: true })
      .transform((s) => new Date(s))
      .optional(),
    type: z.literal("UpdateHabit"),
    payload: UpdateHabit,
  })
  .passthrough();
export type CommandEnvelopeOut_UpdateHabit = z.infer<
  typeof CommandEnvelopeOut_UpdateHabit
>;

export const CommandEnvelopeOut_DeleteHabit = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: z.iso
      .datetime({ offset: true })
      .transform((s) => new Date(s))
      .optional(),
    type: z.literal("DeleteHabit"),
    payload: DeleteHabit,
  })
  .passthrough();
export type CommandEnvelopeOut_DeleteHabit = z.infer<
  typeof CommandEnvelopeOut_DeleteHabit
>;

export const CommandEnvelopeOut_CreateCheckIn = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: z.iso
      .datetime({ offset: true })
      .transform((s) => new Date(s))
      .optional(),
    type: z.literal("CreateCheckIn"),
    payload: CreateCheckIn,
  })
  .passthrough();
export type CommandEnvelopeOut_CreateCheckIn = z.infer<
  typeof CommandEnvelopeOut_CreateCheckIn
>;

export const CommandEnvelopeOut_UpdateCheckIn = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: z.iso
      .datetime({ offset: true })
      .transform((s) => new Date(s))
      .optional(),
    type: z.literal("UpdateCheckIn"),
    payload: UpdateCheckIn,
  })
  .passthrough();
export type CommandEnvelopeOut_UpdateCheckIn = z.infer<
  typeof CommandEnvelopeOut_UpdateCheckIn
>;

export const CommandEnvelopeOut_DeleteCheckIn = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: z.iso
      .datetime({ offset: true })
      .transform((s) => new Date(s))
      .optional(),
    type: z.literal("DeleteCheckIn"),
    payload: DeleteCheckIn,
  })
  .passthrough();
export type CommandEnvelopeOut_DeleteCheckIn = z.infer<
  typeof CommandEnvelopeOut_DeleteCheckIn
>;

export const CommandEnvelopeOut = z.discriminatedUnion("type", [
  CommandEnvelopeOut_CreateHabit,
  CommandEnvelopeOut_UpdateHabit,
  CommandEnvelopeOut_DeleteHabit,
  CommandEnvelopeOut_CreateCheckIn,
  CommandEnvelopeOut_UpdateCheckIn,
  CommandEnvelopeOut_DeleteCheckIn,
]);
export type CommandEnvelopeOut = z.infer<typeof CommandEnvelopeOut>;

export const CommandsPage = z
  .object({
    commands: z.array(CommandEnvelopeOut).nullable(),
    nextSince: z.int().nullable(),
  })
  .partial();
export type CommandsPage = z.infer<typeof CommandsPage>;

export const HttpValidationProblemDetails = z
  .object({
    type: z.string().nullable(),
    title: z.string().nullable(),
    status: z.int().nullable(),
    detail: z.string().nullable(),
    instance: z.string().nullable(),
    errors: z.record(z.string(), z.array(z.string())).nullable(),
  })
  .partial()
  .passthrough();
export type HttpValidationProblemDetails = z.infer<
  typeof HttpValidationProblemDetails
>;

export const endpoints = [
  {
    method: "post",
    path: "/commands",
    alias: "postCommands",
    parameters: [{ name: "body", type: "Body", schema: CommandEnvelope }],
    response: CommandAccepted,
    errors: [{ status: 400, schema: z.void() }],
  },
  {
    method: "get",
    path: "/commands",
    alias: "getCommands",
    parameters: [
      { name: "since", type: "Query", schema: z.int() },
      { name: "limit", type: "Query", schema: z.int().optional() },
    ],
    response: CommandsPage,
    errors: [],
  },
  {
    method: "get",
    path: "/health",
    alias: "getHealth",
    parameters: [],
    response: z.void(),
    errors: [],
  },
  {
    method: "get",
    path: "/home-board",
    alias: "getHomeBoard",
    parameters: [],
    response: z.void(),
    errors: [],
  },
] as const;

export type Endpoints = typeof endpoints;
