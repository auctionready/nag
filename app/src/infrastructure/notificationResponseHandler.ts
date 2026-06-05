import * as Notifications from "expo-notifications";
import { router, useRootNavigationState } from "expo-router";
import { format } from "date-fns";
import { useEffect, useRef } from "react";

const navigateFor = (response: Notifications.NotificationResponse): void => {
  const data = response.notification.request.content.data;
  if (!data?.habitIds || !Array.isArray(data.habitIds)) return;
  const today = format(new Date(), "yyyy-MM-dd");
  router.push(`/calendar?view=day&day=${today}`);
};

export const useNotificationResponseHandler = (): void => {
  const navState = useRootNavigationState();
  const navReady = !!navState?.key;
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!navReady || !lastResponse) return;
    const id = lastResponse.notification.request.identifier;
    if (handledRef.current === id) return;
    handledRef.current = id;
    navigateFor(lastResponse);
  }, [navReady, lastResponse]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handledRef.current = response.notification.request.identifier;
        navigateFor(response);
      },
    );
    return () => subscription.remove();
  }, []);
};
