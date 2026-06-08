import { describe, expect, it } from "vitest";
import { ScheduleAlarmStatus, scheduleAlarmStatus } from "../scheduleAlarm";
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

describe("scheduleAlarmStatus", () => {
  it("is None when there are no timed slots today", () => {
    expect(scheduleAlarmStatus(null)).toBe(ScheduleAlarmStatus.None);
    expect(scheduleAlarmStatus(result([]))).toBe(ScheduleAlarmStatus.None);
  });

  it("is Armed when slots are upcoming or done but none missed", () => {
    expect(scheduleAlarmStatus(result([slot("upcoming")]))).toBe(
      ScheduleAlarmStatus.Armed,
    );
    expect(scheduleAlarmStatus(result([slot("done")]))).toBe(
      ScheduleAlarmStatus.Armed,
    );
    expect(scheduleAlarmStatus(result([slot("skipped")]))).toBe(
      ScheduleAlarmStatus.Armed,
    );
    expect(scheduleAlarmStatus(result([slot("done"), slot("upcoming")]))).toBe(
      ScheduleAlarmStatus.Armed,
    );
  });

  it("is Overdue when any slot's time has passed unlogged", () => {
    expect(scheduleAlarmStatus(result([slot("missed")]))).toBe(
      ScheduleAlarmStatus.Overdue,
    );
    expect(scheduleAlarmStatus(result([slot("done"), slot("missed")]))).toBe(
      ScheduleAlarmStatus.Overdue,
    );
  });
});
