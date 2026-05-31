import type { AnyDb } from "../../db";
import { applyHabitCreated } from "./HabitCreated";
import { applyHabitDetailsEdited } from "./HabitDetailsEdited";
import { applyHabitGoalDefined } from "./HabitGoalDefined";
import { applyHabitGoalCleared } from "./HabitGoalCleared";
import { applyHabitDeleted } from "./HabitDeleted";
import { applyHabitArchived } from "./HabitArchived";
import { applyHabitUnarchived } from "./HabitUnarchived";
import { applyHabitPaused } from "./HabitPaused";
import { applyHabitUnpaused } from "./HabitUnpaused";
import { applyCheckInRecorded } from "./CheckInRecorded";
import { applyCheckInMoved } from "./CheckInMoved";
import { applyCheckInMarkedSkipped } from "./CheckInMarkedSkipped";
import { applyCheckInMarkedDone } from "./CheckInMarkedDone";
import { applyCheckInDeleted } from "./CheckInDeleted";

export { applyHabitCreated } from "./HabitCreated";
export { applyHabitDetailsEdited } from "./HabitDetailsEdited";
export { applyHabitGoalDefined } from "./HabitGoalDefined";
export { applyHabitGoalCleared } from "./HabitGoalCleared";
export { applyHabitDeleted } from "./HabitDeleted";
export { applyHabitArchived } from "./HabitArchived";
export { applyHabitUnarchived } from "./HabitUnarchived";
export { applyHabitPaused } from "./HabitPaused";
export { applyHabitUnpaused } from "./HabitUnpaused";
export { applyCheckInRecorded } from "./CheckInRecorded";
export { applyCheckInMoved } from "./CheckInMoved";
export { applyCheckInMarkedSkipped } from "./CheckInMarkedSkipped";
export { applyCheckInMarkedDone } from "./CheckInMarkedDone";
export { applyCheckInDeleted } from "./CheckInDeleted";

/**
 * Type-keyed registry of event handlers — each one writes a single
 * event's effects to the local DB. Both the command processor (when a
 * local intent emits events) and the sync replay (when the server ships
 * events back) dispatch through here, so the per-event-type DB logic
 * has a single home.
 *
 * Handlers are upsert-shaped and tolerate "target row missing" so out-
 * of-order arrival, redelivery on resume, and self-replay of an event
 * we just authored are all idempotent.
 */
export const eventHandlers = {
  HabitCreated: applyHabitCreated,
  HabitDetailsEdited: applyHabitDetailsEdited,
  HabitGoalDefined: applyHabitGoalDefined,
  HabitGoalCleared: applyHabitGoalCleared,
  HabitDeleted: applyHabitDeleted,
  HabitArchived: applyHabitArchived,
  HabitUnarchived: applyHabitUnarchived,
  HabitPaused: applyHabitPaused,
  HabitUnpaused: applyHabitUnpaused,
  CheckInRecorded: applyCheckInRecorded,
  CheckInMoved: applyCheckInMoved,
  CheckInMarkedSkipped: applyCheckInMarkedSkipped,
  CheckInMarkedDone: applyCheckInMarkedDone,
  CheckInDeleted: applyCheckInDeleted,
} as const;

export type EventTypeName = keyof typeof eventHandlers;

/**
 * Dispatch one event by its discriminator string. Throws on an unknown
 * type — the server is the source of truth for the event vocabulary, so
 * an unknown type means we've shipped an out-of-date client.
 */
export const applyEvent = async (
  db: AnyDb,
  type: string,
  payload: unknown,
): Promise<unknown> => {
  const handler = eventHandlers[type as EventTypeName];
  if (!handler) {
    throw new Error(`applyEvent: unknown event type "${type}"`);
  }
  return (handler as (db: AnyDb, payload: unknown) => Promise<unknown>)(
    db,
    payload,
  );
};
