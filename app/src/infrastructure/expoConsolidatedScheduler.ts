import * as Notifications from "expo-notifications";
import type { ConsolidatedNotificationScheduler } from "@nag/core";

// Set by requestPermissions; gates scheduleTimeSlotNotification so it doesn't
// hit the native permission API on every one of up to 60 calls per sync.
let permissionGranted = false;

export const expoConsolidatedScheduler: ConsolidatedNotificationScheduler = {
  requestPermissions: async (): Promise<boolean> => {
    const { status } = await Notifications.requestPermissionsAsync();
    permissionGranted = status === "granted";
    return permissionGranted;
  },

  cancelAllTimeSlotNotifications: async (): Promise<void> => {
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
        ...(params.badge !== undefined ? { badge: params.badge } : {}),
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: params.fireAt,
      },
    });
  },

  // Badge-only: no title/body/sound, just the icon badge. iOS applies
  // `content.badge` on delivery without (intended) presenting a banner.
  scheduleBadgeNotification: async (params): Promise<void> => {
    if (!permissionGranted) return;

    const { SchedulableTriggerInputTypes } = Notifications;

    await Notifications.scheduleNotificationAsync({
      identifier: params.identifier,
      content: { badge: params.badge },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: params.fireAt,
      },
    });
  },
};
