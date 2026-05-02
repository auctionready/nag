import { cadenceLabel, formatCount, periodLabels } from "../format";

const goal = (regularity: "day" | "week" | "month", frequency: number) => ({
  regularity,
  frequency,
  title: "habit",
  createdAt: new Date(),
});

describe("periodLabels", () => {
  it("maps each regularity to a label", () => {
    expect(periodLabels.day).toBe("today");
    expect(periodLabels.week).toBe("this week");
    expect(periodLabels.month).toBe("this month");
  });
});

describe("cadenceLabel", () => {
  it("renders 'daily' / 'weekly' / 'monthly' for freq=1", () => {
    expect(cadenceLabel(goal("day", 1))).toBe("daily");
    expect(cadenceLabel(goal("week", 1))).toBe("weekly");
    expect(cadenceLabel(goal("month", 1))).toBe("monthly");
  });

  it("renders 'N× / unit' for freq>1", () => {
    expect(cadenceLabel(goal("day", 2))).toBe("2× / day");
    expect(cadenceLabel(goal("week", 3))).toBe("3× / wk");
    expect(cadenceLabel(goal("month", 4))).toBe("4× / mo");
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
