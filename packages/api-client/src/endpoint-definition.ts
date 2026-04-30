/**
 * GENERATED — do not edit by hand.
 *
 * Regenerate with:
 *   pnpm --filter @nag/api-client generate
 */
import { makeApi } from "@zodios/core";
import { z } from "zod";

const IsoDatetime = z.iso
  .datetime({ offset: true })
  .transform((s) => new Date(s));

export const UpgradeAccountRequest = z
  .object({ deviceId: z.uuid(), idpToken: z.string().nullable() })
  .partial();
export type UpgradeAccountRequest = z.infer<typeof UpgradeAccountRequest>;

export const UpgradeAccountResponse = z
  .object({
    accountId: z.uuid(),
    idpSubject: z.string().nullable(),
    upgradedAt: IsoDatetime,
    deviceToken: z.string().nullable(),
  })
  .partial();
export type UpgradeAccountResponse = z.infer<typeof UpgradeAccountResponse>;

export const ErrorResponse = z
  .object({ errors: z.array(z.string()).nullable() })
  .partial();
export type ErrorResponse = z.infer<typeof ErrorResponse>;

export const UnbindAccountResponse = z
  .object({ accountId: z.uuid() })
  .partial();
export type UnbindAccountResponse = z.infer<typeof UnbindAccountResponse>;

export const RegisterDeviceRequest = z
  .object({ deviceId: z.uuid(), label: z.string().nullable() })
  .partial();
export type RegisterDeviceRequest = z.infer<typeof RegisterDeviceRequest>;

export const RegisterDeviceResponse = z
  .object({
    accountId: z.uuid(),
    deviceId: z.uuid(),
    registeredAt: IsoDatetime,
    deviceToken: z.string().nullable(),
  })
  .partial();
export type RegisterDeviceResponse = z.infer<typeof RegisterDeviceResponse>;

export const PairDeviceRequest = z
  .object({
    deviceId: z.uuid(),
    idpToken: z.string().nullable(),
    label: z.string().nullable(),
  })
  .partial();
export type PairDeviceRequest = z.infer<typeof PairDeviceRequest>;

export const PairDeviceResponse = z
  .object({
    accountId: z.uuid(),
    deviceId: z.uuid(),
    registeredAt: IsoDatetime,
    deviceToken: z.string().nullable(),
  })
  .partial();
export type PairDeviceResponse = z.infer<typeof PairDeviceResponse>;

export const Regularity = z.enum(["day", "week", "month"]);
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

export const HabitCreated = z
  .object({
    habitId: z.uuid(),
    title: z.string().nullable(),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    goal: GoalPayload.nullable(),
  })
  .partial();
export type HabitCreated = z.infer<typeof HabitCreated>;

export const EventEntry_HabitCreated = z
  .object({ type: z.literal("HabitCreated"), payload: HabitCreated })
  .passthrough();
export type EventEntry_HabitCreated = z.infer<typeof EventEntry_HabitCreated>;

export const HabitDetailsEdited = z
  .object({
    habitId: z.uuid(),
    title: z.string().nullable(),
    description: z.string().nullable(),
    clearDescription: z.boolean(),
    icon: z.string().nullable(),
    clearIcon: z.boolean(),
  })
  .partial();
export type HabitDetailsEdited = z.infer<typeof HabitDetailsEdited>;

export const EventEntry_HabitDetailsEdited = z
  .object({
    type: z.literal("HabitDetailsEdited"),
    payload: HabitDetailsEdited,
  })
  .passthrough();
export type EventEntry_HabitDetailsEdited = z.infer<
  typeof EventEntry_HabitDetailsEdited
>;

export const HabitGoalDefined = z
  .object({
    habitId: z.uuid(),
    regularity: Regularity,
    frequency: z.int().nullable(),
    schedules: z.array(ScheduleEntry).nullable(),
  })
  .partial();
export type HabitGoalDefined = z.infer<typeof HabitGoalDefined>;

