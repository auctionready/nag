import type { ComplianceColors, ScheduleInfo } from "../../trafficLight";

export const colors: ComplianceColors = {
  default: "default",
  compliant: "compliant",
  partial: "partial",
  failing: "failing",
};

export const oldDate = new Date("2020-01-01T00:00:00.000Z");

export const noSchedules: ScheduleInfo[] = [];

export const defaultResult = {
  color: "default",
  progress: 0,
  periodProgress: 0,
};
