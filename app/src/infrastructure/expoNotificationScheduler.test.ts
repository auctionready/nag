import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Notification } from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import * as Notifications from "expo-notifications";
import { expoNotificationScheduler } from "./expoNotificationScheduler";

vi.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: {
    DAILY: "daily",
    WEEKLY: "weekly",
    MONTHLY: "monthly",
  },
  requestPermissionsAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
}));

const mockRequestPermissions = vi.mocked(Notifications.requestPermissionsAsync);
const mockGetAll = vi.mocked(Notifications.getAllScheduledNotificationsAsync);
const mockCancel = vi.mocked(Notifications.cancelScheduledNotificationAsync);
const mockSchedule = vi.mocked(Notifications.scheduleNotificationAsync);

const makeNotification = (identifier: string): Notification =>
  ({ identifier }) as unknown as Notification;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestPermissions.mockResolvedValue({ status: "granted" } as Awaited<
    ReturnType<typeof Notifications.requestPermissionsAsync>
  >);
  mockGetAll.mockResolvedValue([]);
  mockCancel.mockResolvedValue();
  mockSchedule.mockResolvedValue("id");
});

describe("cancelNotifications", () => {
  it("cancels all notifications matching the habit prefix", async () => {
    mockGetAll.mockResolvedValue([
      makeNotification("habit-1-0"),
      makeNotification("habit-1-0-3"),
      makeNotification("habit-2-0"),
    ]);

    await expoNotificationScheduler.cancelNotifications(1);

    expect(mockCancel).toHaveBeenCalledTimes(2);
    expect(mockCancel).toHaveBeenCalledWith("habit-1-0");
    expect(mockCancel).toHaveBeenCalledWith("habit-1-0-3");
  });

  it("does nothing when no matching notifications exist", async () => {
    mockGetAll.mockResolvedValue([makeNotification("habit-2-0")]);

    await expoNotificationScheduler.cancelNotifications(1);

    expect(mockCancel).not.toHaveBeenCalled();
  });
});

describe("syncNotifications", () => {
  it("does nothing when permissions are denied", async () => {
    mockRequestPermissions.mockResolvedValue({
      status: "denied",
    } as Awaited<ReturnType<typeof Notifications.requestPermissionsAsync>>);

    await expoNotificationScheduler.syncNotifications(1, "Exercise", [], "day");

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("cancels existing notifications before scheduling new ones", async () => {
    mockGetAll.mockResolvedValue([makeNotification("habit-1-0")]);

    await expoNotificationScheduler.syncNotifications(
      1,
      "Exercise",
      [{ hour: 8, minute: 0 }],
      "day",
    );

    expect(mockCancel).toHaveBeenCalledWith("habit-1-0");
  });

  describe("daily", () => {
    it("schedules one notification per entry", async () => {
      await expoNotificationScheduler.syncNotifications(
        1,
        "Exercise",
        [
          { hour: 8, minute: 0 },
          { hour: 18, minute: 30 },
        ],
        "day",
      );

      expect(mockSchedule).toHaveBeenCalledTimes(2);
      expect(mockSchedule).toHaveBeenCalledWith({
        identifier: "habit-1-0",
        content: { title: "Exercise", body: "Time for Exercise" },
        trigger: {
          type: SchedulableTriggerInputTypes.DAILY,
          hour: 8,
          minute: 0,
        },
      });
      expect(mockSchedule).toHaveBeenCalledWith({
        identifier: "habit-1-1",
        content: { title: "Exercise", body: "Time for Exercise" },
        trigger: {
          type: SchedulableTriggerInputTypes.DAILY,
          hour: 18,
          minute: 30,
        },
      });
    });
  });

  describe("weekly", () => {
    it("schedules one notification per active day-of-week", async () => {
      // days bitmask: bit 0 = Sunday, bit 1 = Monday, bit 3 = Wednesday → 0b1011 = 11
      await expoNotificationScheduler.syncNotifications(
        2,
        "Run",
        [{ hour: 7, minute: 0, days: 0b1010 }], // Mon (bit 1) + Wed (bit 3)
        "week",
      );

      expect(mockSchedule).toHaveBeenCalledTimes(2);
      expect(mockSchedule).toHaveBeenCalledWith({
        identifier: "habit-2-0-1",
        content: { title: "Run", body: "Time for Run" },
        trigger: {
          type: SchedulableTriggerInputTypes.WEEKLY,
          hour: 7,
          minute: 0,
          weekday: 2,
        },
      });
      expect(mockSchedule).toHaveBeenCalledWith({
        identifier: "habit-2-0-3",
        content: { title: "Run", body: "Time for Run" },
        trigger: {
          type: SchedulableTriggerInputTypes.WEEKLY,
          hour: 7,
          minute: 0,
          weekday: 4,
        },
      });
    });

    it("schedules nothing when days bitmask is 0", async () => {
      await expoNotificationScheduler.syncNotifications(
        1,
        "Run",
        [{ hour: 7, minute: 0, days: 0 }],
        "week",
      );

      expect(mockSchedule).not.toHaveBeenCalled();
    });
  });

  describe("monthly", () => {
    it("schedules one notification per entry with dayOfMonth", async () => {
      await expoNotificationScheduler.syncNotifications(
        3,
        "Review",
        [{ hour: 9, minute: 0, dayOfMonth: 15 }],
        "month",
      );

      expect(mockSchedule).toHaveBeenCalledTimes(1);
      expect(mockSchedule).toHaveBeenCalledWith({
        identifier: "habit-3-0",
        content: { title: "Review", body: "Time for Review" },
        trigger: {
          type: SchedulableTriggerInputTypes.MONTHLY,
          hour: 9,
          minute: 0,
          day: 15,
        },
      });
    });
  });
});
