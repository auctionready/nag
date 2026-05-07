export interface ScheduleEntry {
  id: number;
  hour: number;
  minute: number;
  days?: number;
  dayOfMonth?: number;
}

export interface NotificationScheduler {
  cancelNotifications(habitId: string): Promise<void>;
  syncNotifications(
    habitId: string,
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
