import * as Notifications from "expo-notifications";
import { router } from "expo-router";

const handleResponse = (response: Notifications.NotificationResponse): void => {
  const data = response.notification.request.content.data;
  if (data?.habitIds && Array.isArray(data.habitIds)) {
    const ids = (data.habitIds as number[]).join(",");
    router.push(`/check-in-slot?habitIds=${ids}`);
  }
};

export const setupNotificationResponseHandler = (): (() => void) => {
  const subscription =
    Notifications.addNotificationResponseReceivedListener(handleResponse);

  // Handle cold-start: check if app was opened from a notification
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      handleResponse(response);
    }
  });

  return () => subscription.remove();
};
