import * as Notifications from "expo-notifications";
import type { ConsolidatedNotificationScheduler } from "@nag/core";

// Refreshed once per sync cycle in cancelAllTime-slotNotifications so that
// scheduleTime-slotNotification doesn't hit the native permission API 60 times.
let permissionGranted = false;

export const expoConsolidatedScheduler: ConsolidatedNotificationScheduler = {
  cancelAllTimeSlotNotifications: async (): Promise<void> => {
    // Use getPermissionsAsync (check-only) so a background sync on startup
    // never triggers the iOS permission dialog. Request permissions through
    // requestPermissionsAsync at a user-initiated moment instead.
    const { status } = await Notifications.getPermissionsAsync();
    permissionGranted = status === "granted";

    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  scheduleTimeSlotNotification: async (params): Promise<void> => {
    if (!permissionGranted) return;

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
