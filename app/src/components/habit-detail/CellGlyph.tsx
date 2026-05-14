import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { tokens } from "../../components/theme";

export type CellState =
  | "done"
  | "today-done"
  | "today"
  | "partial"
  | "today-partial"
  | "missed"
  | "future"
  | "unscheduled"
  | "skipped";

const PARTIAL_RATIO = 0.5;

/**
 * One day-cell on the detail screen's week strip — a 26×26 rounded
 * tile carrying the same `done · today · partial · missed · future ·
 * unscheduled · skipped` glyph language used elsewhere in the app
 * (e.g. home tile `DayIndicators`). `unscheduled` is calendar negative
 * space (no schedule today); `skipped` is a scheduled day the user
 * intentionally set aside — soft ink fill with a quiet cream dash,
 * reading closer to done than to missed.
 */
export const CellGlyph = ({ state }: { state: CellState }) => {
  const cellStyle: ViewStyle[] = [styles.cell];
  let inner: React.ReactNode = null;

  switch (state) {
    case "done":
      cellStyle.push(styles.cellInk);
      inner = <CheckMark />;
      break;
    case "today-done":
      cellStyle.push(styles.cellInk, styles.cellTodayRing);
      inner = <CheckMark />;
      break;
    case "today":
      cellStyle.push(styles.cellTodayRing);
      break;
    case "partial":
      cellStyle.push(styles.cellFaintRing);
      inner = <PartialFill ratio={PARTIAL_RATIO} />;
      break;
    case "today-partial":
      cellStyle.push(styles.cellTodayRing);
      inner = <PartialFill ratio={PARTIAL_RATIO} />;
      break;
    case "missed":
      cellStyle.push(styles.cellFaintRing);
      inner = <CellSlashGlyph />;
      break;
    case "future":
      cellStyle.push(styles.cellFaintRing);
      break;
    case "unscheduled":
      cellStyle.push(styles.cellUnscheduled);
      break;
    case "skipped":
      cellStyle.push(styles.cellSkipped);
      inner = <SkippedDash />;
      break;
  }

  return <View style={cellStyle}>{inner}</View>;
};

// Specialised inner glyphs — sized for the 26×26 cell viewport and
// tinted for the cream/ink palette on the detail strip. Kept local
// since they're not reused outside this cell.
const CheckMark = () => (
  <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
    <Path
      d="M2 5L4.2 7.2L8 3"
      stroke={tokens.cream}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const SkippedDash = () => (
  <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
    <Line
      x1={2}
      y1={5}
      x2={8}
      y2={5}
      stroke={tokens.cream}
      strokeWidth={1.6}
      strokeLinecap="round"
    />
  </Svg>
);

const CellSlashGlyph = () => (
  <Svg width="100%" height="100%" viewBox="0 0 22 22" fill="none">
    <Line
      x1={6}
      y1={16}
      x2={16}
      y2={6}
      stroke={tokens.mute}
      strokeWidth={1.4}
      strokeLinecap="round"
    />
  </Svg>
);

const PartialFill = ({ ratio }: { ratio: number }) => (
  <View
    style={[
      styles.partialFill,
      { height: `${Math.max(0, Math.min(1, ratio)) * 100}%` },
    ]}
  />
);

const styles = StyleSheet.create({
  cell: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  cellInk: {
    backgroundColor: tokens.ink,
  },
  cellTodayRing: {
    borderColor: tokens.orange,
  },
  cellFaintRing: {
    borderColor: tokens.faint,
  },
  cellUnscheduled: {
    backgroundColor: tokens.veryFaint,
  },
  cellSkipped: {
    backgroundColor: tokens.inkSkipped,
  },
  partialFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.ink,
  },
});
