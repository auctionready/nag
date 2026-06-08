import { describe, expect, it } from "vitest";
import { scheduleAlarmState } from "../scheduleAlarm";
import type {
  MatchCheckInsToTimeSlotsResult,
  TimeSlotState,
} from "../trafficLight";

const result = (slots: TimeSlotState[]): MatchCheckInsToTimeSlotsResult => ({
  timeSlots: slots,
  extras: 0,
  done: slots.filter((s) => s.status === "done").length,
  total: slots.length,
});

const slot = (status: TimeSlotState["status"]): TimeSlotState => ({
  hour: 8,
  minute: 0,
  status,
});

describe("scheduleAlarmState", () => {
  it("is 'none' when there are no timed slots today", () => {
    expect(scheduleAlarmState(null)).toBe("none");
    expect(scheduleAlarmState(result([]))).toBe("none");
  });

  it("is 'armed' when slots are upcoming or done but none missed", () => {
    expect(scheduleAlarmState(result([slot("upcoming")]))).toBe("armed");
    expect(scheduleAlarmState(result([slot("done")]))).toBe("armed");
    expect(scheduleAlarmState(result([slot("skipped")]))).toBe("armed");
    expect(scheduleAlarmState(result([slot("done"), slot("upcoming")]))).toBe(
      "armed",
    );
  });

  it("is 'overdue' when any slot's time has passed unlogged", () => {
    expect(scheduleAlarmState(result([slot("missed")]))).toBe("overdue");
    expect(scheduleAlarmState(result([slot("done"), slot("missed")]))).toBe(
      "overdue",
    );
  });
});
