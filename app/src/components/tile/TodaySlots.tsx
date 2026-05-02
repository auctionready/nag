import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { tokens } from "../theme";

// Slot dot states from the design's TodaySlots:
//   done    — ink fill (slot complete)
//   ahead   — orange fill (more done than expected — e.g. extras)
//   pending — empty + faint ring (upcoming slot)
//   behind  — empty + orange ring (slot's time passed, action overdue)
//   missed  — faint solid fill (gone, no recovery expected)
export type SlotDotState = "done" | "ahead" | "pending" | "behind" | "missed";

interface TodaySlotsProps {
  slots: SlotDotState[];
}

/**
 * Compact "today's progress" pip strip rendered above the week strip on
 * tiles whose habit has multiple slots in a day (multi-slot daily
 * frequency, or multiple scheduled times today).
 */
export const TodaySlots = ({ slots }: TodaySlotsProps) => {
  if (!slots.length) return null;
  const done = slots.filter((s) => s === "done" || s === "ahead").length;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>today</Text>
      <View style={styles.dots}>
        {slots.map((s, i) => (
          <Dot key={i} state={s} />
        ))}
      </View>
      <Text style={styles.count}>
        {done} / {slots.length}
      </Text>
    </View>
  );
};

const Dot = ({ state }: { state: SlotDotState }) => {
  const style: ViewStyle[] = [styles.dot];
  switch (state) {
    case "done":
      style.push(styles.dotDone);
      break;
    case "ahead":
      style.push(styles.dotAhead);
      break;
    case "pending":
      style.push(styles.dotPending);
      break;
    case "behind":
      style.push(styles.dotBehind);
      break;
    case "missed":
      style.push(styles.dotMissed);
      break;
  }
  return <View style={style} />;
};

const SIZE = 7;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: tokens.orange,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  count: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.3,
  },
  dot: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  dotDone: {
    backgroundColor: tokens.ink,
  },
  dotAhead: {
    backgroundColor: tokens.orange,
  },
  dotPending: {
    borderWidth: 1.2,
    borderColor: tokens.faint,
  },
  dotBehind: {
    borderWidth: 1.2,
    borderColor: tokens.orange,
  },
  dotMissed: {
    backgroundColor: tokens.faint,
  },
});
