import { useState } from "react";
import { Animated, Dimensions, StyleSheet } from "react-native";

import { TaglineView } from "./TaglineView";
import { pickTagline } from "./taglines";

type SplashTaglineProps = {
  /** Driven by the splash entrance animation (0 -> 1). */
  fade: Animated.Value;
  /** Driven by the splash entrance animation (8 -> 0). */
  fadeY: Animated.Value;
};

/**
 * Picks a random tagline once on mount and displays it on the splash with
 * an entrance fade/slide driven by props from {@link AnimatedSplash}.
 *
 * Picking happens via {@link pickTagline}, which also records the choice so
 * {@link AboutTagline} can surface the same quote on the About screen.
 */
export const SplashTagline = ({ fade, fadeY }: SplashTaglineProps) => {
  const [tagline] = useState(pickTagline);
  return (
    <Animated.View
      style={[
        styles.wrap,
        { opacity: fade, transform: [{ translateY: fadeY }] },
      ]}
    >
      <TaglineView
        tagline={tagline}
        quoteStyle={styles.quote}
        attributionStyle={styles.attribution}
      />
    </Animated.View>
  );
};

const SCREEN = Dimensions.get("window");
const INK_SOFT = "#2A211B";

const styles = StyleSheet.create({
  wrap: {
    marginTop: 28,
    paddingHorizontal: 32,
    alignItems: "center",
    maxWidth: SCREEN.width,
  },
  quote: {
    fontSize: 14,
    color: INK_SOFT,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  attribution: {
    marginTop: 6,
    fontSize: 12,
    color: INK_SOFT,
    opacity: 0.7,
    letterSpacing: 0.5,
    textAlign: "center",
  },
});
