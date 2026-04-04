import { formatTime, formatDays, timeFromStrings } from "../shared";

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
    // Number("0") || 9 evaluates to 9 since 0 is falsy
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
    expect(formatDays(0)).toBe("No days");
  });

  it("returns 'Every day' for AllDays (127)", () => {
    expect(formatDays(127)).toBe("Every day");
  });

  it("returns individual day names for partial bitmask", () => {
    // Mon(2) + Wed(8) = 10
    const result = formatDays(10);
    expect(result).toContain("Mon");
    expect(result).toContain("Wed");
    expect(result).not.toContain("Tue");
  });

  it("returns single day for single bit", () => {
    // Mon = 2
    expect(formatDays(2)).toBe("Mon");
  });
});

describe("timeFromStrings", () => {
  it("creates a Date with the given hour and minute", () => {
    const d = timeFromStrings("14", "30");
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
    expect(d.getSeconds()).toBe(0);
  });

  it("defaults to 9:00 for invalid strings", () => {
    const d = timeFromStrings("", "");
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });
});
