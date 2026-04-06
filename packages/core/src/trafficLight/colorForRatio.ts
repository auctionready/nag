import type { ComplianceColors } from "./types";

export const colorForRatio = (
  ratio: number,
  colors: ComplianceColors,
): string => {
  if (ratio >= 1) return colors.compliant;
  if (ratio >= 0.5) return colors.partial;
  return colors.failing;
};
