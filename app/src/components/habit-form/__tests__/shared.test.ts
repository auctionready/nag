import { parseFormTime, timeFromStrings } from "../shared";

describe("parseFormTime", () => {
  it("coerces numeric strings to numbers", () => {
    expect(parseFormTime("14", "30")).toEqual({ hour: 14, minute: 30 });
  });

  it("falls back to 9:00 for empty / NaN inputs", () => {
    expect(parseFormTime("", "")).toEqual({ hour: 9, minute: 0 });
    expect(parseFormTime("abc", "xyz")).toEqual({ hour: 9, minute: 0 });
  });

  it("treats hour 0 as the 9-AM fallback (falsy coercion)", () => {
    expect(parseFormTime("0", "0")).toEqual({ hour: 9, minute: 0 });
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
