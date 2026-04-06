import type { ComplianceColors, TrafficLightResult } from "./types";

export const colorForRatio = (
  ratio: number,
  colors: ComplianceColors,
): string => {
  if (ratio >= 1) return colors.compliant;
  if (ratio >= 0.5) return colors.partial;
  return colors.failing;
};

export const resultForRatio = (
  ratio: number,
  periodRatio: number,
  colors: ComplianceColors,
): TrafficLightResult => ({
  color: colorForRatio(ratio, colors),
  progress: Math.min(ratio, 1),
  periodProgress: Math.min(periodRatio, 1),
});

export const defaultResult = (
  colors: ComplianceColors,
): TrafficLightResult => ({
  color: colors.default,
  progress: 0,
  periodProgress: 0,
});