export const EventEntry_HabitGoalDefined = z
  .object({ type: z.literal("HabitGoalDefined"), payload: HabitGoalDefined })
  .passthrough();
export type EventEntry_HabitGoalDefined = z.infer<
  typeof EventEntry_HabitGoalDefined
>;

export const HabitGoalCleared = z.object({ habitId: z.uuid() }).partial();
export type HabitGoalCleared = z.infer<typeof HabitGoalCleared>;

export const EventEntry_HabitGoalCleared = z
  .object({ type: z.literal("HabitGoalCleared"), payload: HabitGoalCleared })
  .passthrough();
export type EventEntry_HabitGoalCleared = z.infer<
  typeof EventEntry_HabitGoalCleared
>;

export const HabitDeleted = z.object({ habitId: z.uuid() }).partial();
export type HabitDeleted = z.infer<typeof HabitDeleted>;

export const EventEntry_HabitDeleted = z
  .object({ type: z.literal("HabitDeleted"), payload: HabitDeleted })
  .passthrough();
export type EventEntry_HabitDeleted = z.infer<typeof EventEntry_HabitDeleted>;

export const CheckInRecorded = z
  .object({
    checkInId: z.uuid(),
    habitId: z.uuid(),
    timestamp: IsoDatetime,
    skipped: z.boolean(),
  })
  .partial();
export type CheckInRecorded = z.infer<typeof CheckInRecorded>;

export const EventEntry_CheckInRecorded = z
  .object({ type: z.literal("CheckInRecorded"), payload: CheckInRecorded })
  .passthrough();
export type EventEntry_CheckInRecorded = z.infer<
  typeof EventEntry_CheckInRecorded
>;

export const CheckInMoved = z
  .object({
    checkInId: z.uuid(),
    habitId: z.uuid(),
    oldTimestamp: IsoDatetime,
    newTimestamp: IsoDatetime,
  })
  .partial();
export type CheckInMoved = z.infer<typeof CheckInMoved>;

export const EventEntry_CheckInMoved = z
  .object({ type: z.literal("CheckInMoved"), payload: CheckInMoved })
  .passthrough();
export type EventEntry_CheckInMoved = z.infer<typeof EventEntry_CheckInMoved>;

export const CheckInMarkedSkipped = z
  .object({
    checkInId: z.uuid(),
    habitId: z.uuid(),
    timestamp: IsoDatetime,
  })
  .partial();
export type CheckInMarkedSkipped = z.infer<typeof CheckInMarkedSkipped>;

export const EventEntry_CheckInMarkedSkipped = z
  .object({
    type: z.literal("CheckInMarkedSkipped"),
    payload: CheckInMarkedSkipped,
  })
  .passthrough();
export type EventEntry_CheckInMarkedSkipped = z.infer<
  typeof EventEntry_CheckInMarkedSkipped
>;

export const CheckInMarkedDone = z
  .object({
    checkInId: z.uuid(),
    habitId: z.uuid(),
    timestamp: IsoDatetime,
  })
  .partial();
export type CheckInMarkedDone = z.infer<typeof CheckInMarkedDone>;

export const EventEntry_CheckInMarkedDone = z
  .object({ type: z.literal("CheckInMarkedDone"), payload: CheckInMarkedDone })
  .passthrough();
export type EventEntry_CheckInMarkedDone = z.infer<
  typeof EventEntry_CheckInMarkedDone
>;

export const CheckInDeleted = z
  .object({
    checkInId: z.uuid(),
    habitId: z.uuid(),
    timestamp: IsoDatetime,
  })
  .partial();
export type CheckInDeleted = z.infer<typeof CheckInDeleted>;

export const EventEntry_CheckInDeleted = z
  .object({ type: z.literal("CheckInDeleted"), payload: CheckInDeleted })
  .passthrough();
export type EventEntry_CheckInDeleted = z.infer<
  typeof EventEntry_CheckInDeleted
>;

