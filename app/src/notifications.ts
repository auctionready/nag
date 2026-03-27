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

  for (const [i, entry] of schedules.entries()) {
    let trigger: Notifications.CalendarTriggerInput;

    if (regularity === "day") {
      trigger = {
        type: "calendar",
        hour: entry.hour,
        minute: entry.minute,
        repeats: true,
      };
    } else if (regularity === "week") {
      // expo-notifications weekday: 1=Sunday, 2=Monday, etc.
      // our dayOfWeek: 0=Sunday, 1=Monday, etc.
      trigger = {
        type: "calendar",
        hour: entry.hour,
        minute: entry.minute,
        weekday: entry.dayOfWeek! + 1,
        repeats: true,
      };
    } else {
      trigger = {
        type: "calendar",
        hour: entry.hour,
        minute: entry.minute,
        day: entry.dayOfMonth!,
        repeats: true,
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
