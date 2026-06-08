import { describe, expect, it } from "vitest";
import { ScheduleAlarmStatus, scheduleAlarmStatus } from "../scheduleAlarm";
import { Day } from "../days";
import {
  matchCheckInsToTimeSlots,
  type MatchCheckInsToTimeSlotsResult,
  type TimeSlotState,
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

  it("is None on an off day — a timed slot scheduled for another weekday", () => {
    // Schedule fires Monday 08:00; "now" is a Wednesday, so the slot doesn't
    // apply today and no bell should show despite the past time of day.
    const wednesday = new Date(2026, 5, 10, 9, 0); // 2026-06-10 is a Wednesday
    const timeSlots = matchCheckInsToTimeSlots({
      schedules: [{ days: Day.Mon, dayOfMonth: null, hour: 8, minute: 0 }],
      checkIns: [],
      now: wednesday,
    });
    expect(timeSlots.total).toBe(0);
    expect(scheduleAlarmStatus(timeSlots)).toBe(ScheduleAlarmStatus.None);
  });
});