export const EventEntry = z.discriminatedUnion("type", [
  EventEntry_HabitCreated,
  EventEntry_HabitDetailsEdited,
  EventEntry_HabitGoalDefined,
  EventEntry_HabitGoalCleared,
  EventEntry_HabitDeleted,
  EventEntry_CheckInRecorded,
  EventEntry_CheckInMoved,
  EventEntry_CheckInMarkedSkipped,
  EventEntry_CheckInMarkedDone,
  EventEntry_CheckInDeleted,
]);
export type EventEntry = z.infer<typeof EventEntry>;

export const WriteEventEnvelope = z
  .object({
    id: z.uuid(),
    timestamp: IsoDatetime,
    events: z.array(EventEntry).nullable(),
  })
  .partial();
export type WriteEventEnvelope = z.infer<typeof WriteEventEnvelope>;

export const IResult = z.object({}).partial();
export type IResult = z.infer<typeof IResult>;

export const EventEnvelope_HabitCreated = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: IsoDatetime.optional(),
    type: z.literal("HabitCreated"),
    payload: HabitCreated,
  })
  .passthrough();
export type EventEnvelope_HabitCreated = z.infer<
  typeof EventEnvelope_HabitCreated
>;

export const EventEnvelope_HabitDetailsEdited = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: IsoDatetime.optional(),
    type: z.literal("HabitDetailsEdited"),
    payload: HabitDetailsEdited,
  })
  .passthrough();
export type EventEnvelope_HabitDetailsEdited = z.infer<
  typeof EventEnvelope_HabitDetailsEdited
>;

export const EventEnvelope_HabitGoalDefined = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: IsoDatetime.optional(),
    type: z.literal("HabitGoalDefined"),
    payload: HabitGoalDefined,
  })
  .passthrough();
export type EventEnvelope_HabitGoalDefined = z.infer<
  typeof EventEnvelope_HabitGoalDefined
>;

export const EventEnvelope_HabitGoalCleared = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: IsoDatetime.optional(),
    type: z.literal("HabitGoalCleared"),
    payload: HabitGoalCleared,
  })
  .passthrough();
export type EventEnvelope_HabitGoalCleared = z.infer<
  typeof EventEnvelope_HabitGoalCleared
>;

export const EventEnvelope_HabitDeleted = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: IsoDatetime.optional(),
    type: z.literal("HabitDeleted"),
    payload: HabitDeleted,
  })
  .passthrough();
export type EventEnvelope_HabitDeleted = z.infer<
  typeof EventEnvelope_HabitDeleted
>;

export const EventEnvelope_CheckInRecorded = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: IsoDatetime.optional(),
    type: z.literal("CheckInRecorded"),
    payload: CheckInRecorded,
  })
  .passthrough();
export type EventEnvelope_CheckInRecorded = z.infer<
  typeof EventEnvelope_CheckInRecorded
>;

export const EventEnvelope_CheckInMoved = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: IsoDatetime.optional(),
    type: z.literal("CheckInMoved"),
    payload: CheckInMoved,
  })
  .passthrough();
export type EventEnvelope_CheckInMoved = z.infer<
  typeof EventEnvelope_CheckInMoved
>;

export const EventEnvelope_CheckInMarkedSkipped = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: IsoDatetime.optional(),
    type: z.literal("CheckInMarkedSkipped"),
    payload: CheckInMarkedSkipped,
  })
  .passthrough();
export type EventEnvelope_CheckInMarkedSkipped = z.infer<
  typeof EventEnvelope_CheckInMarkedSkipped
>;

export const EventEnvelope_CheckInMarkedDone = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: IsoDatetime.optional(),
    type: z.literal("CheckInMarkedDone"),
    payload: CheckInMarkedDone,
  })
  .passthrough();
export type EventEnvelope_CheckInMarkedDone = z.infer<
  typeof EventEnvelope_CheckInMarkedDone
>;

export const EventEnvelope_CheckInDeleted = z
  .object({
    sequence: z.int().optional(),
    id: z.uuid().optional(),
    timestamp: IsoDatetime.optional(),
    type: z.literal("CheckInDeleted"),
    payload: CheckInDeleted,
  })
  .passthrough();
