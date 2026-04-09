import { complianceColors, ringColorForTileColor } from "../getComplianceColor";

describe("ringColorForTileColor", () => {
  it("returns a lighter ring color for each compliance tile color", () => {
    const ringColors = [
      ringColorForTileColor(complianceColors.default),
      ringColorForTileColor(complianceColors.compliant),
      ringColorForTileColor(complianceColors.partial),
      ringColorForTileColor(complianceColors.failing),
    ];
    // Each should differ from its corresponding tile color so the ring is
    // visible on top of it.
    expect(ringColors[0]).not.toBe(complianceColors.default);
    expect(ringColors[1]).not.toBe(complianceColors.compliant);
    expect(ringColors[2]).not.toBe(complianceColors.partial);
    expect(ringColors[3]).not.toBe(complianceColors.failing);
  });

  it("returns a distinct ring color for each compliance level", () => {
    const ringColors = new Set([
      ringColorForTileColor(complianceColors.default),
      ringColorForTileColor(complianceColors.compliant),
      ringColorForTileColor(complianceColors.partial),
      ringColorForTileColor(complianceColors.failing),
    ]);
    expect(ringColors.size).toBe(4);
  });

  it("falls back to white for unknown tile colors", () => {
    expect(ringColorForTileColor("#123456")).toBe("#fff");
  });
});
