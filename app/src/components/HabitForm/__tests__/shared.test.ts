import { formatTime, formatDays, timeFromStrings } from "../shared";
import { Day, AllDays, NoDays } from "@nag/core";

describe("formatTime", () => {
  it("formats morning time with AM", () => {
    expect(formatTime("9", "30")).toBe("9:30 AM");
  });

  it("formats afternoon time with PM", () => {
    expect(formatTime("14", "0")).toBe("2:00 PM");
  });

  it("formats noon as 12:00 PM", () => {
    expect(formatTime("12", "0")).toBe("12:00 PM");
  });

  it("treats hour 0 as default (9 AM) due to falsy coercion", () => {
    expect(formatTime("0", "0")).toBe("9:00 AM");
  });

  it("pads minutes with leading zero", () => {
    expect(formatTime("8", "5")).toBe("8:05 AM");
  });

  it("defaults to 9:00 AM for invalid input", () => {
    expect(formatTime("", "")).toBe("9:00 AM");
  });
});

describe("formatDays", () => {
  it("returns 'No days' for 0", () => {
    expect(formatDays(NoDays)).toBe("No days");
  });

  it("returns 'Every day' for AllDays (127)", () => {
    expect(formatDays(AllDays)).toBe("Every day");
  });

  describe("with partial bitmask (Mon + Wed)", () => {
    let result: string;

    beforeEach(() => {
      result = formatDays(Day.Mon | Day.Wed);
    });

    it("includes selected days", () => {
      expect(result).toContain("Mon");
      expect(result).toContain("Wed");
    });

    it("excludes unselected days", () => {
      expect(result).not.toContain("Tue");
    });
  });

  it("returns single day for single bit", () => {
    expect(formatDays(Day.Mon)).toBe("Mon");
  });
});

describe("timeFromStrings", () => {
  describe("with valid hour and minute", () => {
    let result: Date;

    beforeEach(() => {
      result = timeFromStrings("14", "30");
    });

    it("sets the correct hour", () => {
      expect(result.getHours()).toBe(14);
    });

    it("sets the correct minute", () => {
      expect(result.getMinutes()).toBe(30);
    });

    it("zeroes out seconds", () => {
      expect(result.getSeconds()).toBe(0);
    });
  });

  describe("with invalid strings", () => {
    let result: Date;

    beforeEach(() => {
      result = timeFromStrings("", "");
    });

    it("defaults hour to 9", () => {
      expect(result.getHours()).toBe(9);
    });

    it("defaults minute to 0", () => {
      expect(result.getMinutes()).toBe(0);
    });
  });
});
