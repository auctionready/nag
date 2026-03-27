import * as Notifications from "expo-notifications";

interface ScheduleEntry {
  hour: number;
  minute: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

function notificationId(habitId: number, index: number): string {
  return `habit-${habitId}-${index}`;
}

async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function cancelNotifications(habitId: number): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const prefix = `habit-${habitId}-`;
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith(prefix))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export async function syncNotifications(
  habitId: number,
  title: string,
  schedules: ScheduleEntry[],
  regularity: "day" | "week" | "month",
): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;

  await cancelNotifications(habitId);

  const { SchedulableTriggerInputTypes } = Notifications;

  for (const [i, entry] of schedules.entries()) {
    let trigger:
      | Notifications.DailyTriggerInput
      | Notifications.WeeklyTriggerInput
      | Notifications.MonthlyTriggerInput;

    if (regularity === "day") {
      trigger = {
        type: SchedulableTriggerInputTypes.DAILY,
        hour: entry.hour,
        minute: entry.minute,
      };
    } else if (regularity === "week") {
      // expo-notifications weekday: 1=Sunday, 2=Monday, etc.
      // our dayOfWeek: 0=Sunday, 1=Monday, etc.
      trigger = {
        type: SchedulableTriggerInputTypes.WEEKLY,
        hour: entry.hour,
        minute: entry.minute,
        weekday: entry.dayOfWeek! + 1,
      };
    } else {
      trigger = {
        type: SchedulableTriggerInputTypes.MONTHLY,
        hour: entry.hour,
        minute: entry.minute,
        day: entry.dayOfMonth!,
      };
    }

    await Notifications.scheduleNotificationAsync({
      identifier: notificationId(habitId, i),
      content: {
        title,
        body: `Time for ${title}`,
      },
      trigger,
    });
  }
}
