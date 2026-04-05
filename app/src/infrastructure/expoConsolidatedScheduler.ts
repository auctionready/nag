import * as Notifications from "expo-notifications";
import type { ConsolidatedNotificationScheduler } from "@nag/core";

export const expoConsolidatedScheduler: ConsolidatedNotificationScheduler = {
  cancelAllSlotNotifications: async (): Promise<void> => {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter(
          (n) =>
            n.identifier.startsWith("slot-") ||
            n.identifier.startsWith("habit-"),
        )
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier),
        ),
    );
  },

  scheduleSlotNotification: async (params): Promise<void> => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;

    const { SchedulableTriggerInputTypes } = Notifications;

    if (params.trigger.regularity === "day") {
      await Notifications.scheduleNotificationAsync({
        identifier: params.identifier,
        content: {
          title: params.title,
          body: params.body,
          data: params.data,
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DAILY,
          hour: params.trigger.hour,
          minute: params.trigger.minute,
        },
      });
    } else if (params.trigger.regularity === "week") {
      await Notifications.scheduleNotificationAsync({
        identifier: params.identifier,
        content: {
          title: params.title,
          body: params.body,
          data: params.data,
        },
        trigger: {
          type: SchedulableTriggerInputTypes.WEEKLY,
          hour: params.trigger.hour,
          minute: params.trigger.minute,
          weekday: params.trigger.dow! + 1,
        },
      });
    } else {
      await Notifications.scheduleNotificationAsync({
        identifier: params.identifier,
        content: {
          title: params.title,
          body: params.body,
          data: params.data,
        },
        trigger: {
          type: SchedulableTriggerInputTypes.MONTHLY,
          hour: params.trigger.hour,
          minute: params.trigger.minute,
          day: params.trigger.dayOfMonth!,
        },
      });
    }
  },
};
