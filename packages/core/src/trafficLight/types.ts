import type { Regularity } from "@nag/schema";

export interface ScheduleInfo {
  days: number | null;
  dayOfMonth: number | null;
}

export interface TrafficLightInput {
  frequency: number;
  regularity: Regularity;
  createdAt: Date;
  schedules: ScheduleInfo[];
  checkInCount: number;
  now: Date;
}

export interface ComplianceColors {
  default: string;
  compliant: string;
  partial: string;
  failing: string;
}

export type TrafficLightCalculator = (
  input: TrafficLightInput,
  colors: ComplianceColors,
) => string;
