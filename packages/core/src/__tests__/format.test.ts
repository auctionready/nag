import { describe, expect, it } from "vitest";
import { formatTimeOfDay, formatTimeSlotTime } from "../format";

describe("formatTimeSlotTime", () => {
  it("formats 12-hour with a lowercase suffix by default", () => {
    expect(formatTimeSlotTime(7, 0)).toBe("7:00 am");
    expect(formatTimeSlotTime(19, 30)).toBe("7:30 pm");
  });

  it("formats 24-hour with a padded hour and no suffix", () => {
    expect(formatTimeSlotTime(7, 0, true)).toBe("07:00");
    expect(formatTimeSlotTime(19, 30, true)).toBe("19:30");
    expect(formatTimeSlotTime(0, 5, true)).toBe("00:05");
  });
});

describe("formatTimeOfDay", () => {
  const date = new Date(2026, 0, 15, 16, 4);

  it("formats 12-hour by default", () => {
    expect(formatTimeOfDay(date)).toBe("4:04 pm");
  });

  it("formats 24-hour when asked", () => {
    expect(formatTimeOfDay(date, true)).toBe("16:04");
  });
});
