// Time-slot dot states used by tile progress dots:
//   done    — ink fill (time-slot complete)
//   ahead   — orange fill (more done than expected — e.g. extras)
//   pending — empty + faint ring (upcoming time-slot)
//   behind  — empty + orange ring (time-slot's time passed, action overdue)
//   missed  — faint solid fill (gone, no recovery expected)
export type TimeSlotDotState =
  | "done"
  | "ahead"
  | "pending"
  | "behind"
  | "missed";

/**
 * Yields a `done | pending | ahead` strip — first `min(count, target)` as
 * `done`, the rest of `target` as `pending`, and any overflow as `ahead`.
 * Caller spreads into an array.
 */
export function* timeSlotStripStates(
  target: number,
  count: number,
): Generator<TimeSlotDotState> {
  const done = Math.min(count, target);
  const ahead = Math.max(0, count - target);
  for (let i = 0; i < done; i++) yield "done";
  for (let i = 0; i < target - done; i++) yield "pending";
  for (let i = 0; i < ahead; i++) yield "ahead";
}
