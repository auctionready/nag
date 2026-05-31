import { useLocalSearchParams, useRouter } from "expo-router";
import type { CalendarView } from "@nag/core";
import { CalendarScreen } from "../screens/CalendarScreen";

const CalendarRoute = () => {
  const { view: viewParam, day } = useLocalSearchParams<{
    view?: CalendarView;
    day?: string;
  }>();
  const router = useRouter();
  const view: CalendarView =
    viewParam === "week" ? "week" : viewParam === "month" ? "month" : "day";

  return (
    <CalendarScreen
      view={view}
      day={day}
      onChangeView={(next) => router.setParams({ view: next })}
      onChangeDay={(next) => router.setParams({ day: next })}
    />
  );
};

export default CalendarRoute;
