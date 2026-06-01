import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { tokens } from "../theme";

export type HabitStatus = "active" | "paused" | "archived";

export interface StatusBannerProps {
  status: HabitStatus;
  /** Tapped the inline "resume" action on a paused banner. */
  onResume: () => void;
  /** Tapped the inline "unarchive" action on an archived banner. */
  onUnarchive: () => void;
}

/**
 * Paused / archived indicator shown above the habit detail. Paused is a
 * soft orange card ("nags off, still on your board"); archived is a solid
 * ink card ("off your board, record kept"). Each carries an inline action
 * to flip back. Renders nothing for an active habit.
 */
export const StatusBanner = ({
  status,
  onResume,
  onUnarchive,
}: StatusBannerProps) => {
  if (status === "active") return null;
  const paused = status === "paused";

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.card, paused ? styles.cardPaused : styles.cardArchived]}
      >
        <View
          style={[
            styles.badge,
            paused ? styles.badgePaused : styles.badgeArchived,
          ]}
        >
          {paused ? (
            <Svg width={16} height={16} viewBox="0 0 16 16" fill={tokens.cream}>
              <Rect x={4.5} y={3} width={2.6} height={10} rx={1} />
              <Rect x={9} y={3} width={2.6} height={10} rx={1} />
            </Svg>
          ) : (
            <Svg width={17} height={17} viewBox="0 0 16 16" fill="none">
              <Rect
                x={2.5}
                y={3}
                width={11}
                height={3}
                rx={1}
                stroke={tokens.cream}
                strokeWidth={1.6}
              />
              <Path
                d="M3.5 6.5v6.5a1 1 0 001 1h7a1 1 0 001-1V6.5"
                stroke={tokens.cream}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M6.5 9h3"
                stroke={tokens.cream}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </View>

        <View style={styles.text}>
          <Text
            style={[
              styles.title,
              paused ? styles.titlePaused : styles.titleArchived,
            ]}
          >
            {paused ? "paused" : "archived"}
          </Text>
          <Text
            style={[styles.sub, paused ? styles.subPaused : styles.subArchived]}
          >
            {paused
              ? "nags off · still on your board"
              : "off your board · record kept"}
          </Text>
        </View>

        <Pressable
          onPress={paused ? onResume : onUnarchive}
          accessibilityRole="button"
          accessibilityLabel={paused ? "Resume" : "Unarchive"}
          style={({ pressed }) => [
            styles.action,
            paused ? styles.actionPaused : styles.actionArchived,
            pressed && styles.actionPressed,
          ]}
        >
          {paused ? (
            <Svg width={11} height={11} viewBox="0 0 12 12" fill={tokens.cream}>
              <Path d="M3.5 2.5v7l6-3.5z" />
            </Svg>
          ) : (
            <Svg width={11} height={11} viewBox="0 0 12 12" fill="none">
              <Path
                d="M6 9.5V3.5M3.5 6L6 3.5 8.5 6"
                stroke={tokens.cream}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
          <Text style={styles.actionText}>
            {paused ? "resume" : "unarchive"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardPaused: {
    backgroundColor: "rgba(255,90,54,0.10)",
    borderColor: "rgba(255,90,54,0.30)",
    shadowColor: tokens.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 2,
  },
  cardArchived: {
    backgroundColor: tokens.ink,
    borderColor: tokens.ink,
    shadowColor: tokens.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  badgePaused: {
    backgroundColor: tokens.orange,
  },
  badgeArchived: {
    backgroundColor: "rgba(255,248,240,0.16)",
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: "SpaceGrotesk-Bold",
    fontSize: 15.5,
    fontWeight: "700",
    letterSpacing: -0.16,
  },
  titlePaused: {
    color: tokens.orange,
  },
  titleArchived: {
    color: tokens.cream,
  },
  sub: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    letterSpacing: 0.4,
  },
  subPaused: {
    color: "#C2451F",
  },
  subArchived: {
    color: "rgba(255,248,240,0.62)",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  actionPaused: {
    backgroundColor: tokens.orange,
  },
  actionArchived: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,248,240,0.42)",
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionText: {
    fontFamily: "SpaceGrotesk-Bold",
    fontSize: 12.5,
    fontWeight: "700",
    color: tokens.cream,
    letterSpacing: -0.13,
  },
});