export type EventEnvelope_CheckInDeleted = z.infer<
  typeof EventEnvelope_CheckInDeleted
>;

export const EventEnvelope = z.discriminatedUnion("type", [
  EventEnvelope_HabitCreated,
  EventEnvelope_HabitDetailsEdited,
  EventEnvelope_HabitGoalDefined,
  EventEnvelope_HabitGoalCleared,
  EventEnvelope_HabitDeleted,
  EventEnvelope_CheckInRecorded,
  EventEnvelope_CheckInMoved,
  EventEnvelope_CheckInMarkedSkipped,
  EventEnvelope_CheckInMarkedDone,
  EventEnvelope_CheckInDeleted,
]);
export type EventEnvelope = z.infer<typeof EventEnvelope>;

export const EventsPage = z
  .object({
    events: z.array(EventEnvelope).nullable(),
    nextSince: z.int().nullable(),
  })
  .partial();
export type EventsPage = z.infer<typeof EventsPage>;

export const EventsByEnvelope = z
  .object({ id: z.uuid(), events: z.array(EventEnvelope).nullable() })
  .partial();
export type EventsByEnvelope = z.infer<typeof EventsByEnvelope>;

export const HomeCheckIn = z
  .object({
    id: z.uuid(),
    timestamp: IsoDatetime,
    skipped: z.boolean(),
  })
  .partial();
export type HomeCheckIn = z.infer<typeof HomeCheckIn>;

export const HabitPeriodCheckIns = z
  .object({
    habitId: z.uuid(),
    checkIns: z.array(HomeCheckIn).nullable(),
  })
  .partial();
export type HabitPeriodCheckIns = z.infer<typeof HabitPeriodCheckIns>;

export const MonthlyCheckInSummary = z
  .object({
    id: z.string().nullable(),
    monthStart: IsoDatetime,
    habits: z.array(HabitPeriodCheckIns).nullable(),
  })
  .partial();
export type MonthlyCheckInSummary = z.infer<typeof MonthlyCheckInSummary>;

export const WeeklyCheckInSummary = z
  .object({
    id: z.string().nullable(),
    weekStart: IsoDatetime,
    habits: z.array(HabitPeriodCheckIns).nullable(),
  })
  .partial();
export type WeeklyCheckInSummary = z.infer<typeof WeeklyCheckInSummary>;

export const HomeGoal = z
  .object({ regularity: Regularity, frequency: z.int().nullable() })
  .partial();
export type HomeGoal = z.infer<typeof HomeGoal>;

export const HomeSchedule = z
  .object({
    hour: z.int(),
    minute: z.int(),
    days: z.int().nullable(),
    dayOfMonth: z.int().nullable(),
    reminder: z.boolean(),
  })
  .partial();
export type HomeSchedule = z.infer<typeof HomeSchedule>;

export const HomeHabit = z
  .object({
    id: z.uuid(),
    title: z.string().nullable(),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    goal: HomeGoal.nullable(),
    schedules: z.array(HomeSchedule).nullable(),
    periodCheckIns: z.array(HomeCheckIn).nullable(),
  })
  .partial();
export type HomeHabit = z.infer<typeof HomeHabit>;

export const HomeBoard = z
  .object({
    lastSequence: z.int(),
    habits: z.array(HomeHabit).nullable(),
  })
  .partial();
export type HomeBoard = z.infer<typeof HomeBoard>;

export const SyncResponse = z
  .object({
    mode: z.string().nullable(),
    events: z.array(EventEnvelope).nullable(),
    headSequence: z.int().nullable(),
    nextSince: z.int().nullable(),
    sequenceAtSnapshot: z.int().nullable(),
    snapshot: HomeBoard.nullable(),
  })
  .partial();
export type SyncResponse = z.infer<typeof SyncResponse>;

