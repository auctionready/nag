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

    await Notifications.scheduleNotificationAsync({
      identifier: params.identifier,
      content: {
        title: params.title,
        body: params.body,
        data: params.data,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: params.fireAt,
      },
    });
  },
};
