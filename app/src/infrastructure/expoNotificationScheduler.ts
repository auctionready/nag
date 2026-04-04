import * as Notifications from "expo-notifications";
import type {
  NotificationScheduler,
  NotificationScheduleEntry,
} from "@nag/core";

const notificationId = (
  habitId: number,
  index: number,
  dow?: number,
): string =>
  dow !== undefined
    ? `habit-${habitId}-${index}-${dow}`
    : `habit-${habitId}-${index}`;

const requestPermissions = async (): Promise<boolean> => {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
};

export const expoNotificationScheduler: NotificationScheduler = {
  cancelNotifications: async (habitId: number): Promise<void> => {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const prefix = `habit-${habitId}-`;
    await Promise.all(
      all
        .filter((n) => n.identifier.startsWith(prefix))
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier),
        ),
    );
  },

  syncNotifications: async (
    habitId: number,
    title: string,
    schedules: NotificationScheduleEntry[],
    regularity: "day" | "week" | "month",
  ): Promise<void> => {
    const granted = await requestPermissions();
    if (!granted) return;

    await expoNotificationScheduler.cancelNotifications(habitId);

    const { SchedulableTriggerInputTypes } = Notifications;

    for (const [i, entry] of schedules.entries()) {
      if (regularity === "day") {
        await Notifications.scheduleNotificationAsync({
          identifier: notificationId(habitId, i),
          content: { title, body: `Time for ${title}` },
          trigger: {
            type: SchedulableTriggerInputTypes.DAILY,
            hour: entry.hour,
            minute: entry.minute,
          },
        });
      } else if (regularity === "week") {
        const days = entry.days ?? 0;
        for (let dow = 0; dow < 7; dow++) {
          if (days & (1 << dow)) {
            await Notifications.scheduleNotificationAsync({
              identifier: notificationId(habitId, i, dow),
              content: { title, body: `Time for ${title}` },
              trigger: {
                type: SchedulableTriggerInputTypes.WEEKLY,
                hour: entry.hour,
                minute: entry.minute,
                weekday: dow + 1,
              },
            });
          }
        }
      } else {
        await Notifications.scheduleNotificationAsync({
          identifier: notificationId(habitId, i),
          content: { title, body: `Time for ${title}` },
          trigger: {
            type: SchedulableTriggerInputTypes.MONTHLY,
            hour: entry.hour,
            minute: entry.minute,
            day: entry.dayOfMonth!,
          },
        });
      }
    }
  },
};
