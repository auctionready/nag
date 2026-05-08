import type { TimeSlotState } from "@nag/core";
import { pickTimeSlot } from "../pickTimeSlot";

const ts = (
  hour: number,
  minute: number,
  status: TimeSlotState["status"] = "upcoming",
): TimeSlotState => ({ hour, minute, status });

const NOW_NOON = new Date(2025, 5, 4, 12, 0);

describe("pickTimeSlot", () => {
  it("returns undefined when there are no time-slots", () => {
    expect(pickTimeSlot([], 9, 0, NOW_NOON)).toBeUndefined();
  });

  it("returns the exact (hour, minute) match when supplied", () => {
    const slots = [ts(9, 0), ts(13, 0), ts(18, 0)];
    expect(pickTimeSlot(slots, 13, 0, NOW_NOON)).toEqual(ts(13, 0));
  });

  it("falls back to nearest-to-now when the exact match is missing", () => {
    const slots = [ts(9, 0), ts(13, 0), ts(18, 0)];
    // 7:30 isn't in the list — nearest to 12:00 is 13:00.
    expect(pickTimeSlot(slots, 7, 30, NOW_NOON)).toEqual(ts(13, 0));
  });

  it("uses nearest-to-now when hour/minute are undefined", () => {
    const slots = [ts(9, 0), ts(13, 0), ts(18, 0)];
    expect(pickTimeSlot(slots, undefined, undefined, NOW_NOON)).toEqual(
      ts(13, 0),
    );
  });

  it("treats NaN hour/minute as not supplied and falls back to nearest", () => {
    const slots = [ts(9, 0), ts(13, 0)];
    expect(pickTimeSlot(slots, NaN, NaN, NOW_NOON)).toEqual(ts(13, 0));
  });

  it("ties go to the earlier slot (reduce keeps `best` on equal distance)", () => {
    const slots = [ts(11, 0), ts(13, 0)];
    // 12:00 is equidistant from both — earlier slot wins.
    expect(pickTimeSlot(slots, undefined, undefined, NOW_NOON)).toEqual(
      ts(11, 0),
    );
  });
});
