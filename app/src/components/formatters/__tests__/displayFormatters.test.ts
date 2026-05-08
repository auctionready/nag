import { cadenceLabel, formatTime } from "../displayFormatters";

const goal = (regularity: "day" | "week" | "month", frequency: number) => ({
  regularity,
  frequency,
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

describe("formatTime", () => {
  it("formats morning time with AM", () => {
    expect(formatTime(9, 30)).toBe("9:30 AM");
  });

  it("formats afternoon time with PM", () => {
    expect(formatTime(14, 0)).toBe("2:00 PM");
  });

  it("formats noon as 12:00 PM", () => {
    expect(formatTime(12, 0)).toBe("12:00 PM");
  });

  it("formats midnight as 12:00 AM", () => {
    expect(formatTime(0, 0)).toBe("12:00 AM");
  });

  it("pads minutes with leading zero", () => {
    expect(formatTime(8, 5)).toBe("8:05 AM");
  });
});
