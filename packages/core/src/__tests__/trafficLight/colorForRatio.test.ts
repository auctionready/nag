import { describe, expect, it } from "vitest";
import { colorForRatio, tileColor } from "../../trafficLight";
import { colors, noSchedules, defaultResult } from "./shared";

describe("colorForRatio", () => {
  it("returns compliant when ratio >= 1", () => {
    expect(colorForRatio(1, colors)).toBe("compliant");
    expect(colorForRatio(1.5, colors)).toBe("compliant");
  });

  it("returns partial when ratio >= 0.5 and < 1", () => {
    expect(colorForRatio(0.5, colors)).toBe("partial");
    expect(colorForRatio(0.99, colors)).toBe("partial");
  });

  it("returns failing when ratio < 0.5", () => {
    expect(colorForRatio(0, colors)).toBe("failing");
    expect(colorForRatio(0.49, colors)).toBe("failing");
  });
});

describe("tileColor", () => {
  it("returns default with zero progress when goal is null", () => {
    expect(tileColor(null, 0, noSchedules, colors)).toEqual(defaultResult);
    expect(tileColor(null, 5, noSchedules, colors)).toEqual(defaultResult);
  });
});
