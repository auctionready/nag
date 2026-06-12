import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { CalendarView } from "@nag/core";
import { AppHeaderShell } from "../../components/shell";
import { CalendarScreen } from "../../screens/CalendarScreen";
import { tokens } from "../../components/theme";

const CalendarRoute = () => {
  const { view: viewParam, day } = useLocalSearchParams<{
    view?: CalendarView;
    day?: string;
  }>();
  const router = useRouter();
  const view: CalendarView =
    viewParam === "week" ? "week" : viewParam === "month" ? "month" : "day";

  return (
    <View style={styles.container}>
      <AppHeaderShell title="Calendar" />
      <CalendarScreen
        view={view}
        day={day}
        onChangeView={(next) => router.setParams({ view: next })}
        onChangeDay={(next) => router.setParams({ day: next })}
      />
    </View>
  );
};

export default CalendarRoute;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
});
