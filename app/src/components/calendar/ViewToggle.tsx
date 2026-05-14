import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "../theme";

export type CalendarView = "month" | "week";

interface ViewToggleProps {
  view: CalendarView;
  onChange: (next: CalendarView) => void;
}

export const ViewToggle = ({ view, onChange }: ViewToggleProps) => (
  <View style={styles.track}>
    {(["month", "week"] as const).map((v) => {
      const active = v === view;
      return (
        <Pressable
          key={v}
          onPress={() => onChange(v)}
          style={[styles.item, active && styles.itemActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          accessibilityLabel={`${v} view`}
        >
          <Text style={[styles.label, active && styles.labelActive]}>{v}</Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: 3,
    gap: 2,
    borderRadius: 999,
    backgroundColor: tokens.veryFaint,
    alignSelf: "flex-start",
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  itemActive: {
    backgroundColor: tokens.ink,
  },
  label: {
    fontFamily: "JetBrainsMono",
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.mute,
  },
  labelActive: {
    color: tokens.cream,
  },
});
