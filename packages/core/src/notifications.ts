export interface ScheduleEntry {
  hour: number;
  minute: number;
  days?: number;
  dayOfMonth?: number;
}

export interface NotificationScheduler {
  cancelNotifications(habitId: number): Promise<void>;
  syncNotifications(
    habitId: number,
    title: string,
    schedules: ScheduleEntry[],
    regularity: "day" | "week" | "month",
  ): Promise<void>;
}

const noop: NotificationScheduler = {
  cancelNotifications: async () => {},
  syncNotifications: async () => {},
};

let scheduler: NotificationScheduler = noop;

export const setNotificationScheduler = (s: NotificationScheduler) => {
  scheduler = s;
};

export const getNotificationScheduler = () => scheduler;
