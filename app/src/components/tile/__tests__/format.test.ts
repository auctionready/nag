import { formatCount, periodLabels } from "../format";

describe("periodLabels", () => {
  it("maps each regularity to a label", () => {
    expect(periodLabels.day).toBe("today");
    expect(periodLabels.week).toBe("this week");
    expect(periodLabels.month).toBe("this month");
  });
});

describe("formatCount", () => {
  it("returns word for numbers 0-9", () => {
    expect(formatCount(0)).toBe("zero");
    expect(formatCount(1)).toBe("one");
    expect(formatCount(5)).toBe("five");
    expect(formatCount(9)).toBe("nine");
  });

  it("returns string digit for numbers >= 10", () => {
    expect(formatCount(10)).toBe("10");
    expect(formatCount(42)).toBe("42");
    expect(formatCount(100)).toBe("100");
  });
});
