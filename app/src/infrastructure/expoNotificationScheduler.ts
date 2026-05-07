import * as Notifications from "expo-notifications";
import type {
  NotificationScheduler,
  NotificationScheduleEntry,
} from "@nag/core";
import type { Regularity } from "@nag/schema";

const notificationId = (
  habitId: string,
  scheduleId: number,
  dow?: number,
): string =>
  dow !== undefined
    ? `habit-${habitId}-${scheduleId}-${dow}`
    : `habit-${habitId}-${scheduleId}`;

const requestPermissions = async (): Promise<boolean> => {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
};

export const expoNotificationScheduler: NotificationScheduler = {
  cancelNotifications: async (habitId: string) => {
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
    habitId: string,
    title: string,
    schedules: NotificationScheduleEntry[],
    regularity: Regularity,
  ) => {
    const granted = await requestPermissions();
    if (!granted) return;

    await expoNotificationScheduler.cancelNotifications(habitId);

    const { SchedulableTriggerInputTypes } = Notifications;
    const content = { title, body: `Time for ${title}` };

    for (const entry of schedules) {
      switch (regularity) {
        case "day":
          await Notifications.scheduleNotificationAsync({
            identifier: notificationId(habitId, entry.id),
            content,
            trigger: {
              type: SchedulableTriggerInputTypes.DAILY,
              hour: entry.hour,
              minute: entry.minute,
            },
          });
          break;

        case "week": {
          const days = entry.days ?? 0;
          for (let dow = 0; dow < 7; dow++) {
            if (days & (1 << dow)) {
              await Notifications.scheduleNotificationAsync({
                identifier: notificationId(habitId, entry.id, dow),
                content,
                trigger: {
                  type: SchedulableTriggerInputTypes.WEEKLY,
                  hour: entry.hour,
                  minute: entry.minute,
                  weekday: dow + 1,
                },
              });
            }
          }
          break;
        }

        case "month":
          await Notifications.scheduleNotificationAsync({
            identifier: notificationId(habitId, entry.id),
            content,
            trigger: {
              type: SchedulableTriggerInputTypes.MONTHLY,
              hour: entry.hour,
              minute: entry.minute,
              day: entry.dayOfMonth!,
            },
          });
          break;

        default:
          regularity satisfies never;
          throw new Error(`Unrecognised regularity: ${regularity}`);
      }
    }
  },
};