export const endpoints = makeApi([
  {
    method: "post",
    path: "/accounts/unbind",
    alias: "postAccountsUnbind",
    parameters: [],
    response: z.object({ accountId: z.uuid() }).partial(),
    errors: [
      { status: 401, schema: ErrorResponse },
      { status: 404, schema: ErrorResponse },
    ],
  },
  {
    method: "post",
    path: "/accounts/upgrade",
    alias: "postAccountsUpgrade",
    parameters: [{ name: "body", type: "Body", schema: UpgradeAccountRequest }],
    response: UpgradeAccountResponse,
    errors: [
      { status: 400, schema: ErrorResponse },
      { status: 401, schema: ErrorResponse },
      { status: 404, schema: ErrorResponse },
      { status: 409, schema: ErrorResponse },
    ],
  },
  {
    method: "get",
    path: "/check-ins/monthly/:year/:month",
    alias: "getMonthlyCheckInSummary",
    parameters: [
      { name: "year", type: "Path", schema: z.int() },
      { name: "month", type: "Path", schema: z.int() },
    ],
    response: MonthlyCheckInSummary,
    errors: [
      { status: 400, schema: z.void() },
      { status: 404, schema: z.void() },
    ],
  },
  {
    method: "get",
    path: "/check-ins/weekly/:year/:month/:day",
    alias: "getWeeklyCheckInSummary",
    parameters: [
      { name: "year", type: "Path", schema: z.int() },
      { name: "month", type: "Path", schema: z.int() },
      { name: "day", type: "Path", schema: z.int() },
    ],
    response: WeeklyCheckInSummary,
    errors: [
      { status: 400, schema: z.void() },
      { status: 404, schema: z.void() },
    ],
  },
  {
    method: "post",
    path: "/devices/pair",
    alias: "postDevicesPair",
    parameters: [{ name: "body", type: "Body", schema: PairDeviceRequest }],
    response: PairDeviceResponse,
    errors: [
      { status: 400, schema: ErrorResponse },
      { status: 401, schema: ErrorResponse },
      { status: 404, schema: ErrorResponse },
      { status: 409, schema: ErrorResponse },
    ],
  },
  {
    method: "post",
    path: "/devices/register",
    alias: "postDevicesRegister",
    parameters: [{ name: "body", type: "Body", schema: RegisterDeviceRequest }],
    response: RegisterDeviceResponse,
    errors: [
      { status: 400, schema: ErrorResponse },
      { status: 404, schema: z.void() },
    ],
  },
  {
    method: "post",
    path: "/events",
    alias: "postEvents",
    parameters: [{ name: "body", type: "Body", schema: WriteEventEnvelope }],
    response: z.object({}).partial(),
    errors: [
      { status: 400, schema: ErrorResponse },
      { status: 404, schema: z.void() },
    ],
  },
  {
    method: "get",
    path: "/events",
    alias: "getEvents",
    parameters: [
      { name: "since", type: "Query", schema: z.int().optional() },
      { name: "limit", type: "Query", schema: z.int().nullish() },
    ],
    response: EventsPage,
    errors: [{ status: 404, schema: z.void() }],
  },
  {
    method: "get",
    path: "/events/by-envelope/:id",
    alias: "getEventsByEnvelope",
    parameters: [{ name: "id", type: "Path", schema: z.uuid() }],
    response: EventsByEnvelope,
    errors: [{ status: 404, schema: z.void() }],
  },
  {
    method: "get",
    path: "/health",
    alias: "getHealth",
    parameters: [],
    response: z.object({}).partial(),
    errors: [{ status: 404, schema: z.void() }],
  },
  {
    method: "get",
    path: "/home-board",
    alias: "getHomeBoard",
    parameters: [],
    response: HomeBoard,
    errors: [{ status: 404, schema: z.void() }],
  },
  {
    method: "get",
    path: "/sync",
    alias: "getSync",
    parameters: [{ name: "since", type: "Query", schema: z.int().optional() }],
    response: SyncResponse,
    errors: [{ status: 404, schema: z.void() }],
  },
]);

export type Endpoints = typeof endpoints;
