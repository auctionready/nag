import { formatGroupTime } from "../formatGroupTime";
import type { TimeSlotCheckInItem } from "../TimeSlotCheckIn";

const item = (timeSlotMeta?: string): TimeSlotCheckInItem => ({
  id: "h",
  title: "Habit",
  timeSlotMeta,
  initialState: "pending",
});

describe("formatGroupTime", () => {
  it("formats the explicit (hour, minute) when supplied", () => {
    expect(formatGroupTime(7, 0, [])).toBe("7:00 am");
  });

  it("falls back to a shared row meta when hour/minute are absent", () => {
    expect(
      formatGroupTime(undefined, undefined, [item("8:00 am"), item("8:00 am")]),
    ).toBe("8:00 am");
  });

  it("returns undefined when rows disagree", () => {
    expect(
      formatGroupTime(undefined, undefined, [item("8:00 am"), item("9:00 am")]),
    ).toBeUndefined();
  });

  it("returns undefined when the row meta is missing", () => {
    expect(
      formatGroupTime(undefined, undefined, [item(undefined)]),
    ).toBeUndefined();
  });

  it("ignores NaN hour/minute and falls back to row meta", () => {
    expect(formatGroupTime(NaN, NaN, [item("7:00 am")])).toBe("7:00 am");
  });
});
